/* Board history: snapshots of each board are kept on this device (every few minutes while you
   edit, and when you open a board). Slide back through them and restore any version. */
(function () {
  const N = window.N, S = N.S, esc = N.esc;
  const GAP = 3 * 60 * 1000, KEEP = 80;
  const last = {}; // boardId -> {time, sig}
  const sigOf = b => JSON.stringify([b.title, b.cards, b.links]);
  const snapOf = b => ({ title: b.title, cards: JSON.parse(JSON.stringify(b.cards)), links: JSON.parse(JSON.stringify(b.links)), media: [...new Set(b.cards.filter(c => c.media).map(c => c.media))] });
  async function capture(b, force) {
    if (!b || preview) return;
    const sig = sigOf(b), l = last[b.id];
    if (l && l.sig === sig) return;
    if (!force && l && Date.now() - l.time < GAP) return;
    last[b.id] = { time: Date.now(), sig };
    try {
      await N.Store.putHistory(b.id, Date.now(), snapOf(b));
      const all = await N.Store.listHistory(b.id);
      if (all.length > KEEP) for (const h of all.slice(0, all.length - KEEP)) await N.Store.delHistory(h.key);
    } catch (e) {}
  }
  let opened = null;
  N.hooks.render.push(b => { if (opened !== b.id) { opened = b.id; capture(b, true); } });
  N.hooks.saved.push(() => capture(N.B(), false));
  addEventListener('pagehide', () => capture(N.B(), true));
  N.hooks.historyMedia = () => N.Store.allHistoryMedia();

  /* ---------- browsing ---------- */
  let preview = null; // {board, keep:{cards,links,title}, canWrite}
  N.hooks.tools.push(b => preview ? '' : `<button class="ib" id="hOpen" title="See earlier versions of this board"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v3.8h3.8M12 8v4.5l3 2"/></svg><span class="hide-s">History</span></button>`);
  N.$('#btools').addEventListener('click', e => { if (e.target.closest('#hOpen')) open(); });
  async function open() {
    const b = N.B(); await capture(b, true);
    const list = (await N.Store.listHistory(b.id)).reverse();
    if (list.length < 2) return N.toast('No earlier versions yet. Notera keeps one every few minutes while you edit.');
    const now = new Date();
    const label = t => { const d = new Date(t), same = d.toDateString() === now.toDateString(), y = new Date(now); y.setDate(y.getDate() - 1);
      return (same ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString([], { day: 'numeric', month: 'short' })) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
    const m = N.modal(`<h2>History of “${esc(b.title || 'this board')}”</h2><p>Drag the slider back in time to see the board as it was. Nothing changes until you press Restore.</p>
      <div class="hist"><input type="range" id="hSlide" min="0" max="${list.length - 1}" value="0" aria-label="Version"><div class="hlab"><b id="hWhen">Now</b><span id="hInfo"></span></div></div>
      <div class="row"><button class="pri" id="hView">Show this version</button><button data-close>Close</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    const sl = m.querySelector('#hSlide');
    const upd = () => { const h = list[+sl.value]; m.querySelector('#hWhen').textContent = +sl.value === 0 ? 'Latest' : label(h.time); m.querySelector('#hInfo').textContent = ` · ${h.snap.cards.filter(c => !c.col).length} cards`; };
    sl.oninput = upd; upd();
    m.querySelector('#hView').onclick = () => { const h = list[+sl.value]; N.closeOv(); show(b, h, label(h.time)); };
  }
  function show(b, h, when) {
    if (preview) back();
    preview = { board: b.id, keep: { cards: b.cards, links: b.links, title: b.title }, canWrite: N.P.canWrite, h };
    N.P.canWrite = false; b.cards = JSON.parse(JSON.stringify(h.snap.cards)); b.links = JSON.parse(JSON.stringify(h.snap.links));
    document.body.classList.add('previewing');
    const bar = document.createElement('div'); bar.id = 'histbar';
    bar.innerHTML = `<span>Viewing <b>${esc(when)}</b></span><button class="pri" id="hRestore">Restore this version</button><button class="ib" id="hBack">Back to now</button>`;
    document.body.append(bar);
    bar.querySelector('#hBack').onclick = back;
    bar.querySelector('#hRestore').onclick = () => { const snapCards = b.cards, snapLinks = b.links; back(); N.snap(); b.cards = snapCards; b.links = snapLinks; N.touch(); N.render(); N.toast('Earlier version restored. Ctrl+Z undoes this.'); };
    N.S.entering = true; N.render();
  }
  function back() {
    if (!preview) return; const b = S.boards[preview.board];
    if (b) { b.cards = preview.keep.cards; b.links = preview.keep.links; }
    N.P.canWrite = preview.canWrite; preview = null; document.body.classList.remove('previewing');
    const bar = document.getElementById('histbar'); if (bar) bar.remove(); N.render();
  }
  const prevBefore = N.hooks.beforeOpen;
  N.hooks.beforeOpen = async id => { if (preview) back(); return prevBefore(id); };
  document.addEventListener('keydown', e => { if (preview && e.key === 'Escape') { e.stopPropagation(); back(); } }, true);
})();
