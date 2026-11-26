/* Industry reports made from the schedule and breakdown:
   Day Out of Days (which days each actor works), the one-line schedule, the location report,
   and what each shoot day needs. Each one saves as a PDF or picture. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const REPORTS = [['dood', 'Day Out of Days'], ['oneline', 'One-line schedule'], ['locations', 'Locations'], ['elements', 'Needs by day']];
  let cur = 'dood';
  const dateOf = day => day.date ? F.fmtDate(day.date) : '';

  // Day Out of Days codes: SW start work, W work, WF work finish, SWF start-work-finish, H hold (between work days, not working)
  F.dood = d => {
    const cast = d.people.filter(p => p.kind === 'cast').sort((a, b) => (+a.num || 999) - (+b.num || 999));
    return cast.map(p => {
      const work = d.days.map(day => F.dayScenes(d, day).some(s => (s.cast || []).includes(p.id)));
      const first = work.indexOf(true), last = work.lastIndexOf(true);
      const codes = work.map((w, i) => first < 0 ? '' : w ? (first === last ? 'SWF' : i === first ? 'SW' : i === last ? 'WF' : 'W') : i > first && i < last ? 'H' : '');
      return { p, codes, worked: work.filter(Boolean).length, held: codes.filter(c => c === 'H').length, span: first < 0 ? 0 : last - first + 1 };
    });
  };
  const sheetHead = (d, title, sub) => `<header><div><small>${esc(title)}</small><h2>${esc(d.title)}</h2><p>${esc(sub)}</p></div></header>`;
  const genDate = () => 'Made ' + new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });

  const R = {
    dood(d) {
      const rows = F.dood(d);
      if (!d.days.length || !rows.length) return `<div class="empty-row big">Day Out of Days shows which shoot days each actor works. It needs cast on the People tab and scenes placed in shoot days on the Schedule tab.</div>`;
      return `<div class="sheet rpt" id="rpSheet">${sheetHead(d, 'Day Out of Days', `${d.days.length} shoot day${d.days.length === 1 ? '' : 's'} · ${genDate()}`)}
        <div class="rpt-scroll"><table class="ftable dood"><thead><tr><th>Cast</th>${d.days.map((day, i) => `<th class="c">Day ${i + 1}<small>${esc(dateOf(day))}</small></th>`).join('')}<th class="c">Work</th><th class="c">Hold</th><th class="c">Total</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td><b>${esc(r.p.num || '')}</b> ${esc(r.p.role || '')}${r.p.name ? `<small> ${esc(r.p.name)}</small>` : ''}</td>${r.codes.map(c => `<td class="c"><span class="dd dd-${c.toLowerCase()}">${c}</span></td>`).join('')}<td class="c">${r.worked}</td><td class="c">${r.held}</td><td class="c">${r.span}</td></tr>`).join('')}</tbody></table></div>
        <p class="fhint">SW starts work · W works · WF last work day · SWF works one day only · H on hold: booked but not shooting that day. Total is the days from first to last work day, which is what you pay most actors for.</p></div>`;
    },
    oneline(d) {
      if (!d.days.length) return `<div class="empty-row big">The one-line schedule lists every scene in shooting order. Add shoot days on the Schedule tab first.</div>`;
      const planned = new Set(d.days.flatMap(x => x.sceneIds)), loose = F.sortScenes(d).filter(s => !planned.has(s.id));
      const sRow = s => `<tr class="${F.stripClass(s)}"><td class="c"><b>${esc(s.num)}</b></td><td>${esc(s.ie)}. ${esc(s.loc || 'Location')} – ${esc(s.dn || '')}${s.summary ? `<small>${esc(s.summary)}</small>` : ''}</td><td class="c">${F.eighths(s.pages)}</td><td>${F.castOf(d, s).map(p => esc(p.num || '?')).join(', ')}</td></tr>`;
      return `<div class="sheet rpt" id="rpSheet">${sheetHead(d, 'One-line schedule', genDate())}
        <table class="ftable oneline"><thead><tr><th class="c">Scene</th><th>Set and description</th><th class="c">Pages</th><th>Cast</th></tr></thead><tbody>
        ${d.days.map((day, i) => { const sc = F.dayScenes(d, day), pg = sc.reduce((n, s) => n + (s.pages || 0), 0);
          return sc.map(sRow).join('') + `<tr class="eod"><td colspan="4">End of day ${i + 1}${day.date ? ' · ' + esc(dateOf(day)) : ''} · ${F.eighths(pg)} pages</td></tr>`; }).join('')}
        ${loose.length ? `<tr class="eod loose"><td colspan="4">Not scheduled yet</td></tr>${loose.map(sRow).join('')}` : ''}</tbody></table></div>`;
    },
    locations(d) {
      if (!d.scenes.length) return `<div class="empty-row big">The location report groups scenes by place. Bring in your script on the Breakdown tab first.</div>`;
      const map = new Map(); F.sortScenes(d).forEach(s => { const k = (s.loc || 'Location not set').toUpperCase(); (map.get(k) || map.set(k, []).get(k)).push(s); });
      const dayOf = s => d.days.findIndex(x => x.sceneIds.includes(s.id));
      return `<div class="sheet rpt" id="rpSheet">${sheetHead(d, 'Location report', `${map.size} location${map.size === 1 ? '' : 's'} · ${genDate()}`)}
        ${[...map].sort((a, b) => b[1].reduce((n, s) => n + (s.pages || 0), 0) - a[1].reduce((n, s) => n + (s.pages || 0), 0)).map(([loc, sc]) => { const days = [...new Set(sc.map(dayOf).filter(i => i >= 0))].sort((a, b) => a - b);
          return `<section class="rp-loc"><h3>${esc(loc)}</h3><p>${sc.length} scene${sc.length === 1 ? '' : 's'} · ${F.eighths(sc.reduce((n, s) => n + (s.pages || 0), 0))} pages · ${[...new Set(sc.map(s => s.ie))].join(' and ')} · ${[...new Set(sc.map(s => s.dn).filter(Boolean))].join(', ') || 'time not set'}</p>
            <p><b>Scenes</b> ${sc.map(s => esc(s.num)).join(', ')}${days.length ? ` · <b>Shooting</b> ${days.map(i => 'day ' + (i + 1) + (d.days[i].date ? ' (' + esc(dateOf(d.days[i])) + ')' : '')).join(', ')}` : ' · <b>Not scheduled</b>'}</p></section>`; }).join('')}</div>`;
    },
    elements(d) {
      if (!d.days.length) return `<div class="empty-row big">This lists everything each shoot day needs, from the tags on the Breakdown tab. Add shoot days on the Schedule tab first.</div>`;
      return `<div class="sheet rpt" id="rpSheet">${sheetHead(d, 'Needs by day', genDate())}
        ${d.days.map((day, i) => { const sc = F.dayScenes(d, day); const cast = [...new Set(sc.flatMap(s => s.cast || []))].map(id => F.person(d, id)).filter(Boolean).sort((a, b) => (+a.num || 99) - (+b.num || 99));
          const rows = F.CATS.slice(1).map(([k, label]) => [label, k, [...new Set(sc.flatMap(s => (s.tags && s.tags[k]) || []))]]).filter(r => r[2].length);
          return `<section class="rp-day"><h3>Day ${i + 1}${day.date ? ' · ' + esc(dateOf(day)) : ''}<small>${sc.length ? 'Scenes ' + sc.map(s => esc(s.num)).join(', ') : 'No scenes yet'}</small></h3>
            ${cast.length ? `<p><span class="tl tg-cast">Cast</span> ${cast.map(p => esc((p.num ? p.num + '. ' : '') + p.role)).join(', ')}</p>` : ''}
            ${rows.map(([label, k, items]) => `<p><span class="tl tg-${k}">${label}</span> ${items.map(esc).join(', ')}</p>`).join('') || (sc.length ? '<p class="fhint">Nothing tagged for these scenes yet.</p>' : '')}</section>`; }).join('')}</div>`;
    }
  };

  F.tabs.push({ id: 'reports', label: 'Reports', order: 47, render(el, d) {
    const body = R[cur](d), canSave = body.includes('id="rpSheet"');
    el.innerHTML = `<div class="fwrap wide"><div class="rp-bar"><div class="seg">${REPORTS.map(([k, l]) => `<button data-rp="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${canSave ? `<div class="cs-act"><button class="pri" data-rpsave="share">Send</button><button class="ib" data-rpsave="png">Save as picture</button><button class="ib" data-rpsave="pdf">Save as PDF</button></div>` : ''}</div>${body}</div>`;
    el.onclick = e => {
      const b = e.target.closest('[data-rp]'); if (b) { cur = b.dataset.rp; return F.refresh(); }
      const sv = e.target.closest('[data-rpsave]'); if (sv) N.saveNode(el.querySelector('#rpSheet'), `${d.title || 'Film'} ${REPORTS.find(r => r[0] === cur)[1]}`, sv.dataset.rpsave);
    };
  } });
})();
