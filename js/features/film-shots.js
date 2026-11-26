/* Shot cards: one card per shot, numbered by scene (1A, 1B…), with shot size, lens, movement, angle,
   a storyboard frame and a status (to shoot, done, pickup). The Shots tab lists every shot in the film. */
(function () {
  const N = window.N, F = N.film, esc = N.esc, S = N.S;
  const SIZES = ['Wide', 'Full', 'Medium', 'Medium close-up', 'Close-up', 'Extreme close-up', 'Over the shoulder', 'Insert', 'Aerial'];
  const MOVES = ['Static', 'Pan', 'Tilt', 'Push in', 'Pull out', 'Tracking', 'Handheld', 'Gimbal', 'Crane', 'Zoom'];
  const ANGLES = ['Eye level', 'High', 'Low', 'Overhead', 'Dutch', 'POV'];
  const ST = { todo: 'To shoot', done: 'Done', pickup: 'Pickup' }, NEXT = { todo: 'done', done: 'pickup', pickup: 'todo' };
  const label = c => `${c.scene || '?'}${c.letter || ''}`;
  const opt = (list, v, ph) => `<option value="">${ph}</option>` + list.map(x => `<option${x === v ? ' selected' : ''}>${x}</option>`).join('');
  const ro = () => !N.P.canWrite ? ' disabled' : '';

  function frameTag(c) {
    if (!c.frame) return `<button class="sh-add" data-shframe>${N.P.canWrite ? '+ Draw or add a frame' : 'No frame'}</button>`;
    const u = N.Store.cachedUrl(c.frame);
    if (u === undefined) { N.Store.mediaUrl(c.frame).then(() => N.world.querySelectorAll(`[data-frame="${CSS.escape(c.frame)}"]`).forEach(x => { const k = N.find(x.closest('.card').dataset.id); if (k) x.innerHTML = frameTag(k); })); return '<div class="ph">Loading…</div>'; }
    return u ? `<img src="${esc(u)}" alt="" draggable="false"><button class="sh-swap" data-shframe aria-label="Change frame">Change</button>` : '<div class="ph">Frame not on this device</div>';
  }
  N.TYPES.push('shot'); N.DEFW.shot = 300; N.MINW.shot = 220; N.EH.shot = 230; N.TN.shot = 'Shot';
  N.hooks.cardTypes.shot = {
    render: c => `<div class="sh-frame" data-frame="${esc(c.frame || '')}">${frameTag(c)}</div>
      <div class="sh-top"><button class="sh-no" data-shno title="Change shot number">${esc(label(c))}</button><button class="sh-st st-${c.status || 'todo'}" data-shst${ro()}>${ST[c.status || 'todo']}</button></div>
      <div class="sh-specs"><select data-sf="size" aria-label="Shot size"${ro()}>${opt(SIZES, c.size, 'Size')}</select><input data-sf="lens" value="${esc(c.lens || '')}" placeholder="Lens" aria-label="Lens"${ro()}>
        <select data-sf="move" aria-label="Movement"${ro()}>${opt(MOVES, c.move, 'Movement')}</select><select data-sf="angle" aria-label="Angle"${ro()}>${opt(ANGLES, c.angle, 'Angle')}</select></div>`
      + `<div class="txt sh-desc" contenteditable="${N.P.canWrite ? 'plaintext-only' : 'false'}" spellcheck="false" data-f="text" data-ph="What happens in this shot">${esc(c.text || '')}</div>`,
    placed(c) {
      // number the new shot: scene from its column ("Scene 3 · …") or the last shot on this board
      const colCard = c.col && N.find(c.col), fromCol = colCard && (colCard.text || '').match(/scene\s+(\w+)/i);
      const shots = N.B().cards.filter(k => k.type === 'shot' && k.id !== c.id);
      c.scene = fromCol ? fromCol[1] : (shots.length ? shots[shots.length - 1].scene : '1');
      c.letter = nextLetter(c.scene, c.id); c.status = 'todo';
    }
  };
  function allShots() {
    const r = F.root(); const ids = []; if (r) N.collect(r.id, ids); else ids.push(S.cur);
    return ids.flatMap(id => (S.boards[id] ? S.boards[id].cards.filter(c => c.type === 'shot').map(c => ({ c, b: S.boards[id] })) : []));
  }
  F.allShots = allShots;
  function nextLetter(scene, skip) {
    const used = new Set(allShots().filter(x => String(x.c.scene) === String(scene) && x.c.id !== skip).map(x => x.c.letter));
    for (let i = 0; i < 26 * 27; i++) { const l = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26); if (!used.has(l)) return l; }
    return 'Z';
  }
  // editing inside shot cards
  N.world.addEventListener('change', e => {
    const t = e.target; if (!t.dataset.sf) return; const c = N.find(t.closest('.card').dataset.id); if (!c) return;
    N.snap(); c[t.dataset.sf] = t.value.trim(); N.touch();
  });
  N.world.addEventListener('click', async e => {
    const card = e.target.closest('.card.t-shot'); if (!card || !N.P.canWrite) return; const c = N.find(card.dataset.id); if (!c) return;
    if (e.target.closest('[data-shst]')) { N.snap(); c.status = NEXT[c.status || 'todo']; N.touch(); N.render(); }
    else if (e.target.closest('[data-shno]')) { const v = await F.ask('Shot number', 'For example 3B', label(c)); if (!v) return; const m = v.toUpperCase().match(/^(\d+[A-Z]?)\s*([A-Z]{1,2})?$/) || v.toUpperCase().match(/^(.+?)([A-Z]{1,2})$/); if (!m) return N.toast('Use a scene number and a letter, like 3B'); N.snap(); c.scene = m[1]; c.letter = m[2] || nextLetter(m[1], c.id); N.touch(); N.render(); }
    else if (e.target.closest('[data-shframe]') && F.pickFrame) F.pickFrame(c, f => setFrame(c, f));
    else if (e.target.closest('[data-shframe]')) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => i.files[0] && setFrame(c, i.files[0]); i.click(); }
  });
  async function setFrame(c, file) { try { const id = await N.Store.putMedia(file); N.snap(); c.frame = id; N.touch(); N.render(); } catch (e) { N.toast('That picture couldn’t be saved on this device'); } }
  // dropping a picture onto a shot sets its frame instead of adding a new card
  N.world.addEventListener('drop', e => {
    const card = e.target.closest('.card.t-shot'); const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type));
    if (!card || !f || !N.P.canWrite) return; e.preventDefault(); e.stopPropagation(); const c = N.find(card.dataset.id); if (c) setFrame(c, f);
  }, true);

  /* ---------- Shots tab ---------- */
  let filter = 'all';
  F.tabs.push({ id: 'shots', label: 'Shots', order: 40, render(el, d) {
    const all = allShots(), counts = { all: all.length, todo: 0, done: 0, pickup: 0 }; all.forEach(x => counts[x.c.status || 'todo']++);
    const show = all.filter(x => filter === 'all' || (x.c.status || 'todo') === filter);
    const groups = new Map(); show.sort((a, b) => String(a.c.scene).localeCompare(String(b.c.scene), undefined, { numeric: true }) || String(a.c.letter).localeCompare(String(b.c.letter))).forEach(x => { const k = String(x.c.scene || '?'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
    const sceneName = k => { const s = d.scenes.find(x => String(x.num) === k); return s ? F.sceneLabel(s) : ''; };
    el.innerHTML = `<div class="fwrap wide"><div class="sl-top"><div class="seg">${['all', 'todo', 'done', 'pickup'].map(k => `<button data-flt="${k}" class="${filter === k ? 'on' : ''}">${k === 'all' ? 'All' : ST[k]} <em>${counts[k]}</em></button>`).join('')}</div>
      <div class="sl-act"><button class="ib" data-slsave="png">Save as picture</button><button class="ib" data-slsave="pdf">Save as PDF</button></div></div>
      ${all.length ? '' : '<p class="fhint">No shots yet. Add Shot cards from the dock on any board in this film, for example on the Shot list board.</p>'}
      <div id="slSheet" class="sheet shotsheet"><h2>${esc(d.title)} · Shot list</h2>${[...groups].map(([k, xs]) => `<h3>Scene ${esc(k)}<span>${esc(sceneName(k))}</span></h3>
        <table class="ftable"><thead><tr><th>Shot</th><th>Frame</th><th>Size</th><th>Lens</th><th>Movement</th><th>Angle</th><th>What happens</th><th>Status</th></tr></thead><tbody>
        ${xs.map(({ c, b }) => `<tr><td><b>${esc(label(c))}</b></td><td class="thumb" data-frame="${esc(c.frame || '')}">${c.frame ? `<img src="${esc(N.Store.cachedUrl(c.frame) || '')}" alt="">` : ''}</td><td>${esc(c.size || '')}</td><td>${esc(c.lens || '')}</td><td>${esc(c.move || '')}</td><td>${esc(c.angle || '')}</td><td>${esc(c.text || '')}</td>
          <td><button class="sh-st st-${c.status || 'todo'}" data-slst="${esc(c.id)}" data-b="${esc(b.id)}">${ST[c.status || 'todo']}</button></td></tr>`).join('')}</tbody></table>`).join('')}</div></div>`;
    // load any frames not yet in memory
    all.forEach(({ c }) => { if (c.frame && N.Store.cachedUrl(c.frame) === undefined) N.Store.mediaUrl(c.frame).then(() => F.refresh()); });
    el.onclick = e => {
      const f = e.target.closest('[data-flt]'); if (f) { filter = f.dataset.flt; return F.refresh(); }
      const st = e.target.closest('[data-slst]'); if (st && N.P.canWrite) { const b = S.boards[st.dataset.b], c = b && b.cards.find(x => x.id === st.dataset.slst); if (c) { N.snap(); c.status = NEXT[c.status || 'todo']; N.touch(); F.refresh(); } }
      const sv = e.target.closest('[data-slsave]'); if (sv) N.saveNode(el.querySelector('#slSheet'), (d.title || 'Film') + ' shot list', sv.dataset.slsave);
    };
  } });
})();
