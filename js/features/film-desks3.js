/* Department desks, part three: the Director's overview, and the 1st AD, Camera and DIT, Grip, Art, Wardrobe,
   Hair and makeup, Safety, Transport, Catering, Edit and VFX, Music and Clearances desks.
   Desks feed each other: the 1st AD's running order sets makeup calls and catering; Wardrobe uses Continuity;
   Safety feeds the crisis screen and the call sheet; every desk reports how ready it is and what needs attention,
   which the Director's overview and the Producer desk gather in one place. */
(function () {
  const N = window.N, F = N.film, esc = N.esc, num = F.num;
  const isExt = s => /EXT/i.test(s.ie || ''), isNight = s => /NIGHT|EVENING|DUSK/i.test(s.dn || '');
  const toMin = t => { const [h, m] = String(t || '07:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const hm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; const d0 = new Date(); d0.setHours(0, m, 0, 0); return d0.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const hh = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const firstDay = d => (F.nextDays(d, 60)[0] || d.days[0] || {}).id;
  const dayPick = (d, ui, attr) => d.days.length ? `<select ${attr} aria-label="Shoot day">${d.days.map(x => `<option value="${esc(x.id)}"${x.id === ui.day ? ' selected' : ''}>${esc(F.dayLabel(d, x))}</option>`).join('')}</select>` : '';
  const pickDay = (d, ui) => { if (!ui.day || !d.days.find(x => x.id === ui.day)) ui.day = firstDay(d); return d.days.find(x => x.id === ui.day); };
  const W = (k, init, fn, quiet) => F.change(dd => fn(F.deskW(dd, k, init)), quiet);
  const head = (t, p, act = '') => `<header class="dk-top"><div><h2>${t}</h2><p>${p}</p></div>${act ? `<div class="cs-act">${act}</div>` : ''}</header>`;
  const sel = (attr, list, v, blank) => `<select ${attr}>${blank ? `<option value="">${blank}</option>` : ''}${list.map(x => { const [k, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}"${String(v ?? '') === String(k) ? ' selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  const castOfDay = (d, day) => [...new Set(F.dayScenes(d, day).flatMap(s => s.cast || []))].map(id => F.person(d, id)).filter(Boolean);

  /* ================= 1st AD: the day's running order ================= */
  F.runOrder = (d, day) => {
    const A = F.desk(d, 'ad', {}), mpp = num(A.mpp) || 60, setup = num(A.setup ?? 30), move = num(A.move ?? 45), prep = num(A.prep ?? 60), lunchAt = num(A.lunchAt) || 6, lunch = num(A.lunch) || 60;
    const call = toMin(day.call || '07:00'), out = []; let t = call + prep, last = null, fed = false;
    out.push({ kind: 'call', start: call, end: call + prep, text: 'Crew call, set up and rehearse' });
    F.dayScenes(d, day).forEach(s => {
      if (last && last !== s.loc) { out.push({ kind: 'move', start: t, end: t + move, text: `Company move to ${s.loc || 'the next place'}` }); t += move; }
      if (!fed && t - call >= lunchAt * 60) { out.push({ kind: 'lunch', start: t, end: t + lunch, text: 'Lunch' }); t += lunch; fed = true; }
      const mins = num((A.mins || {})[s.id]) || Math.round(setup + (s.pages || 0) / 8 * mpp);
      out.push({ kind: 'scene', s, start: t, end: t + mins, text: `${s.num}. ${F.sceneLabel(s)}` }); t += mins; last = s.loc;
    });
    if (!fed && t - call > lunchAt * 60 - 30) { out.push({ kind: 'lunch', start: t, end: t + lunch, text: 'Lunch' }); t += lunch; }
    out.push({ kind: 'wrap', start: t, end: t + 30, text: 'Wrap and pack up' });
    return { items: out, call, wrap: t + 30, hours: (t + 30 - call) / 60 };
  };
  F.desks.push({ id: 'ad', group: 'Direction', label: '1st AD', who: 'Assistant directors', icon: '⏱',
    status(d) { const n = d.days.filter(x => x.call).length; return { ready: d.days.length ? n / d.days.length : null, note: `${n} of ${d.days.length} days have a crew call` }; },
    alerts(d) { return d.days.filter(x => x.sceneIds.length && F.runOrder(d, x).hours > 12.5).map(x => ({ lvl: 'warn', text: `${F.dayLabel(d, x)} runs about ${F.runOrder(d, x).hours.toFixed(1)} hours: move a scene or start earlier` })); },
    render(el, d) {
      const A = F.desk(d, 'ad', {}), ui = this.ui = this.ui || {}, day = pickDay(d, ui);
      if (!day) { el.innerHTML = head('1st AD', 'The running order for each shoot day.') + '<div class="empty-row big">Add shoot days on the Schedule tab.</div>'; return; }
      const R = F.runOrder(d, day), over = R.hours > 12;
      el.innerHTML = head('1st AD', 'The running order for each shoot day, worked out from page counts, set-ups, company moves and lunch. Makeup calls and meals follow it, and it goes on the call sheet.') +
        `<div class="dk-two"><section class="fsec"><div class="dk-h"><h3>Running order</h3>${dayPick(d, ui, 'data-aday')}</div>
          <div class="dk-inline"><span class="dk-pill"><b>${hm(R.call)}</b> crew call</span><span class="dk-pill ${over ? 'bad' : ''}"><b>${hm(R.wrap)}</b> wrap</span><span class="dk-pill ${over ? 'bad' : ''}"><b>${R.hours.toFixed(1)}</b> hours</span></div>
          <ol class="dk-run">${R.items.map(x => `<li class="k-${x.kind}"><time>${hm(x.start)}</time><span>${esc(x.text)}${x.s && x.s.summary ? `<small>${esc(x.s.summary)}</small>` : ''}</span>${x.kind === 'scene' ? `<label class="dk-mins"><input data-amins="${esc(x.s.id)}" value="${esc((A.mins || {})[x.s.id] || '')}" placeholder="${Math.round(x.end - x.start)}" inputmode="numeric" aria-label="Minutes for scene ${esc(x.s.num)}">min</label>` : `<small class="dk-dur">${Math.round(x.end - x.start)} min</small>`}</li>`).join('')}</ol>
          ${over ? '<div class="wx-al warn"><b>This is a long day</b><span>Over 12 hours means tired crew and overtime. Move a scene to another day or start earlier.</span></div>' : ''}
          <div class="row"><label class="dk-sd">Crew call<input type="time" data-acall value="${esc(day.call || '07:00')}"></label><button class="add" data-ftab="schedule">Change the scene order on the Schedule</button></div></section>
        <section class="fsec"><h3>How Itàn times the day</h3><div class="dk-grid2">
          <label>Minutes per page<input data-ak="mpp" value="${esc(A.mpp || 60)}" inputmode="numeric"></label><label>Set-up per scene (min)<input data-ak="setup" value="${esc(A.setup ?? 30)}" inputmode="numeric"></label>
          <label>Company move (min)<input data-ak="move" value="${esc(A.move ?? 45)}" inputmode="numeric"></label><label>From call to first shot (min)<input data-ak="prep" value="${esc(A.prep ?? 60)}" inputmode="numeric"></label>
          <label>Lunch after (hours)<input data-ak="lunchAt" value="${esc(A.lunchAt || 6)}" inputmode="numeric"></label><label>Lunch (min)<input data-ak="lunch" value="${esc(A.lunch || 60)}" inputmode="numeric"></label></div>
          <p class="fhint">Most crews shoot 3 to 5 pages a day; dialogue goes faster than action, stunts and crowds. Type minutes next to a scene to override it.</p></section></div>`;
      el.onchange = e => { const t = e.target;
        if (t.dataset.aday !== undefined) { ui.day = t.value; return F.refresh(); }
        if (t.dataset.acall !== undefined) return F.change(dd => { dd.days.find(x => x.id === day.id).call = t.value; });
        if (t.dataset.ak) return W('ad', () => ({}), A2 => { A2[t.dataset.ak] = t.value; });
        if (t.dataset.amins) return W('ad', () => ({}), A2 => { A2.mins = A2.mins || {}; A2.mins[t.dataset.amins] = t.value; });
      };
    } });

  /* ================= CAMERA AND DIT: cards, backups, storage ================= */
  const CODECS = [['BRAW 12:1 (6K)', 135], ['BRAW 8:1 (6K)', 200], ['BRAW 5:1 (6K)', 323], ['ProRes 422 HQ (4K)', 707], ['ProRes 422 (4K)', 471], ['ProRes 422 HQ (1080p)', 176], ['ProRes 422 LT (4K)', 328], ['XAVC S-I (4K)', 600], ['XAVC HS / S (4K)', 150], ['H.265 10-bit (4K)', 100], ['H.264 (1080p)', 50], ['ARRIRAW (4.6K)', 2000]];
  F.desks.push({ id: 'dit', group: 'Camera and light', label: 'Camera and DIT', who: 'DP, camera assistants, DIT', icon: '💾',
    status(d) { const L = F.desk(d, 'dit', {}).log || [], wr = d.days.filter(x => x.set && x.set.wrapped); return { ready: null, note: `${L.length} cards logged${wr.length ? ` over ${wr.length} wrapped days` : ''}` }; },
    alerts(d) { const bad = (F.desk(d, 'dit', {}).log || []).filter(x => !(x.a && x.b)); return bad.length ? [{ lvl: 'bad', text: `Footage in only one place: ${bad.map(x => x.card).join(', ')}. Back it up twice before formatting.` }] : []; },
    render(el, d) {
      const D = F.desk(d, 'dit', {}), ui = this.ui = this.ui || {}, day = pickDay(d, ui), log = (D.log || []).filter(x => !day || x.day === day.id);
            const camTab = F.tabs.find(x => x.id === 'camera');
      if (ui.view === 'tools' && camTab) { el.innerHTML = head('Camera and DIT', 'Storage for the shoot, what a lens sees on your sensor, and shutter and ND for the look you want.') + `<div class="seg dk-seg"><button data-dv="cards">Cards and backups</button><button data-dv="tools" class="on">Camera tools</button></div><div class="dk-cam"></div>`;
        camTab.render(el.querySelector('.dk-cam'), d); el.querySelector('.dk-seg').onclick = e => { const b = e.target.closest('[data-dv]'); if (b) { ui.view = b.dataset.dv; F.refresh(); } }; return; }
      el.innerHTML = head('Camera and DIT', 'Log every card as it comes off the camera, tick each backup, and never format a card until it’s in two places.') + (camTab ? `<div class="seg dk-seg"><button data-dv="cards" class="on">Cards and backups</button><button data-dv="tools">Camera tools</button></div>` : '') +
        `<div class="dk-two"><section class="fsec"><div class="dk-h"><h3>Card log</h3>${dayPick(d, ui, 'data-dday')}</div>
          <div class="dk-scroll"><table class="ftable dk-dit"><thead><tr><th>Card</th><th>Camera</th><th>Clips</th><th>GB</th><th title="Copied to the first drive">Drive 1</th><th title="Copied to the second drive">Drive 2</th><th title="Checked: files open and play">Checked</th><th></th></tr></thead><tbody>
          ${log.map(x => `<tr data-dl="${esc(x.id)}" class="${x.a && x.b ? 'ok' : 'risk'}"><td><input data-dk="card" value="${esc(x.card)}"></td><td><input data-dk="cam" value="${esc(x.cam || '')}" placeholder="A"></td><td class="num"><input data-dk="clips" value="${esc(x.clips || '')}" inputmode="numeric"></td><td class="num"><input data-dk="gb" value="${esc(x.gb || '')}" inputmode="decimal"></td>
            ${['a', 'b', 'ok'].map(k => `<td class="c"><input type="checkbox" data-dk="${k}"${x[k] ? ' checked' : ''} aria-label="${k}"></td>`).join('')}<td class="act"><button class="ib xs" data-dldel aria-label="Remove">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty-row">No cards logged for this day</td></tr>'}</tbody></table></div>
          <div class="row"><button class="add" data-dladd>+ Card</button><span class="fhint">${log.reduce((n, x) => n + num(x.gb), 0).toFixed(0)} GB today · ${log.filter(x => x.a && x.b).length} of ${log.length} safely in two places</span></div></section>
        <section class="fsec"><h3>Settings for every camera</h3><label class="dk-lab">Camera settings for everyone<textarea data-dnote rows="3" placeholder="Shutter 180°, ISO 800, 5600 K, S-Log3 / S-Gamut3.Cine, 23.976 fps">${esc(D.notes || '')}</textarea></label></section></div>`;
      el.onchange = e => { const t = e.target;
        if (t.dataset.dday !== undefined) { ui.day = t.value; return F.refresh(); }
        if (t.dataset.dnote !== undefined) return W('dit', () => ({}), x => { x.notes = t.value; }, true);
        const r = t.closest('[data-dl]'); if (r && t.dataset.dk) W('dit', () => ({}), x => { const it = x.log.find(y => y.id === r.dataset.dl); it[t.dataset.dk] = t.type === 'checkbox' ? t.checked : t.value.trim(); });
      };
      el.onclick = e => { const t = e.target;
        const dv = t.closest('[data-dv]'); if (dv) { ui.view = dv.dataset.dv; return F.refresh(); }
        if (t.closest('[data-dladd]')) { const n = log.length + 1, cam = (log[log.length - 1] || {}).cam || 'A'; return W('dit', () => ({}), x => { (x.log = x.log || []).push({ id: F.uid(), day: day && day.id, card: `${cam}${String((x.log.filter(y => (y.cam || 'A') === cam).length) + 1).padStart(3, '0')}`, cam, t: Date.now() }); }); }
        const dl = t.closest('[data-dldel]'); if (dl) { const id = dl.closest('[data-dl]').dataset.dl; return W('dit', () => ({}), x => { x.log = x.log.filter(y => y.id !== id); }); }
      };
    } });

  /* ================= GRIP: what moves the camera ================= */
  const GEAR = { Tracking: 'Dolly and track', 'Push in': 'Slider or dolly', 'Pull out': 'Slider or dolly', Crane: 'Jib or crane', Gimbal: 'Gimbal', Handheld: 'Shoulder rig or Easyrig', Pan: 'Fluid-head tripod', Tilt: 'Fluid-head tripod', Static: 'Tripod', Zoom: 'Tripod' };
  F.gripOfDay = (d, day) => {
    const nums = F.dayScenes(d, day).map(s => String(s.num)), shots = F.allShots().map(x => x.c).filter(c => nums.includes(String(c.scene))), need = {};
    shots.forEach(c => { const g = c.size === 'Aerial' ? 'Drone (with a licensed pilot)' : GEAR[c.move]; if (g) (need[g] = need[g] || []).push(c.scene + (c.letter || '')); });
    F.dayScenes(d, day).forEach(s => { if ((s.tags && (s.tags.vehicles || []).length)) (need['Car mount or hostess tray'] = need['Car mount or hostess tray'] || []).push(s.num + ''); });
    const lights = F.lightLoad ? Object.values(F.lightLoad(d, day).gear).reduce((n, v) => n + v, 0) : 0, windy = day.wx && F.weatherAlerts && F.weatherAlerts(d, day, day.wx).some(a => /gust|Breezy|wind/i.test(a.text));
    return { need, shots, stands: lights + 4, bags: Math.ceil((lights + 4) * (windy ? 3 : 2)), windy };
  };
  F.desks.push({ id: 'grip', group: 'Camera and light', label: 'Grip', who: 'Key grip, dolly grip', icon: '🛞',
    alerts(d) { return F.nextDays(d, 4).filter(x => x.wx && F.gripOfDay(d, x).need['Drone (with a licensed pilot)'] && F.weatherAlerts(d, x, x.wx).some(a => /gust|wind/i.test(a.text) && a.lvl === 'bad')).map(x => ({ lvl: 'bad', text: `${F.dayLabel(d, x)}: drone shots planned on a windy day` })); },
    render(el, d) {
      const G = F.desk(d, 'grip', {}), ui = this.ui = this.ui || {}, day = pickDay(d, ui);
      if (!day) { el.innerHTML = head('Grip', 'Camera support for each day.') + '<div class="empty-row big">Add shoot days on the Schedule tab.</div>'; return; }
      const g = F.gripOfDay(d, day), done = (G.done || {})[day.id] || {};
      el.innerHTML = head('Grip', 'The camera support each day needs, worked out from the moves on the Shot cards, and the stands and sandbags for the lights.') +
        `<section class="fsec"><div class="dk-h"><h3>${esc(F.dayLabel(d, day))}</h3>${dayPick(d, ui, 'data-gday')}</div>
          ${g.shots.length ? '' : '<p class="fhint">No Shot cards for this day’s scenes yet. Add them on the Shots tab and set each one’s movement.</p>'}
          <ul class="dk-check">${Object.entries(g.need).map(([k, v]) => `<li class="${done[k] ? 'done' : ''}"><label><input type="checkbox" data-gk="${esc(k)}"${done[k] ? ' checked' : ''}><span><b>${esc(k)}</b><small>Shots ${v.map(esc).join(', ')}</small></span></label></li>`).join('')}
            ${[[`${g.stands} C-stands or light stands`, 'One per light, plus four for flags and frames'], [`${g.bags} sandbags`, g.windy ? 'Extra for the wind forecast' : 'Two per stand'], ['Apple boxes, wedges and a ladder', ''], ['Flags, floppies and a 6×6 or 8×8 frame', 'To cut and soften the light']].map(([k, sub]) => `<li class="${done[k] ? 'done' : ''}"><label><input type="checkbox" data-gk="${esc(k)}"${done[k] ? ' checked' : ''}><span><b>${esc(k)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label></li>`).join('')}</ul>
          <label class="dk-lab">Rigging notes<textarea data-gnote rows="3" placeholder="Track along the bus park fence, 6 m; car mount on the passenger side">${esc((G.notes || {})[day.id] || '')}</textarea></label></section>`;
      el.onchange = e => { const t = e.target;
        if (t.dataset.gday !== undefined) { ui.day = t.value; return F.refresh(); }
        if (t.dataset.gk) return W('grip', () => ({}), x => { x.done = x.done || {}; (x.done[day.id] = x.done[day.id] || {})[t.dataset.gk] = t.checked; });
        if (t.dataset.gnote !== undefined) return W('grip', () => ({}), x => { (x.notes = x.notes || {})[day.id] = t.value; }, true);
      };
    } });

  /* ================= ART DEPARTMENT: the sets ================= */
  const SST = [['design', 'Design'], ['find', 'Finding things'], ['build', 'Building'], ['dress', 'Dressing'], ['ready', 'Ready'], ['strike', 'Struck']];
  const setsOf = d => [...new Map(d.scenes.filter(s => s.loc).map(s => [String(s.loc).toUpperCase(), s])).keys()];
  const scenesAtSet = (d, k) => d.scenes.filter(s => String(s.loc || '').toUpperCase() === k);
  F.desks.push({ id: 'art', group: 'Art and look', label: 'Art department', who: 'Production designer, set dressers', icon: '🛋',
    status(d) { const A = F.desk(d, 'art', {}).sets || {}, ks = setsOf(d); return { ready: ks.length ? ks.filter(k => ['ready', 'strike'].includes((A[k] || {}).st)).length / ks.length : null, note: `${ks.filter(k => ['ready', 'strike'].includes((A[k] || {}).st)).length} of ${ks.length} sets ready` }; },
    alerts(d) { const A = F.desk(d, 'art', {}).sets || {}, soon = F.nextDays(d, 3).flatMap(x => F.dayScenes(d, x)), late = [...new Set(soon.map(s => String(s.loc || '').toUpperCase()))].filter(k => k && !['ready', 'strike'].includes((A[k] || {}).st)); return late.length ? [{ lvl: 'bad', text: `Sets not ready for the next 3 days: ${late.join(', ')}` }] : []; },
    render(el, d) {
      const A = F.desk(d, 'art', {}), sets = A.sets || {}, ks = setsOf(d), ui = this.ui = this.ui || {};
      if (!ks.length) { el.innerHTML = head('Art department', 'Every set in the film.') + '<div class="empty-row big">Sets come from the scene headings. Bring in the script on the Breakdown tab first.</div>'; return; }
      if (!ui.set || !ks.includes(ui.set)) ui.set = ks[0];
      const S = sets[ui.set] || {}, sc = scenesAtSet(d, ui.set), dates = [...new Set(sc.flatMap(s => F.daysOfScene(d, s).map(x => x.date)).filter(Boolean))].sort();
      const loc = (d.locations || []).find(l => (l.places || []).includes(ui.set)), cur = (d.budget && d.budget.cur) || '₦';
      el.innerHTML = head('Art department', 'Every set in the film, how it should look, what goes in it, and whether it’s ready before the camera arrives.') +
        `<div class="dk-scenes">${ks.map(k => `<button data-aset="${esc(k)}" class="${k === ui.set ? 'on' : ''}${['ready', 'strike'].includes((sets[k] || {}).st) ? ' done' : ''}">${esc(k)}</button>`).join('')}</div>
        <div class="dk-two"><section class="fsec"><div class="dk-h"><h3>${esc(ui.set)}</h3>${sel('data-ak2="st"', SST, S.st || 'design')}</div>
          <p class="fhint">Scenes ${sc.map(s => esc(s.num)).join(', ')}${dates.length ? ` · shooting ${dates.map(x => new Date(x + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })).join(', ')}` : ' · not scheduled'}${loc ? ` · location: ${esc(loc.name)}` : ''}</p>
          <label class="dk-lab">The look<textarea data-ak2="look" rows="2" placeholder="Worn but loved. Faded green walls, calendar from 2019, plastic chairs">${esc(S.look || '')}</textarea></label>
          <label class="dk-lab">To bring or build (one per line)<textarea data-ak2="dress" rows="5" placeholder="Wall clock (script)\nFamily photo frames\nKerosene stove">${esc(S.dress || '')}</textarea></label>
          <div class="dk-grid2"><label>Cost (${esc(cur)})<input data-ak2="cost" value="${esc(S.cost || '')}" inputmode="decimal"></label><label>Who’s on it<input data-ak2="who" value="${esc(S.who || '')}"></label></div></section>
        <section class="fsec"><h3>References</h3><div class="dk-refs">${(S.refs || []).map((m, j) => `<figure><img data-media="${esc(m)}" alt=""><button class="ib xs" data-arefdel="${j}" aria-label="Remove">✕</button></figure>`).join('')}<button class="dk-addph" data-aref>+ Pictures</button></div>
          ${loc && (loc.photos || []).length ? `<h4>Scouting photos of ${esc(loc.name)}</h4><div class="dk-refs">${loc.photos.slice(0, 6).map(p => `<figure><img data-media="${esc(p.media)}" alt=""></figure>`).join('')}</div>` : ''}</section></div>`;
      F.mediaImgs(el);
      const setS = fn => W('art', () => ({}), x => { x.sets = x.sets || {}; fn(x.sets[ui.set] = x.sets[ui.set] || {}); });
      el.onclick = async e => { const t = e.target;
        const b = t.closest('[data-aset]'); if (b) { ui.set = b.dataset.aset; return F.refresh(); }
        if (t.closest('[data-aref]')) { const ids = await F.pickImages(); if (ids.length) setS(x => { x.refs = [...(x.refs || []), ...ids]; }); return; }
        const r = t.closest('[data-arefdel]'); if (r) setS(x => { x.refs.splice(+r.dataset.arefdel, 1); });
      };
      el.onchange = e => { const t = e.target; if (t.dataset.ak2) setS(x => { x[t.dataset.ak2] = t.value; }); };
    } });

  /* ================= WARDROBE: costume changes per character ================= */
  const WST = [['need', 'Needed'], ['buy', 'Buying or making'], ['fit', 'Fitting'], ['ready', 'Ready']];
  F.costumeOf = (d, s, pid) => ((F.desk(d, 'ward', {}).chars || {})[pid] || { changes: [] }).changes.find(c => (c.scenes || []).includes(s.id));
  F.desks.push({ id: 'ward', group: 'Art and look', label: 'Wardrobe', who: 'Costume designer, wardrobe', icon: '👗',
    status(d) { const pairs = d.scenes.flatMap(s => (s.cast || []).map(p => [s, p])), n = pairs.filter(([s, p]) => (F.costumeOf(d, s, p) || {}).st === 'ready').length; return { ready: pairs.length ? n / pairs.length : null, note: `${n} of ${pairs.length} scene costumes ready` }; },
    alerts(d) { const soon = F.nextDays(d, 3).flatMap(x => F.dayScenes(d, x)), late = soon.flatMap(s => (s.cast || []).filter(p => (F.costumeOf(d, s, p) || {}).st !== 'ready').map(p => (F.person(d, p) || {}).role)).filter(Boolean); return late.length ? [{ lvl: 'bad', text: `Costumes not ready for the next 3 days: ${[...new Set(late)].join(', ')}` }] : []; },
    render(el, d) {
      const Wd = F.desk(d, 'ward', {}), chars = Wd.chars || {}, ui = this.ui = this.ui || {}, cast = d.people.filter(p => p.kind === 'cast' && d.scenes.some(s => (s.cast || []).includes(p.id)));
      if (!cast.length) { el.innerHTML = head('Wardrobe', 'Costume changes per character.') + '<div class="empty-row big">Characters appear once they’re in scenes on the Breakdown tab.</div>'; return; }
      if (!ui.p || !cast.find(p => p.id === ui.p)) ui.p = cast[0].id;
      const p = cast.find(x => x.id === ui.p), C = chars[p.id] || { changes: [] }, sc = F.sortScenes(d).filter(s => (s.cast || []).includes(p.id)), looks = F.desk(d, 'cont', {}).looks || {}, cur = (d.budget && d.budget.cur) || '₦';
      const fromCont = [...new Set(sc.map(s => (looks[s.id + ':' + p.id] || {}).ward).filter(Boolean))].filter(w => !C.changes.some(c => c.desc === w));
      el.innerHTML = head('Wardrobe', 'Each character’s costume changes, which scenes they’re worn in, and fittings. Uses the wardrobe notes from Continuity.') +
        `<div class="dk-scenes">${cast.map(x => `<button data-wp="${esc(x.id)}" class="${x.id === ui.p ? 'on' : ''}">${esc(x.role || x.name)}</button>`).join('')}</div>
        <div class="dk-two"><section class="fsec"><div class="dk-h"><h3>${esc(p.role || '')}${p.name ? ` <small class="fhint">${esc(p.name)}</small>` : ''}</h3><label class="dk-sd">Fitting<input type="date" data-wfit value="${esc(C.fit || '')}"></label></div>
          ${C.changes.map((c, i) => `<article class="dk-chg" data-wc="${esc(c.id)}"><b>Change ${i + 1}</b><input data-wk="desc" value="${esc(c.desc || '')}" placeholder="What they wear">${sel('data-wk="st"', WST, c.st || 'need')}<input data-wk="cost" value="${esc(c.cost || '')}" placeholder="${esc(cur)}" inputmode="decimal" class="xs-in"><button class="ib xs" data-wcdel aria-label="Remove change">✕</button></article>`).join('') || '<p class="fhint">No costume changes yet.</p>'}
          <div class="row"><button class="add" data-wcadd>+ Change</button>${fromCont.length ? `<button class="add" data-wcont>+ ${fromCont.length} from Continuity notes</button>` : ''}</div></section>
        <section class="fsec"><h3>Scenes, in story order</h3><table class="ftable"><thead><tr><th>Scene</th><th>Costume</th></tr></thead><tbody>${sc.map(s => { const c = C.changes.find(x => (x.scenes || []).includes(s.id)); return `<tr><td><b>${esc(s.num)}</b> <small>${esc(F.sceneLabel(s))}</small>${(looks[s.id + ':' + p.id] || {}).ward ? `<br><small class="fhint">Continuity: ${esc(looks[s.id + ':' + p.id].ward)}</small>` : ''}</td><td>${sel(`data-wsc="${esc(s.id)}"`, C.changes.map((x, i) => [x.id, `Change ${i + 1}${x.desc ? ': ' + x.desc : ''}`]), c ? c.id : '', 'Choose…')}</td></tr>`; }).join('')}</tbody></table></section></div>`;
      const setC = fn => W('ward', () => ({}), x => { x.chars = x.chars || {}; const c = x.chars[p.id] = x.chars[p.id] || { changes: [] }; fn(c); });
      el.onclick = e => { const t = e.target;
        const b = t.closest('[data-wp]'); if (b) { ui.p = b.dataset.wp; return F.refresh(); }
        if (t.closest('[data-wcadd]')) return setC(c => c.changes.push({ id: F.uid(), desc: '', st: 'need', scenes: [] }));
        if (t.closest('[data-wcont]')) return setC(c => fromCont.forEach(w => c.changes.push({ id: F.uid(), desc: w, st: 'need', scenes: sc.filter(s => (looks[s.id + ':' + p.id] || {}).ward === w).map(s => s.id) })));
        const dl = t.closest('[data-wcdel]'); if (dl) { const id = dl.closest('[data-wc]').dataset.wc; return setC(c => { c.changes = c.changes.filter(x => x.id !== id); }); }
      };
      el.onchange = e => { const t = e.target;
        if (t.dataset.wfit !== undefined) return setC(c => { c.fit = t.value; });
        const r = t.closest('[data-wc]'); if (r && t.dataset.wk) return setC(c => { c.changes.find(x => x.id === r.dataset.wc)[t.dataset.wk] = t.value; });
        if (t.dataset.wsc) return setC(c => { c.changes.forEach(x => { x.scenes = (x.scenes || []).filter(id => id !== t.dataset.wsc); }); const x = c.changes.find(y => y.id === t.value); if (x) x.scenes.push(t.dataset.wsc); });
      };
    } });

  /* ================= HAIR AND MAKEUP: who sits in the chair when ================= */
  F.makeupCalls = (d, day) => {
    const H = F.desk(d, 'hmu', {}), R = F.runOrder(d, day), artists = Math.max(1, num(H.artists) || 1), ward = num(H.ward ?? 15);
    const firstOn = pid => { const x = R.items.find(i => i.kind === 'scene' && (i.s.cast || []).includes(pid)); return x ? x.start : R.call + 60; };
    const people = castOfDay(d, day).map(p => ({ p, ready: firstOn(p.id) - 15, chair: num((H.chair || {})[p.id]) || 30 })).sort((a, b) => b.ready - a.ready);
    const free = Array(artists).fill(1e9);
    people.forEach(x => { let best = 0; free.forEach((f, i) => { if (Math.min(f, x.ready - ward) > Math.min(free[best], x.ready - ward)) best = i; }); const end = Math.min(free[best], x.ready - ward); x.start = end - x.chair; x.arrive = x.start - 10; x.artist = best + 1; free[best] = x.start; });
    return people.sort((a, b) => a.arrive - b.arrive);
  };
  F.desks.push({ id: 'hmu', group: 'Art and look', label: 'Hair and makeup', who: 'Makeup artists, hair stylists', icon: '💄',
    alerts(d) { return F.nextDays(d, 2).filter(x => x.call && F.makeupCalls(d, x).some(m => m.arrive < toMin(x.call) - 90)).map(x => ({ lvl: 'warn', text: `${F.dayLabel(d, x)}: makeup starts very early. Add an artist or start a scene without that actor.` })); },
    render(el, d) {
      const H = F.desk(d, 'hmu', {}), ui = this.ui = this.ui || {}, day = pickDay(d, ui), looks = F.desk(d, 'cont', {}).looks || {};
      if (!day) { el.innerHTML = head('Hair and makeup', 'Makeup calls for each day.') + '<div class="empty-row big">Add shoot days on the Schedule tab.</div>'; return; }
      const M = F.makeupCalls(d, day);
      el.innerHTML = head('Hair and makeup', 'Who sits in the chair when, worked out backwards from each actor’s first scene on the 1st AD’s running order. One tap puts the times on the call sheet.') +
        `<div class="dk-two"><section class="fsec"><div class="dk-h"><h3>Chair times</h3>${dayPick(d, ui, 'data-hday')}</div>
          <table class="ftable"><thead><tr><th>Actor</th><th>Arrive</th><th>In the chair</th><th>On set</th><th class="n">Minutes</th></tr></thead><tbody>${M.map(x => `<tr><td><b>${esc(x.p.role || '')}</b><br><small>${esc(x.p.name || '')}${num(H.artists) > 1 ? ` · artist ${x.artist}` : ''}</small></td><td><b>${hm(x.arrive)}</b></td><td>${hm(x.start)}</td><td>${hm(x.ready + 15)}</td><td class="num"><input data-hchair="${esc(x.p.id)}" value="${esc((H.chair || {})[x.p.id] || '')}" placeholder="30" inputmode="numeric"></td></tr>`).join('') || '<tr><td colspan="5" class="empty-row">No cast on this day</td></tr>'}</tbody></table>
          <div class="row"><button class="pri" data-hcall${M.length ? '' : ' disabled'}>Put these on the call sheet</button><label class="dk-sd">Artists<input data-hk="artists" value="${esc(H.artists || 1)}" inputmode="numeric"></label><label class="dk-sd">Wardrobe (min)<input data-hk="ward" value="${esc(H.ward ?? 15)}" inputmode="numeric"></label></div></section>
        <section class="fsec"><h3>Looks today</h3>${F.dayScenes(d, day).map(s => `<div class="dk-hl"><b>${esc(s.num)}</b>${(s.cast || []).map(id => { const p = F.person(d, id), L = looks[s.id + ':' + id] || {}; return p ? `<p><b>${esc(p.role || '')}</b>: ${esc([L.hair, L.state].filter(Boolean).join(' · ') || 'no notes yet')}</p>` : ''; }).join('')}${(s.tags && (s.tags.makeup || []).length) ? `<p class="fhint">Script: ${s.tags.makeup.map(esc).join(', ')}</p>` : ''}</div>`).join('')}
          <label class="dk-lab">Kit and special makeup<textarea data-hnote rows="3" placeholder="Blood, sweat spray, wig for the flashback">${esc(H.notes || '')}</textarea></label></section></div>`;
      el.onchange = e => { const t = e.target;
        if (t.dataset.hday !== undefined) { ui.day = t.value; return F.refresh(); }
        if (t.dataset.hchair) return W('hmu', () => ({}), x => { (x.chair = x.chair || {})[t.dataset.hchair] = t.value; });
        if (t.dataset.hk) return W('hmu', () => ({}), x => { x[t.dataset.hk] = t.value; });
        if (t.dataset.hnote !== undefined) return W('hmu', () => ({}), x => { x.notes = t.value; }, true);
      };
      el.onclick = e => { if (e.target.closest('[data-hcall]')) { F.change(dd => { const dy = dd.days.find(x => x.id === day.id); dy.castCalls = dy.castCalls || {}; M.forEach(x => { dy.castCalls[x.p.id] = hh(x.arrive); }); }); N.toast('Cast call times are on the call sheet'); } };
    } });

  /* ================= STUNTS AND SAFETY ================= */
  const HAZ = [[/fire|flame|burn|smok|candle|kerosene/i, 'Fire or smoke'], [/gun|pistol|rifle|shoot(s|ing)? (at|him|her)|knife|machete|cutlass|weapon/i, 'Weapons (props)'], [/fight|punch|slap|kick|struggle|attack|beat/i, 'Fight'], [/fall|jump|roof|ledge|height|cliff|stairs/i, 'Falls or heights'], [/water|river|sea|pool|swim|lagoon|beach|rain/i, 'Water'], [/car|bus|danfo|okada|keke|bike|drive|vehicle|traffic|road/i, 'Vehicles and roads'], [/crowd|market|riot|protest|hawkers|party/i, 'Crowds'], [/child|baby|kid/i, 'Children on set'], [/blood|wound|injur/i, 'Blood and injury makeup']];
  F.hazardsOf = s => { const txt = [s.summary, s.loc, ...Object.values(s.tags || {}).flat()].join(' '), out = HAZ.filter(([re]) => re.test(txt)).map(x => x[1]); if (isExt(s) && isNight(s)) out.push('Night exterior'); return [...new Set(out)]; };
  F.desks.push({ id: 'safety', group: 'Safety and logistics', label: 'Stunts and safety', who: 'Safety officer, stunt coordinator, medic', icon: '⛑',
    status(d) { const S = F.desk(d, 'safety', {}), risky = d.scenes.filter(s => F.hazardsOf(s).length), n = risky.filter(s => ((S.risk || {})[s.id] || {}).controls).length; return { ready: (S.hospital ? 0.3 : 0) + (risky.length ? 0.7 * n / risky.length : 0.7), note: `${n} of ${risky.length} risky scenes planned${S.hospital ? '' : ' · no hospital set'}` }; },
    alerts(d) { const S = F.desk(d, 'safety', {}), out = [], soon = F.nextDays(d, 7); if (soon.length && !S.hospital) out.push({ lvl: 'bad', text: 'No nearest hospital or emergency number for the shoot' });
      const un = soon.flatMap(x => F.dayScenes(d, x)).filter(s => F.hazardsOf(s).length && !((S.risk || {})[s.id] || {}).controls); if (un.length) out.push({ lvl: 'warn', text: `Risky scenes this week without a safety plan: ${un.map(s => s.num).join(', ')}` }); return out; },
    render(el, d) {
      const S = F.desk(d, 'safety', {}), risk = S.risk || {}, scenes = F.sortScenes(d).filter(s => F.hazardsOf(s).length || risk[s.id]);
      el.innerHTML = head('Stunts and safety', 'The emergency plan everyone needs, and a risk check for every scene with fire, weapons, fights, heights, water, vehicles, crowds or children. The crisis screen and the call sheet use these details.') +
        `<div class="dk-two"><section class="fsec"><h3>Emergency plan</h3><div class="dk-grid2">${[['hospital', 'Nearest hospital', 'Name, address and phone'], ['emergency', 'Emergency number', '112'], ['meet', 'Meeting point', 'Front gate by the bus park'], ['medic', 'Medic or first aider', 'Name and phone'], ['fire', 'Fire extinguishers', 'By the generator and in the van'], ['police', 'Police or security contact', '']].map(([k, l, ph]) => `<label>${l}<input data-sk="${k}" value="${esc(S[k] || '')}" placeholder="${esc(ph)}"></label>`).join('')}</div>
          <p class="fhint">In Nigeria, 112 reaches emergency services from any phone. Put a first-aid kit on every set.</p></section>
        <section class="fsec"><h3>Risk check by scene</h3>${scenes.map(s => { const r = risk[s.id] || {}; return `<article class="dk-risk-s" data-sr="${esc(s.id)}"><header><b>${esc(s.num)}. ${esc(F.sceneLabel(s))}</b>${sel('data-srk="lvl"', [['low', 'Low risk'], ['med', 'Medium'], ['high', 'High: needs a specialist']], r.lvl || 'med')}</header>
          <div class="dk-gear">${F.hazardsOf(s).map(h => `<li>${esc(h)}</li>`).join('')}</div><textarea data-srk="controls" rows="2" placeholder="How you’ll keep everyone safe: stunt coordinator, rubber knife, road closed, safety swimmer, rehearse at half speed">${esc(r.controls || '')}</textarea></article>`; }).join('') || '<div class="empty-row">No risky scenes found in the script. Itàn looks for fire, weapons, fights, heights, water, vehicles, crowds and children.</div>'}</section></div>`;
      el.onchange = e => { const t = e.target;
        if (t.dataset.sk) return W('safety', () => ({}), x => { x[t.dataset.sk] = t.value.trim(); }, true);
        const r = t.closest('[data-sr]'); if (r && t.dataset.srk) W('safety', () => ({}), x => { x.risk = x.risk || {}; (x.risk[r.dataset.sr] = x.risk[r.dataset.sr] || {})[t.dataset.srk] = t.value; }, true);
      };
    } });

  /* ================= TRANSPORT ================= */
  F.desks.push({ id: 'transport', group: 'Safety and logistics', label: 'Transport', who: 'Transport captain, drivers', icon: '🚐',
    alerts(d) { const T = F.desk(d, 'transport', {}), seats = (T.vehicles || []).reduce((n, v) => n + num(v.seats), 0); if (!seats) return []; return F.nextDays(d, 3).filter(x => castOfDay(d, x).length + d.people.filter(p => p.kind === 'crew').length > seats).map(x => ({ lvl: 'warn', text: `${F.dayLabel(d, x)}: more people than seats (${seats})` })); },
    render(el, d) {
      const T = F.desk(d, 'transport', {}), ui = this.ui = this.ui || {}, day = pickDay(d, ui), vs = T.vehicles || [], seats = vs.reduce((n, v) => n + num(v.seats), 0);
      const ppl = day ? castOfDay(d, day).length + d.people.filter(p => p.kind === 'crew').length : 0, picks = (T.pick || []).filter(x => day && x.day === day.id), R = day ? F.runOrder(d, day) : null;
      el.innerHTML = head('Transport', 'The vehicles, who drives, and who gets picked up where and when. Company moves come from the 1st AD’s running order.') +
        `<div class="dk-two"><section class="fsec"><h3>Vehicles</h3><table class="ftable"><thead><tr><th>Vehicle</th><th>Driver</th><th>Phone</th><th>Seats</th><th></th></tr></thead><tbody>${vs.map(v => `<tr data-tv="${esc(v.id)}"><td><input data-tk="name" value="${esc(v.name || '')}" placeholder="Hiace bus"></td><td><input data-tk="driver" value="${esc(v.driver || '')}"></td><td><input data-tk="phone" value="${esc(v.phone || '')}" inputmode="tel"></td><td class="num"><input data-tk="seats" value="${esc(v.seats || '')}" inputmode="numeric"></td><td class="act"><button class="ib xs" data-tvdel aria-label="Remove">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-row">No vehicles yet</td></tr>'}</tbody></table>
          <div class="row"><button class="add" data-tvadd>+ Vehicle</button><span class="fhint">${seats} seats</span></div></section>
        <section class="fsec"><div class="dk-h"><h3>Pick-ups</h3>${dayPick(d, ui, 'data-tday')}</div>${day ? `<div class="dk-inline"><span class="dk-pill ${seats && ppl > seats ? 'bad' : ''}"><b>${ppl}</b> people</span><span class="dk-pill"><b>${seats}</b> seats</span></div>
          <table class="ftable"><thead><tr><th>Who</th><th>From</th><th>Time</th><th>Vehicle</th><th></th></tr></thead><tbody>${picks.map(x => `<tr data-tp="${esc(x.id)}"><td>${sel('data-tpk="who"', d.people.map(p => [p.id, p.name || p.role]), x.who, 'Choose…')}</td><td><input data-tpk="from" value="${esc(x.from || '')}" placeholder="Ikeja under bridge"></td><td><input type="time" data-tpk="time" value="${esc(x.time || '')}"></td><td>${sel('data-tpk="v"', vs.map(v => [v.id, v.name || 'Vehicle']), x.v, '—')}</td><td class="act"><button class="ib xs" data-tpdel aria-label="Remove">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-row">No pick-ups for this day</td></tr>'}</tbody></table>
          <div class="row"><button class="add" data-tpadd>+ Pick-up</button></div>
          ${R && R.items.some(i => i.kind === 'move') ? `<h4>Company moves</h4><ul class="dk-risk">${R.items.filter(i => i.kind === 'move').map(i => `<li>${hm(i.start)}: ${esc(i.text)}</li>`).join('')}</ul>` : ''}` : '<div class="empty-row">Add shoot days on the Schedule tab.</div>'}</section></div>`;
      el.onchange = e => { const t = e.target;
        if (t.dataset.tday !== undefined) { ui.day = t.value; return F.refresh(); }
        const v = t.closest('[data-tv]'); if (v && t.dataset.tk) return W('transport', () => ({}), x => { x.vehicles.find(y => y.id === v.dataset.tv)[t.dataset.tk] = t.value.trim(); });
        const p = t.closest('[data-tp]'); if (p && t.dataset.tpk) return W('transport', () => ({}), x => { x.pick.find(y => y.id === p.dataset.tp)[t.dataset.tpk] = t.value; });
      };
      el.onclick = e => { const t = e.target;
        if (t.closest('[data-tvadd]')) return W('transport', () => ({}), x => (x.vehicles = x.vehicles || []).push({ id: F.uid(), seats: '' }));
        if (t.closest('[data-tpadd]')) return W('transport', () => ({}), x => (x.pick = x.pick || []).push({ id: F.uid(), day: day.id }));
        const a = t.closest('[data-tvdel]'); if (a) { const id = a.closest('[data-tv]').dataset.tv; return W('transport', () => ({}), x => { x.vehicles = x.vehicles.filter(y => y.id !== id); }); }
        const b = t.closest('[data-tpdel]'); if (b) { const id = b.closest('[data-tp]').dataset.tp; return W('transport', () => ({}), x => { x.pick = x.pick.filter(y => y.id !== id); }); }
      };
    } });

  /* ================= CATERING ================= */
  F.mealsOf = (d, day) => {
    const C = F.desk(d, 'food', {}), R = F.runOrder(d, day), extras = F.dayScenes(d, day).flatMap(s => (s.tags && s.tags.extras) || []).reduce((n, w) => n + (parseInt(String(w).match(/\d+/)) || 1), 0);
    const heads = castOfDay(d, day).length + d.people.filter(p => p.kind === 'crew').length + extras + num((C.guests || {})[day.id]);
    const lunch = R.items.find(i => i.kind === 'lunch'), meals = [['Breakfast', R.call - 15], ...(lunch ? [['Lunch', lunch.start]] : []), ...(R.wrap - R.call > 10 * 60 || R.wrap > 19 * 60 ? [['Dinner', R.wrap - 90]] : [])];
    return { heads, extras, meals, cost: heads * meals.length * (num(C.rate) || 2500) };
  };
  F.desks.push({ id: 'food', group: 'Safety and logistics', label: 'Catering', who: 'Caterer, craft services', icon: '🍲',
    render(el, d) {
      const C = F.desk(d, 'food', {}), ui = this.ui = this.ui || {}, day = pickDay(d, ui), cur = (d.budget && d.budget.cur) || '₦';
      const all = d.days.map(x => F.mealsOf(d, x)), total = all.reduce((n, m) => n + m.cost, 0), M = day ? F.mealsOf(d, day) : null;
      el.innerHTML = head('Catering', 'How many people to feed each day and when, from the cast in the scenes, the crew, the extras and the running order. Diets come from the people list.', d.budget ? `<button class="ib" data-fbud>Send to the budget</button>` : '') +
        `<div class="dk-two"><section class="fsec"><div class="dk-h"><h3>Meals</h3>${dayPick(d, ui, 'data-fday')}</div>${M ? `<div class="dk-meter"><div><small>People to feed</small><b>${M.heads}</b><span>${M.extras ? `including ${M.extras} extras` : 'cast and crew'}</span></div><div><small>Meals</small><b>${M.meals.length}</b><span>${M.meals.map(m => `${m[0]} ${hm(m[1])}`).join(' · ')}</span></div><div><small>Cost</small><b>${esc(cur)}${Math.round(M.cost).toLocaleString()}</b><span>this day</span></div></div>
          <div class="dk-grid2"><label>Guests or visitors<input data-fg value="${esc((C.guests || {})[day.id] || '')}" inputmode="numeric" placeholder="0"></label><label>Cost per plate (${esc(cur)})<input data-fk="rate" value="${esc(C.rate || 2500)}" inputmode="decimal"></label></div>
          <p class="fhint">Whole shoot: about ${esc(cur)}${Math.round(total).toLocaleString()}. Keep water, snacks and tea going all day (craft services).</p>` : '<div class="empty-row">Add shoot days on the Schedule tab.</div>'}</section>
        <section class="fsec"><h3>Diets and allergies</h3><table class="ftable"><tbody>${d.people.filter(p => p.name).map(p => `<tr><td>${esc(p.name)}<br><small>${esc(p.role || '')}</small></td><td><input data-fdiet="${esc(p.id)}" value="${esc((C.diet || {})[p.id] || '')}" placeholder="No pork, vegetarian, nut allergy…"></td></tr>`).join('') || '<tr><td class="empty-row">Add people on the People tab.</td></tr>'}</tbody></table></section></div>`;
      el.onchange = e => { const t = e.target;
        if (t.dataset.fday !== undefined) { ui.day = t.value; return F.refresh(); }
        if (t.dataset.fg !== undefined) return W('food', () => ({}), x => { (x.guests = x.guests || {})[day.id] = t.value; });
        if (t.dataset.fk) return W('food', () => ({}), x => { x[t.dataset.fk] = t.value; });
        if (t.dataset.fdiet) return W('food', () => ({}), x => { (x.diet = x.diet || {})[t.dataset.fdiet] = t.value.trim(); }, true);
      };
      el.onclick = e => { if (e.target.closest('[data-fbud]')) F.change(dd => { const b = dd.budget; let dp = b.depts.find(y => /cater|food/i.test(y.name)); if (!dp) { dp = { id: F.uid(), name: 'Catering', items: [] }; b.depts.push(dp); }
        dd.days.forEach(x => { const m = F.mealsOf(dd, x); let it = dp.items.find(y => y.day === x.id); if (!it) { it = { id: F.uid(), day: x.id }; dp.items.push(it); } it.desc = `Meals, ${F.dayLabel(dd, x)} (${m.heads} people × ${m.meals.length})`; it.qty = 1; it.rate = Math.round(m.cost); }); N.toast('Catering is in the budget'); }); };
    } });

  /* ================= EDIT AND VFX ================= */
  const VST = [['todo', 'To do'], ['wip', 'In progress'], ['review', 'Review'], ['final', 'Final']];
  const VKIND = ['Clean-up', 'Screen replacement', 'Sky replacement', 'Compositing', 'Muzzle flash or blood', 'CGI', 'Titles and graphics', 'Stabilise or reframe'];
  F.desks.push({ id: 'vfx', group: 'Post', label: 'Edit and VFX', who: 'Editor, VFX artists', icon: '✂',
    status(d) { const V = F.desk(d, 'vfx', {}).shots || []; return { ready: V.length ? V.filter(x => x.st === 'final').length / V.length : null, note: `${V.filter(x => x.st === 'final').length} of ${V.length} VFX shots final` }; },
    render(el, d) {
      const V = F.desk(d, 'vfx', {}), shots = V.shots || [], sug = d.scenes.filter(s => (s.tags && (s.tags.effects || []).length) && !shots.some(x => x.scene === String(s.num)));
      const circled = d.takes ? d.takes.filter(t => t.mark === 'circle') : [];
      el.innerHTML = head('Edit and VFX', 'The visual effects shots and who’s on them, and the editor’s notes scene by scene with the circled takes from set.', '<button class="ib" data-ftab="post">Post tracker</button>') +
        `<div class="dk-two"><section class="fsec"><h3>VFX shots</h3><div class="dk-scroll"><table class="ftable"><thead><tr><th>Scene</th><th>Shot</th><th>What</th><th>Kind</th><th>Status</th><th>Artist</th><th></th></tr></thead><tbody>${shots.map(x => `<tr data-vx="${esc(x.id)}"><td class="num"><input data-vk="scene" value="${esc(x.scene || '')}"></td><td class="num"><input data-vk="shot" value="${esc(x.shot || '')}"></td><td><input data-vk="what" value="${esc(x.what || '')}" placeholder="Remove the boom shadow"></td><td>${sel('data-vk="kind"', VKIND, x.kind, '—')}</td><td>${sel('data-vk="st"', VST, x.st || 'todo')}</td><td><input data-vk="who" value="${esc(x.who || '')}"></td><td class="act"><button class="ib xs" data-vxdel aria-label="Remove">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-row">No VFX shots yet</td></tr>'}</tbody></table></div>
          <div class="row"><button class="add" data-vxadd>+ VFX shot</button>${sug.length ? `<button class="add" data-vxsug>+ ${sug.length} from effects in the script</button>` : ''}</div></section>
        <section class="fsec"><h3>Editor’s notes</h3>${F.sortScenes(d).map(s => { const c = circled.filter(t => String(t.scene) === String(s.num)); return `<label class="dk-lab"><span><b>${esc(s.num)}</b> ${esc(F.sceneLabel(s))}${c.length ? ` · circled: ${c.map(t => esc(t.scene + t.shot + '-' + t.n)).join(', ')}` : ''}</span><textarea data-vnote="${esc(s.id)}" rows="2" placeholder="Start on the clock, cut before she turns">${esc((V.notes || {})[s.id] || '')}</textarea></label>`; }).join('') || '<div class="empty-row">Scenes appear once the script is broken down.</div>'}</section></div>`;
      el.onchange = e => { const t = e.target;
        const r = t.closest('[data-vx]'); if (r && t.dataset.vk) return W('vfx', () => ({}), x => { x.shots.find(y => y.id === r.dataset.vx)[t.dataset.vk] = t.value.trim(); });
        if (t.dataset.vnote) return W('vfx', () => ({}), x => { (x.notes = x.notes || {})[t.dataset.vnote] = t.value; }, true);
      };
      el.onclick = e => { const t = e.target;
        if (t.closest('[data-vxadd]')) return W('vfx', () => ({}), x => (x.shots = x.shots || []).push({ id: F.uid(), st: 'todo' }));
        if (t.closest('[data-vxsug]')) return W('vfx', () => ({}), x => { x.shots = x.shots || []; sug.forEach(s => x.shots.push({ id: F.uid(), scene: String(s.num), what: s.tags.effects.join(', '), st: 'todo' })); });
        const dl = t.closest('[data-vxdel]'); if (dl) { const id = dl.closest('[data-vx]').dataset.vx; W('vfx', () => ({}), x => { x.shots = x.shots.filter(y => y.id !== id); }); }
      };
    } });

  /* ================= MUSIC ================= */
  const LIC = [['none', 'Not needed'], ['ask', 'Asking'], ['ok', 'Cleared'], ['no', 'Refused']];
  F.desks.push({ id: 'music', group: 'Post', label: 'Music', who: 'Composer, music supervisor', icon: '🎵',
    status(d) { const c = F.desk(d, 'music', {}).cues || []; return { ready: c.length ? c.filter(x => ['none', 'ok'].includes(x.lic || 'none')).length / c.length : null, note: `${c.length} cues · ${c.filter(x => x.lic === 'ask').length} waiting for a licence` }; },
    alerts(d) { const c = F.desk(d, 'music', {}).cues || [], no = c.filter(x => x.lic === 'no'), ask = c.filter(x => x.lic === 'ask'); return [...(no.length ? [{ lvl: 'bad', text: `Music refused: ${no.map(x => x.title || x.cue).join(', ')}. Replace before picture lock.` }] : []), ...(ask.length ? [{ lvl: 'info', text: `${ask.length} song${ask.length > 1 ? 's' : ''} still waiting for a licence` }] : [])]; },
    render(el, d) {
      const cues = F.desk(d, 'music', {}).cues || [], cur = (d.budget && d.budget.cur) || '₦';
      el.innerHTML = head('Music', 'Every music cue: score from the composer, songs playing in the scene, and the licences for songs you don’t own. Festivals and platforms ask for this cue sheet.') +
        `<section class="fsec"><div class="dk-scroll"><table class="ftable dk-props"><thead><tr><th>Cue</th><th>Scene</th><th>Kind</th><th>Title</th><th>Artist or composer</th><th>Licence</th><th>Cost</th><th></th></tr></thead><tbody>${cues.map((x, i) => `<tr data-mc="${esc(x.id)}"><td class="num"><input data-mk="cue" value="${esc(x.cue || `${i + 1}M1`)}"></td><td class="num"><input data-mk="scene" value="${esc(x.scene || '')}"></td><td>${sel('data-mk="kind"', ['Score', 'Song in the scene', 'Song over the scene', 'Sound design'], x.kind, '—')}</td><td><input data-mk="title" value="${esc(x.title || '')}"></td><td><input data-mk="by" value="${esc(x.by || '')}"></td><td>${sel('data-mk="lic"', LIC, x.lic || 'none')}</td><td class="num"><input data-mk="cost" value="${esc(x.cost || '')}" placeholder="${esc(cur)}" inputmode="decimal"></td><td class="act"><button class="ib xs" data-mcdel aria-label="Remove">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty-row">No music cues yet</td></tr>'}</tbody></table></div>
          <div class="row"><button class="add" data-mcadd>+ Cue</button><span class="fhint">Never use a song in a film you show publicly without a licence for both the recording and the song.</span></div></section>`;
      el.onchange = e => { const t = e.target, r = t.closest('[data-mc]'); if (r && t.dataset.mk) W('music', () => ({}), x => { x.cues.find(y => y.id === r.dataset.mc)[t.dataset.mk] = t.value.trim(); }); };
      el.onclick = e => { const t = e.target;
        if (t.closest('[data-mcadd]')) return W('music', () => ({}), x => (x.cues = x.cues || []).push({ id: F.uid(), lic: 'none' }));
        const dl = t.closest('[data-mcdel]'); if (dl) { const id = dl.closest('[data-mc]').dataset.mc; W('music', () => ({}), x => { x.cues = x.cues.filter(y => y.id !== id); }); }
      };
    } });

  /* ================= CLEARANCES: releases, licences, insurance ================= */
  const CST = [['', 'Not started'], ['sent', 'Sent'], ['signed', 'Signed']];
  F.clearanceRows = d => {
    const C = F.desk(d, 'legal', {}), st = C.st || {}, rows = [];
    d.people.filter(p => p.kind === 'cast' && p.name).forEach(p => rows.push({ k: 'cast:' + p.id, kind: 'Actor release', what: `${p.name} (${p.role || 'cast'})`, pid: p.id }));
    d.people.filter(p => p.kind === 'crew' && p.name).forEach(p => rows.push({ k: 'crew:' + p.id, kind: 'Crew agreement', what: `${p.name} (${p.role || 'crew'})` }));
    (d.locations || []).forEach(l => rows.push({ k: 'loc:' + l.id, kind: 'Location release', what: l.name }));
    (F.desk(d, 'music', {}).cues || []).filter(x => x.lic && x.lic !== 'none').forEach(x => rows.push({ k: 'mus:' + x.id, kind: 'Music licence', what: x.title || x.cue }));
    (F.desk(d, 'brands', {}).deals || []).filter(x => x.brand && x.st !== 'talk' && x.st !== 'no').forEach(x => rows.push({ k: 'brand:' + x.id, kind: 'Brand agreement', what: x.brand }));
    (C.extra || []).forEach(x => rows.push({ k: 'x:' + x.id, kind: x.kind || 'Other', what: x.what, extra: x.id }));
    return rows.map(r => ({ ...r, ...(st[r.k] || {}) }));
  };
  F.desks.push({ id: 'legal', group: 'Production', label: 'Clearances', who: 'Producer, production lawyer', icon: '📝',
    status(d) { const r = F.clearanceRows(d); return { ready: r.length ? r.filter(x => x.s === 'signed').length / r.length : null, note: `${r.filter(x => x.s === 'signed').length} of ${r.length} signed` }; },
    alerts(d) { const soon = new Set(F.nextDays(d, 3).flatMap(x => castOfDay(d, x).map(p => p.id))), un = F.clearanceRows(d).filter(r => r.pid && soon.has(r.pid) && r.s !== 'signed'); return un.length ? [{ lvl: 'warn', text: `Actors shooting soon without a signed release: ${un.map(r => r.what.split(' (')[0]).join(', ')}` }] : []; },
    render(el, d) {
      const rows = F.clearanceRows(d);
      el.innerHTML = head('Clearances', 'Signed releases from everyone on screen, agreements with the crew, location releases, music licences, brand deals and insurance. Itàn fills in each agreement; they sign it on their phone. Distributors and festivals ask for these.', F.syncSignatures && F.desk(d, 'legal', {}).room ? '<button class="ib" data-clsync>Check for signatures</button>' : '') +
        `<section class="fsec"><div class="dk-scroll"><table class="ftable dk-props"><thead><tr><th>Kind</th><th>Who or what</th><th>Status</th><th>Agreement</th><th>Notes</th><th></th></tr></thead><tbody>${rows.map(r => `<tr data-cl="${esc(r.k)}" class="st-${r.s === 'signed' ? 'ready' : 'need'}"><td><small>${esc(r.kind)}</small></td><td><b>${esc(r.what || '')}</b></td><td>${sel('data-clk="s"', CST, r.s || '')}</td><td class="cl-doc">${r.file ? `<button class="linkish" data-clopen="${esc(r.file)}">Open signed copy</button>` : ''}${F.signDoc && !r.extra && r.s !== 'signed' ? `<button class="ib xs${r.s === 'sent' ? '' : ' pri'}" data-clsign>${r.s === 'sent' ? 'Waiting · open' : '✍ Prepare and sign'}</button>` : ''}${!r.file ? `<button class="linkish" data-clup>Upload a copy</button>` : ''}</td><td><input data-clk="note" value="${esc(r.note || '')}"></td><td class="act">${r.extra ? '<button class="ib xs" data-cldel aria-label="Remove">✕</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-row">Add cast, crew and locations, and they show up here.</td></tr>'}</tbody></table></div>
          <div class="row"><button class="add" data-cladd>+ Something else to clear</button><span class="fhint">Logos, artwork, branded products, insurance, permits.</span></div></section>`;
      const setR = (k, fn) => W('legal', () => ({}), x => { x.st = x.st || {}; fn(x.st[k] = x.st[k] || {}); });
      el.onchange = e => { const t = e.target, r = t.closest('[data-cl]'); if (r && t.dataset.clk) setR(r.dataset.cl, x => { x[t.dataset.clk] = t.value; }); };
      el.onclick = async e => { const t = e.target, r = t.closest('[data-cl]');
        if (t.closest('[data-clsync]')) { const n = await F.syncSignatures(false); N.toast(n ? `${n} new signature${n === 1 ? '' : 's'}` : 'No new signatures yet'); return; }
        if (r && t.closest('[data-clsign]')) { const row = F.clearanceRows(d).find(x => x.k === r.dataset.cl); if (row) F.signDoc(row); return; }
        if (r && t.closest('[data-clup]')) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*,application/pdf'; i.onchange = async () => { if (!i.files[0]) return; const id = await N.Store.putMedia(i.files[0]); setR(r.dataset.cl, x => { x.file = id; if (!x.s) x.s = 'signed'; }); }; i.click(); return; }
        const op = t.closest('[data-clopen]'); if (op) { const u = await N.Store.mediaUrl(op.dataset.clopen); if (u) window.open(u, '_blank', 'noopener'); return; }
        if (t.closest('[data-cladd]')) { const w = await F.ask('What needs clearing?', 'Coca-Cola sign in scene 4, insurance, a painting'); if (w) W('legal', () => ({}), x => (x.extra = x.extra || []).push({ id: F.uid(), what: w, kind: /insur/i.test(w) ? 'Insurance' : 'Clearance' })); return; }
        if (r && t.closest('[data-cldel]')) { const id = r.dataset.cl.slice(2); W('legal', () => ({}), x => { x.extra = x.extra.filter(y => y.id !== id); }); }
      };
    } });

  /* ================= THE DIRECTOR'S OVERVIEW ================= */
  F.desks.unshift({ id: 'director', group: 'Direction', label: 'Director’s overview', who: 'Every department at a glance', icon: '🎬',
    render(el, d) {
      const today = N.todayStr(0), next = d.days.find(x => x.date && x.date >= today && !(x.set && x.set.wrapped)) || d.days.find(x => !(x.set && x.set.wrapped));
      const P = F.producerRisks ? F.producerRisks(d) : { risks: [] }, risks = P.risks.filter(r => r.lvl !== 'info');
      const people = N.live && N.live.people ? N.live.people() : [];
      let hero = '<div class="empty-row">No shoot days yet. Build the schedule and this shows the next day here.</div>';
      if (next) {
        const R = F.runOrder(d, next), sc = F.dayScenes(d, next), wa = next.wx && F.weatherAlerts ? F.weatherAlerts(d, next, next.wx).filter(a => a.lvl !== 'info') : [], loc = F.placeOfDay ? F.placeOfDay(d, next) : null;
        const away = next.date ? Math.round((new Date(next.date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 864e5) : null;
        hero = `<div class="dr-next"><div class="dr-when"><small>${away === 0 ? 'Today' : away === 1 ? 'Tomorrow' : away != null ? `In ${away} days` : 'Next'}</small><b>${esc(F.dayLabel(d, next))}</b><span>${loc ? esc(loc.name || '') : ''}</span></div>
          <div class="dr-facts"><span><b>${hm(R.call)}</b>crew call</span><span><b>${hm(R.wrap)}</b>wrap</span><span><b>${sc.length}</b>scene${sc.length === 1 ? '' : 's'}</span><span><b>${F.eighths(sc.reduce((n, s) => n + (s.pages || 0), 0))}</b>pages</span><span><b>${castOfDay(d, next).length}</b>cast</span>${next.wx ? `<span><b>${next.wx.kind === 'forecast' ? Math.round(next.wx.tmax) + '°' : '—'}</b>${next.wx.kind === 'forecast' ? (next.wx.rain ?? 0) + '% rain' : 'no forecast yet'}</span>` : ''}</div>
          <div class="dr-scenes">${sc.map(s => `<span class="strip ${F.stripClass(s)}">${esc(s.num)} ${esc(s.loc || '')}</span>`).join('')}</div>
          ${wa.map(a => `<div class="wx-al ${a.lvl}"><b>${esc(a.text)}</b><span>${esc(a.hint)}</span></div>`).join('')}
          <div class="row"><button class="ib" data-ftab="callsheets">Call sheet</button><button class="ib" data-ftab="set">Set Mode</button><button class="ib" data-ftab="weather">Weather</button>${F.alertCrew ? '<button class="ib" data-dralert>Alert the crew</button>' : ''}</div></div>`;
      }
      const desks = F.desks.filter(x => x.id !== 'director'), all = F.deskAlerts(d);
      el.innerHTML = head('Director’s overview', 'Every department in one place: the next shoot day, how ready each team is, and what needs you. It updates live as your team works.') +
        `${people.length ? `<p class="dr-live"><i></i>Working now: ${people.map(p => esc(p.name || 'Someone')).join(', ')}</p>` : ''}
        <section class="fsec">${hero}</section>
        <div class="dr-grid">${desks.map(x => { let s = null; try { s = x.status ? x.status(d) : null; } catch (e) {} const a = all.filter(y => y.desk === x.id), worst = a.find(y => y.lvl === 'bad') || a.find(y => y.lvl === 'warn');
          const pct = s && s.ready != null ? Math.round(Math.max(0, Math.min(1, s.ready)) * 100) : null;
          return `<button class="dr-dept ${worst ? worst.lvl : pct === 100 ? 'good' : ''}" data-dkgo="${x.id}"><span class="dk-ic">${x.icon}</span><span class="dr-dt"><b>${esc(x.label)}</b><small>${esc(worst ? worst.text : s ? s.note : x.who)}</small>${pct != null ? `<i class="dk-bar"><em style="width:${pct}%"></em></i>` : ''}</span>${pct != null ? `<em class="dr-pct">${pct}%</em>` : ''}</button>`; }).join('')}</div>
        <section class="fsec"><h3>Needs you <small class="fhint">${risks.length}</small></h3><ul class="dk-risks">${risks.slice(0, 10).map(r => `<li class="${r.lvl}"><span>${esc(r.text)}</span><button class="ib xs" ${r.go.startsWith('desk:') ? `data-dkgo="${r.go.slice(5)}"` : `data-ftab="${r.go}"`}>Open</button></li>`).join('') || '<li class="good"><span>Nothing urgent. Every department is on track.</span></li>'}</ul></section>`;
      el.onclick = e => { const g = e.target.closest('[data-dkgo]'); if (g) F.openDesk(g.dataset.dkgo); if (e.target.closest('[data-dralert]')) F.alertCrew(''); };
    } });

  /* ================= the call sheet gets every department's part ================= */
  F.callSheetExtras = (d, day) => {
    const R = F.runOrder(d, day), S = F.desk(d, 'safety', {}), T = F.desk(d, 'transport', {}), M = F.mealsOf(d, day), out = [];
    if (R.items.length > 2) out.push(`<h3>Running order</h3><table class="ftable"><tbody>${R.items.map(i => `<tr><td style="width:90px"><b>${hm(i.start)}</b></td><td>${esc(i.text)}</td></tr>`).join('')}</tbody></table>`);
    const pk = (T.pick || []).filter(x => x.day === day.id && x.who); if (pk.length) out.push(`<h3>Pick-ups</h3><table class="ftable"><tbody>${pk.map(x => { const p = F.person(d, x.who) || {}, v = (T.vehicles || []).find(y => y.id === x.v) || {}; return `<tr><td><b>${esc(x.time ? hm(toMin(x.time)) : '')}</b></td><td>${esc(p.name || p.role || '')}</td><td>${esc(x.from || '')}</td><td>${esc(v.name || '')}${v.driver ? ' · ' + esc(v.driver) + (v.phone ? ' ' + esc(v.phone) : '') : ''}</td></tr>`; }).join('')}</tbody></table>`);
    const costumes = F.dayScenes(d, day).flatMap(s => (s.cast || []).map(pid => { const c = F.costumeOf(d, s, pid), p = F.person(d, pid); return c && p ? `${s.num}: ${p.role} in ${c.desc || 'their costume'}` : ''; })).filter(Boolean);
    const dept = [['Meals', M.meals.map(m => `${m[0]} ${hm(m[1])}`).join(', ') + ` · ${M.heads} people`], ['Costumes', costumes.join('; ')], ['Power', F.lightLoad && F.lightLoad(d, day).peak > 800 ? `About ${(F.lightLoad(d, day).peak / 1000).toFixed(1)} kW at the peak` : '']].filter(x => x[1]);
    if (dept.length) out.push(`<h3>Departments</h3><div class="cs-grid">${dept.map(([k, v]) => `<div><small>${k}</small><p>${esc(v)}</p></div>`).join('')}</div>`);
    const safe = [['Emergency', S.emergency], ['Medic', S.medic], ['Meeting point', S.meet]].filter(x => x[1]);
    const haz = F.dayScenes(d, day).filter(s => ((S.risk || {})[s.id] || {}).controls);
    if (safe.length || haz.length) out.push(`<h3>Safety</h3>${safe.length ? `<div class="cs-grid">${safe.map(([k, v]) => `<div><small>${k}</small><p>${esc(v)}</p></div>`).join('')}</div>` : ''}${haz.map(s => `<p class="cs-notes"><b>Scene ${esc(s.num)}:</b> ${esc(S.risk[s.id].controls)}</p>`).join('')}`);
    return out.join('');
  };
  F.deskTabs();
})();
