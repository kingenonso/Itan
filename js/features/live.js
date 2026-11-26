/* Live teamwork: share a board (and everything inside it) so several people work on it at the same time.
   The person sharing gets two invite links: one to edit, one to only view.
   Changes go through the free Itàn Live server (server/ folder, on Cloudflare) and arrive for everyone within a second.
   Each person still keeps a full copy on their own device, so it keeps working offline and catches up when back online. */
(function () {
  const N = window.N, esc = N.esc, Store = N.Store, $ = N.$;
  const API = (window.APP_CONFIG && window.APP_CONFIG.live) || '';
  const WEB = (window.APP_CONFIG && window.APP_CONFIG.web) || 'https://kingenonso.github.io/Itan/';
  const COLORS = ['#4636ef', '#ff5a3c', '#36a86d', '#e0508f', '#f39a1e', '#2a9ec4', '#8f5ae8', '#d14b4b'];
  const MAX_UPLOAD = 95 * 1024 * 1024;
  const key = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join('');

  let me = null, rooms = [];               // rooms: [{room, key, role, root, parent, title, outbox:{k:1}}]
  const live = new Map();                  // room id -> connection state
  const live$ = N.live = { rooms: () => rooms, conn: id => live.get(id), me: () => me, askName: () => askName(), people: () => [...live.values()].flatMap(c => c.people) };

  /* ---------- which board belongs to which room ---------- */
  const parentOf = id => { const b = N.S.boards[id]; if (b) return b.parent; const d = N.P.remote.get('b:' + id); return d ? d.parent : null; };
  function roomOfBoard(id) {
    let g = 0;
    while (id && g++ < 80) { const r = rooms.find(x => x.root === id); if (r) return r; id = parentOf(id); }
    return null;
  }
  function roomOfKey(k, v) {
    const id = k[0] === 'b' ? k.slice(2) : (v || N.P.remote.get(k) || {})._b;
    return id ? roomOfBoard(id) : null;
  }
  const mediaOf = (k, v) => { if (!v) return []; const out = []; if (k[0] === 'c') { if (v.media) out.push(v.media); if (v.frame) out.push(v.frame); } else { if (v.voice) out.push(v.voice); const w = v.extra && v.extra.walk; if (w && w.media) out.push(w.media); } return out; };
  // the shared board's place on each person's own home board isn't shared
  const outgoing = (r, k, v) => (v && k === 'b:' + r.root) ? { ...v, parent: null } : v;
  const incoming = (r, k, v) => (v && k === 'b:' + r.root) ? { ...v, parent: r.parent || 'home' } : v;
  function roomKeys(r) { const out = []; for (const [k, v] of N.P.remote) if (roomOfKey(k, v) === r) out.push(k); return out; }

  let saveT; const saveRooms = () => { clearTimeout(saveT); saveT = setTimeout(() => Store.setKV('liveRooms', rooms).catch(() => {}), 300); };

  /* ---------- the connection ---------- */
  function connect(r) {
    if (!API) return;
    let c = live.get(r.room);
    if (c && c.ws && c.ws.readyState < 2) return;
    if (!c) { c = { r, server: new Map(), media: new Set(), people: [], open: false, tries: 0, n: 0, sending: new Map() }; live.set(r.room, c); }
    const u = API.replace(/^http/, 'ws') + `/rooms/${r.room}/ws?key=${encodeURIComponent(r.key)}&name=${encodeURIComponent(me.name)}&color=${encodeURIComponent(me.color)}`;
    let ws; try { ws = new WebSocket(u); } catch (e) { return retry(c); }
    c.ws = ws;
    ws.onopen = () => { c.tries = 0; };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } handle(c, m); };
    ws.onclose = ev => { c.open = false; c.people = []; c.sending.clear(); N.requestRender(); if (ev.code === 1008 || c.denied) return; retry(c); };
    ws.onerror = () => {};
    clearInterval(c.ping); c.ping = setInterval(() => { if (c.open) ws.send('{"type":"ping"}'); }, 50000);
  }
  function retry(c) {
    if (!rooms.includes(c.r)) return;
    clearTimeout(c.rt); c.rt = setTimeout(() => connect(c.r), Math.min(30000, 1000 * Math.pow(2, c.tries++)));
  }
  window.addEventListener('online', () => live.forEach(c => { if (!c.open) connect(c.r); }));

  async function handle(c, m) {
    const r = c.r;
    if (m.type === 'hello') {
      c.open = true; c.role = r.role = m.role; c.you = m.you; if (m.title) r.title = m.title;
      if (!r.root) { r.root = m.root; r.parent = 'home'; }
      c.server = new Map(m.docs.map(([k, v]) => [k, v])); c.media = new Set(m.media);
      // bring in what changed while we were away; our own unsent changes win
      const changes = [];
      for (const [k, v] of c.server) { if (r.outbox[k]) continue; const mine = N.P.remote.get(k), want = incoming(r, k, v); if (!mine || JSON.stringify(mine) !== JSON.stringify(want)) changes.push([k, want]); }
      if (r.joined) for (const k of roomKeys(r)) if (!c.server.has(k) && !r.outbox[k]) changes.push([k, null]);
      // a brand-new device keeps its starter boards only in memory until the first change: save them first
      if (!N.P.remote.has('b:home') && N.S.boards.home) { N.touch(); N.flushNow(); }
      if (changes.length) await Store.inject(changes);
      if (!r.joined) { r.joined = Date.now(); if (r.mount) { delete r.mount; await mount(r); } }
      if (m.role === 'view' && Object.keys(r.outbox).length) revert(c, Object.keys(r.outbox));
      saveRooms(); flush(c); syncMedia(c);
      if (c.onHello) { c.onHello(m); c.onHello = null; }
      sendWhere(); N.requestRender();
    } else if (m.type === 'put') {
      const changes = [];
      m.changes.forEach(([k, v]) => { if (v === null) c.server.delete(k); else c.server.set(k, v); if (!r.outbox[k]) changes.push([k, incoming(r, k, v)]); });
      if (changes.length) { await Store.inject(changes); changes.forEach(([k, v]) => mediaOf(k, v).forEach(id => fetchMedia(c, id))); }
    } else if (m.type === 'ack') {
      const sent = c.sending.get(m.n); c.sending.delete(m.n);
      if (sent) { sent.forEach(i => { if (r.outbox[i.k] === i.s) delete r.outbox[i.k]; if (i.v === null) c.server.delete(i.k); else c.server.set(i.k, i.v); }); saveRooms(); flush(c); }
    } else if (m.type === 'people') { c.people = m.people.filter(p => p.id !== c.you); N.requestRender(); }
    else if (m.type === 'media') { c.media.add(m.id); const used = [...N.P.remote].some(([k, v]) => roomOfKey(k, v) === r && mediaOf(k, v).includes(m.id)); if (used) fetchMedia(c, m.id); }
    else if (m.type === 'denied') { revert(c, Object.keys(r.outbox)); }
  }

  // send waiting changes in batches; each item remembers which local version it carried
  function flush(c) {
    const r = c.r; if (!c.open || c.role !== 'edit') return;
    const inflight = new Set(); c.sending.forEach(items => items.forEach(i => inflight.add(i.k)));
    const keys = Object.keys(r.outbox).filter(k => !inflight.has(k));
    for (let i = 0; i < keys.length; i += 200) {
      const items = keys.slice(i, i + 200).map(k => ({ k, v: outgoing(r, k, N.P.remote.has(k) ? N.P.remote.get(k) : null), s: r.outbox[k] }));
      const n = ++c.n; c.sending.set(n, items);
      c.ws.send(JSON.stringify({ type: 'put', n, changes: items.map(x => [x.k, x.v]) }));
    }
  }
  // view-only: put back the shared version
  async function revert(c, keys) {
    const r = c.r, changes = keys.map(k => [k, c.server.has(k) ? incoming(r, k, c.server.get(k)) : null]);
    keys.forEach(k => delete r.outbox[k]); saveRooms();
    if (changes.length) { await Store.inject(changes); N.toast('You can view this board but not change it. Ask the owner for the edit link.'); }
  }

  /* ---------- pictures, videos and voice notes ---------- */
  const uploading = new Set(), fetching = new Set();
  async function syncMedia(c) {
    const r = c.r, ids = new Set();
    for (const [k, v] of N.P.remote) if (roomOfKey(k, v) === r) mediaOf(k, v).forEach(id => ids.add(id));
    for (const id of ids) { if (c.media.has(id)) { if (!(await Store.hasMedia(id).catch(() => true))) fetchMedia(c, id); } else if (c.role === 'edit') upload(c, id); }
  }
  async function upload(c, id) {
    if (uploading.has(id) || c.media.has(id)) return; const blob = await Store.getMedia(id).catch(() => null); if (!blob) return;
    if (blob.size > MAX_UPLOAD) { if (!c.bigWarned) { c.bigWarned = true; N.toast('A video over 95 MB stays on your device only. Teammates see a placeholder. Share a smaller export or a link.'); } return; }
    uploading.add(id); N.status('Uploading for your team…');
    try { const res = await fetch(`${API}/rooms/${c.r.room}/media/${id}`, { method: 'PUT', headers: { 'X-Key': c.r.key, 'X-Type': blob.type || '' }, body: blob }); if (res.ok) c.media.add(id); }
    catch (e) {} finally { uploading.delete(id); N.settled(); }
  }
  async function fetchMedia(c, id) {
    if (fetching.has(id) || !c.media.has(id)) return; if (await Store.hasMedia(id).catch(() => false)) return;
    fetching.add(id);
    try { const res = await fetch(`${API}/rooms/${c.r.room}/media/${id}`, { headers: { 'X-Key': c.r.key } }); if (res.ok) { await Store.putMediaAs(id, await res.blob()); N.render(); } }
    catch (e) {} finally { fetching.delete(id); }
  }

  /* ---------- this device's own changes ---------- */
  let pendingTap = new Set(), tapT;
  Store.onWrite(changes => {
    changes.forEach(([k, v]) => {
      const r = roomOfKey(k, v); if (!r) return;
      r.outbox[k] = Date.now() + Math.random(); pendingTap.add(r.room);
      mediaOf(k, v).forEach(id => { const c = live.get(r.room); if (c && c.open && c.role === 'edit') upload(c, id); });
    });
    clearTimeout(tapT); tapT = setTimeout(() => { saveRooms(); pendingTap.forEach(id => { const c = live.get(id); if (!c) return; if (c.open && c.role === 'view') revert(c, Object.keys(c.r.outbox)); else flush(c); }); pendingTap.clear(); }, 60);
  });

  /* ---------- presence ---------- */
  let lastWhere = null;
  function sendWhere() {
    const cur = N.S.cur, r = roomOfBoard(cur);
    live.forEach(c => { if (!c.open) return; const w = c.r === r ? cur : null; if (c.lastWhere === w) return; c.lastWhere = w; c.ws.send(JSON.stringify({ type: 'where', board: w })); });
  }
  N.hooks.render.push(() => { if (N.S.cur !== lastWhere) { lastWhere = N.S.cur; sendWhere(); } const r = roomOfBoard(N.S.cur); document.body.classList.toggle('lv-view', !!r && r.role === 'view'); });
  const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  N.hooks.tools.unshift(b => {
    if (!API || b.id === 'home') return '';
    const r = roomOfBoard(b.id), c = r && live.get(r.room);
    if (!r) return `<button class="ib" id="lvGo" title="Work on this board with other people at the same time">${PEOPLE}<span class="hide-s">Live</span></button>`;
    const here = c ? c.people.filter(p => p.where === b.id) : [], away = c ? c.people.filter(p => p.where !== b.id) : [];
    return `<button class="ib lv-on${c && c.open ? '' : ' off'}" id="lvGo" title="${c && c.open ? `Live with ${c.people.length} other${c.people.length === 1 ? '' : 's'}${r.role === 'view' ? ' · view only' : ''}` : 'Connecting to your team…'}">
      <span class="lv-dot"></span>${here.concat(away).slice(0, 4).map(p => `<span class="lv-face${p.where === b.id ? '' : ' away'}" style="--c:${esc(p.color)}" title="${esc(p.name)}${p.where === b.id ? ' is on this board' : ''}">${esc(initials(p.name))}</span>`).join('')}
      ${c && c.people.length > 4 ? `<span class="lv-more">+${c.people.length - 4}</span>` : ''}<span class="hide-s">${r.role === 'view' ? 'Viewing' : 'Live'}</span></button>`;
  });
  $('#btools').addEventListener('click', e => { if (e.target.closest('#lvGo')) panel(); });
  const PEOPLE = '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c2.4.1 4.3 1.6 4.9 4.8"/></svg>';

  /* ---------- who am I ---------- */
  async function askName() {
    if (me && me.name) return me;
    return new Promise(res => {
      const m = N.modal(`<h2>What should your team call you?</h2><p>Your name shows next to the boards you’re working on.</p><label>Your name<input id="lvName" maxlength="40" autocomplete="name" placeholder="Eze"></label><div class="row"><button class="pri" id="lvOk">Continue</button><button data-close>Cancel</button></div>`);
      const go = () => { const n = m.querySelector('#lvName').value.trim(); if (!n) return m.querySelector('#lvName').focus(); me = { name: n, color: COLORS[Math.floor(Math.random() * COLORS.length)] }; Store.setKV('liveMe', me).catch(() => {}); N.closeOv(); res(me); };
      m.querySelector('#lvOk').onclick = go; m.querySelector('#lvName').onkeydown = e => { if (e.key === 'Enter') go(); };
      m.querySelector('[data-close]').onclick = () => { N.closeOv(); res(null); };
      setTimeout(() => m.querySelector('#lvName').focus(), 50);
    });
  }

  /* ---------- sharing and joining ---------- */
  const linkFor = (r, k) => (/^https?:/.test(location.protocol) && !/localhost|127\.0\.0\.1|tauri/.test(location.host) ? location.origin + location.pathname : WEB) + `#join=${r.room}.${k}`;
  async function start(boardId) {
    if (!(await askName())) return;
    const film = N.film && N.film.root(boardId), root = film ? film.id : boardId, b = N.S.boards[root];
    if (!navigator.onLine) return N.toast('Working together needs internet');
    const r = { room: key().slice(0, 16), key: key(), view: key(), role: 'edit', root, parent: b.parent || 'home', title: b.title || 'Untitled board', outbox: {}, joined: Date.now(), owner: true };
    N.status('Setting up…');
    try { const res = await fetch(`${API}/rooms/${r.room}/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edit: r.key, view: r.view, root, title: r.title }) }); if (!res.ok) throw new Error(); }
    catch (e) { N.settled(); return N.toast('Couldn’t reach the Itàn Live server. Check your internet and try again.'); }
    N.settled(); N.flushNow();
    rooms.push(r); roomKeys(r).forEach(k => r.outbox[k] = 1); saveRooms(); connect(r); N.render();
    panel();
  }
  async function mount(r) {
    // put a card for the shared board on this person's home board
    if (Object.values(N.S.boards).some(b => b.cards.some(c => c.type === 'board' && c.board === r.root))) return;
    const home = N.S.boards.home; if (!home) return;
    const maxX = home.cards.reduce((x, c) => Math.max(x, (+c.x || 0) + (+c.w || 0)), 0);
    const id = N.uid(); await Store.inject([['c:' + id, { id, type: 'board', board: r.root, x: maxX + 40, y: 40, w: 190, text: '', o: home.cards.length, _b: 'home' }]]);
  }
  async function join(room, k) {
    if (rooms.some(r => r.room === room)) { const r = rooms.find(x => x.room === room); return N.show(r.root); }
    if (!(await askName())) return;
    const r = { room, key: k, role: null, root: null, parent: 'home', title: '', outbox: {}, mount: true };
    rooms.push(r); N.status('Joining…');
    const c = { r, server: new Map(), media: new Set(), people: [], open: false, tries: 0, n: 0, sending: new Map() }; live.set(room, c);
    const timer = setTimeout(() => { if (!c.open) { N.settled(); N.toast('Still connecting. Your board appears as soon as it’s reached.'); } }, 12000);
    c.onHello = m => { clearTimeout(timer); N.settled(); setTimeout(() => { N.show(r.root); N.toast(m.role === 'edit' ? `You joined “${r.title}”. Changes you make show up for everyone.` : `You’re viewing “${r.title}”. Ask the owner for the edit link to make changes.`); }, 250); };
    // a link that no longer works
    fetch(`${API}/rooms/${room}/check`, { headers: { 'X-Key': k } }).then(res => { if (res.status === 403) { clearTimeout(timer); N.settled(); c.denied = true; rooms = rooms.filter(x => x !== r); live.delete(room); saveRooms(); try { c.ws.close(); } catch (e) {} N.toast('This invite link isn’t valid any more. Ask for a new one.'); } }).catch(() => {});
    connect(r);
  }
  function leave(r) {
    const c = live.get(r.room); if (c) { c.denied = true; clearInterval(c.ping); clearTimeout(c.rt); try { c.ws.close(); } catch (e) {} live.delete(r.room); }
    rooms = rooms.filter(x => x !== r); saveRooms(); N.render();
    N.toast(r.owner ? 'Stopped sharing on this device. Your boards stay here.' : 'You left. Your copy of the board stays on this device.');
  }

  function panel() {
    const r = roomOfBoard(N.S.cur);
    if (!r) {
      const film = N.film && N.film.root(N.S.cur), root = film ? film : N.B();
      const m = N.modal(`<h2>Work together live</h2><p>Share “${esc(root.title || 'Untitled board')}” and everything inside it. Everyone you invite sees changes as they happen, from their phone or computer. It’s free.</p>
        <p>You’ll get two links: one lets people edit, the other only lets them look. Pictures and videos are uploaded once so your team can see them. Videos over 95 MB stay on your device.</p>
        <div class="row"><button class="pri" id="lvStart">Start working together</button><button data-close>Cancel</button></div>`);
      m.querySelector('[data-close]').onclick = N.closeOv;
      m.querySelector('#lvStart').onclick = () => { N.closeOv(); start(root.id); };
      return;
    }
    const c = live.get(r.room), others = c ? c.people : [];
    const linkRow = (label, k, hint) => `<div class="lv-link"><div><b>${label}</b><small>${hint}</small></div><input readonly value="${esc(linkFor(r, k))}" aria-label="${label}"><button class="ib" data-copy="${esc(linkFor(r, k))}">Copy</button><a class="ib" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`Join “${r.title}” on Itàn: ${linkFor(r, k)}`)}">WhatsApp</a></div>`;
    const m = N.modal(`<h2>${esc(r.title || 'Shared board')}</h2><p>${c && c.open ? (others.length ? `${others.length} other${others.length === 1 ? ' person is' : ' people are'} here now.` : 'You’re the only one here right now.') : 'Connecting… your changes are kept and sent when you’re back online.'}${r.role === 'view' ? ' You can view this board but not change it.' : ''}</p>
      ${others.length ? `<ul class="lv-people">${others.map(p => `<li><span class="lv-face" style="--c:${esc(p.color)}">${esc(initials(p.name))}</span>${esc(p.name)}<small>${p.role === 'view' ? 'viewing' : 'editing'}${p.where && N.S.boards[p.where] ? ' · on “' + esc(N.S.boards[p.where].title || 'Untitled') + '”' : ''}</small></li>`).join('')}</ul>` : ''}
      ${r.owner ? linkRow('Edit link', r.key, 'Can add and change things') + linkRow('View link', r.view, 'Can look but not change') : r.role === 'edit' ? linkRow('Invite link', r.key, 'Anyone with it can edit') : ''}
      <p class="fine">Anyone with a link can open the board, so only send it to your team.</p>
      <div class="row"><button class="pri" data-close>Done</button><button id="lvLeave">${r.owner ? 'Stop sharing on this device' : 'Leave'}</button></div>`);
    m.classList.add('wide');
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#lvLeave').onclick = async () => { N.closeOv(); if (await N.confirmBox(r.owner ? 'Stop sending your changes to the team from this device? People who joined keep their copy.' : 'Leave this board? You keep your copy, but stop getting changes.', r.owner ? 'Stop' : 'Leave')) leave(r); };
    m.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); N.toast('Link copied'); } catch (e) { b.previousElementSibling.select(); document.execCommand('copy'); N.toast('Link copied'); } });
  }

  /* ---------- start up ---------- */
  N.hooks.ready.push(async () => {
    if (!API) return;
    // read an invite link straight away, before anything else can change the address
    const h = location.hash.match(/^#join=([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{8,64})$/);
    if (h) { live$.joining = true; history.replaceState(null, '', location.pathname + location.search); }
    me = await Store.getKV('liveMe').catch(() => null) || null;
    rooms = (await Store.getKV('liveRooms').catch(() => null)) || [];
    rooms.forEach(r => { r.outbox = r.outbox || {}; delete r.mount; connect(r); });
    if (h) join(h[1], h[2]);
  });
  window.addEventListener('hashchange', () => { const h = location.hash.match(/^#join=([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{8,64})$/); if (h) { history.replaceState(null, '', location.pathname + location.search); join(h[1], h[2]); } });
})();
