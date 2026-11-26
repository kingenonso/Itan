/* Itàn Live: lets several people work on the same board at the same time.
   - A room holds one shared board and everything under it.
   - People join with an invite link carrying an edit key or a view key.
   - Changes travel over a WebSocket; pictures, videos and voice notes are uploaded once and stored in chunks.
   Everything stays within Cloudflare's free plan (Durable Objects with SQLite storage). */
import { DurableObject } from 'cloudflare:workers';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Key,X-Type' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const CHUNK = 1024 * 1024;            // 1 MB per stored piece (SQLite rows can hold up to 2 MB)
const MAX_FILE = 95 * 1024 * 1024;    // Workers accept uploads up to 100 MB on the free plan
const MAX_DOC = 512 * 1024;           // one board or card record

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url), p = url.pathname.split('/').filter(Boolean);
    if (!p.length) return json({ ok: true, app: 'itan-live' });
    if (p[0] !== 'rooms' || !ID.test(p[1] || '')) return json({ error: 'not found' }, 404);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(p[1]));
    return stub.fetch(req);
  }
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS docs (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT, size INTEGER, parts INTEGER, done INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS chunks (id TEXT, n INTEGER, data BLOB, PRIMARY KEY (id, n));`);
  }
  meta(k) { const r = this.sql.exec('SELECT v FROM meta WHERE k=?', k).toArray()[0]; return r ? r.v : null; }
  role(key) { if (!key) return null; if (key === this.meta('edit')) return 'edit'; if (key === this.meta('view')) return 'view'; return null; }

  async fetch(req) {
    const url = new URL(req.url), p = url.pathname.split('/').filter(Boolean), what = p[2] || '';
    const key = req.headers.get('X-Key') || url.searchParams.get('key');

    // POST /rooms/:id/init  {edit, view, root}  — only once, by the person who shares the board
    if (what === 'init' && req.method === 'POST') {
      if (this.meta('edit')) return json({ error: 'This room already exists' }, 409);
      const b = await req.json().catch(() => ({}));
      if (!ID.test(b.edit || '') || !ID.test(b.view || '') || !ID.test(b.root || '')) return json({ error: 'bad request' }, 400);
      for (const k of ['edit', 'view', 'root', 'title']) this.sql.exec('INSERT OR REPLACE INTO meta VALUES (?,?)', k, String(b[k] || '').slice(0, 200));
      this.sql.exec('INSERT OR REPLACE INTO meta VALUES (?,?)', 'created', String(Date.now()));
      return json({ ok: true });
    }
    const role = this.role(key);
    if (!role) return json({ error: 'This invite link isn’t valid any more' }, 403);

    if (what === 'check') return json({ role, title: this.meta('title') });

    if (what === 'ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 426);
      const pair = new WebSocketPair(), [client, server] = Object.values(pair);
      const who = { id: crypto.randomUUID().slice(0, 8), role, name: (url.searchParams.get('name') || 'Someone').slice(0, 40), color: (url.searchParams.get('color') || '#4636ef').slice(0, 9), where: null };
      this.ctx.acceptWebSocket(server); server.serializeAttachment(who);
      const docs = this.sql.exec('SELECT k, v, t FROM docs').toArray().map(r => [r.k, JSON.parse(r.v), r.t]);
      const media = this.sql.exec('SELECT id FROM media WHERE done=1').toArray().map(r => r.id);
      server.send(JSON.stringify({ type: 'hello', you: who.id, role, root: this.meta('root'), title: this.meta('title'), docs, media, now: Date.now() }));
      this.presence();
      return new Response(null, { status: 101, webSocket: client });
    }

    if (what === 'media') {
      const id = p[3] || ''; if (!ID.test(id)) return json({ error: 'bad id' }, 400);
      if (req.method === 'GET') {
        const m = this.sql.exec('SELECT type, size, parts FROM media WHERE id=? AND done=1', id).toArray()[0];
        if (!m) return json({ error: 'not found' }, 404);
        const sql = this.sql;
        const body = new ReadableStream({ n: 0, pull(c) { const r = sql.exec('SELECT data FROM chunks WHERE id=? AND n=?', id, this.n++).toArray()[0]; if (!r) return c.close(); c.enqueue(new Uint8Array(r.data)); if (this.n >= m.parts) c.close(); } });
        return new Response(body, { headers: { ...CORS, 'Content-Type': m.type || 'application/octet-stream', 'Content-Length': String(m.size), 'Cache-Control': 'private, max-age=31536000, immutable' } });
      }
      if (req.method === 'PUT') {
        if (role !== 'edit') return json({ error: 'view only' }, 403);
        if (this.sql.exec('SELECT 1 FROM media WHERE id=? AND done=1', id).toArray().length) return json({ ok: true, had: true });
        const len = +req.headers.get('Content-Length') || 0; if (len > MAX_FILE) return json({ error: 'too big' }, 413);
        const buf = new Uint8Array(await req.arrayBuffer()); if (buf.length > MAX_FILE) return json({ error: 'too big' }, 413);
        const parts = Math.max(1, Math.ceil(buf.length / CHUNK));
        this.sql.exec('DELETE FROM chunks WHERE id=?', id);
        for (let n = 0; n < parts; n++) this.sql.exec('INSERT INTO chunks VALUES (?,?,?)', id, n, buf.subarray(n * CHUNK, (n + 1) * CHUNK));
        this.sql.exec('INSERT OR REPLACE INTO media VALUES (?,?,?,?,1)', id, (req.headers.get('X-Type') || '').slice(0, 100), buf.length, parts);
        this.broadcast({ type: 'media', id });
        return json({ ok: true });
      }
    }
    return json({ error: 'not found' }, 404);
  }

  async webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const who = ws.deserializeAttachment() || {};
    if (m.type === 'put' && Array.isArray(m.changes)) {
      if (who.role !== 'edit') return ws.send(JSON.stringify({ type: 'denied' }));
      const out = [], t = Date.now();
      for (const [k, v] of m.changes.slice(0, 500)) {
        if (typeof k !== 'string' || !/^[bc]:[A-Za-z0-9_-]{1,64}$/.test(k)) continue;
        if (v === null) this.sql.exec('DELETE FROM docs WHERE k=?', k);
        else { const s = JSON.stringify(v); if (s.length > MAX_DOC) continue; this.sql.exec('INSERT OR REPLACE INTO docs VALUES (?,?,?)', k, s, t); }
        out.push([k, v, t]);
      }
      if (out.length) this.broadcast({ type: 'put', changes: out, by: who.id }, ws);
      ws.send(JSON.stringify({ type: 'ack', n: m.n, t }));
    } else if (m.type === 'where') {
      who.where = typeof m.board === 'string' ? m.board.slice(0, 64) : null; ws.serializeAttachment(who); this.presence();
    } else if (m.type === 'ping') ws.send('{"type":"pong"}');
  }
  webSocketClose(ws) { try { ws.close(); } catch (e) {} this.presence(ws); }
  webSocketError(ws) { this.presence(ws); }
  broadcast(msg, except) { const s = JSON.stringify(msg); for (const w of this.ctx.getWebSockets()) if (w !== except) { try { w.send(s); } catch (e) {} } }
  presence(gone) {
    const people = this.ctx.getWebSockets().filter(w => w !== gone && w.readyState === 1).map(w => w.deserializeAttachment()).filter(Boolean).map(({ id, name, color, role, where }) => ({ id, name, color, role, where }));
    this.broadcast({ type: 'people', people }, gone);
  }
}
