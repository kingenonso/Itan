/* Itàn Live: lets several people work on the same board at the same time.
   - A room holds one shared board and everything under it.
   - People join with an invite link carrying an edit key or a view key.
   - Changes travel over a WebSocket; pictures, videos and voice notes are uploaded once and stored in chunks.
   Everything stays within Cloudflare's free plan (Durable Objects with SQLite storage). */
import { DurableObject } from 'cloudflare:workers';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Key,X-Type,Range' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const CHUNK = 1024 * 1024;            // 1 MB per stored piece (SQLite rows can hold up to 2 MB)
const MAX_FILE = 95 * 1024 * 1024;    // Workers accept uploads up to 100 MB on the free plan
const MAX_DOC = 512 * 1024;           // one board or card record
const GUEST_FILE = 60 * 1024 * 1024;  // a self-tape or headshot sent by someone outside the team
const GUEST_ROOM = 1536 * 1024 * 1024; // all guest uploads in one casting call

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
      CREATE TABLE IF NOT EXISTS chunks (id TEXT, n INTEGER, data BLOB, PRIMARY KEY (id, n));
      CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, body TEXT);`);
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
      // guests may upload files (casting self-tapes and headshots), within limits
      if (b.guestUpload) this.sql.exec('INSERT OR REPLACE INTO meta VALUES (?,?)', 'guestUpload', '1');
      this.sql.exec('INSERT OR REPLACE INTO meta VALUES (?,?)', 'created', String(Date.now()));
      return json({ ok: true });
    }
    const role = this.role(key);
    if (!role) return json({ error: 'This invite link isn’t valid any more' }, 403);

    if (what === 'check') return json({ role, title: this.meta('title') });

    // A page made for people outside the team (a client approving a cut, crew signing up for shoot days):
    // the owner posts what they should see; guests send back notes, approvals or sign-ups.
    if (what === 'form') {
      if (req.method === 'GET') return json({ form: JSON.parse(this.meta('form') || 'null'), title: this.meta('title') });
      if (req.method === 'POST') {
        if (role !== 'edit') return json({ error: 'view only' }, 403);
        const body = await req.text(); if (body.length > 64 * 1024) return json({ error: 'too big' }, 413);
        try { JSON.parse(body); } catch (e) { return json({ error: 'bad request' }, 400); }
        this.sql.exec('INSERT OR REPLACE INTO meta VALUES (?,?)', 'form', body); return json({ ok: true });
      }
    }
    if (what === 'feedback') {
      if (req.method === 'POST') {
        const body = await req.text(); if (body.length > 16 * 1024) return json({ error: 'too big' }, 413);
        let o; try { o = JSON.parse(body); } catch (e) { return json({ error: 'bad request' }, 400); }
        const n = this.sql.exec('SELECT COUNT(*) AS n FROM feedback').toArray()[0].n; if (n > 5000) return json({ error: 'full' }, 429);
        const t = Date.now(); this.sql.exec('INSERT INTO feedback (t, body) VALUES (?,?)', t, JSON.stringify(o));
        const id = this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id;
        this.broadcast({ type: 'feedback', id, t, body: o });
        return json({ ok: true, id });
      }
      if (req.method === 'GET') {
        if (role !== 'edit') return json({ error: 'only the owner can read this' }, 403);
        const after = +url.searchParams.get('after') || 0;
        return json({ items: this.sql.exec('SELECT id, t, body FROM feedback WHERE id > ? ORDER BY id LIMIT 1000', after).toArray().map(r => ({ id: r.id, t: r.t, body: JSON.parse(r.body) })) });
      }
    }

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
        // supports byte ranges, so a video can be skipped through without downloading all of it
        const sql = this.sql, size = m.size, rng = (req.headers.get('Range') || '').match(/bytes=(\d*)-(\d*)/);
        let start = 0, end = size - 1;
        if (rng) { if (rng[1] === '' && rng[2]) { start = Math.max(0, size - +rng[2]); } else { start = +rng[1] || 0; if (rng[2]) end = Math.min(size - 1, +rng[2]); } if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...CORS, 'Content-Range': `bytes */${size}` } }); }
        let n = Math.floor(start / CHUNK), pos = start;
        const body = new ReadableStream({ pull(c) {
          if (pos > end) return c.close();
          const r = sql.exec('SELECT data FROM chunks WHERE id=? AND n=?', id, n).toArray()[0]; if (!r) return c.close();
          const buf = new Uint8Array(r.data), from = pos - n * CHUNK, to = Math.min(buf.length, end - n * CHUNK + 1);
          c.enqueue(buf.subarray(from, to)); pos = n * CHUNK + to; n++; if (pos > end) c.close();
        } });
        const h = { ...CORS, 'Content-Type': m.type || 'application/octet-stream', 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable', 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges' };
        if (rng) h['Content-Range'] = `bytes ${start}-${end}/${size}`;
        return new Response(body, { status: rng ? 206 : 200, headers: h });
      }
      if (req.method === 'DELETE') {
        if (role !== 'edit') return json({ error: 'view only' }, 403);
        this.sql.exec('DELETE FROM chunks WHERE id=?', id); this.sql.exec('DELETE FROM media WHERE id=?', id); return json({ ok: true });
      }
      if (req.method === 'PUT') {
        const guest = role !== 'edit';
        if (guest && this.meta('guestUpload') !== '1') return json({ error: 'view only' }, 403);
        const replace = !guest && url.searchParams.get('replace') === '1';
        if (!replace && this.sql.exec('SELECT 1 FROM media WHERE id=? AND done=1', id).toArray().length) return json({ ok: true, had: true });
        const cap = guest ? GUEST_FILE : MAX_FILE;
        const len = +req.headers.get('Content-Length') || 0; if (len > cap) return json({ error: 'too big' }, 413);
        if (guest) { const used = this.sql.exec('SELECT COALESCE(SUM(size),0) AS n FROM media').toArray()[0].n; if (used + len > GUEST_ROOM) return json({ error: 'full' }, 507); }
        const buf = new Uint8Array(await req.arrayBuffer()); if (buf.length > cap) return json({ error: 'too big' }, 413);
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
