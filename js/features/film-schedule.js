/* Shooting schedule: each scene is a colour-coded strip (inside or outside, day or night).
   Drag strips into shoot days to plan the shoot; each day adds up its pages and screen time.
   On touch screens, tap a strip to move it. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const dayLabel = (d, i) => `Day ${i + 1}`;
  const fmtDate = s => { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }); };
  F.dayLabel = dayLabel; F.fmtDate = fmtDate;
  F.dayScenes = (d, day) => day.sceneIds.map(id => d.scenes.find(s => s.id === id)).filter(Boolean);
  const stripHTML = (d, s) => `<div class="strip ${F.stripClass(s)}" draggable="true" data-sid="${esc(s.id)}" tabindex="0">
    <b>${esc(s.num)}</b><span class="sl">${esc(s.ie)} · ${esc(s.loc || 'Location')}</span><em>${esc(s.dn || '')}</em>
    <small class="pg">${F.eighths(s.pages)}</small><small class="cn" title="Cast numbers">${F.castOf(d, s).map(p => esc(p.num || '?')).join(', ')}</small>
    ${s.summary ? `<span class="sum">${esc(s.summary)}</span>` : ''}</div>`;
  const totals = (scenes) => { const p = scenes.reduce((n, s) => n + (s.pages || 0), 0); return `${F.eighths(p)} pages · ${p < 8 ? 'under a minute' : 'about ' + Math.round(p / 8) + ' min'} on screen`; };

  F.tabs.push({ id: 'schedule', label: 'Schedule', order: 20, render(el, d) {
    const planned = new Set(d.days.flatMap(x => x.sceneIds));
    const loose = (d.groupLoose ? d.scenes.slice() : F.sortScenes(d)).filter(s => !planned.has(s.id));
    el.innerHTML = `<div class="sched-top"><div class="legend"><span class="strip int-day">Inside · day</span><span class="strip ext-day">Outside · day</span><span class="strip int-night">Inside · night</span><span class="strip ext-night">Outside · night</span></div>
        <div class="sched-act"><button class="ib" id="scGroup" title="Sort unscheduled scenes by location, so scenes in the same place sit together">Group by location</button><button class="pri" id="scAddDay">+ Add shoot day</button></div></div>
      ${d.scenes.length ? '' : `<p class="fhint" style="margin:0 4px 12px">No scenes yet. Bring in your script on the Breakdown tab, or add scenes there by hand.</p>`}
      <div class="board-cols">
        <section class="dcol loose" data-day=""><header><b>Not scheduled</b><small>${loose.length} scene${loose.length === 1 ? '' : 's'}</small></header><div class="dlist" data-drop="">${loose.map(s => stripHTML(d, s)).join('') || '<div class="empty-row">All scenes are scheduled</div>'}</div></section>
        ${d.days.map((day, i) => { const sc = F.dayScenes(d, day); return `<section class="dcol" data-day="${esc(day.id)}"><header><b>${dayLabel(day, i)}</b><button class="ib xs" data-delday="${esc(day.id)}" aria-label="Remove ${dayLabel(day, i)}">✕</button>
          <div class="dfields"><input type="date" data-df="date" value="${esc(day.date || '')}" aria-label="Date"><input type="time" data-df="call" value="${esc(day.call || '')}" aria-label="Crew call time"></div>
          <small>${sc.length ? totals(sc) : 'Drag scenes here'}</small></header><div class="dlist" data-drop="${esc(day.id)}">${sc.map(s => stripHTML(d, s)).join('')}</div></section>`; }).join('')}
      </div>`;
    // drag and drop between days
    let dragId = null;
    el.ondragstart = e => { const s = e.target.closest('[data-sid]'); if (!s) return; dragId = s.dataset.sid; s.classList.add('lifting'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} };
    el.ondragend = e => { el.querySelectorAll('.lifting,.over').forEach(x => x.classList.remove('lifting', 'over')); };
    el.ondragover = e => { const l = e.target.closest('[data-drop]'); if (!l || !dragId) return; e.preventDefault(); el.querySelectorAll('.over').forEach(x => x.classList.remove('over')); l.classList.add('over'); };
    el.ondrop = e => { const l = e.target.closest('[data-drop]'); if (!l || !dragId) return; e.preventDefault();
      const kids = [...l.querySelectorAll('[data-sid]')].filter(k => k.dataset.sid !== dragId); const idx = kids.filter(k => { const r = k.getBoundingClientRect(); return r.top + r.height / 2 < e.clientY; }).length;
      move(dragId, l.dataset.drop, idx); dragId = null; };
    el.onclick = e => {
      const t = e.target;
      if (t.closest('#scAddDay')) return F.change(dd => { const last = dd.days[dd.days.length - 1]; let date = ''; if (last && last.date) { const x = new Date(last.date + 'T00:00:00'); x.setDate(x.getDate() + 1); date = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); } dd.days.push({ id: F.uid(), date, call: last ? last.call : '07:00', sceneIds: [], castCalls: {} }); });
      if (t.closest('#scGroup')) return F.change(dd => { const planned2 = new Set(dd.days.flatMap(x => x.sceneIds)); const key = s => [s.loc || '', s.ie, /NIGHT/.test(s.dn || '') ? 1 : 0].join('|'); const rest = dd.scenes.filter(s => !planned2.has(s.id)).sort((a, b) => key(a).localeCompare(key(b)) || String(a.num).localeCompare(String(b.num), undefined, { numeric: true })); const on = dd.scenes.filter(s => planned2.has(s.id)); dd.scenes = [...on, ...rest]; dd.groupLoose = true; });
      const del = t.closest('[data-delday]'); if (del) { const day = d.days.find(x => x.id === del.dataset.delday); const go = () => F.change(dd => { dd.days = dd.days.filter(x => x.id !== del.dataset.delday); }); return day.sceneIds.length ? N.confirmBox(`Remove this shoot day? Its ${day.sceneIds.length} scene${day.sceneIds.length === 1 ? '' : 's'} go back to Not scheduled.`, 'Remove').then(ok => ok && go()) : go(); }
      const st = t.closest('[data-sid]'); if (st && matchMedia('(hover: none)').matches) return mover(st.dataset.sid);
    };
    el.onkeydown = e => { const st = e.target.closest('[data-sid]'); if (st && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); mover(st.dataset.sid); } };
    el.onchange = e => { const t = e.target; if (!t.dataset.df) return; const id = t.closest('[data-day]').dataset.day; F.change(dd => { const day = dd.days.find(x => x.id === id); if (day) day[t.dataset.df] = t.value; }, true); };
  } });
  function move(sid, dayId, idx) {
    F.change(d => {
      d.days.forEach(day => day.sceneIds = day.sceneIds.filter(x => x !== sid));
      if (dayId) { const day = d.days.find(x => x.id === dayId); if (day) day.sceneIds.splice(Math.min(idx, day.sceneIds.length), 0, sid); }
    });
  }
  function mover(sid) {
    const d = F.data(), s = d.scenes.find(x => x.id === sid);
    const m = N.modal(`<h2>Move scene ${esc(s.num)}</h2><p>${esc(F.sceneLabel(s))}</p><div class="row">${['<button data-mv="">Not scheduled</button>', ...d.days.map((day, i) => `<button data-mv="${esc(day.id)}">${dayLabel(day, i)}${day.date ? ' · ' + esc(fmtDate(day.date)) : ''}</button>`)].join('')}</div><div class="row" style="padding-top:0"><button data-close>Cancel</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { N.closeOv(); move(sid, b.dataset.mv, 999); });
  }
})();
