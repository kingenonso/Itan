/* Call sheets: one per shoot day, filled in from the schedule, the script breakdown and the people list.
   Add the day's details once, then save it as a picture or PDF, or send it straight to WhatsApp. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  let cur = null;
  const hhmm = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m || 0); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  F.tabs.push({ id: 'callsheets', label: 'Call sheets', order: 30, render(el, d) {
    if (!d.days.length) { el.innerHTML = `<div class="fwrap"><div class="empty-row big">Call sheets are made from your shoot days.<br>Add days and scenes on the Schedule tab first.</div><div class="row" style="justify-content:center"><button class="pri" data-ftab="schedule">Go to Schedule</button></div></div>`; return; }
    if (!cur || !d.days.find(x => x.id === cur)) cur = d.days[0].id;
    const i = d.days.findIndex(x => x.id === cur), day = d.days[i], scenes = F.dayScenes(d, day);
    day.castCalls = day.castCalls || {};
    const castIds = [...new Set(scenes.flatMap(s => s.cast || []))], cast = castIds.map(id => F.person(d, id)).filter(Boolean).sort((a, b) => (+a.num || 99) - (+b.num || 99));
    const crew = d.people.filter(p => p.kind === 'crew');
    const locs = [...new Set(scenes.map(s => s.loc).filter(Boolean))];
    const needs = k => [...new Set(scenes.flatMap(s => (s.tags && s.tags[k]) || []))];
    const f = (k, label, ph, type = 'text') => `<label>${label}<input data-cs="${k}" type="${type}" value="${esc(day[k] || '')}" placeholder="${esc(ph || '')}"></label>`;
    el.innerHTML = `<div class="cs">
      <aside class="cs-form">
        <div class="seg days">${d.days.map((x, j) => `<button data-csday="${esc(x.id)}" class="${x.id === cur ? 'on' : ''}">Day ${j + 1}</button>`).join('')}</div>
        ${f('date', 'Date', '', 'date')}${f('call', 'Crew call', '', 'time')}${f('address', 'Location address or map link', locs.join(', '))}${f('parking', 'Parking', 'Where cars and the van can park')}
        ${f('hospital', 'Nearest hospital', 'Name and address')}${f('weather', 'Weather', 'Check the forecast the day before')}${f('sunset', 'Sunrise and sunset', 'For outdoor scenes')}
        <label>Notes for everyone<textarea data-cs="notes" rows="3" placeholder="Bring water. Quiet on set during takes.">${esc(day.notes || '')}</textarea></label>
        <label>Producer’s name and phone<input data-film="contact" value="${esc(d.contact || '')}" placeholder="Name · phone"></label>
        ${cast.length ? `<h4>Cast call times</h4>${cast.map(p => `<label class="inline">${esc((p.num ? p.num + '. ' : '') + (p.role || ''))}${p.name ? ' · ' + esc(p.name) : ''}<input type="time" data-castcall="${esc(p.id)}" value="${esc(day.castCalls[p.id] || day.call || '')}"></label>`).join('')}` : ''}
      </aside>
      <section class="cs-out"><div class="cs-act"><button class="pri" data-cssave="share">Send</button><button class="ib" data-cssave="png">Save as picture</button><button class="ib" data-cssave="pdf">Save as PDF</button></div>
        <div class="sheet callsheet" id="csSheet">
          <header><div><small>Call sheet</small><h2>${esc(d.title)}</h2><p>Day ${i + 1} of ${d.days.length}${day.date ? ' · ' + esc(new Date(day.date + 'T00:00:00').toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : ''}</p></div>
            <div class="callbox"><small>Crew call</small><b>${esc(hhmm(day.call) || '—')}</b></div></header>
          <div class="cs-grid">
            <div><small>Location</small><p>${esc(day.address || locs.join(', ') || '—')}</p></div>
            <div><small>Parking</small><p>${esc(day.parking || '—')}</p></div>
            <div><small>Nearest hospital</small><p>${esc(day.hospital || '—')}</p></div>
            <div><small>Weather</small><p>${esc(day.weather || '—')}${day.sunset ? '<br>' + esc(day.sunset) : ''}</p></div>
            <div><small>Producer</small><p>${esc(d.contact || '—')}</p></div>
          </div>
          <h3>Scenes</h3>
          <table class="ftable"><thead><tr><th>Scene</th><th>Set</th><th>Day/night</th><th>Pages</th><th>Cast</th><th>What happens</th></tr></thead><tbody>
            ${scenes.map(s => `<tr><td><b>${esc(s.num)}</b></td><td>${esc(s.ie)}. ${esc(s.loc || '')}</td><td>${esc(s.dn || '')}</td><td>${F.eighths(s.pages)}</td><td>${F.castOf(d, s).map(p => esc(p.num || '?')).join(', ')}</td><td>${esc(s.summary || '')}</td></tr>`).join('') || '<tr><td colspan="6">No scenes on this day yet</td></tr>'}
            <tr class="tot"><td colspan="3">Total</td><td>${F.eighths(scenes.reduce((n, s) => n + (s.pages || 0), 0))}</td><td colspan="2"></td></tr></tbody></table>
          ${cast.length ? `<h3>Cast</h3><table class="ftable"><thead><tr><th>No.</th><th>Character</th><th>Actor</th><th>Call</th><th>Phone</th></tr></thead><tbody>${cast.map(p => `<tr><td>${esc(p.num || '')}</td><td>${esc(p.role || '')}</td><td>${esc(p.name || '')}</td><td><b>${esc(hhmm(day.castCalls[p.id] || day.call))}</b></td><td>${esc(p.phone || '')}</td></tr>`).join('')}</tbody></table>` : ''}
          ${crew.length ? `<h3>Crew</h3><table class="ftable"><thead><tr><th>Job</th><th>Name</th><th>Phone</th></tr></thead><tbody>${crew.map(p => `<tr><td>${esc(p.role || '')}</td><td>${esc(p.name || '')}</td><td>${esc(p.phone || '')}</td></tr>`).join('')}</tbody></table>` : ''}
          ${['props', 'wardrobe', 'makeup', 'vehicles', 'effects', 'extras'].some(k => needs(k).length) ? `<h3>Needed today</h3><div class="cs-needs">${[['props', 'Props'], ['wardrobe', 'Wardrobe'], ['makeup', 'Hair and makeup'], ['vehicles', 'Vehicles'], ['effects', 'Effects'], ['extras', 'Extras']].filter(([k]) => needs(k).length).map(([k, l]) => `<div><small>${l}</small><p>${esc(needs(k).join(', '))}</p></div>`).join('')}</div>` : ''}
          ${day.notes ? `<h3>Notes</h3><p class="cs-notes">${esc(day.notes)}</p>` : ''}
          <footer>Made with Itàn</footer>
        </div></section></div>`;
    el.onclick = e => {
      const dd = e.target.closest('[data-csday]'); if (dd) { cur = dd.dataset.csday; return F.refresh(); }
      const sv = e.target.closest('[data-cssave]'); if (sv) N.saveNode(el.querySelector('#csSheet'), `${d.title || 'Film'} call sheet day ${i + 1}`, sv.dataset.cssave);
    };
    el.onchange = e => {
      const t = e.target;
      if (t.dataset.cs) F.change(x => { const dy = x.days.find(y => y.id === cur); dy[t.dataset.cs] = t.value.trim(); });
      else if (t.dataset.castcall) F.change(x => { const dy = x.days.find(y => y.id === cur); dy.castCalls = dy.castCalls || {}; dy.castCalls[t.dataset.castcall] = t.value; });
      else if (t.dataset.film) F.change(x => { x[t.dataset.film] = t.value.trim(); });
    };
  } });
})();
