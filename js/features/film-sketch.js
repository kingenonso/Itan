/* Sketch storyboards: draw a shot's frame with a finger, stylus or mouse, right on the shot card.
   Pen, marker and eraser, arrows for camera and actor moves, boxes for framing,
   and guides (thirds, centre, widescreen bars) that help composition but aren't saved into the picture. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const W = 1600, H = 900;
  const COLORS = [['#1a1c29', 'Black'], ['#8a8fa3', 'Grey'], ['#e0392b', 'Red'], ['#4636ef', 'Blue'], ['#ffbd2e', 'Yellow'], ['#36a86d', 'Green']];
  const TOOLS = [['pen', 'Pen'], ['marker', 'Marker'], ['arrow', 'Arrow'], ['box', 'Box'], ['eraser', 'Eraser']];
  const GUIDES = [['thirds', 'Thirds'], ['center', 'Centre'], ['scope', 'Widescreen 2.39']];

  // ask how to make the frame, then hand the picture to save(blob)
  F.pickFrame = async (c, save) => {
    const has = !!c.frame;
    const m = N.modal(`<h2>Storyboard frame · ${esc((c.scene || '?') + (c.letter || ''))}</h2><p>Draw the shot, or use a photo or reference picture.</p>
      <div class="row"><button class="pri" id="skDraw">${has ? 'Draw over this frame' : 'Draw it'}</button>${has ? '<button id="skNew">Start a new drawing</button>' : ''}<button id="skPic">Use a picture</button><button data-close>Cancel</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    const go = async bg => { N.closeOv(); const blob = await F.sketch(bg, c); if (blob) save(blob); };
    m.querySelector('#skDraw').onclick = async () => go(has ? await N.Store.getMedia(c.frame).catch(() => null) : null);
    const nw = m.querySelector('#skNew'); if (nw) nw.onclick = () => go(null);
    m.querySelector('#skPic').onclick = () => { N.closeOv(); const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => i.files[0] && save(i.files[0]); i.click(); };
  };

  F.sketch = (bgBlob, shot) => new Promise(async resolve => {
    const st = { tool: 'pen', color: '#1a1c29', size: 6, guides: new Set(['thirds']), undo: [], redo: [] };
    const el = document.createElement('div'); el.className = 'sk'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Sketch the frame');
    el.innerHTML = `<header class="sk-bar">
        <div class="seg sk-tools">${TOOLS.map(([k, l]) => `<button data-tool="${k}" class="${k === 'pen' ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="sk-colors">${COLORS.map(([c, l]) => `<button data-color="${c}" style="--c:${c}" aria-label="${l}" class="${c === st.color ? 'on' : ''}"></button>`).join('')}</div>
        <label class="sk-size">Size<input type="range" min="2" max="40" value="6" id="skSize"></label>
        <div class="seg sk-guides">${GUIDES.map(([k, l]) => `<button data-guide="${k}" class="${st.guides.has(k) ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span class="spacer"></span>
        <button class="ib" id="skUndo" title="Undo (Ctrl+Z)">Undo</button><button class="ib" id="skRedo" title="Redo">Redo</button><button class="ib" id="skClear">Clear</button>
        <button class="ib" id="skCancel">Cancel</button><button class="pri" id="skSave">Use this frame</button></header>
      <div class="sk-stage"><div class="sk-paper"><canvas id="skC" width="${W}" height="${H}"></canvas><canvas id="skG" width="${W}" height="${H}"></canvas><canvas id="skP" width="${W}" height="${H}"></canvas></div></div>
      <p class="sk-hint">${shot && shot.text ? esc(shot.text) + ' · ' : ''}Draw with your finger, a stylus or the mouse. Guides help you frame but aren’t saved.</p>`;
    document.body.append(el); document.body.classList.add('sketching');
    const cv = el.querySelector('#skC'), g = cv.getContext('2d'), gv = el.querySelector('#skG'), gg = gv.getContext('2d'), pv = el.querySelector('#skP'), pg = pv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    if (bgBlob) { try { const img = await createImageBitmap(bgBlob); const s = Math.max(W / img.width, H / img.height); g.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s); } catch (e) {} }
    const snapshot = () => g.getImageData(0, 0, W, H);
    const push = () => { st.undo.push(snapshot()); if (st.undo.length > 40) st.undo.shift(); st.redo = []; };
    function guides() {
      gg.clearRect(0, 0, W, H); gg.lineWidth = 2; gg.strokeStyle = 'rgba(70,54,239,.35)'; gg.setLineDash([10, 10]);
      if (st.guides.has('thirds')) { gg.beginPath(); [1, 2].forEach(i => { gg.moveTo(W * i / 3, 0); gg.lineTo(W * i / 3, H); gg.moveTo(0, H * i / 3); gg.lineTo(W, H * i / 3); }); gg.stroke(); }
      if (st.guides.has('center')) { gg.setLineDash([]); gg.beginPath(); gg.moveTo(W / 2 - 30, H / 2); gg.lineTo(W / 2 + 30, H / 2); gg.moveTo(W / 2, H / 2 - 30); gg.lineTo(W / 2, H / 2 + 30); gg.stroke(); }
      if (st.guides.has('scope')) { const bh = (H - W / 2.39) / 2; gg.fillStyle = 'rgba(26,28,41,.28)'; gg.fillRect(0, 0, W, bh); gg.fillRect(0, H - bh, W, bh); }
      gg.setLineDash([]);
    }
    guides();
    const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H, p: e.pointerType === 'pen' && e.pressure ? e.pressure : 0.5 }; };
    const width = p => st.tool === 'marker' ? st.size * 3 : st.tool === 'eraser' ? st.size * 4 : st.size * (0.5 + p);
    function arrow(ctx, a, b) {
      const ang = Math.atan2(b.y - a.y, b.x - a.x), head = Math.max(18, st.size * 4);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(ang - 0.45), b.y - head * Math.sin(ang - 0.45)); ctx.lineTo(b.x - head * Math.cos(ang + 0.45), b.y - head * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    }
    let down = null, last = null;
    const style = (ctx, p) => { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = width(p); ctx.strokeStyle = st.tool === 'eraser' ? '#fff' : st.color; ctx.globalAlpha = st.tool === 'marker' ? 0.35 : 1; };
    pv.addEventListener('pointerdown', e => {
      e.preventDefault(); pv.setPointerCapture(e.pointerId); push(); down = pt(e); last = down;
      if (st.tool === 'marker') { st.path = [down]; return; }
      if (st.tool === 'pen' || st.tool === 'eraser') { style(g, down.p); g.beginPath(); g.moveTo(down.x, down.y); g.lineTo(down.x + 0.01, down.y); g.stroke(); }
    });
    pv.addEventListener('pointermove', e => {
      if (!down) return; const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (st.tool === 'arrow' || st.tool === 'box') { const q = pt(e); pg.clearRect(0, 0, W, H); style(pg, 0.5); pg.globalAlpha = 1; if (st.tool === 'arrow') arrow(pg, down, q); else pg.strokeRect(Math.min(down.x, q.x), Math.min(down.y, q.y), Math.abs(q.x - down.x), Math.abs(q.y - down.y)); return; }
      if (st.tool === 'marker') { // a see-through stroke is drawn whole, so overlaps don't darken
        evs.forEach(ev => st.path.push(pt(ev))); pg.clearRect(0, 0, W, H); style(pg, 0.5); pg.globalAlpha = 1; pg.beginPath(); st.path.forEach((q, i) => i ? pg.lineTo(q.x, q.y) : pg.moveTo(q.x, q.y)); pg.stroke(); pv.style.opacity = .4; return; }
      for (const ev of evs) { const q = pt(ev); style(g, q.p); g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(q.x, q.y); g.stroke(); last = q; }
    });
    const up = e => {
      if (!down) return; const q = pt(e);
      if (st.tool === 'marker') { g.globalAlpha = .4; g.globalCompositeOperation = 'multiply'; g.drawImage(pv, 0, 0); g.globalCompositeOperation = 'source-over'; pg.clearRect(0, 0, W, H); pv.style.opacity = 1; }
      if (st.tool === 'arrow' || st.tool === 'box') { pg.clearRect(0, 0, W, H); style(g, 0.5); g.globalAlpha = 1; if (st.tool === 'arrow') { if (Math.hypot(q.x - down.x, q.y - down.y) > 8) arrow(g, down, q); } else g.strokeRect(Math.min(down.x, q.x), Math.min(down.y, q.y), Math.abs(q.x - down.x), Math.abs(q.y - down.y)); }
      g.globalAlpha = 1; down = null;
    };
    pv.addEventListener('pointerup', up); pv.addEventListener('pointercancel', up);
    const undo = () => { if (!st.undo.length) return; st.redo.push(snapshot()); g.putImageData(st.undo.pop(), 0, 0); };
    const redo = () => { if (!st.redo.length) return; st.undo.push(snapshot()); g.putImageData(st.redo.pop(), 0, 0); };
    const finish = blob => { document.removeEventListener('keydown', key, true); el.remove(); document.body.classList.remove('sketching'); resolve(blob); };
    const key = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); e.shiftKey ? redo() : undo(); }
      else if (e.key === 'Escape') { e.stopPropagation(); finish(null); }
      else if (!e.ctrlKey && !e.metaKey && /^[pmabe]$/.test(e.key) && document.activeElement.tagName !== 'INPUT') { e.stopPropagation(); const t = { p: 'pen', m: 'marker', a: 'arrow', b: 'box', e: 'eraser' }[e.key]; el.querySelector(`[data-tool="${t}"]`).click(); }
    };
    document.addEventListener('keydown', key, true);
    el.addEventListener('click', e => {
      const t = e.target;
      const tl = t.closest('[data-tool]'); if (tl) { st.tool = tl.dataset.tool; el.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b === tl)); return; }
      const c = t.closest('[data-color]'); if (c) { st.color = c.dataset.color; if (st.tool === 'eraser') { st.tool = 'pen'; el.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === 'pen')); } el.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', b === c)); return; }
      const gd = t.closest('[data-guide]'); if (gd) { const k = gd.dataset.guide; st.guides.has(k) ? st.guides.delete(k) : st.guides.add(k); gd.classList.toggle('on'); guides(); return; }
      if (t.closest('#skUndo')) undo(); if (t.closest('#skRedo')) redo();
      if (t.closest('#skClear')) { push(); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
      if (t.closest('#skCancel')) finish(null);
      if (t.closest('#skSave')) cv.toBlob(b => finish(b), 'image/jpeg', 0.88);
    });
    el.querySelector('#skSize').oninput = e => { st.size = +e.target.value; };
  });
})();
