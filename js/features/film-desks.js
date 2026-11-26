/* Department desks: one tab with a desk for each department's own work.
   Lighting and power (gaffer), Continuity, Props, Sound, Colour, Producer and BTS each get tools built on the
   film's script, schedule and locations, so nobody types the same thing twice.
   Desks are registered with F.desks.push({ id, label, who, icon, render(el, d, ui) }). This file has the frame and
   the Lighting, Continuity and Props desks; film-desks2.js has the rest. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  F.desks = [];
  F.desk = (d, k, init) => { d.desks = d.desks || {}; return d.desks[k] || init; };   // read without changing anything
  F.deskW = (d, k, init) => { d.desks = d.desks || {}; d.desks[k] = d.desks[k] || init(); return d.desks[k]; };  // inside F.change only
  F.openDesk = id => F.open('dk-' + id);
  const num = v => { const n = parseFloat(String(v || '').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
  F.num = num;
  F.mediaImgs = el => el.querySelectorAll('img[data-media]').forEach(async im => { const u = await N.Store.mediaUrl(im.dataset.media); if (u) im.src = u; else im.remove(); });
  F.dayLabel = (d, day) => { const i = d.days.indexOf(day); return `Day ${i + 1}${day.date ? ' · ' + new Date(day.date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : ''}`; };
  F.nextDays = (d, n = 3) => d.days.filter(x => x.date && x.date >= N.todayStr(0) && x.date <= N.todayStr(n) && !(x.set && x.set.wrapped));
  F.daysOfScene = (d, s) => d.days.filter(x => x.sceneIds.includes(s.id));
  F.pickImages = (multiple = true) => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = multiple; i.onchange = async () => { const ids = []; for (const f of i.files) ids.push(await N.Store.putMedia(f)); res(ids); }; i.click(); });

  // departments, in the order a film is usually organised
  F.DESK_GROUPS = ['Direction', 'Production', 'Camera and light', 'Art and look', 'Sound', 'Safety and logistics', 'Post', 'Publicity'];
  F.deskAlerts = d => F.desks.flatMap(x => { try { return (x.alerts ? x.alerts(d) : []).map(a => ({ ...a, desk: x.id, label: x.label, icon: x.icon })); } catch (e) { return []; } });
  // each desk is a tab in the stage where that department does most of its work
  const DESK_STAGE = { director: 'overview', prod: 'overview', ad: 'plan', art: 'plan', props: 'plan', brands: 'plan', ward: 'plan', hmu: 'plan', light: 'plan', grip: 'plan', safety: 'plan', transport: 'plan', food: 'plan', cont: 'shoot', dit: 'shoot', sound: 'shoot', bts: 'shoot', vfx: 'post', colour: 'post', music: 'post', legal: 'post' };
  F.deskTabs = () => F.desks.forEach((x, i) => {
    if (F.tabs.some(t => t.id === 'dk-' + x.id)) return;
    F.setStage('dk-' + x.id, DESK_STAGE[x.id] || 'plan');
    F.tabs.push({ id: 'dk-' + x.id, desk: true, label: x.label, icon: x.icon, order: 100 + (Object.keys(DESK_STAGE).indexOf(x.id) + 1 || 50 + i), badge: d => { try { return (x.alerts ? x.alerts(d) : []).filter(a => a.lvl === 'bad').length; } catch (e) { return 0; } },
      render(el, d) { el.innerHTML = `<div class="fwrap wide dk1"><section class="dk-body" data-desk-body="${x.id}"></section></div>`; el.onclick = el.onchange = el.oninput = null; x.render.call(x, el.querySelector('.dk-body'), d); } });
    if (F.sortTabs) F.sortTabs();
  });

  /* ================= LIGHTING AND POWER (gaffer, DP, sparks) ================= */
  const FIX = [['Aputure 600d / 600x', 720], ['Aputure 300d / 300x', 350], ['Aputure 120d', 180], ['Amaran 200d / 200x', 200], ['Amaran 100d / 100x', 130], ['Nanlite Forza 500', 560], ['Nanlite Forza 300', 330], ['Nanlite Forza 60', 88], ['Godox SL60 / SL150', 150], ['LED panel (1×1)', 100], ['LED tube (4 ft)', 40], ['LED tube (2 ft)', 20], ['Fresnel 650 W', 650], ['Fresnel 1K', 1000], ['Fresnel 2K', 2000], ['HMI 1.2K (with ballast)', 1380], ['HMI 4K (with ballast)', 4600], ['Practical lamp', 60], ['Haze machine', 700], ['Monitors and video village', 300], ['Battery charging', 400], ['DIT / laptop station', 250]];
  const GENS = [2.5, 3.5, 5, 6.5, 7.5, 10, 15, 20, 30, 45, 60, 100];
  const MOODS = ['Natural', 'High key (bright, soft)', 'Low key (dark, contrasty)', 'Night', 'Golden hour', 'Mixed colour', 'Practical-led'];
  F.lightLoad = (d, day) => {
    const L = F.desk(d, 'light', {}), sc = L.scenes || {};
    const per = F.dayScenes(d, day).map(s => ({ s, w: ((sc[s.id] || {}).fixtures || []).reduce((n, f) => n + num(f.w) * (num(f.qty) || 1), 0) }));
    const base = num((L.base ?? 700)), peak = Math.max(0, ...per.map(x => x.w)) + base;
    const gear = {}; F.dayScenes(d, day).forEach(s => ((sc[s.id] || {}).fixtures || []).forEach(f => { gear[f.name] = Math.max(gear[f.name] || 0, num(f.qty) || 1); }));
    return { per, base, peak, gear };
  };
  F.desks.push({ id: 'light', group: 'Camera and light', label: 'Lighting and power', who: 'Gaffer, electric dept', icon: '💡',
    status(d) { const L = F.desk(d, 'light', {}), sc = L.scenes || {}, n = d.scenes.filter(s => ((sc[s.id] || {}).fixtures || []).length).length; return { ready: d.scenes.length ? n / d.scenes.length : null, note: `${n} of ${d.scenes.length} scenes lit` }; },
    alerts(d) { const L = F.desk(d, 'light', {}), have = num(L.kva); return have && (L.supply || 'gen') === 'gen' ? F.nextDays(d, 7).filter(x => F.lightLoad(d, x).peak * 1.25 / 0.8 / 1000 > have).map(x => ({ lvl: 'bad', text: `${F.dayLabel(d, x)} needs more power than your ${have} kVA generator` })) : []; }, render(el, d) {
    const L = F.desk(d, 'light', {}), sc = L.scenes || {}, volts = num(L.volts) || 230, supply = L.supply || 'gen';
    const ui = this.ui = this.ui || { scene: null, day: null };
    const scenes = F.sortScenes(d); if (!ui.scene || !scenes.find(s => s.id === ui.scene)) ui.scene = scenes[0] && scenes[0].id;
    if (!ui.day || !d.days.find(x => x.id === ui.day)) ui.day = (F.nextDays(d, 30)[0] || d.days[0] || {}).id;
    const s = scenes.find(x => x.id === ui.scene), my = s ? sc[s.id] || {} : {}, day = d.days.find(x => x.id === ui.day);
    const fixRows = (my.fixtures || []).map(f => `<tr data-fx="${esc(f.id)}"><td><input data-fk="name" value="${esc(f.name)}" list="dkFix"></td><td class="num"><input data-fk="qty" value="${esc(f.qty || 1)}" inputmode="numeric"></td><td class="num"><input data-fk="w" value="${esc(f.w || '')}" inputmode="numeric"></td><td><input data-fk="role" value="${esc(f.role || '')}" placeholder="Key, fill, back, bounce…"></td><td><input data-fk="gel" value="${esc(f.gel || '')}" placeholder="Gel, diffusion, colour"></td><td class="act"><button class="ib xs" data-fxdel aria-label="Remove">✕</button></td></tr>`).join('');
    const sceneW = (my.fixtures || []).reduce((n, f) => n + num(f.w) * (num(f.qty) || 1), 0);
    let power = '';
    if (day) {
      const ld = F.lightLoad(d, day), amps = ld.peak / volts, kva = ld.peak * 1.25 / 0.8 / 1000, gen = GENS.find(g => g >= kva) || Math.ceil(kva), have = num(L.kva), breaker = num(L.amps) || 13;
      const locs = F.locationsOfDay ? F.locationsOfDay(d, day) : [], pw = locs.map(l => (l.notes || {}).power).filter(Boolean);
      const fuel = ld.peak / 1000 * 0.6 * (num(L.hours) || 12) * (gen <= 10 ? 0.45 : 0.3);
      const ok = supply === 'gen' ? (!have || have >= kva) : amps <= breaker;
      power = `<section class="fsec dk-power"><div class="dk-h"><h3>Power for the day</h3><select data-lday aria-label="Shoot day">${d.days.map(x => `<option value="${esc(x.id)}"${x.id === ui.day ? ' selected' : ''}>${esc(F.dayLabel(d, x))}</option>`).join('')}</select></div>
        <div class="dk-meter ${ok ? 'ok' : 'over'}"><div><small>Biggest load at once</small><b>${(ld.peak / 1000).toFixed(2)} kW</b><span>${amps.toFixed(1)} A at ${volts} V</span></div>
          <div><small>${supply === 'gen' ? 'Generator to hire' : 'Wall supply'}</small><b>${supply === 'gen' ? `${gen} kVA` : `${breaker} A circuit`}</b><span>${supply === 'gen' ? (have ? (have >= kva ? `Your ${have} kVA is enough` : `Your ${have} kVA is too small`) : 'with 25% headroom') : (amps <= breaker ? 'Within the circuit' : `Over by ${(amps - breaker).toFixed(1)} A: split across circuits`)}</span></div>
          ${supply === 'gen' ? `<div><small>Fuel, rough</small><b>${Math.ceil(fuel)} L</b><span>for ${num(L.hours) || 12} hours (${gen <= 10 ? 'petrol' : 'diesel'})</span></div>` : ''}</div>
        <div class="dk-inline"><label>Supply<select data-lk="supply"><option value="gen"${supply === 'gen' ? ' selected' : ''}>Generator</option><option value="mains"${supply === 'mains' ? ' selected' : ''}>Wall sockets</option></select></label>
          <label>Volts<input data-lk="volts" value="${volts}" inputmode="numeric"></label>${supply === 'gen' ? `<label>Generator you have (kVA)<input data-lk="kva" value="${esc(L.kva || '')}" placeholder="Optional" inputmode="decimal"></label>` : `<label>Circuit (amps)<input data-lk="amps" value="${esc(L.amps || '')}" placeholder="13" inputmode="numeric"></label>`}
          <label>Always on (W)<input data-lk="base" value="${esc(L.base ?? 700)}" inputmode="numeric" title="Monitors, charging, DIT, fans"></label><label>Hours<input data-lk="hours" value="${esc(L.hours || 12)}" inputmode="numeric"></label></div>
        ${pw.length ? `<p class="fhint">Location says: ${pw.map(esc).join(' · ')}</p>` : ''}
        <table class="ftable dk-mini"><thead><tr><th>Scene</th><th class="n">Lights</th></tr></thead><tbody>${ld.per.map(x => `<tr><td>${esc(x.s.num)} ${esc(F.sceneLabel(x.s))}</td><td class="n">${x.w ? (x.w / 1000).toFixed(2) + ' kW' : '—'}</td></tr>`).join('') || '<tr><td colspan="2">No scenes on this day</td></tr>'}</tbody></table>
        ${Object.keys(ld.gear).length ? `<h4>Lights to load for the day</h4><ul class="dk-gear">${Object.entries(ld.gear).map(([k, v]) => `<li><b>${v}×</b> ${esc(k)}</li>`).join('')}</ul>` : ''}</section>`;
    }
    el.innerHTML = `<header class="dk-top"><div><h2>Lighting and power</h2><p>Plan the lights for each scene. Itàn adds up the power for each shoot day and sizes the generator.</p></div></header>
      ${scenes.length ? `<div class="dk-two"><section class="fsec"><div class="dk-h"><h3>Scene lighting</h3><select data-lscene aria-label="Scene">${scenes.map(x => `<option value="${esc(x.id)}"${x.id === ui.scene ? ' selected' : ''}>${esc(x.num)}. ${esc(F.sceneLabel(x))}</option>`).join('')}</select></div>
        ${s && s.summary ? `<p class="fhint">${esc(s.summary)}</p>` : ''}
        <div class="dk-inline"><label>Mood<select data-ls="mood"><option value="">Choose…</option>${MOODS.map(m => `<option${my.mood === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
          <label>Colour temperature<select data-ls="ct"><option value="">Choose…</option>${['3200 K (tungsten)', '4300 K', '5600 K (daylight)', 'Mixed'].map(m => `<option${my.ct === m ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
          <label>Key light comes from<input data-ls="key" value="${esc(my.key || '')}" placeholder="Window, camera left"></label></div>
        <table class="ftable dk-fx"><thead><tr><th>Light</th><th>Qty</th><th>Watts</th><th>Job</th><th>Gel and diffusion</th><th></th></tr></thead><tbody>${fixRows || '<tr><td colspan="6" class="empty-row">No lights yet</td></tr>'}</tbody></table>
        <datalist id="dkFix">${FIX.map(([n]) => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="row"><button class="add" data-fxadd>+ Light</button><span class="fhint">${sceneW ? `${(sceneW / 1000).toFixed(2)} kW for this scene` : ''}</span></div>
        <label class="dk-lab">Notes for the sparks<textarea data-ls="notes" rows="3" placeholder="Rigging, flags, practicals to swap, what to pre-light">${esc(my.notes || '')}</textarea></label>
        <div class="dk-plan">${my.plan ? `<img data-media="${esc(my.plan)}" alt="Lighting plan">` : ''}<button class="ib" data-lplan>${my.plan ? 'Edit the lighting plan' : 'Draw a lighting plan (top view)'}</button></div></section>
        ${power}</div>` : '<div class="empty-row big">Bring in the script on the Breakdown tab to plan lighting scene by scene.</div>'}`;
    F.mediaImgs(el);
    const setS = fn => F.change(dd => { const LL = F.deskW(dd, 'light', () => ({ scenes: {} })); LL.scenes = LL.scenes || {}; const x = LL.scenes[ui.scene] = LL.scenes[ui.scene] || { fixtures: [] }; x.fixtures = x.fixtures || []; fn(x, LL); });
    el.onchange = e => { const t = e.target;
      if (t.dataset.lscene !== undefined) { ui.scene = t.value; return F.refresh(); }
      if (t.dataset.lday !== undefined) { ui.day = t.value; return F.refresh(); }
      if (t.dataset.ls) return setS(x => { x[t.dataset.ls] = t.value; });
      if (t.dataset.lk) return F.change(dd => { F.deskW(dd, 'light', () => ({ scenes: {} }))[t.dataset.lk] = t.value; });
      const r = t.closest('[data-fx]'); if (r && t.dataset.fk) setS(x => { const f = x.fixtures.find(y => y.id === r.dataset.fx); f[t.dataset.fk] = t.value; if (t.dataset.fk === 'name') { const k = FIX.find(([n]) => n === t.value); if (k) f.w = k[1]; } });
    };
    el.onclick = async e => { const t = e.target;
      if (t.closest('[data-fxadd]')) return setS(x => x.fixtures.push({ id: F.uid(), name: '', qty: 1, w: '' }));
      const del = t.closest('[data-fxdel]'); if (del) { const id = del.closest('[data-fx]').dataset.fx; return setS(x => { x.fixtures = x.fixtures.filter(y => y.id !== id); }); }
      if (t.closest('[data-lplan]') && F.sketch) { const bg = my.plan ? await N.Store.getMedia(my.plan).catch(() => null) : null; const blob = await F.sketch(bg, { text: s ? `Lighting plan, scene ${s.num}: draw the room from above, then the camera and each light` : '' }); if (blob) { const id = await N.Store.putMedia(blob); setS(x => { x.plan = id; }); } }
    };
  } });

  /* ================= CONTINUITY (script supervisor, wardrobe, hair and makeup) ================= */
  F.desks.push({ id: 'cont', group: 'Direction', label: 'Continuity', who: 'Script supervisor', icon: '🧷',
    status(d) { const looks = F.desk(d, 'cont', {}).looks || {}, pairs = d.scenes.flatMap(s => (s.cast || []).map(id => s.id + ':' + id)), n = pairs.filter(k => looks[k] && Object.keys(looks[k]).some(f => looks[k][f] && (f !== 'photos' || looks[k][f].length))).length; return { ready: pairs.length ? n / pairs.length : null, note: `${n} of ${pairs.length} looks recorded` }; }, render(el, d) {
    const C = F.desk(d, 'cont', {}), looks = C.looks || {}, sd = C.storyDay || {};
    const ui = this.ui = this.ui || { scene: null };
    const scenes = F.sortScenes(d); if (!ui.scene || !scenes.find(s => s.id === ui.scene)) ui.scene = scenes[0] && scenes[0].id;
    if (!scenes.length) { el.innerHTML = `<header class="dk-top"><div><h2>Continuity</h2></div></header><div class="empty-row big">Bring in the script on the Breakdown tab first. Continuity follows each character from scene to scene in story order.</div>`; return; }
    const s = scenes.find(x => x.id === ui.scene), i = scenes.indexOf(s), cast = F.castOf(d, s);
    const shotDate = sc => { const ds = F.daysOfScene(d, sc).map(x => x.date).filter(Boolean).sort(); return ds[0] || ''; };
    const myDate = shotDate(s);
    const card = p => {
      const k = s.id + ':' + p.id, L = looks[k] || {};
      const prev = scenes.slice(0, i).reverse().find(x => (x.cast || []).includes(p.id)), PL = prev ? looks[prev.id + ':' + p.id] || {} : null, pDate = prev ? shotDate(prev) : '';
      const order = prev && myDate && pDate && pDate > myDate ? `<span class="dk-flag warn">Scene ${esc(prev.num)} is shot later (${esc(pDate)}). Agree this look now and match it then.</span>` : prev && myDate && !pDate ? `<span class="dk-flag">Scene ${esc(prev.num)} isn’t scheduled yet</span>` : '';
      const pv = prev ? `<div class="dk-prev"><small>Before this, in scene ${esc(prev.num)}${sd[prev.id] ? ' (' + esc(sd[prev.id]) + ')' : ''}</small>${(PL.photos || []).slice(0, 3).map(m => `<img data-media="${esc(m)}" alt="">`).join('')}<p>${esc([PL.ward, PL.hair, PL.props, PL.state].filter(Boolean).join(' · ') || 'Nothing written yet')}</p>${sd[prev.id] && sd[s.id] && sd[prev.id] === sd[s.id] ? '<span class="dk-flag good">Same story day: should match unless the script changes it</span>' : ''}</div>` : '<div class="dk-prev"><small>First time we see this character</small></div>';
      return `<article class="dk-look" data-look="${esc(k)}"><header><b>${esc(p.role || p.name || 'Cast')}</b>${p.name && p.role ? `<small>${esc(p.name)}</small>` : ''}</header>${pv}${order}
        <div class="dk-photos">${(L.photos || []).map((m, j) => `<figure><img data-media="${esc(m)}" alt=""><button class="ib xs" data-lphdel="${j}" aria-label="Remove photo">✕</button></figure>`).join('')}<button class="dk-addph" data-lph>+ Photos</button></div>
        <div class="dk-grid2">${[['ward', 'Wardrobe', 'Blue agbada, cap tilted left'], ['hair', 'Hair and makeup', 'Sweat on forehead, lipstick faded'], ['props', 'In hand or on them', 'Phone in right hand, bag on left shoulder'], ['state', 'State', 'Wet, cut on left cheek, tired']].map(([f, l, ph]) => `<label>${l}<input data-lf="${f}" value="${esc(L[f] || '')}" placeholder="${esc(ph)}"></label>`).join('')}</div>
        ${prev && PL && Object.keys(PL).some(x => x !== 'photos' && PL[x]) && !['ward', 'hair', 'props', 'state'].some(x => L[x]) ? `<button class="linkish" data-lcopy="${esc(prev.id)}">Same as scene ${esc(prev.num)}</button>` : ''}</article>`;
    };
    const tags = ['wardrobe', 'makeup', 'props'].flatMap(k => (s.tags && s.tags[k]) || []);
    el.innerHTML = `<header class="dk-top"><div><h2>Continuity</h2><p>How each character looks in every scene, with the scene before it in the story beside it, even when you shoot out of order.</p></div><div class="cs-act"><button class="ib" data-cbook>Continuity book (PDF)</button></div></header>
      <div class="dk-scenes" role="tablist">${scenes.map(x => `<button data-cscene="${esc(x.id)}" class="${x.id === ui.scene ? 'on' : ''}${(x.cast || []).some(id => looks[x.id + ':' + id]) ? ' done' : ''}">${esc(x.num)}</button>`).join('')}</div>
      <section class="fsec"><div class="dk-h"><h3>${esc(s.num)}. ${esc(F.sceneLabel(s))}</h3><label class="dk-sd">Story day<input data-sd value="${esc(sd[s.id] || '')}" placeholder="D1, N2…"></label></div>
        <p class="fhint">${esc(s.summary || '')}${myDate ? ` · Shooting ${esc(new Date(myDate + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' }))}` : ' · Not scheduled'}${tags.length ? ` · Script mentions: ${tags.map(esc).join(', ')}` : ''}</p>
        <div class="dk-looks">${cast.map(card).join('') || '<div class="empty-row">No cast in this scene. Add them on the Breakdown tab.</div>'}</div>
        <label class="dk-lab">Scene notes<textarea data-cnote rows="2" placeholder="Glass half full, clock says 4:10, window open">${esc((C.notes || {})[s.id] || '')}</textarea></label></section>`;
    F.mediaImgs(el);
    const setL = (k, fn) => F.change(dd => { const CC = F.deskW(dd, 'cont', () => ({})); CC.looks = CC.looks || {}; const x = CC.looks[k] = CC.looks[k] || {}; fn(x); });
    el.onclick = async e => { const t = e.target;
      const b = t.closest('[data-cscene]'); if (b) { ui.scene = b.dataset.cscene; return F.refresh(); }
      const lk = t.closest('[data-look]'); const k = lk && lk.dataset.look;
      if (t.closest('[data-lph]')) { const ids = await F.pickImages(); if (ids.length) setL(k, x => { x.photos = [...(x.photos || []), ...ids]; }); return; }
      const pd = t.closest('[data-lphdel]'); if (pd) return setL(k, x => { x.photos.splice(+pd.dataset.lphdel, 1); });
      const cp = t.closest('[data-lcopy]'); if (cp) { const src = looks[cp.dataset.lcopy + ':' + k.split(':')[1]] || {}; return setL(k, x => { ['ward', 'hair', 'props', 'state'].forEach(f => { x[f] = src[f] || ''; }); }); }
      if (t.closest('[data-cbook]')) return book(d);
    };
    el.onchange = e => { const t = e.target;
      if (t.dataset.lf) { const k = t.closest('[data-look]').dataset.look; return setL(k, x => { x[t.dataset.lf] = t.value.trim(); }); }
      if (t.dataset.sd !== undefined) return F.change(dd => { const CC = F.deskW(dd, 'cont', () => ({})); CC.storyDay = CC.storyDay || {}; CC.storyDay[ui.scene] = t.value.trim().toUpperCase(); });
      if (t.dataset.cnote !== undefined) return F.change(dd => { const CC = F.deskW(dd, 'cont', () => ({})); CC.notes = CC.notes || {}; CC.notes[ui.scene] = t.value; }, true);
    };
  } });
  // a printable book: each character, every scene in story order
  async function book(d) {
    const C = F.desk(d, 'cont', {}), looks = C.looks || {}, sd = C.storyDay || {}, scenes = F.sortScenes(d);
    const host = document.createElement('div'); host.className = 'sheet dk-book'; host.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px';
    host.innerHTML = `<h1>${esc(d.title)}: continuity</h1>` + d.people.filter(p => p.kind === 'cast').map(p => { const rows = scenes.filter(s => (s.cast || []).includes(p.id)); if (!rows.length) return '';
      return `<h2>${esc(p.role || '')}${p.name ? ' · ' + esc(p.name) : ''}</h2><table class="ftable"><thead><tr><th>Scene</th><th>Look</th><th>Photos</th></tr></thead><tbody>${rows.map(s => { const L = looks[s.id + ':' + p.id] || {};
        return `<tr><td><b>${esc(s.num)}</b>${sd[s.id] ? ' · ' + esc(sd[s.id]) : ''}<br><small>${esc(F.sceneLabel(s))}</small></td><td>${[['Wardrobe', L.ward], ['Hair and makeup', L.hair], ['Props', L.props], ['State', L.state]].filter(x => x[1]).map(([a, b]) => `<b>${a}:</b> ${esc(b)}`).join('<br>') || '—'}</td><td>${(L.photos || []).slice(0, 3).map(m => `<img data-media="${esc(m)}" alt="" style="width:110px;height:74px;object-fit:cover;border-radius:4px;margin:2px">`).join('')}</td></tr>`; }).join('')}</tbody></table>`; }).join('');
    document.body.append(host);
    await Promise.all([...host.querySelectorAll('img[data-media]')].map(async im => { const b = await N.Store.getMedia(im.dataset.media).catch(() => null); if (b) im.src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); else im.remove(); }));
    try { await N.saveNode(host, `${d.title} continuity`, 'pdf', { position: 'static', left: '0', top: '0' }); } finally { host.remove(); }
  }

  /* ================= PROPS (props master, art department) ================= */
  const PSTAT = [['need', 'Needed'], ['src', 'Sourcing'], ['ready', 'Ready'], ['set', 'On set'], ['back', 'Returned'], ['lost', 'Lost or broken']];
  const PSRC = ['Have it', 'Buy', 'Rent', 'Borrow', 'Make'];
  const key = s => String(s || '').trim().toLowerCase();
  F.propScenes = (d, name) => d.scenes.filter(s => ((s.tags && s.tags.props) || []).some(w => key(w) === key(name)));
  F.propScenesOf = (d, x) => d.scenes.filter(s => (x.scenes || []).includes(s.id) || ((s.tags && s.tags.props) || []).some(w => key(w) === key(x.name)));
  F.desks.push({ id: 'props', group: 'Art and look', label: 'Props', who: 'Props master', icon: '🎒',
    status(d) { const it = F.desk(d, 'props', {}).items || []; return { ready: it.length ? it.filter(x => ['ready', 'set', 'back'].includes(x.status)).length / it.length : null, note: `${it.filter(x => ['ready', 'set', 'back'].includes(x.status)).length} of ${it.length} props ready` }; },
    alerts(d) { const it = F.desk(d, 'props', {}).items || [], soon = F.nextDays(d, 3).flatMap(x => F.dayScenes(d, x)), late = it.filter(x => ['need', 'src'].includes(x.status || 'need') && F.propScenesOf(d, x).some(s => soon.includes(s))), od = it.filter(x => x.ret && x.ret < N.todayStr(0) && !['back', 'lost'].includes(x.status) && ['Rent', 'Borrow'].includes(x.src));
      return [...(late.length ? [{ lvl: 'bad', text: `Props not ready for the next 3 days: ${late.map(x => x.name).join(', ')}` }] : []), ...(od.length ? [{ lvl: 'warn', text: `Props past their return date: ${od.map(x => x.name).join(', ')}` }] : [])]; }, render(el, d) {
    const P = F.desk(d, 'props', {}), items = P.items || [], cur = (d.budget && d.budget.cur) || '₦';
    const ui = this.ui = this.ui || { day: '*' };
    const fromScript = [...new Map(d.scenes.flatMap(s => (s.tags && s.tags.props) || []).map(w => [key(w), w])).values()].filter(w => !items.some(x => key(x.name) === key(w)));
    const day = d.days.find(x => x.id === ui.day), dayScenes = day ? F.dayScenes(d, day) : null;
    const shown = items.filter(x => !dayScenes || F.propScenes(d, x.name).some(s => dayScenes.includes(s)) || (x.scenes || []).some(id => dayScenes.some(s => s.id === id)));
    const soon = F.nextDays(d, 3).flatMap(x => F.dayScenes(d, x)), late = items.filter(x => ['need', 'src'].includes(x.status || 'need') && F.propScenesOf(d, x).some(s => soon.includes(s)));
    const overdue = items.filter(x => x.ret && x.ret < N.todayStr(0) && !['back', 'have', 'lost'].includes(x.status) && x.src !== 'Have it' && x.src !== 'Buy' && x.src !== 'Make');
    const total = items.reduce((n, x) => n + num(x.cost), 0);
    const row = x => { const sc = F.propScenesOf(d, x); return `<tr data-pr="${esc(x.id)}" class="st-${x.status || 'need'}">
      <td>${x.photo ? `<img data-media="${esc(x.photo)}" alt="" class="dk-thumb" data-prph>` : `<button class="dk-thumb ph" data-prph aria-label="Add a photo">+</button>`}</td>
      <td><input data-pk="name" value="${esc(x.name)}"><small>${sc.length ? 'Scenes ' + sc.map(s => esc(s.num)).join(', ') : 'Not in the script'}${x.hero ? ' · hero' : ''}</small></td>
      <td><select data-pk="status">${PSTAT.map(([k, l]) => `<option value="${k}"${(x.status || 'need') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><select data-pk="src"><option value=""></option>${PSRC.map(k => `<option${x.src === k ? ' selected' : ''}>${k}</option>`).join('')}</select></td>
      <td class="num"><input data-pk="cost" value="${esc(x.cost || '')}" inputmode="decimal" placeholder="${esc(cur)}"></td><td class="num"><input data-pk="qty" value="${esc(x.qty || '')}" inputmode="numeric" placeholder="1" title="How many, including spares"></td>
      <td><input data-pk="who" value="${esc(x.who || '')}" placeholder="Who"></td><td><input data-pk="ret" type="date" value="${esc(x.ret || '')}" title="Return by"></td><td class="act"><button class="ib xs" data-prdel aria-label="Remove">✕</button></td></tr>`; };
    el.innerHTML = `<header class="dk-top"><div><h2>Props</h2><p>Every prop the script needs, where it’s coming from, and what has to be on the truck each day.</p></div><div class="cs-act">${d.budget ? `<button class="ib" data-prbud>${P.budgeted ? 'Update' : 'Send'} costs to the budget</button>` : ''}<button class="ib" data-prsave>Pull list (PDF)</button></div></header>
      ${late.length || overdue.length ? `<div class="dk-alerts">${late.length ? `<div class="wx-al bad"><b>Not ready for the next 3 days: ${late.map(x => esc(x.name)).join(', ')}</b></div>` : ''}${overdue.length ? `<div class="wx-al warn"><b>Past the return date: ${overdue.map(x => esc(x.name)).join(', ')}</b><span>Late returns can cost extra days of rent.</span></div>` : ''}</div>` : ''}
      <div class="rp-bar"><div class="seg"><button data-prday="*" class="${ui.day === '*' ? 'on' : ''}">All props</button>${d.days.map((x, j) => `<button data-prday="${esc(x.id)}" class="${x.id === ui.day ? 'on' : ''}">Day ${j + 1}</button>`).join('')}</div>
        <span class="fhint">${items.length} props · ${items.filter(x => ['ready', 'set', 'back'].includes(x.status)).length} ready · ${esc(cur)}${total.toLocaleString()}</span></div>
      <section class="fsec" id="prSheet">${day ? `<h3>Pull list: ${esc(F.dayLabel(d, day))}</h3>` : ''}<div class="dk-scroll"><table class="ftable dk-props"><thead><tr><th></th><th>Prop</th><th>Status</th><th>Source</th><th>Cost</th><th>Qty</th><th>Who</th><th>Return by</th><th></th></tr></thead>
        <tbody>${shown.map(row).join('') || `<tr><td colspan="9" class="empty-row">${day ? 'No props for this day’s scenes' : 'No props yet'}</td></tr>`}</tbody></table></div>
        <div class="row"><button class="add" data-pradd>+ Prop</button>${fromScript.length ? `<button class="add" data-prscript>+ ${fromScript.length} from the script (${fromScript.slice(0, 4).map(esc).join(', ')}${fromScript.length > 4 ? '…' : ''})</button>` : ''}</div></section>`;
    F.mediaImgs(el);
    const set = (id, fn) => F.change(dd => { const PP = F.deskW(dd, 'props', () => ({ items: [] })); const x = PP.items.find(y => y.id === id); if (x) fn(x); });
    el.onclick = async e => { const t = e.target;
      const dy = t.closest('[data-prday]'); if (dy) { ui.day = dy.dataset.prday; return F.refresh(); }
      if (t.closest('[data-pradd]')) { const n = await F.ask('New prop', 'For example: old Nokia phone'); if (n) F.change(dd => F.deskW(dd, 'props', () => ({ items: [] })).items.push({ id: F.uid(), name: n, status: 'need' })); return; }
      if (t.closest('[data-prscript]')) return F.change(dd => { const PP = F.deskW(dd, 'props', () => ({ items: [] })); PP.items = PP.items || []; fromScript.forEach(w => PP.items.push({ id: F.uid(), name: w.charAt(0).toUpperCase() + w.slice(1), status: 'need' })); });
      const r = t.closest('[data-pr]');
      if (r && t.closest('[data-prdel]')) { if (await N.confirmBox('Remove this prop?', 'Remove')) F.change(dd => { const PP = F.deskW(dd, 'props', () => ({ items: [] })); PP.items = PP.items.filter(x => x.id !== r.dataset.pr); }); return; }
      if (r && t.closest('[data-prph]')) { const [id] = await F.pickImages(false); if (id) set(r.dataset.pr, x => { x.photo = id; }); return; }
      if (t.closest('[data-prsave]')) return N.saveNode(el.querySelector('#prSheet'), `${d.title} props${day ? ' day ' + (d.days.indexOf(day) + 1) : ''}`, 'pdf');
      if (t.closest('[data-prbud]')) return F.change(dd => { const b = dd.budget; let dp = b.depts.find(y => /prop|art/i.test(y.name)); if (!dp) { dp = { id: F.uid(), name: 'Props and art', items: [] }; b.depts.push(dp); }
        const PP = F.deskW(dd, 'props', () => ({ items: [] })); PP.items.filter(x => num(x.cost)).forEach(x => { const desc = `Prop: ${x.name}${x.src ? ' (' + x.src.toLowerCase() + ')' : ''}`; let it = dp.items.find(y => y.prop === x.id); if (!it) { it = { id: F.uid(), prop: x.id }; dp.items.push(it); } it.desc = desc; it.qty = 1; it.rate = num(x.cost); it.plan = num(x.cost); });
        PP.budgeted = true; N.toast('Prop costs are in the budget'); });
    };
    el.onchange = e => { const t = e.target, r = t.closest('[data-pr]'); if (r && t.dataset.pk) set(r.dataset.pr, x => { x[t.dataset.pk] = t.type === 'date' ? t.value : t.value.trim(); }); };
  } });
})();
