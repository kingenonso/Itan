/* Take log: on set, log every take of every shot from a phone: circled, OK or no good, with notes,
   clip name and camera and sound rolls. It makes the camera report and sound report for the editor,
   and exports a metadata file that DaVinci Resolve reads, so circled takes are marked in the edit. */
(function () {
  const N = window.N, F = N.film, esc = N.esc, S = N.S;
  const MARKS = [['circle', 'Circled', '◯'], ['ok', 'OK', '✓'], ['ng', 'No good', '✕']];
  let view = 'log', st = {};
  try { st = JSON.parse(localStorage.getItem('itan:takes') || '{}'); } catch (e) {}
  const keep = () => { try { localStorage.setItem('itan:takes', JSON.stringify(st)); } catch (e) {} };
  const key = (scene, shot) => `${scene}|${shot}`;
  const ofShot = (d, scene, shot) => (d.takes || []).filter(t => String(t.scene) === String(scene) && String(t.shot) === String(shot)).sort((a, b) => a.n - b.n);
  const markOf = m => MARKS.find(x => x[0] === m);
  const dayName = (d, id) => { const i = d.days.findIndex(x => x.id === id); return i < 0 ? 'No day' : `Day ${i + 1}${d.days[i].date ? ' · ' + F.fmtDate(d.days[i].date) : ''}`; };

  // mark the shot card done once it has a circled take
  function shotDone(scene, shot) {
    const x = F.allShots().find(y => String(y.c.scene) === String(scene) && String(y.c.letter) === String(shot));
    if (x && (x.c.status || 'todo') === 'todo') { x.c.status = 'done'; }
  }

  F.tabs.push({ id: 'takes', label: 'Takes', order: 41, render(el, d) {
    d.takes = d.takes || [];
    if (!st.day || (st.day !== '-' && !d.days.find(x => x.id === st.day))) st.day = (d.days.find(x => x.date === N.todayStr(0)) || d.days[0] || { id: '-' }).id;
    const day = d.days.find(x => x.id === st.day);
    // shots for the chosen day's scenes, else every shot
    let sceneNums = day ? F.dayScenes(d, day).map(s => String(s.num)) : null; if (sceneNums && !sceneNums.length) sceneNums = null;
    let shots = F.allShots().map(x => x.c).filter(c => !sceneNums || sceneNums.includes(String(c.scene)))
      .sort((a, b) => String(a.scene).localeCompare(String(b.scene), undefined, { numeric: true }) || String(a.letter).localeCompare(String(b.letter)));
    if (!st.scene && shots[0]) { st.scene = String(shots[0].scene); st.shot = String(shots[0].letter); }
    const cur = st.scene ? ofShot(d, st.scene, st.shot || '') : [];
    const last = cur[cur.length - 1];
    const takeRow = t => `<li class="tk mk-${t.mark || 'none'}" data-tk="${esc(t.id)}"><b class="tk-n">${t.n}</b>
      <div class="tk-marks">${MARKS.map(([k, l, ic]) => `<button data-mark="${k}" class="${t.mark === k ? 'on' : ''}" title="${l}" aria-label="${l}">${ic}</button>`).join('')}</div>
      <input data-tf="clip" value="${esc(t.clip || '')}" placeholder="Clip file name" aria-label="Clip file name"><input data-tf="note" value="${esc(t.note || '')}" placeholder="Note: focus soft, great performance…" aria-label="Note" class="grow">
      <button class="ib xs" data-tkdel aria-label="Delete take">✕</button></li>`;
    const all = d.takes.slice().sort((a, b) => (a.t || 0) - (b.t || 0));
    const forDay = all.filter(t => view === 'log' || st.repDay === '*' || t.day === (st.repDay || st.day));
    el.innerHTML = `<div class="fwrap wide tks"><div class="rp-bar"><div class="seg">${[['log', 'Log takes'], ['camera', 'Camera report'], ['sound', 'Sound report']].map(([k, l]) => `<button data-tv="${k}" class="${k === view ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="cs-act">${view === 'log' ? `<button class="ib" id="tkResolve" title="A metadata file for DaVinci Resolve">Export for DaVinci Resolve</button>` : `<button class="ib" data-tksave="png">Save as picture</button><button class="ib" data-tksave="pdf">Save as PDF</button>`}</div></div>
      <div class="tk-set"><label>Shoot day<select data-st="day">${d.days.map(x => `<option value="${esc(x.id)}"${x.id === st.day ? ' selected' : ''}>${esc(dayName(d, x.id))}</option>`).join('')}<option value="-"${st.day === '-' ? ' selected' : ''}>No day</option></select></label>
        <label>Camera<input data-st="cam" value="${esc(st.cam || 'A')}" class="w4"></label><label>Camera roll or card<input data-st="roll" value="${esc(st.roll || 'A001')}" placeholder="A001"></label><label>Sound roll<input data-st="snd" value="${esc(st.snd || '')}" placeholder="S001"></label></div>
      ${view === 'log' ? `
      <section class="fsec"><h3>Shot</h3><div class="tk-shots">${shots.map(c => { const n = ofShot(d, c.scene, c.letter), circ = n.some(t => t.mark === 'circle');
          return `<button data-pick="${esc(c.scene)}|${esc(c.letter)}" class="${String(c.scene) === st.scene && String(c.letter) === st.shot ? 'on' : ''}${circ ? ' circ' : ''}"><b>${esc(c.scene + c.letter)}</b><small>${n.length ? n.length + ' take' + (n.length === 1 ? '' : 's') : esc(c.size || '')}</small></button>`; }).join('')}
          <button data-pick="__other" class="other">Other shot…</button></div>
        ${shots.length ? '' : '<p class="fhint">No Shot cards for this day yet. Use “Other shot” to log by scene and shot, or add Shot cards to your boards.</p>'}</section>
      ${st.scene ? `<section class="fsec tk-cur"><div class="slate"><div><small>Scene</small><b>${esc(st.scene)}</b></div><div><small>Shot</small><b>${esc(st.shot || '—')}</b></div><div><small>Take</small><b>${(last ? last.n : 0) + 1}</b></div><div><small>Roll</small><b>${esc(st.roll || 'A001')}</b></div></div>
        <div class="row tk-go"><button class="pri big" id="tkAdd">+ Log take ${(last ? last.n : 0) + 1}</button>${last ? `<span class="fhint">Then mark it ◯ circled, ✓ OK or ✕ no good</span>` : ''}</div>
        <ol class="tk-list">${cur.slice().reverse().map(takeRow).join('') || '<li class="empty-row">No takes yet for this shot</li>'}</ol></section>` : ''}` : report(d, forDay)}
    </div>`;
    el.onchange = e => {
      const t = e.target;
      if (t.dataset.st) { st[t.dataset.st] = t.value.trim(); if (t.dataset.st === 'day') { st.scene = ''; st.repDay = ''; } keep(); return F.refresh(); }
      if (t.dataset.rep) { st.repDay = t.value; keep(); return F.refresh(); }
      const row = t.closest('[data-tk]'); if (row && t.dataset.tf) F.change(dd => { const k = dd.takes.find(x => x.id === row.dataset.tk); if (k) k[t.dataset.tf] = t.value.trim(); }, true);
    };
    el.onclick = async e => {
      const t = e.target;
      const tv = t.closest('[data-tv]'); if (tv) { view = tv.dataset.tv; return F.refresh(); }
      const pk = t.closest('[data-pick]'); if (pk) {
        if (pk.dataset.pick === '__other') { const v = await F.ask('Which shot?', 'Scene and shot, like 12B (or 12A C for scene 12A, shot C)', st.scene ? st.scene + (st.shot || '') : ''); if (!v) return; const u = v.toUpperCase().trim(), m = u.match(/^(\d+[A-Z]?)[\s\/-]+([A-Z]{1,2})$/) || u.match(/^(\d+)([A-Z]{1,2})$/) || u.match(/^(\d+[A-Z]?)$/) && [0, u, ''] || [0, u, '']; st.scene = m[1]; st.shot = m[2] || ''; }
        else [st.scene, st.shot] = pk.dataset.pick.split('|');
        keep(); return F.refresh();
      }
      if (t.closest('#tkAdd')) { const n = (last ? last.n : 0) + 1; F.change(dd => { dd.takes = dd.takes || []; dd.takes.push({ id: F.uid(), day: st.day === '-' ? '' : st.day, scene: st.scene, shot: st.shot || '', n, cam: st.cam || 'A', roll: st.roll || 'A001', snd: st.snd || '', clip: '', note: '', mark: '', t: Date.now() }); }); return; }
      const mk = t.closest('[data-mark]'); if (mk) { const id = t.closest('[data-tk]').dataset.tk; F.change(dd => { const k = dd.takes.find(x => x.id === id); k.mark = k.mark === mk.dataset.mark ? '' : mk.dataset.mark; if (k.mark === 'circle') shotDone(k.scene, k.shot); }); return; }
      if (t.closest('[data-tkdel]')) { const id = t.closest('[data-tk]').dataset.tk; F.change(dd => { dd.takes = dd.takes.filter(x => x.id !== id); }); return; }
      if (t.closest('#tkResolve')) return resolveCSV(d);
      const sv = t.closest('[data-tksave]'); if (sv) N.saveNode(el.querySelector('#tkSheet'), `${d.title || 'Film'} ${view} report`, sv.dataset.tksave);
    };
  } });

  function report(d, takes) {
    const sel = `<label class="tk-rep">Show<select data-rep>${d.days.map(x => `<option value="${esc(x.id)}"${x.id === (st.repDay || st.day) ? ' selected' : ''}>${esc(dayName(d, x.id))}</option>`).join('')}<option value="*"${st.repDay === '*' ? ' selected' : ''}>Every day</option></select></label>`;
    const by = view === 'camera' ? 'roll' : 'snd', groups = new Map();
    takes.forEach(t => { const k = t[by] || (view === 'camera' ? 'No roll' : 'No sound roll'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
    const dateTxt = st.repDay === '*' ? 'Every shoot day' : dayName(d, st.repDay || st.day);
    return `${sel}<div class="sheet rpt" id="tkSheet"><header><div><small>${view === 'camera' ? 'Camera report' : 'Sound report'}</small><h2>${esc(d.title)}</h2><p>${esc(dateTxt)}</p></div></header>
      ${takes.length ? [...groups].map(([k, ts]) => `<h3>${view === 'camera' ? 'Roll' : 'Sound roll'} ${esc(k)}<span>${ts.length} take${ts.length === 1 ? '' : 's'}</span></h3>
        <table class="ftable tkt"><thead><tr><th>Scene</th><th>Shot</th><th class="c">Take</th>${view === 'camera' ? '<th>Camera</th><th>Clip</th>' : '<th>Camera roll</th>'}<th class="c">Circled</th><th>Notes</th></tr></thead><tbody>
        ${ts.map(t => `<tr class="${t.mark === 'ng' ? 'ng' : ''}"><td>${esc(t.scene)}</td><td>${esc(t.shot)}</td><td class="c">${t.mark === 'circle' ? `<span class="circ">${t.n}</span>` : t.n}</td>${view === 'camera' ? `<td>${esc(t.cam || '')}</td><td>${esc(t.clip || '')}</td>` : `<td>${esc(t.roll || '')}</td>`}<td class="c">${t.mark === 'circle' ? '◯' : t.mark === 'ng' ? 'NG' : t.mark === 'ok' ? 'OK' : ''}</td><td>${esc(t.note || '')}</td></tr>`).join('')}</tbody></table>`).join('')
      : '<p class="fhint">No takes logged for this day yet.</p>'}<footer>Made with Itàn</footer></div>`;
  }

  // a CSV that DaVinci Resolve imports as clip metadata (File › Import › Metadata, matched by file name)
  function resolveCSV(d) {
    const ts = (d.takes || []).filter(t => t.clip);
    if (!ts.length) return N.toast('Type each take’s clip file name first, for example C0012.MP4. Resolve uses it to find the clip.');
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['File Name', 'Scene', 'Shot', 'Take', 'Good Take', 'Camera #', 'Roll Card #', 'Comments', 'Keywords']]
      .concat(ts.map(t => [t.clip, t.scene, t.shot, t.n, t.mark === 'circle' ? '1' : '0', t.cam || '', t.roll || '', t.note || '', t.mark === 'circle' ? 'Circled' : t.mark === 'ng' ? 'No good' : t.mark === 'ok' ? 'OK' : '']));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = `${d.title || 'Film'} take metadata.csv`; document.body.append(a); a.click(); a.remove();
    N.modal(`<h2>Take notes saved for Resolve</h2><p>${ts.length} take${ts.length === 1 ? '' : 's'} with clip names are in the file.</p>
      <ol class="gm-steps"><li>In DaVinci Resolve, import your footage into the Media Pool.</li><li>Choose <b>File › Import › Metadata To › Media Pool</b> and pick the file.</li><li>Match clips by <b>file name</b>. Scene, shot, take, comments and circled takes (Good Take) fill in on each clip.</li></ol>
      <div class="row"><button class="pri" data-close>Done</button></div>`);
  }
})();
