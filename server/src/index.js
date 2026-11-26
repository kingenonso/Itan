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
    if (p[0] === 'push') return env.ALERTS.get(env.ALERTS.idFromName('alerts')).fetch(req);
    if (p[0] !== 'rooms' || !ID.test(p[1] || '')) return json({ error: 'not found' }, 404);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(p[1]));
    return stub.fetch(req);
  },
  // every 3 hours: check the weather for every film with people waiting for alerts
  async scheduled(ev, env, ctx) { ctx.waitUntil(env.ALERTS.get(env.ALERTS.idFromName('alerts')).fetch('https://alerts/push/cron', { method: 'POST' })); }
};

/* ---------- Weather alerts on phones (Web Push) ----------
   A phone or computer that allows notifications sends its push address and the film's shoot days (date, place,
   whether there are exterior scenes). Every 3 hours this checks the forecast for the next 3 days and wakes the
   devices when there's a crisis: thunderstorms, flooding rain, dangerous wind or heat, or rain on an outdoor day.
   Pushes carry no data; the device then asks for its latest alerts. The signing keys are made here on first use. */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha = async s => b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).slice(0, 32);
const FILM = /^[A-Za-z0-9_-]{8,64}$/;
const WX = c => c >= 95 ? 'Thunderstorm' : c >= 80 ? 'Heavy showers' : c >= 61 ? 'Rain' : c >= 51 ? 'Drizzle' : 'Clouds';
export function crisisOf(day, j) {
  const h = j.hourly, dl = j.daily, out = [], hrs = h.time.map((t, i) => ({ h: +t.slice(11, 13), code: h.weather_code[i], gust: h.wind_gusts_10m[i] || 0, feels: h.apparent_temperature[i] })).filter(x => x.h >= 6 && x.h <= 21);
  const at = list => list.length ? ` around ${list[0].h % 12 || 12}${list[0].h < 12 ? 'am' : 'pm'}` : '';
  const storm = hrs.filter(x => x.code >= 95), mm = dl.precipitation_sum[0] || 0, gust = Math.max(0, ...hrs.map(x => x.gust)), hot = Math.max(-99, ...hrs.map(x => x.feels)), rain = dl.precipitation_probability_max[0] || 0;
  if (storm.length) out.push({ k: 'storm', lvl: 'crisis', text: `Thunderstorm expected${at(storm)}. Keep crew, lights and power away from open ground.` });
  if (mm >= 30) out.push({ k: 'flood', lvl: 'crisis', text: `Very heavy rain, about ${Math.round(mm)} mm. Roads may flood: plan travel and protect the gear.` });
  if (gust >= 60) out.push({ k: 'wind', lvl: 'crisis', text: `Dangerous wind, gusts to ${Math.round(gust)} km/h. Take down frames and tents, no drones.` });
  if (hot >= 42) out.push({ k: 'heat', lvl: 'crisis', text: `Extreme heat, feels like ${Math.round(hot)}°C. Shade, water and breaks for everyone.` });
  if (!out.length && day.ext && rain >= 60) out.push({ k: 'rain', lvl: 'warn', text: `${rain}% chance of rain with outdoor scenes. Get the cover set ready.` });
  return out;
}
export class Alerts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS subs (id TEXT, film TEXT, endpoint TEXT, t INTEGER, PRIMARY KEY (id, film));
      CREATE TABLE IF NOT EXISTS films (film TEXT PRIMARY KEY, title TEXT, days TEXT, checked INTEGER DEFAULT 0, sent TEXT DEFAULT '[]', t INTEGER);
      CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, film TEXT, t INTEGER, title TEXT, body TEXT, lvl TEXT, day TEXT);`);
  }
  kv(k, v) { if (v === undefined) { const r = this.sql.exec('SELECT v FROM kv WHERE k=?', k).toArray()[0]; return r ? r.v : null; } this.sql.exec('INSERT OR REPLACE INTO kv VALUES (?,?)', k, v); }
  async keys() {
    let pub = this.kv('pub'), priv = this.kv('priv');
    if (!pub) { const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey)); priv = JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey)); this.kv('pub', pub); this.kv('priv', priv); }
    return { pub, priv: await crypto.subtle.importKey('jwk', JSON.parse(priv), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']) };
  }
  async push(endpoint) {
    const { pub, priv } = await this.keys(), aud = new URL(endpoint).origin, enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
    const head = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://kingenonso.github.io/Itan/' });
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, new TextEncoder().encode(head));
    try { const r = await fetch(endpoint, { method: 'POST', headers: { Authorization: `vapid t=${head}.${b64u(sig)}, k=${pub}`, TTL: '86400', Urgency: 'high', 'Content-Length': '0' } });
      if (r.status === 404 || r.status === 410) this.sql.exec('DELETE FROM subs WHERE endpoint=?', endpoint); return r.status; } catch (e) { return 0; }
  }
  async tell(film, title, body, lvl, day) {
    this.sql.exec('INSERT INTO alerts (film, t, title, body, lvl, day) VALUES (?,?,?,?,?,?)', film, Date.now(), title, body, lvl, day || '');
    this.sql.exec('DELETE FROM alerts WHERE t < ?', Date.now() - 14 * 864e5);
    const eps = [...new Set(this.sql.exec('SELECT endpoint FROM subs WHERE film=?', film).toArray().map(r => r.endpoint))];
    let ok = 0; for (const ep of eps.slice(0, 40)) if (await this.push(ep) === 201) ok++;
    return { devices: eps.length, delivered: ok };
  }
  async check(f) {
    const days = JSON.parse(f.days || '[]'), today = new Date().toISOString().slice(0, 10), until = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const sent = new Set(JSON.parse(f.sent || '[]')); let n = 0;
    for (const day of days.filter(x => x.date >= today && x.date <= until && isFinite(x.lat) && isFinite(x.lon)).slice(0, 4)) {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${day.lat}&longitude=${day.lon}&hourly=weather_code,wind_gusts_10m,apparent_temperature&daily=precipitation_sum,precipitation_probability_max&timezone=auto&start_date=${day.date}&end_date=${day.date}`);
        if (!r.ok) continue;
        for (const a of crisisOf(day, await r.json())) { const key = `${day.date}:${a.k}`; if (sent.has(key)) continue; sent.add(key); n++;
          await this.tell(f.film, `${a.lvl === 'crisis' ? '⚠ Weather crisis' : '☂ Rain'}: ${day.label}`, `${f.title}. ${a.text}`, a.lvl, day.id); }
      } catch (e) {}
    }
    this.sql.exec('UPDATE films SET checked=?, sent=? WHERE film=?', Date.now(), JSON.stringify([...sent].slice(-200)), f.film);
    return n;
  }
  async fetch(req) {
    const url = new URL(req.url), what = url.pathname.split('/').filter(Boolean)[1] || '';
    const body = req.method === 'POST' ? await req.text() : '';
    if (body.length > 64 * 1024) return json({ error: 'too big' }, 413);
    let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) { return json({ error: 'bad request' }, 400); }
    if (what === 'key') return json({ key: (await this.keys()).pub });
    if (what === 'cron') {
      const films = this.sql.exec('SELECT f.* FROM films f WHERE EXISTS (SELECT 1 FROM subs s WHERE s.film=f.film) ORDER BY checked LIMIT 8').toArray();
      let n = 0; for (const f of films) n += await this.check(f);
      this.sql.exec('DELETE FROM films WHERE t < ? AND NOT EXISTS (SELECT 1 FROM subs s WHERE s.film=films.film)', Date.now() - 30 * 864e5);
      return json({ films: films.length, alerts: n });
    }
    if (what === 'latest') {
      const id = url.searchParams.get('id') || '', since = +url.searchParams.get('since') || Date.now() - 2 * 864e5;
      const films = this.sql.exec('SELECT film FROM subs WHERE id=?', id).toArray().map(r => r.film); if (!films.length) return json({ items: [] });
      return json({ items: this.sql.exec(`SELECT id, film, t, title, body, lvl, day FROM alerts WHERE t > ? AND film IN (${films.map(() => '?').join(',')}) ORDER BY t DESC LIMIT 5`, since, ...films).toArray() });
    }
    if (!FILM.test(b.film || '')) return json({ error: 'bad request' }, 400);
    if (what === 'sub') {
      let ep; try { ep = new URL(b.endpoint); } catch (e) { return json({ error: 'bad request' }, 400); }
      if (ep.protocol !== 'https:') return json({ error: 'bad request' }, 400);
      const id = await sha(b.endpoint), days = (Array.isArray(b.days) ? b.days : []).slice(0, 120).map(x => ({ id: String(x.id || '').slice(0, 40), date: String(x.date || '').slice(0, 10), lat: +x.lat, lon: +x.lon, ext: !!x.ext, label: String(x.label || '').slice(0, 60) }));
      this.sql.exec('INSERT OR REPLACE INTO subs VALUES (?,?,?,?)', id, b.film, b.endpoint, Date.now());
      const old = this.sql.exec('SELECT sent FROM films WHERE film=?', b.film).toArray()[0];
      this.sql.exec('INSERT OR REPLACE INTO films (film, title, days, checked, sent, t) VALUES (?,?,?,0,?,?)', b.film, String(b.title || 'Your film').slice(0, 80), JSON.stringify(days), old ? old.sent : '[]', Date.now());
      return json({ ok: true, id, devices: this.sql.exec('SELECT COUNT(DISTINCT id) AS n FROM subs WHERE film=?', b.film).toArray()[0].n });
    }
    if (what === 'unsub') { this.sql.exec('DELETE FROM subs WHERE film=? AND id=?', b.film, await sha(String(b.endpoint || ''))); return json({ ok: true }); }
    if (what === 'check') { const f = this.sql.exec('SELECT * FROM films WHERE film=?', b.film).toArray()[0]; return json({ alerts: f ? await this.check(f) : 0 }); }
    // someone on the team sends an alert to everyone following the film
    if (what === 'notify') {
      const last = +(this.kv('n:' + b.film) || 0); if (Date.now() - last < 60000) return json({ error: 'Wait a minute before sending another alert' }, 429);
      const text = String(b.text || '').trim().slice(0, 300); if (!text) return json({ error: 'bad request' }, 400);
      this.kv('n:' + b.film, String(Date.now()));
      return json(await this.tell(b.film, String(b.title || 'Message from set').slice(0, 80), text, b.lvl === 'crisis' ? 'crisis' : 'info', ''));
    }
    return json({ error: 'not found' }, 404);
  }
}

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
