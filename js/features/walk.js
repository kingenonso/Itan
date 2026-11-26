/* Walkthroughs: record your voice while you move around a board and click cards.
   Playback replays the camera moves and highlights each card in time with your voice.
   Present mode: a slideshow that glides from card to card in reading order. */
(function () {
  const N = window.N, $ = N.$, esc = N.esc, S = N.S;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  let tween = 0;
  function animateView(to, ms = 650) {
    const v = N.V(), from = { ...v }; cancelAnimationFrame(tween);
    if (calm()) { Object.assign(v, to); N.applyView(); N.linksSoon(); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = ease(k);
      v.x = from.x + (to.x - from.x) * e; v.y = from.y + (to.y - from.y) * e; v.z = from.z + (to.z - from.z) * e;
      N.applyView(); N.linksSoon(); if (k < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }
  function viewFor(rect, pad = 90, maxZ = 2) {
    const W = innerWidth, H = innerHeight, top = 70, bot = 110, ah = H - top - bot;
    const z = Math.max(.2, Math.min(maxZ, (W - pad * 2) / rect.w, (ah - pad) / rect.h));
    return { z, x: W / 2 - (rect.x + rect.w / 2) * z, y: top + ah / 2 - (rect.y + rect.h / 2) * z };
  }
  function spotlight(id) {
    N.world.querySelectorAll('.card.spot').forEach(e => e.classList.remove('spot'));
    N.world.classList.toggle('spotlight', !!id);
    if (id) { const e = N.el(id); if (e) e.classList.add('spot'); }
  }

  /* ---------- top-bar buttons ---------- */
  const tools = $('#btools');
  function bar(b) {
    const w = b.extra && b.extra.walk, playing = player && player.board === b.id;
    let h = '';
    if (w && w.media) h += `<button class="ib wt on" id="wPlay" title="Play the walkthrough of this board"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg><span class="hide-s">Walkthrough · ${fmt(w.len || 0)}</span></button>` + (N.P.canWrite ? `<button class="ib" id="wMore" aria-label="Walkthrough options">⋯</button>` : '');
    else if (N.P.canWrite) h += `<button class="ib" id="wRec" title="Record a walkthrough: talk while you move around the board"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3" class="fillme"/></svg><span class="hide-s">Walkthrough</span></button>`;
    h += `<button class="ib" id="pStart" title="Present this board as a slideshow (P)"><svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M12 16.5v3M8.5 20h7"/></svg><span class="hide-s">Present</span></button>`;
    tools.dataset.walk = h;
  }
  // The board-tools island is assembled from several features; each contributes a slice.
  N.hooks.tools = N.hooks.tools || [];
  N.hooks.tools.push(b => { bar(b); return tools.dataset.walk; });

  tools.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'wRec') record();
    else if (t.id === 'wPlay') play();
    else if (t.id === 'pStart') present();
    else if (t.id === 'wMore') {
      const b = N.B();
      const m = N.modal(`<h2>Walkthrough</h2><p>A recording of you talking through “${esc(b.title || 'this board')}” while the screen moves with you. It travels with the board when you share it.</p><div class="row"><button class="pri" id="wNew">Record again</button><button id="wDel">Remove</button><button data-close>Close</button></div>`);
      m.querySelector('[data-close]').onclick = N.closeOv;
      m.querySelector('#wNew').onclick = () => { N.closeOv(); record(); };
      m.querySelector('#wDel').onclick = () => { N.closeOv(); N.snap(); delete b.extra.walk; N.touch(); N.render(); N.toast('Walkthrough removed. Ctrl+Z brings it back.'); };
    }
  });

  /* ---------- recording ---------- */
  let rec = null;
  async function record() {
    if (rec || !N.P.canWrite) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) return N.toast('This browser can’t record audio. Try Chrome, Edge, Firefox or Safari.');
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return N.toast('Microphone access was blocked. Allow it in the browser’s address bar and try again.'); }
    const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
    const mime = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const t0 = performance.now(), board = S.cur, track = { W: innerWidth, H: innerHeight, v: [], c: [] };
    const sample = () => { const v = N.V(), t = Math.round(performance.now() - t0), last = track.v[track.v.length - 1];
      if (!last || Math.abs(last[1] - v.x) > .5 || Math.abs(last[2] - v.y) > .5 || Math.abs(last[3] - v.z) > .002) track.v.push([t, +v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(4)]); };
    sample();
    const onCard = e => { const c = e.target.closest('.card'); if (c) track.c.push([Math.round(performance.now() - t0), c.dataset.id]); };
    N.canvas.addEventListener('pointerdown', onCard, true);
    const iv = setInterval(sample, 100);
    const ui = document.createElement('div'); ui.id = 'recbar';
    ui.innerHTML = `<span class="recdot"></span><b id="rbT">0:00</b><span class="hide-s">Talk while you move around and click cards</span><button class="pri" id="rbStop">Stop and save</button><button class="ib" id="rbCancel">Cancel</button>`;
    document.body.append(ui); document.body.classList.add('recording');
    const tick = setInterval(() => { ui.querySelector('#rbT').textContent = fmt((performance.now() - t0) / 1000); }, 250);
    let keep = true;
    const stop = save => {
      if (!rec) return; keep = save; rec = null;
      clearInterval(iv); clearInterval(tick); N.canvas.removeEventListener('pointerdown', onCard, true);
      if (mr.state !== 'inactive') mr.stop(); stream.getTracks().forEach(t => t.stop());
      ui.remove(); document.body.classList.remove('recording');
    };
    rec = { stop, board };
    ui.querySelector('#rbStop').onclick = () => stop(true);
    ui.querySelector('#rbCancel').onclick = () => stop(false);
    mr.onstop = async () => {
      if (!keep || !chunks.length) return;
      sample();
      const blob = new Blob(chunks, { type: (mr.mimeType || mime || 'audio/webm').split(';')[0] });
      const len = Math.round((performance.now() - t0) / 1000), b = S.boards[board]; if (!b) return;
      try {
        const id = await N.Store.putMedia(blob);
        N.snap(); b.extra.walk = { media: id, len, track }; N.touch(); N.render();
        N.toast('Walkthrough saved. Press play at the top to watch it.');
        N.hooks.transcribe && N.hooks.transcribe(blob, text => { const bb = S.boards[board]; if (bb && bb.extra.walk && bb.extra.walk.media === id) { bb.extra.walk.text = text; N.touch(); } });
      } catch (e) { N.toast('The walkthrough couldn’t be saved on this device.'); }
    };
    mr.start(1000);
  }
  N.hooks.render.push(b => { if (rec && b.id !== rec.board) rec.stop(true); });

  /* ---------- playback ---------- */
  let player = null;
  async function play() {
    const b = N.B(), w = b.extra && b.extra.walk; if (!w) return;
    if (player) return stopPlay();
    const url = await N.Store.mediaUrl(w.media); if (!url) return N.toast('The walkthrough recording isn’t on this device');
    const audio = new Audio(url), tr = w.track || { v: [], c: [] };
    const k = Math.min(innerWidth / (tr.W || innerWidth), innerHeight / (tr.H || innerHeight));
    // convert each recorded camera position to this screen: keep the same centre point, scale the zoom
    const pts = tr.v.map(([t, x, y, z]) => { const cx = ((tr.W || innerWidth) / 2 - x) / z, cy = ((tr.H || innerHeight) / 2 - y) / z, nz = z * k; return [t, innerWidth / 2 - cx * nz, innerHeight / 2 - cy * nz, nz]; });
    const ui = document.createElement('div'); ui.id = 'player';
    ui.innerHTML = `<button class="ib" id="plPP" aria-label="Pause"><svg viewBox="0 0 24 24"><rect x="7" y="5.5" width="3.5" height="13" rx="1"/><rect x="13.5" y="5.5" width="3.5" height="13" rx="1"/></svg></button>
      <input type="range" id="plSeek" min="0" max="${Math.max(1, w.len || 1)}" step="0.1" value="0" aria-label="Position">
      <span id="plT">0:00 / ${fmt(w.len || 0)}</span><button class="ib" id="plX" aria-label="Close walkthrough">✕</button>`;
    document.body.append(ui); document.body.classList.add('playing');
    player = { board: b.id, audio, ui, raf: 0, follow: true };
    if (pts.length) animateView({ x: pts[0][1], y: pts[0][2], z: pts[0][3] }, 500);
    const at = t => { if (!pts.length) return null; let lo = 0, hi = pts.length - 1; if (t <= pts[0][0]) return pts[0]; if (t >= pts[hi][0]) return pts[hi];
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= t) lo = m; else hi = m; }
      const a = pts[lo], c = pts[hi], f = (t - a[0]) / Math.max(1, c[0] - a[0]); return [t, a[1] + (c[1] - a[1]) * f, a[2] + (c[2] - a[2]) * f, a[3] + (c[3] - a[3]) * f]; };
    const loop = () => {
      if (!player) return;
      const t = audio.currentTime * 1000;
      if (player.follow && !audio.paused) { const p = at(t); if (p) { const v = N.V(); v.x = p[1]; v.y = p[2]; v.z = p[3]; N.applyView(); N.linksSoon(); } }
      const recent = tr.c.filter(c => c[0] <= t && t - c[0] < 2600).pop(); spotlight(recent ? recent[1] : null);
      const seek = ui.querySelector('#plSeek'); if (document.activeElement !== seek) seek.value = audio.currentTime;
      ui.querySelector('#plT').textContent = `${fmt(audio.currentTime)} / ${fmt(w.len || audio.duration || 0)}`;
      player.raf = requestAnimationFrame(loop);
    };
    const setPP = () => { ui.querySelector('#plPP').innerHTML = audio.paused ? '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>' : '<svg viewBox="0 0 24 24"><rect x="7" y="5.5" width="3.5" height="13" rx="1"/><rect x="13.5" y="5.5" width="3.5" height="13" rx="1"/></svg>'; };
    audio.onplay = audio.onpause = setPP;
    audio.onended = () => setTimeout(stopPlay, 600);
    ui.querySelector('#plPP').onclick = () => { if (audio.paused) { player.follow = true; audio.play(); } else audio.pause(); };
    ui.querySelector('#plSeek').oninput = e => { audio.currentTime = +e.target.value; player.follow = true; };
    ui.querySelector('#plX').onclick = stopPlay;
    setTimeout(() => audio.play().catch(() => { setPP(); N.toast('Press play to start'); }), calm() ? 0 : 520);
    loop();
  }
  function stopPlay() { if (!player) return; player.audio.pause(); cancelAnimationFrame(player.raf); player.ui.remove(); player = null; document.body.classList.remove('playing'); spotlight(null); N.render(); }
  // Moving the board yourself pauses the camera so you can look around
  N.canvas.addEventListener('pointerdown', () => { if (player) { player.follow = false; player.audio.pause(); } }, true);
  N.canvas.addEventListener('wheel', () => { if (player) { player.follow = false; player.audio.pause(); } }, { passive: true });
  N.hooks.render.push(b => { if (player && b.id !== player.board) stopPlay(); });

  /* ---------- present mode ---------- */
  let pres = null;
  function order(b) {
    const cs = b.cards.filter(c => !c.col).map(c => ({ c, r: N.wrect(c.id) })).filter(x => x.r);
    cs.sort((a, b2) => a.r.y - b2.r.y);
    const rows = [];
    for (const x of cs) { const row = rows.find(r => Math.abs(r.y - x.r.y) < 140); if (row) row.items.push(x); else rows.push({ y: x.r.y, items: [x] }); }
    return rows.flatMap(r => r.items.sort((a, b2) => a.r.x - b2.r.x));
  }
  function present() {
    const b = N.B(), seq = order(b); if (!seq.length) return N.toast('Add some cards first, then present them');
    if (player) stopPlay();
    N.S.sel.clear(); N.refreshSel();
    const ui = document.createElement('div'); ui.id = 'presbar';
    ui.innerHTML = `<button class="ib" id="prPrev" aria-label="Previous">‹</button><span id="prN"></span><button class="ib" id="prNext" aria-label="Next">›</button><button class="ib" id="prX">Exit</button>`;
    document.body.append(ui); document.body.classList.add('presenting');
    const saved = { ...N.V() };
    pres = { i: -1, seq, ui, saved };
    const go = i => {
      pres.i = Math.max(-1, Math.min(seq.length - 1, i));
      if (pres.i < 0) { const all = seq.map(x => x.r); const x0 = Math.min(...all.map(r => r.x)), y0 = Math.min(...all.map(r => r.y)), x1 = Math.max(...all.map(r => r.x + r.w)), y1 = Math.max(...all.map(r => r.y + r.h)); animateView(viewFor({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, 60, 1.2)); spotlight(null); }
      else { const r = N.wrect(seq[pres.i].c.id) || seq[pres.i].r; animateView(viewFor(r, 110, 2.2)); spotlight(seq[pres.i].c.id); }
      ui.querySelector('#prN').textContent = pres.i < 0 ? `Overview · ${seq.length} cards` : `${pres.i + 1} of ${seq.length}`;
    };
    pres.go = go;
    ui.querySelector('#prPrev').onclick = () => go(pres.i - 1);
    ui.querySelector('#prNext').onclick = () => go(pres.i + 1);
    ui.querySelector('#prX').onclick = endPresent;
    go(-1);
    try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  }
  function endPresent() {
    if (!pres) return; pres.ui.remove(); document.body.classList.remove('presenting'); spotlight(null);
    animateView(pres.saved, 500); pres = null;
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  }
  document.addEventListener('keydown', e => {
    if (pres) {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); pres.go(pres.i + 1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); pres.go(pres.i - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endPresent(); }
      return;
    }
    if (player && e.key === 'Escape') { e.stopPropagation(); stopPlay(); return; }
    if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey && !N.isEditing() && $('#dlg').hidden && $('#search').hidden) { e.preventDefault(); present(); }
  }, true);
  N.hooks.render.push(b => { if (pres && !document.body.contains(pres.ui)) pres = null; });
  N.walk = { animateView, viewFor };
})();
