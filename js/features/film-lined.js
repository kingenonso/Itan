/* The Living Script: a lined script drawn from your shot cards.
   Each shot is a coloured line down the side of the page over the lines it covers (solid once it has a circled take).
   Lines no shot covers are flagged, and so are lines of dialogue only seen in a wide shot.
   Tap any line to see everything about it: the shots and sketches, the takes, edit notes, and notes or voice notes left on the line. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const PAL = ['#4636ef', '#e0508f', '#2a9ec4', '#f39a1e', '#36a86d', '#8f5ae8', '#d14b4b', '#0f8f8a'];
  const WIDE = /wide|full|aerial|establish/i;
  const label = c => `${c.scene || '?'}${c.letter || ''}`;
  let active = null, pending = null, openLine = null, heat = false;

  // split the screenplay into scenes and give each its scene number (matching the breakdown when it can)
  function scenesOf(d) {
    const out = []; let cur = null;
    (d.screenplay || []).forEach(l => { if (l.t === 'scene') { cur = { head: l, lines: [] }; out.push(cur); } else if (cur) cur.lines.push(l); });
    const bd = F.sortScenes(d);
    out.forEach((s, i) => { const byLoc = bd.find(x => x.loc && s.head.x.toUpperCase().includes(String(x.loc).toUpperCase()) && !out.some((o, j) => j < i && o.num === x.num));
      s.num = String(bd.length === out.length ? bd[i].num : byLoc ? byLoc.num : i + 1); });
    return out;
  }
  const shotsFor = num => F.allShots().map(x => x.c).filter(c => String(c.scene) === String(num)).sort((a, b) => String(a.letter).localeCompare(String(b.letter)));
  const circled = (d, c) => (d.takes || []).some(t => String(t.scene) === String(c.scene) && String(t.shot) === String(c.letter) && t.mark === 'circle') || c.status === 'done';
  // which lines a shot covers (by position in its scene)
  function range(sc, c) {
    if (!c.cover) return null; const ids = sc.lines.map(l => l.id), a = ids.indexOf(c.cover.from), b = ids.indexOf(c.cover.to);
    return a < 0 || b < 0 ? null : [Math.min(a, b), Math.max(a, b)];
  }
  const counts = l => l.t === 'action' || l.t === 'dial';
  function analyse(sc, shots) {
    const cover = sc.lines.map(() => []);
    shots.forEach(c => { const r = range(sc, c); if (r) for (let k = r[0]; k <= r[1]; k++) cover[k].push(c); });
    const gaps = [], wideOnly = [];
    sc.lines.forEach((l, k) => { if (!counts(l) || !(l.x || '').trim()) return; if (!cover[k].length) gaps.push(k); else if (l.t === 'dial' && cover[k].every(c => WIDE.test(c.size || ''))) wideOnly.push(k); });
    return { cover, gaps, wideOnly };
  }
  // a first guess: wide shots cover the scene; closer shots cover the lines of characters named in the shot description
  function guess(sc, c) {
    const first = sc.lines.find(l => (l.x || '').trim()), last = [...sc.lines].reverse().find(l => (l.x || '').trim());
    if (!first) return null; const whole = { from: first.id, to: last.id };
    if (!c.size || WIDE.test(c.size)) return whole;
    const text = (c.text || '').toUpperCase(), names = [...new Set(sc.lines.filter(l => l.t === 'char').map(l => l.x.replace(/\s*\(.*\)/, '').trim().toUpperCase()))].filter(n => n && text.includes(n));
    if (!names.length) return whole;
    let a = -1, b = -1, speaking = null;
    sc.lines.forEach((l, k) => { if (l.t === 'char') speaking = l.x.replace(/\s*\(.*\)/, '').trim().toUpperCase(); else if (l.t !== 'paren' && l.t !== 'dial') speaking = null;
      if (speaking && names.includes(speaking)) { if (a < 0) a = k; b = k; } });
    return a < 0 ? whole : { from: sc.lines[a].id, to: sc.lines[b].id };
  }
  const editNotes = c => { const out = []; Object.values(N.S.boards).forEach(b => b.cards.forEach(v => { if (v.type !== 'video') return; (v.notes || []).forEach(n => { if (new RegExp('\\b' + label(c) + '\\b', 'i').test(n.text || '')) out.push({ v, n }); }); })); return out; };

  F.tabs.push({ id: 'lined', label: 'Lined script', order: 6, render(el, d) {
    const sp = d.screenplay || [];
    if (!sp.length) { el.innerHTML = `<div class="fwrap"><div class="empty-row big">The lined script shows which shots cover which lines of your script, and warns you about lines no shot covers.<br>It works from the script on the Script tab.</div>
      <div class="row" style="justify-content:center">${d.script ? '<button class="pri" id="lsUse">Use my imported script</button>' : ''}<button class="${d.script ? 'ib' : 'pri'}" data-ftab="script">Go to Script</button></div></div>`;
      el.onclick = e => { if (e.target.closest('#lsUse')) F.change(dd => { dd.screenplay = F.toScreenplay(dd.script); }); }; return; }
    const scs = scenesOf(d), info = scs.map(sc => { const shots = shotsFor(sc.num); return { sc, shots, a: analyse(sc, shots) }; });
    const totalLines = info.reduce((n, x) => n + x.sc.lines.filter(l => counts(l) && (l.x || '').trim()).length, 0), gapN = info.reduce((n, x) => n + x.a.gaps.length, 0), wideN = info.reduce((n, x) => n + x.a.wideOnly.length, 0);
    const noCover = info.reduce((n, x) => n + x.shots.filter(c => !range(x.sc, c)).length, 0);
    const pct = totalLines ? Math.round((totalLines - gapN) / totalLines * 100) : 0;
    const act = active && F.allShots().find(x => x.c.id === active);
    el.innerHTML = `<div class="ls">
      <div class="ls-top"><div class="ls-stats"><div class="${pct === 100 ? 'good' : ''}"><small>Lines covered</small><b>${pct}%</b></div><div class="${gapN ? 'bad' : ''}"><small>Not covered</small><b>${gapN}</b></div><div class="${wideN ? 'warn' : ''}"><small>Dialogue only in a wide</small><b>${wideN}</b></div></div>
        <div class="ls-act">${noCover && N.P.canWrite ? `<button class="pri" id="lsGuess" title="Wide shots cover the whole scene; closer shots cover the lines of characters named in the shot">Fill in coverage for ${noCover} shot${noCover === 1 ? '' : 's'}</button>` : ''}<button class="ib${heat ? ' on' : ''}" id="lsHeat">Heat map</button><button class="ib" id="lsPdf">Save as PDF</button></div></div>
      ${act ? `<div class="ls-mode"><b>Marking ${esc(label(act.c))}</b> ${pending ? 'Now tap the last line it covers.' : 'Tap the first line this shot covers, then the last.'}<button class="ib" id="lsWhole">Whole scene</button><button class="ib" id="lsClear">Clear</button><button class="ib" id="lsDone">Done</button></div>`
        : `<p class="fhint ls-help">Each coloured line is a shot. Solid lines have a circled take; dashed ones aren’t shot yet. Tap a shot’s tag to mark the lines it covers. Tap any line of the script to see everything about it.</p>`}
      <div class="ls-wrap"><div class="ls-page${heat ? ' heat' : ''}" id="lsPage">${info.map(({ sc, shots, a }, si) => `
        <section class="ls-scene" data-sc="${si}"><header><div class="ls-head">${esc(sc.num)}. ${esc(sc.head.x)}</div>
          <div class="ls-chips">${shots.map((c, k) => `<button class="ls-chip${active === c.id ? ' on' : ''}${range(sc, c) ? '' : ' none'}" data-shot="${esc(c.id)}" style="--c:${PAL[k % PAL.length]}" title="${esc([c.size, c.text].filter(Boolean).join(' — '))}">${esc(label(c))}</button>`).join('') || '<span class="fhint">No shots for this scene yet</span>'}
          ${a.gaps.length ? `<span class="ls-flag bad">${a.gaps.length} line${a.gaps.length === 1 ? '' : 's'} not covered</span>` : ''}${a.wideOnly.length ? `<span class="ls-flag warn">${a.wideOnly.length} only in a wide</span>` : ''}</div></header>
          <div class="ls-body" style="--cols:${shots.length}"><div class="ls-lines">${sc.lines.map((l, k) => { const n = a.cover[k].length, gap = a.gaps.includes(k), wide = a.wideOnly.includes(k), notes = (d.lineNotes && d.lineNotes[l.id] || []).length;
            const inPend = pending && pending.sc === si && pending.k === k;
            return `<div class="ls-l sp-${l.t}${gap ? ' ls-gap' : ''}${wide ? ' ls-wide' : ''}${openLine === l.id ? ' ls-open' : ''}${inPend ? ' ls-pend' : ''}" data-k="${k}" data-lid="${esc(l.id)}" style="--h:${Math.min(n, 4)}">${esc(l.t === 'paren' && l.x && !/^\(/.test(l.x) ? '(' + l.x + ')' : l.x) || '&nbsp;'}${notes ? `<span class="ls-note" title="${notes} note${notes === 1 ? '' : 's'}">${notes}</span>` : ''}${gap ? '<span class="ls-mk" title="No shot covers this line">!</span>' : wide ? '<span class="ls-mk w" title="Only a wide shot sees this">W</span>' : ''}</div>`; }).join('')}</div>
            <div class="ls-gutter">${shots.map((c, k) => `<div class="ls-col${circled(d, c) ? ' shot' : ''}" data-col="${esc(c.id)}" style="--c:${PAL[k % PAL.length]};left:${k * 26}px" data-r="${(range(sc, c) || []).join(',')}"><span>${esc(label(c))}</span></div>`).join('')}</div></div></section>`).join('')}</div>
        <aside class="ls-side" id="lsSide"${openLine ? '' : ' hidden'}></aside></div></div>`;
    place(el);
    if (openLine) side(el, d, scs);
    el.onclick = e => click(e, el, d, scs);
    el.onkeydown = e => { if (e.target.id === 'lsNoteIn' && e.key === 'Enter') { e.preventDefault(); el.querySelector('#lsNoteAdd').click(); } };
  } });

  // draw each shot's line from its first covered line to its last
  function place(el) {
    el.querySelectorAll('.ls-body').forEach(body => {
      const lines = body.querySelectorAll('.ls-l');
      body.querySelectorAll('.ls-col').forEach(col => {
        const r = col.dataset.r.split(',').filter(Boolean).map(Number); if (r.length < 2 || !lines[r[0]] || !lines[r[1]]) { col.style.display = 'none'; return; }
        const top = lines[r[0]].offsetTop, bottom = lines[r[1]].offsetTop + lines[r[1]].offsetHeight;
        col.style.top = top + 'px'; col.style.height = Math.max(14, bottom - top) + 'px'; col.style.display = '';
      });
    });
  }
  window.addEventListener('resize', () => { const el = document.querySelector('.fws .fbody[data-tab="lined"]'); if (el) place(el); });

  function click(e, el, d, scs) {
    const t = e.target;
    if (t.closest('#lsHeat')) { heat = !heat; return F.refresh(); }
    if (t.closest('#lsPdf')) { const pg = el.querySelector('#lsPage'); return N.saveNode(pg, `${d.title || 'Film'} lined script`, 'pdf'); }
    if (t.closest('#lsDone')) { active = null; pending = null; return F.refresh(); }
    if (t.closest('#lsGuess')) { N.snap(); let n = 0; scs.forEach(sc => shotsFor(sc.num).forEach(c => { if (!range(sc, c)) { const g = guess(sc, c); if (g) { c.cover = g; n++; } } })); N.touch(); N.toast(`Coverage filled in for ${n} shot${n === 1 ? '' : 's'}. Tap a shot’s tag to adjust it.`); return F.refresh(); }
    const chip = t.closest('[data-shot]'); if (chip) { if (!N.P.canWrite) return; active = active === chip.dataset.shot ? null : chip.dataset.shot; pending = null; openLine = null; return F.refresh(); }
    const actShot = () => { const x = F.allShots().find(y => y.c.id === active); return x && x.c; };
    if (t.closest('#lsWhole') || t.closest('#lsClear')) { const c = actShot(); const sc = scs.find(s => String(s.num) === String(c.scene)); if (!c || !sc) return; N.snap();
      if (t.closest('#lsClear')) delete c.cover; else { const g = guess(sc, { size: 'Wide' }); if (g) c.cover = g; } N.touch(); pending = null; return F.refresh(); }
    if (t.closest('#lsSideClose')) { openLine = null; return F.refresh(); }
    if (t.closest('#lsNoteAdd')) return addNote(el, d, false);
    if (t.closest('#lsVoice')) return addNote(el, d, true);
    const pl = t.closest('[data-play]'); if (pl) { N.Store.mediaUrl(pl.dataset.play).then(u => { if (u) new Audio(u).play(); else N.toast('That recording isn’t on this device'); }); return; }
    const nd = t.closest('[data-ndel]'); if (nd) { F.change(dd => { dd.lineNotes[openLine] = (dd.lineNotes[openLine] || []).filter(x => x.id !== nd.dataset.ndel); }); return; }
    const line = t.closest('.ls-l'); if (!line) return;
    const si = +line.closest('[data-sc]').dataset.sc, k = +line.dataset.k, sc = scs[si];
    if (active) {
      const c = actShot(); if (!c) return;
      if (String(c.scene) !== String(sc.num)) return N.toast(`${label(c)} belongs to scene ${c.scene}. Tap lines in that scene.`);
      if (!pending) { pending = { sc: si, k }; return F.refresh(); }
      N.snap(); c.cover = { from: sc.lines[Math.min(pending.k, k)].id, to: sc.lines[Math.max(pending.k, k)].id }; N.touch(); pending = null; return F.refresh();
    }
    openLine = openLine === line.dataset.lid ? null : line.dataset.lid; F.refresh();
  }

  // everything about one line
  function side(el, d, scs) {
    const box = el.querySelector('#lsSide'); let sc, k = -1;
    scs.some(s => { const i = s.lines.findIndex(l => l.id === openLine); if (i >= 0) { sc = s; k = i; return true; } return false; });
    if (!sc) { box.hidden = true; return; }
    const l = sc.lines[k], shots = shotsFor(sc.num).filter(c => { const r = range(sc, c); return r && k >= r[0] && k <= r[1]; });
    const notes = (d.lineNotes && d.lineNotes[l.id]) || [];
    const speaker = (() => { for (let j = k; j >= 0; j--) { if (sc.lines[j].t === 'char') return sc.lines[j].x; if (!['dial', 'paren', 'char'].includes(sc.lines[j].t)) return null; } return null; })();
    const thumb = c => { if (!c.frame) return ''; const u = N.Store.cachedUrl(c.frame); if (u === undefined) { N.Store.mediaUrl(c.frame).then(() => F.refresh()); return ''; } return u ? `<img src="${esc(u)}" alt="">` : ''; };
    box.innerHTML = `<header><small>Scene ${esc(sc.num)}${speaker ? ' · ' + esc(speaker) : ''}</small><button class="ib xs" id="lsSideClose" aria-label="Close">✕</button></header>
      <blockquote>${esc(l.x)}</blockquote>
      <h4>Seen in</h4>${shots.length ? shots.map(c => { const ts = (d.takes || []).filter(t => String(t.scene) === String(c.scene) && String(t.shot) === String(c.letter)).sort((a, b) => a.n - b.n), en = editNotes(c);
        return `<div class="ls-shot">${thumb(c)}<div><b>${esc(label(c))}</b> <span>${esc([c.size, c.lens, c.move].filter(Boolean).join(' · '))}</span>${c.text ? `<p>${esc(c.text)}</p>` : ''}
          <p class="ls-takes">${ts.length ? ts.map(t => `<span class="tkc mk-${t.mark || 'none'}" title="${esc(t.note || '')}">${t.n}</span>`).join('') + (ts.filter(t => t.note).map(t => `<em>Take ${t.n}: ${esc(t.note)}</em>`).join('')) : '<em>Not shot yet</em>'}</p>
          ${en.map(x => `<p class="ls-edit"><b>Edit note</b> ${esc(x.n.text)}</p>`).join('')}</div></div>`; }).join('') : '<p class="ls-none">No shot covers this line yet.</p>'}
      <h4>Notes on this line</h4><ul class="ls-notes">${notes.map(n => `<li><b>${esc(n.by || 'Someone')}</b> ${n.voice ? `<button class="ib xs" data-play="${esc(n.voice)}">▶ Voice note${n.len ? ' · ' + n.len + 's' : ''}</button>` : esc(n.text)}${N.P.canWrite ? `<button class="ib xs" data-ndel="${esc(n.id)}" aria-label="Delete note">✕</button>` : ''}</li>`).join('') || '<li class="fhint">None yet. Directors use these for performance notes.</li>'}</ul>
      ${N.P.canWrite ? `<div class="ls-add"><input id="lsNoteIn" placeholder="A note about this line"><button class="ib" id="lsNoteAdd">Add</button><button class="ib" id="lsVoice" title="Record a voice note">🎙</button></div>` : ''}`;
    box.hidden = false;
  }
  async function addNote(el, d, voice) {
    const by = (N.live && N.live.me() && N.live.me().name) || localStorage.getItem('itan:name') || 'Director', lid = openLine;
    const push = note => F.change(dd => { dd.lineNotes = dd.lineNotes || {}; dd.lineNotes[lid] = [...(dd.lineNotes[lid] || []), { id: F.uid(), by, t: Date.now(), ...note }]; });
    if (voice) return N.recordVoice(null, null, (id, secs) => push({ voice: id, len: secs, text: '' }), 'Voice note on this line');
    const inp = el.querySelector('#lsNoteIn'), text = inp.value.trim(); if (!text) return inp.focus(); push({ text });
  }
})();
