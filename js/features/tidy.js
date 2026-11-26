/* Tidy: line cards up in neat rows, keeping their reading order.
   Guides: while you drag a card, it snaps to the edges and centres of nearby cards
   (hold Alt to place it freely). */
(function () {
  const N = window.N, S = N.S;
  const GAP = 28;
  function tidy() {
    if (!N.P.canWrite) return;
    const b = N.B(), sel = [...S.sel].map(N.find).filter(c => c && !c.col);
    const pool = (sel.length > 1 ? sel : b.cards.filter(c => !c.col)).map(c => ({ c, r: N.wrect(c.id) })).filter(x => x.r);
    if (pool.length < 2) return N.toast('Add a few cards first');
    pool.sort((a, z) => a.r.y - z.r.y);
    const rows = [];
    for (const x of pool) { const row = rows.find(r => Math.abs(r.y - x.r.y) < 120); if (row) row.items.push(x); else rows.push({ y: x.r.y, items: [x] }); }
    rows.forEach(r => r.items.sort((a, z) => a.r.x - z.r.x));
    const flat = rows.flatMap(r => r.items), area = flat.reduce((s, x) => s + (x.r.w + GAP) * (x.r.h + GAP), 0);
    const maxW = Math.max(900, Math.min(2400, Math.sqrt(area) * 1.6));
    const x0 = Math.min(...flat.map(x => x.r.x)), y0 = Math.min(...flat.map(x => x.r.y));
    N.snap();
    let x = x0, y = y0, rowH = 0;
    for (const it of flat) {
      if (x > x0 && x + it.r.w > x0 + maxW) { x = x0; y += rowH + GAP; rowH = 0; }
      it.c.x = Math.round(x); it.c.y = Math.round(y); x += it.r.w + GAP; rowH = Math.max(rowH, it.r.h);
    }
    N.world.classList.add('tidying'); N.touch(); N.render();
    setTimeout(() => { N.world.classList.remove('tidying'); N.linksSoon(); }, 700);
    N.toast('Tidied. Ctrl+Z puts everything back.');
  }
  N.hooks.tools.push(b => N.P.canWrite && b.cards.length > 1 ? `<button class="ib" id="tdBtn" title="Line cards up neatly (select several to tidy just those)"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="4" rx="1.5"/><rect x="13" y="10" width="7" height="10" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/></svg><span class="hide-s">Tidy</span></button>` : '');
  N.$('#btools').addEventListener('click', e => { if (e.target.closest('#tdBtn')) tidy(); });

  // snapping guides
  let cache = null; const layer = document.createElement('div'); layer.id = 'guides'; N.world.append(layer);
  N.hooks.snapDrag = (c, free) => {
    layer.innerHTML = '';
    if (free) return;
    const z = N.V().z, th = 7 / z, me = N.el(c.id); if (!me) return;
    const w = me.offsetWidth, h = me.offsetHeight;
    if (!cache) cache = N.B().cards.filter(k => !k.col && k.id !== c.id && !S.sel.has(k.id)).map(k => { const e = N.el(k.id); return e ? { x: k.x, y: k.y, w: e.offsetWidth, h: e.offsetHeight } : null; }).filter(Boolean);
    let bx = null, by = null;
    for (const o of cache) {
      for (const [mine, theirs] of [[c.x, o.x], [c.x, o.x + o.w], [c.x + w, o.x + o.w], [c.x + w, o.x], [c.x + w / 2, o.x + o.w / 2]]) { const d = theirs - mine; if (Math.abs(d) < th && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, at: theirs, o }; }
      for (const [mine, theirs] of [[c.y, o.y], [c.y, o.y + o.h], [c.y + h, o.y + o.h], [c.y + h, o.y], [c.y + h / 2, o.y + o.h / 2]]) { const d = theirs - mine; if (Math.abs(d) < th && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, at: theirs, o }; }
    }
    if (bx) { c.x = Math.round(c.x + bx.d); const y1 = Math.min(c.y, bx.o.y) - 12, y2 = Math.max(c.y + h, bx.o.y + bx.o.h) + 12; layer.insertAdjacentHTML('beforeend', `<i class="gv" style="left:${bx.at}px;top:${y1}px;height:${y2 - y1}px"></i>`); }
    if (by) { c.y = Math.round(c.y + by.d); const x1 = Math.min(c.x, by.o.x) - 12, x2 = Math.max(c.x + w, by.o.x + by.o.w) + 12; layer.insertAdjacentHTML('beforeend', `<i class="gh" style="top:${by.at}px;left:${x1}px;width:${x2 - x1}px"></i>`); }
  };
  N.hooks.dragEnd = () => { cache = null; layer.innerHTML = ''; };
  N.hooks.render.push(() => { if (!layer.isConnected) N.world.append(layer); });
})();
