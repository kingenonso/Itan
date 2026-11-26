/* Locations: everything about each place you shoot, in one spot.
   A map pin (from the phone's GPS or a search), where the sun rises, sets and sits at any hour on the shoot date
   (drawn on the map, which is always true north), contacts, fee (one tap into the budget), permits, and the practical
   things crews ask about: power, parking, noise, toilets, the nearest hospital. Scouting photos remember which way
   they faced. Call sheets get each location's address and a QR code for directions. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const NOTES = [['power', 'Power', 'Sockets, generator, NEPA hours'], ['parking', 'Parking', 'Where the van and cars go'], ['noise', 'Noise', 'Traffic, generators, mosque or church times'], ['toilets', 'Toilets', ''], ['hospital', 'Nearest hospital', ''], ['access', 'Access', 'Gate, keys, who lets us in']];
  let sel = null, map = null, layer = null, when = null;
  const L_ = () => (d => (d.locations = d.locations || []))(F.data());
  const dirUrl = l => `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lon}`;
  const hm = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const deg = a => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((a % 360) + 360) % 360 / 45) % 8];
  // scenes shot at a location: the scene's place matches one of the location's scene places
  const scenesAt = (d, l) => d.scenes.filter(s => (l.places || []).includes(String(s.loc || '').toUpperCase()));
  F.locationsOfDay = (d, day) => { const sc = F.dayScenes(d, day); return (d.locations || []).filter(l => sc.some(s => (l.places || []).includes(String(s.loc || '').toUpperCase()))); };
  // the date to show the sun for: the first shoot day here, else today
  const dayFor = (d, l) => { const ids = new Set(scenesAt(d, l).map(s => s.id)); const day = d.days.find(x => x.date && x.sceneIds.some(i => ids.has(i))); return day ? day.date : N.todayStr(0); };

  F.tabs.push({ id: 'locations', label: 'Locations', order: 46.5, render(el, d) {
    const ls = L_(); if (!sel || !ls.find(l => l.id === sel)) sel = ls[0] && ls[0].id;
    const l = ls.find(x => x.id === sel), places = [...new Set(d.scenes.map(s => String(s.loc || '').toUpperCase()).filter(Boolean))];
    const unplaced = places.filter(p => !ls.some(x => (x.places || []).includes(p)));
    el.innerHTML = `<div class="fwrap wide loc"><div class="rp-bar"><div class="loc-tabs">${ls.map(x => { const ph = (x.photos || [])[0];
        return `<button data-loc="${esc(x.id)}" class="${x.id === sel ? 'on' : ''}">${ph ? `<img data-media="${esc(ph.media)}" alt="">` : '<span class="loc-ph">⌖</span>'}<span><b>${esc(x.name)}</b><small>${scenesAt(d, x).length} scene${scenesAt(d, x).length === 1 ? '' : 's'}${x.lat ? '' : ' · no pin yet'}</small></span></button>`; }).join('')}
        <button class="add" id="lcAdd">+ Location</button>${unplaced.length ? `<button class="add" id="lcFromScript">+ ${unplaced.length} from the script</button>` : ''}</div>
        ${N.viewfinder ? '<div class="cs-act"><button class="pri" id="lcScout">◎ Scout with the viewfinder</button></div>' : ''}</div>
      ${!l ? `<div class="empty-row big">Add the places you’re shooting. Pin them on the map, see where the sun will be on your shoot date, and keep the details your crew will ask for.</div>` : `
      <div class="loc-main"><section class="fsec loc-info">
          <input class="loc-name" data-lf="name" value="${esc(l.name)}" aria-label="Location name">
          <div class="loc-addr"><input data-lf="address" value="${esc(l.address || '')}" placeholder="Address"><button class="ib" id="lcFind">Find on map</button><button class="ib" id="lcHere">◉ I’m here</button></div>
          ${l.lat ? `<p class="fhint">Pinned at ${(+l.lat).toFixed(5)}, ${(+l.lon).toFixed(5)}${l.acc ? ` (±${Math.round(l.acc)} m)` : ''} · <a href="${esc(dirUrl(l))}" target="_blank" rel="noopener">Directions</a> · drag the pin to move it</p>` : '<p class="fhint">No pin yet. Find the address, use your position when you’re there, or tap the map.</p>'}
          <div class="loc-grid"><label>Contact<input data-lf="contact" value="${esc(l.contact || '')}" placeholder="Owner or manager"></label><label>Phone<input data-lf="phone" value="${esc(l.phone || '')}" inputmode="tel"></label>
            <label>Fee<input data-lf="fee" value="${esc(l.fee || '')}" inputmode="decimal" placeholder="0"></label><label>Permit<select data-lf="permit">${['', 'Not needed', 'Asked', 'Approved', 'Refused'].map(x => `<option${(l.permit || '') === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label></div>
          ${+l.fee && d.budget ? `<button class="linkish" id="lcBudget">${l.budgeted ? 'Update the fee in the budget' : 'Add the fee to the budget'}</button>` : ''}
          <div class="loc-grid">${NOTES.map(([k, label, ph]) => `<label>${label}<input data-ln="${k}" value="${esc((l.notes || {})[k] || '')}" placeholder="${esc(ph)}"></label>`).join('')}</div>
          <h4>Scenes here</h4><div class="loc-places">${places.map(p => `<label><input type="checkbox" data-place="${esc(p)}"${(l.places || []).includes(p) ? ' checked' : ''}${ls.some(x => x.id !== l.id && (x.places || []).includes(p)) ? ' disabled' : ''}>${esc(p)}</label>`).join('') || '<span class="fhint">Bring in your script on the Breakdown tab to link scenes.</span>'}</div>
          <div class="row"><button class="ib xs" id="lcDel">Remove location</button></div></section>
        <section class="fsec loc-sun"><div class="loc-mapwrap"><div id="lcMap" class="loc-map"></div>${l.lat ? '' : '<div class="loc-nomap">Pin the location to see the map and the sun</div>'}</div>
          ${l.lat ? sunBlock(d, l) : ''}</section></div>
      <section class="fsec"><h3>Scouting photos</h3><div class="loc-photos">${(l.photos || []).map((p, i) => `<figure><img data-media="${esc(p.media)}" alt=""><figcaption>${p.heading != null ? `<span class="hd" style="--h:${p.heading}deg">↑</span> facing ${deg(p.heading)} (${Math.round(p.heading)}°)` : ''}${p.lens ? ' · ' + esc(p.lens) : ''}<br><small>${new Date(p.t).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small></figcaption>${N.P.canWrite ? `<button class="ib xs" data-pdel="${i}" aria-label="Remove photo">✕</button>` : ''}</figure>`).join('')}
        <label class="loc-addph">+ Add photos<input type="file" accept="image/*" multiple id="lcPhotos" hidden></label></div></section>`}
    </div>`;
    el.querySelectorAll('img[data-media]').forEach(async im => { const u = await N.Store.mediaUrl(im.dataset.media); if (u) im.src = u; else im.replaceWith(Object.assign(document.createElement('span'), { className: 'loc-ph', textContent: '⌖' })); });
    if (l) drawMap(el, d, l);
    el.onclick = e => click(e, el, d, l);
    el.onchange = e => change(e, d, l);
    el.oninput = e => { if (e.target.id === 'lcTime' || e.target.id === 'lcDate') { if (e.target.id === 'lcTime') when.min = +e.target.value; else when.date = e.target.value; const sb = el.querySelector('.loc-sunblock'); if (sb) sb.outerHTML = sunBlock(d, l); drawSun(d, l); } };
  } });

  // the sun for the chosen date: a dial (top-down, north up) plus times
  function sunBlock(d, l) {
    if (!when || when.id !== l.id) { when = { id: l.id, date: dayFor(d, l), min: null }; }
    const s = F.sunTimes(when.date, l.lat, l.lon); if (!s) return '<p class="fhint">The sun doesn’t rise or set here on that date.</p>';
    if (when.min == null) when.min = Math.round(((s.goldPm ? s.goldPm[0] : s.sunset) - new Date(when.date + 'T00:00:00')) / 60000);
    const at = new Date(new Date(when.date + 'T00:00:00').getTime() + when.min * 60000), p = F.sunPos(at, l.lat, l.lon);
    const rise = F.sunPos(s.sunrise, l.lat, l.lon), set = F.sunPos(s.sunset, l.lat, l.lon);
    // sun path on the dial: points every 15 minutes while the sun is up
    const pts = []; for (let t = s.sunrise.getTime(); t <= s.sunset.getTime(); t += 900000) { const q = F.sunPos(new Date(t), l.lat, l.lon); const r = 88 * (1 - Math.max(0, q.alt) / 90); pts.push([100 + r * Math.sin(q.az * Math.PI / 180), 100 - r * Math.cos(q.az * Math.PI / 180)]); }
    const r = 88 * (1 - Math.max(0, p.alt) / 90), sx = 100 + r * Math.sin(p.az * Math.PI / 180), sy = 100 - r * Math.cos(p.az * Math.PI / 180);
    const sh = (p.az + 180) % 360, shadowLen = p.alt > 0 ? Math.min(80, 18 / Math.tan(Math.max(2, p.alt) * Math.PI / 180)) : 0;
    const up = p.alt > 0;
    return `<div class="loc-sunblock"><svg viewBox="0 0 200 200" class="loc-dial" role="img" aria-label="Sun path for the day">
        <circle cx="100" cy="100" r="88" class="dl-ring"/><circle cx="100" cy="100" r="58" class="dl-in"/><circle cx="100" cy="100" r="29" class="dl-in"/>
        ${['N', 'E', 'S', 'W'].map((t, i) => `<text x="${100 + 98 * Math.sin(i * Math.PI / 2)}" y="${104 - 98 * Math.cos(i * Math.PI / 2)}" class="dl-t">${t}</text>`).join('')}
        <polyline points="${pts.map(q => q.map(v => v.toFixed(1)).join(',')).join(' ')}" class="dl-path"/>
        <line x1="100" y1="100" x2="${100 + 88 * Math.sin(rise.az * Math.PI / 180)}" y2="${100 - 88 * Math.cos(rise.az * Math.PI / 180)}" class="dl-rise"/>
        <line x1="100" y1="100" x2="${100 + 88 * Math.sin(set.az * Math.PI / 180)}" y2="${100 - 88 * Math.cos(set.az * Math.PI / 180)}" class="dl-set"/>
        ${up ? `<line x1="100" y1="100" x2="${100 + shadowLen * Math.sin(sh * Math.PI / 180)}" y2="${100 - shadowLen * Math.cos(sh * Math.PI / 180)}" class="dl-shadow"/><circle cx="${sx}" cy="${sy}" r="8" class="dl-sun"/>` : ''}
        <circle cx="100" cy="100" r="3" class="dl-me"/></svg>
      <div class="loc-suntxt"><label>Date<input type="date" id="lcDate" value="${esc(when.date)}"></label>
        <label>Time <b>${hm(at)}</b><input type="range" id="lcTime" min="${Math.max(0, Math.round((s.sunrise - new Date(when.date + 'T00:00:00')) / 60000) - 60)}" max="${Math.min(1439, Math.round((s.sunset - new Date(when.date + 'T00:00:00')) / 60000) + 60)}" step="5" value="${when.min}"></label>
        <p>${up ? `Sun in the <b>${deg(p.az)}</b> (${Math.round(p.az)}°), <b>${Math.round(p.alt)}°</b> up. Shadows fall to the ${deg(sh)}${p.alt < 15 ? ', long and warm' : p.alt > 60 ? ', short and hard' : ''}.` : 'The sun is down.'}</p>
        <p class="fhint">Sunrise ${hm(s.sunrise)} in the ${deg(rise.az)} · sunset ${hm(s.sunset)} in the ${deg(set.az)}${s.goldPm ? ` · golden hour ${hm(s.goldPm[0])}–${hm(s.goldPm[1])}` : ''}</p>
        <p class="loc-key"><i class="k-rise"></i>sunrise <i class="k-set"></i>sunset <i class="k-now"></i>sun now <i class="k-sh"></i>shadows</p></div></div>`;
  }

  /* ---------- the map (OpenStreetMap, free) ---------- */
  async function drawMap(el, d, l) {
    const box = el.querySelector('#lcMap'); if (!box) return;
    if (!document.querySelector('link[href*="leaflet"]')) { const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'; document.head.append(c); }
    try { await N.loadLib('map'); } catch (e) { box.innerHTML = '<p class="loc-nomap">The map needs internet</p>'; return; }
    if (!box.isConnected) return;
    const Lf = window.L, centre = l.lat ? [l.lat, l.lon] : (L_().find(x => x.lat) ? [L_().find(x => x.lat).lat, L_().find(x => x.lat).lon] : d.place ? [d.place.lat, d.place.lon] : [6.5244, 3.3792]);
    if (map) { try { map.remove(); } catch (e) {} map = null; }
    map = Lf.map(box, { zoomControl: true, attributionControl: true }).setView(centre, l.lat ? 17 : 11);
    Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    L_().filter(x => x.lat).forEach(x => { const mk = Lf.marker([x.lat, x.lon], { draggable: x.id === l.id && N.P.canWrite, title: x.name }).addTo(map); if (x.id !== l.id) mk.on('click', () => { sel = x.id; F.refresh(); });
      else mk.on('dragend', ev => { const p = ev.target.getLatLng(); setPin(l.id, p.lat, p.lng); }); });
    if (N.P.canWrite && !l.lat) map.on('click', ev => setPin(l.id, ev.latlng.lat, ev.latlng.lng));
    layer = Lf.layerGroup().addTo(map); drawSun(d, l);
    setTimeout(() => map && map.invalidateSize(), 50);
  }
  // sunrise, sunset and the sun at the chosen time as lines from the pin; on a map, up is always true north
  function drawSun(d, l) {
    if (!map || !layer || !l.lat || !when) return; layer.clearLayers();
    const s = F.sunTimes(when.date, l.lat, l.lon); if (!s) return;
    const at = new Date(new Date(when.date + 'T00:00:00').getTime() + when.min * 60000);
    const line = (az, color, w, dash) => { const k = 0.0013, la = l.lat + k * Math.cos(az * Math.PI / 180), lo = l.lon + k * Math.sin(az * Math.PI / 180) / Math.cos(l.lat * Math.PI / 180); window.L.polyline([[l.lat, l.lon], [la, lo]], { color, weight: w, dashArray: dash, opacity: .9 }).addTo(layer); };
    line(F.sunPos(s.sunrise, l.lat, l.lon).az, '#ffbd2e', 4); line(F.sunPos(s.sunset, l.lat, l.lon).az, '#ff6a3d', 4);
    const p = F.sunPos(at, l.lat, l.lon); if (p.alt > 0) { line(p.az, '#ffe27a', 6); line((p.az + 180) % 360, '#1a1c29', 3, '6 6'); }
  }
  function setPin(id, lat, lon, acc) { F.change(dd => { const x = dd.locations.find(y => y.id === id); x.lat = +lat.toFixed(6); x.lon = +lon.toFixed(6); x.acc = acc || null; }); }

  async function click(e, el, d, l) {
    const t = e.target;
    const lb = t.closest('[data-loc]'); if (lb) { sel = lb.dataset.loc; when = null; return F.refresh(); }
    if (t.closest('#lcAdd')) { const n = await F.ask('New location', 'For example: Mama Nkechi’s house, Ikeja'); if (n) { const id = F.uid(); sel = id; when = null; F.change(dd => (dd.locations = dd.locations || []).push({ id, name: n, places: [], photos: [], notes: {} })); } return; }
    if (t.closest('#lcFromScript')) return F.change(dd => { dd.locations = dd.locations || []; const ps = [...new Set(dd.scenes.map(s => String(s.loc || '').toUpperCase()).filter(Boolean))].filter(p => !dd.locations.some(x => (x.places || []).includes(p)));
      ps.forEach(p => dd.locations.push({ id: F.uid(), name: p.toLowerCase().replace(/(^|[\s(\-\/])(\w)/g, (m, a, b) => a + b.toUpperCase()), places: [p], photos: [], notes: {} })); });
    if (t.closest('#lcScout')) return N.viewfinder({ mode: 'scout', location: l && l.id });
    if (!l) return;
    if (t.closest('#lcHere')) {
      if (!navigator.geolocation) return N.toast('This device can’t share its position');
      N.status('Finding where you are…');
      navigator.geolocation.getCurrentPosition(p => { N.settled(); setPin(l.id, p.coords.latitude, p.coords.longitude, p.coords.accuracy); N.toast(`Pinned here (±${Math.round(p.coords.accuracy)} m)`); },
        err => { N.settled(); N.toast(err.code === 1 ? 'Allow location access to pin where you are' : 'Couldn’t get your position. Try outside, or tap the map.'); }, { enableHighAccuracy: true, timeout: 15000 });
      return;
    }
    if (t.closest('#lcFind')) {
      const q = (el.querySelector('[data-lf=address]').value || l.name).trim(); if (!q) return;
      N.status('Searching…');
      try { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'en' } }); const j = await r.json(); N.settled();
        if (!j.length) return N.toast('Couldn’t find that address. Try a nearby landmark or street, or tap the map.'); setPin(l.id, +j[0].lat, +j[0].lon); N.toast('Found. Drag the pin if it’s not quite right.'); }
      catch (x) { N.settled(); N.toast('Searching needs internet'); }
      return;
    }
    if (t.closest('#lcBudget')) return F.change(dd => { const x = dd.locations.find(y => y.id === l.id), b = dd.budget; let dp = b.depts.find(y => /location/i.test(y.name)); if (!dp) { dp = { id: F.uid(), name: 'Locations and permits', items: [] }; b.depts.push(dp); }
      let it = dp.items.find(y => y.loc === x.id); if (!it) { it = { id: F.uid(), loc: x.id, desc: x.name, qty: 1, rate: '', units: 1, actual: '' }; dp.items.push(it); } it.rate = +x.fee; it.desc = x.name; x.budgeted = true; N.toast('Fee added to the budget under Locations'); });
    if (t.closest('#lcDel')) { if (await N.confirmBox(`Remove ${l.name}?`, 'Remove')) F.change(dd => { dd.locations = dd.locations.filter(x => x.id !== l.id); }); return; }
    const pd = t.closest('[data-pdel]'); if (pd) return F.change(dd => { dd.locations.find(x => x.id === l.id).photos.splice(+pd.dataset.pdel, 1); });
  }
  async function change(e, d, l) {
    const t = e.target; if (!l) return;
    if (t.id === 'lcPhotos') { const files = [...t.files]; if (!files.length) return; const ids = []; for (const f of files) ids.push(await N.Store.putMedia(f)); F.change(dd => { const x = dd.locations.find(y => y.id === l.id); x.photos = [...(x.photos || []), ...ids.map(media => ({ media, t: Date.now() }))]; }); return; }
    if (t.dataset.lf) return F.change(dd => { dd.locations.find(x => x.id === l.id)[t.dataset.lf] = t.value.trim(); }, !['name', 'fee'].includes(t.dataset.lf));
    if (t.dataset.ln) return F.change(dd => { const x = dd.locations.find(y => y.id === l.id); x.notes = x.notes || {}; x.notes[t.dataset.ln] = t.value.trim(); }, true);
    if (t.dataset.place) return F.change(dd => { const x = dd.locations.find(y => y.id === l.id); x.places = x.places || []; const p = t.dataset.place; if (t.checked) x.places.push(p); else x.places = x.places.filter(y => y !== p); });
  }
  // the viewfinder and others can add photos to a location
  F.addLocationPhoto = (id, photo) => F.change(dd => { const x = (dd.locations || []).find(y => y.id === id); if (x) x.photos = [...(x.photos || []), photo]; });

  /* ---------- call sheets: locations with address and a QR code for directions ---------- */
  N.hooks.ready.push(() => {
    const t = F.tabs.find(x => x.id === 'callsheets'); if (!t || t._loc) return; t._loc = true;
    const base = t.render;
    t.render = function (el, d) {
      base.call(this, el, d);
      const sheet = el.querySelector('.sheet'); if (!sheet) return;
      const btn = el.querySelector('[data-csday].on'), day = btn && d.days.find(x => x.id === btn.dataset.csday); if (!day) return;
      const ls = F.locationsOfDay(d, day).filter(l => l.lat); if (!ls.length) return;
      const box = document.createElement('section'); box.className = 'cs-locs';
      box.innerHTML = `<h3>Getting there</h3>${ls.map(l => `<div class="cs-loc"><div class="qr" data-qr="${esc(dirUrl(l))}"></div><div><b>${esc(l.name)}</b><p>${esc(l.address || `${(+l.lat).toFixed(5)}, ${(+l.lon).toFixed(5)}`)}</p>
        ${['parking', 'power', 'toilets', 'hospital'].filter(k => (l.notes || {})[k]).map(k => `<p><small>${NOTES.find(n => n[0] === k)[1]}</small> ${esc(l.notes[k])}</p>`).join('')}<p class="fhint">Scan for directions</p></div></div>`).join('')}`;
      const foot = sheet.querySelector('footer'); foot ? sheet.insertBefore(box, foot) : sheet.append(box);
      N.loadLib('qr').then(() => box.querySelectorAll('[data-qr]').forEach(q => { const g = window.qrcode(0, 'M'); g.addData(q.dataset.qr); g.make(); q.innerHTML = g.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); })).catch(() => box.querySelectorAll('[data-qr]').forEach(q => q.remove()));
    };
  });
})();
