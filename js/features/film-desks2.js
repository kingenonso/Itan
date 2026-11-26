/* Department desks, part two: Sound, Colour, Producer and BTS. (The frame and the first desks are in film-desks.js.) */
(function () {
  const N = window.N, F = N.film, esc = N.esc, num = F.num;
  const isExt = s => /EXT/i.test(s.ie || ''), isNight = s => /NIGHT|EVENING|DUSK/i.test(s.dn || '');
  const check = (done, k, label, sub) => `<li class="${done[k] ? 'done' : ''}"><label><input type="checkbox" data-ck="${esc(k)}"${done[k] ? ' checked' : ''}><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></label></li>`;
  const dayPick = (d, ui, attr) => `<select ${attr} aria-label="Shoot day">${d.days.map(x => `<option value="${esc(x.id)}"${x.id === ui.day ? ' selected' : ''}>${esc(F.dayLabel(d, x))}</option>`).join('')}</select>`;
  const firstDay = d => (F.nextDays(d, 60)[0] || d.days[0] || {}).id;

  /* ================= SOUND (sound recordist, boom op) ================= */
  const MICS = ['Boom', 'Lav 1', 'Lav 2', 'Lav 3', 'Lav 4', 'Lav 5', 'Lav 6', 'Plant mic', 'ADR later'];
  F.desks.push({ id: 'sound', group: 'Sound', label: 'Sound', who: 'Sound recordist, boom op', icon: '🎙',
    status(d) { const m = F.desk(d, 'sound', {}).mics || {}, cast = d.people.filter(p => p.kind === 'cast' && d.scenes.some(s => (s.cast || []).includes(p.id))); return { ready: cast.length ? cast.filter(p => m[p.id]).length / cast.length : null, note: `${cast.filter(p => m[p.id]).length} of ${cast.length} cast on the mic plan` }; }, render(el, d) {
    const So = F.desk(d, 'sound', {}), mics = So.mics || {}, ui = this.ui = this.ui || {};
    if (!ui.day || !d.days.find(x => x.id === ui.day)) ui.day = firstDay(d);
    const day = d.days.find(x => x.id === ui.day), cast = d.people.filter(p => p.kind === 'cast' && d.scenes.some(s => (s.cast || []).includes(p.id)));
    const lavs = sc => (sc.cast || []).filter(id => /Lav/.test(mics[id] || '')).length;
    let dayHtml = '<div class="empty-row">Add shoot days on the Schedule tab.</div>';
    if (day) {
      const scenes = F.dayScenes(d, day), done = (So.done || {})[day.id] || {}, locs = [...new Set(scenes.map(s => s.loc).filter(Boolean))];
      const need = Math.max(0, ...scenes.map(lavs)), big = scenes.find(s => lavs(s) === need);
      const wild = (So.wild || []).filter(w => scenes.some(s => String(s.num) === String(w.scene)) || !w.scene);
      const L = F.locationsOfDay ? F.locationsOfDay(d, day) : [], risks = [];
      L.forEach(l => (l.notes || {}).noise && risks.push(`${esc(l.name)}: ${esc(l.notes.noise)}`));
      if (day.wx && F.weatherAlerts) F.weatherAlerts(d, day, day.wx).forEach(a => { const ext = scenes.some(isExt); if (/gust|Breezy/i.test(a.text)) risks.push(esc(a.text) + (ext ? ': furry windshield on the boom, wind covers on the lavs' : ': listen for wind at the windows and doors')); else if (/Rain|Thunder/i.test(a.text)) risks.push(esc(a.text) + (ext ? ': rain on the mics and umbrellas will be heard; pack rain covers' : ': rain on roofs and windows will be heard. Find the quietest room')); });
      if ((F.desk(d, 'light', {}).supply || 'gen') === 'gen' && F.lightLoad && F.lightLoad(d, day).peak > 1500) risks.push('Generator on set: park it far away and downwind, behind a wall or vehicle, with long cable');
      if (scenes.some(s => isExt(s) && !isNight(s))) risks.push('Daytime exteriors: traffic, generators, horns and planes. Record a clean wild track of each line if a take is noisy');
      dayHtml = `<div class="dk-inline"><span class="dk-pill"><b>${need}</b> lav${need === 1 ? '' : 's'} at once${big && need ? ` (scene ${esc(big.num)})` : ''}</span><span class="dk-pill"><b>${scenes.length}</b> scenes</span><span class="dk-pill"><b>${locs.length}</b> place${locs.length === 1 ? '' : 's'}</span></div>
        ${risks.length ? `<h4>Noise to plan for</h4><ul class="dk-risk">${risks.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
        <h4>Before you leave each place</h4><ul class="dk-check">${locs.map(l => check(done, 'tone:' + l, `Room tone at ${esc(l)}`, '30 seconds, everyone still, same mic positions')).join('')}
          ${scenes.filter(s => (s.tags && (s.tags.vehicles || []).length) || (s.tags && (s.tags.effects || []).length)).map(s => check(done, 'fx:' + s.id, `Sound effects for scene ${esc(s.num)}`, esc([...(s.tags.vehicles || []), ...(s.tags.effects || [])].join(', ')))).join('')}
          ${wild.map(w => check(done, 'wild:' + w.id, `Wild line${w.scene ? ', scene ' + esc(w.scene) : ''}: ${esc(w.text)}`, '')).join('')}</ul>
        <div class="row"><button class="add" data-wildadd>+ Wild line to record</button><button class="add" data-ftab="takes">Open the sound report</button></div>`;
    }
    el.innerHTML = `<header class="dk-top"><div><h2>Sound</h2><p>Who wears which mic, how many lavs each day needs, the noise to expect, and the room tone and wild lines to grab before you move.</p></div></header>
      <div class="dk-two"><section class="fsec"><h3>Mic plan</h3>${cast.length ? `<table class="ftable"><thead><tr><th>Character</th><th>Mic</th><th class="n">Scenes</th></tr></thead><tbody>${cast.map(p => `<tr><td>${esc(p.role || p.name)}${p.name && p.role ? `<br><small>${esc(p.name)}</small>` : ''}</td><td><select data-mic="${esc(p.id)}"><option value="">—</option>${MICS.map(m => `<option${mics[p.id] === m ? ' selected' : ''}>${m}</option>`).join('')}</select></td><td class="n">${d.scenes.filter(s => (s.cast || []).includes(p.id)).length}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-row">Cast appear here once they’re in scenes on the Breakdown tab.</div>'}
        <label class="dk-lab">Kit and track notes<textarea data-snote rows="3" placeholder="Recorder, track names (1 Boom, 2 Lav Ada…), sample rate 48 kHz / 24 bit, timecode">${esc(So.notes || '')}</textarea></label></section>
        <section class="fsec"><div class="dk-h"><h3>Shoot day</h3>${d.days.length ? dayPick(d, ui, 'data-sday') : ''}</div>${dayHtml}</section></div>`;
    el.onchange = e => { const t = e.target;
      if (t.dataset.sday !== undefined) { ui.day = t.value; return F.refresh(); }
      if (t.dataset.mic) return F.change(dd => { const S = F.deskW(dd, 'sound', () => ({})); S.mics = S.mics || {}; S.mics[t.dataset.mic] = t.value; });
      if (t.dataset.snote !== undefined) return F.change(dd => { F.deskW(dd, 'sound', () => ({})).notes = t.value; }, true);
      if (t.dataset.ck) return F.change(dd => { const S = F.deskW(dd, 'sound', () => ({})); S.done = S.done || {}; const x = S.done[ui.day] = S.done[ui.day] || {}; x[t.dataset.ck] = t.checked; });
    };
    el.onclick = async e => {
      if (e.target.closest('[data-wildadd]')) { const txt = await F.ask('Wild line to record', 'The line, e.g. “Mama, the bus has left!”'); if (!txt) return; const sc = await F.ask('Which scene? (optional)', 'Scene number'); F.change(dd => { const S = F.deskW(dd, 'sound', () => ({})); (S.wild = S.wild || []).push({ id: F.uid(), text: txt, scene: sc || '' }); }); }
    };
  } });

  /* ================= COLOUR (colorist, DP, DIT) ================= */
  const PROFILES = ['Rec.709 (baked in)', 'Sony S-Log3', 'Sony S-Log2', 'Canon C-Log2', 'Canon C-Log3', 'Blackmagic Film Gen 5', 'Panasonic V-Log', 'Fujifilm F-Log', 'Nikon N-Log', 'ARRI LogC3', 'ARRI LogC4', 'RED Log3G10', 'Apple Log', 'DJI D-Log'];
  const DELIV = [['dcp', 'Cinema (DCP, P3)'], ['fest', 'Festival screener (ProRes 422 HQ)'], ['yt', 'YouTube (Rec.709, 4K)'], ['ig', 'Instagram / TikTok (9:16 and 4:5)'], ['tv', 'TV broadcast (Rec.709, legal levels)'], ['stream', 'Streaming platform (check their spec)']];
  // the main colours of a picture (a quick k-means on a small copy)
  F.palette = async (blob, k = 5) => {
    const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = 64; c.height = Math.max(1, Math.round(64 * bmp.height / bmp.width));
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height); const px = g.getImageData(0, 0, c.width, c.height).data, pts = [];
    for (let i = 0; i < px.length; i += 4) pts.push([px[i], px[i + 1], px[i + 2]]);
    let cen = Array.from({ length: k }, (_, i) => pts[Math.floor((i + .5) * pts.length / k)].slice()), lab = new Array(pts.length).fill(0);
    for (let it = 0; it < 10; it++) {
      pts.forEach((p, i) => { let b = 0, bd = 1e9; cen.forEach((c2, j) => { const dd = (p[0] - c2[0]) ** 2 + (p[1] - c2[1]) ** 2 + (p[2] - c2[2]) ** 2; if (dd < bd) { bd = dd; b = j; } }); lab[i] = b; });
      cen = cen.map((c2, j) => { const m = pts.filter((_, i) => lab[i] === j); return m.length ? [0, 1, 2].map(x => m.reduce((n, p) => n + p[x], 0) / m.length) : c2; });
    }
    const cnt = cen.map((_, j) => lab.filter(x => x === j).length);
    return cen.map((c2, j) => ({ c: '#' + c2.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), n: cnt[j] })).sort((a, b) => b.n - a.n).map(x => x.c);
  };
  F.desks.push({ id: 'colour', group: 'Post', label: 'Colour', who: 'Colorist, DP', icon: '🎨',
    status(d) { const C = F.desk(d, 'colour', {}), n = new Set((C.looks || []).flatMap(x => x.scenes || [])).size; return { ready: d.scenes.length ? n / d.scenes.length : null, note: `${(C.looks || []).length} looks covering ${n} of ${d.scenes.length} scenes` }; }, render(el, d) {
    const Co = F.desk(d, 'colour', {}), looks = Co.looks || [], spec = Co.spec || {}, ui = this.ui = this.ui || {};
    if (!ui.look || !looks.find(x => x.id === ui.look)) ui.look = looks[0] && looks[0].id;
    const L = looks.find(x => x.id === ui.look), scenes = F.sortScenes(d), used = id => looks.find(x => x.id !== ui.look && (x.scenes || []).includes(id));
    el.innerHTML = `<header class="dk-top"><div><h2>Colour</h2><p>The film’s looks, with reference frames, their colours, and how it was shot, so the grade starts where the DP meant it to.</p></div><div class="cs-act"><button class="ib" data-cobook>Look book (PDF)</button></div></header>
      <div class="dk-two"><section class="fsec" id="coBook"><div class="dk-h"><div class="seg">${looks.map(x => `<button data-look="${esc(x.id)}" class="${x.id === ui.look ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div><button class="add" data-coadd>+ Look</button></div>
        ${L ? `<input class="loc-name" data-co="name" value="${esc(L.name)}" aria-label="Look name">
          <div class="dk-refs">${(L.refs || []).map((m, j) => `<figure><img data-media="${esc(m)}" alt=""><button class="ib xs" data-corefdel="${j}" aria-label="Remove">✕</button></figure>`).join('')}<button class="dk-addph" data-coref>+ Reference frames</button></div>
          ${(L.palette || []).length ? `<div class="dk-pal" aria-label="Main colours">${L.palette.map(c => `<button style="--c:${esc(c)}" data-hex="${esc(c)}" title="Copy ${esc(c)}"><span>${esc(c)}</span></button>`).join('')}</div>` : ''}
          <div class="dk-grid2"><label>Contrast<input data-co="contrast" value="${esc(L.contrast || '')}" placeholder="Soft, lifted blacks"></label><label>Saturation<input data-co="sat" value="${esc(L.sat || '')}" placeholder="Muted, except reds"></label>
            <label>Skin<input data-co="skin" value="${esc(L.skin || '')}" placeholder="Warm and rich, never grey"></label><label>LUT or film emulation<input data-co="lut" value="${esc(L.lut || '')}" placeholder="Kodak 2383, custom LUT name"></label></div>
          <h4>Scenes with this look</h4><div class="loc-places">${scenes.map(s => `<label><input type="checkbox" data-cosc="${esc(s.id)}"${(L.scenes || []).includes(s.id) ? ' checked' : ''}${used(s.id) ? ' disabled title="In another look"' : ''}>${esc(s.num)} ${esc(s.loc || '')}</label>`).join('') || '<span class="fhint">Scenes appear once the script is broken down.</span>'}</div>
          <label class="dk-lab">Notes for the colorist<textarea data-co="notes" rows="3" placeholder="What this part of the film should feel like">${esc(L.notes || '')}</textarea></label>
          <div class="row"><button class="ib xs" data-codel>Remove look</button></div>` : '<div class="empty-row big">Add a look for each part of the film: “Lagos day”, “Flashback”, “Night chase”. Drop in reference frames and Itàn pulls out their colours.</div>'}</section>
        <section class="fsec"><h3>How it’s shot and delivered</h3>
          <div class="dk-grid2"><label>Camera profile<select data-cs="profile"><option value="">Choose…</option>${PROFILES.map(p => `<option${spec.profile === p ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
            <label>White balance<input data-cs="wb" value="${esc(spec.wb || '')}" placeholder="5600 K, locked"></label><label>Base ISO<input data-cs="iso" value="${esc(spec.iso || '')}" placeholder="800 / 12800"></label>
            <label>Frame rate<input value="${esc(d.fps || 24)} fps" readonly title="Set on the Camera tab"></label>
            <label>Grade in<select data-cs="space"><option value="">Choose…</option>${['DaVinci Wide Gamut / Intermediate', 'ACES (ACEScct)', 'Rec.709 (display referred)'].map(p => `<option${spec.space === p ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
            <label>Monitor LUT on set<input data-cs="setlut" value="${esc(spec.setlut || '')}" placeholder="The LUT the DP and director watched"></label></div>
          <h4>Deliverables</h4><ul class="dk-check">${DELIV.map(([k, l]) => `<li class="${(spec.deliv || []).includes(k) ? 'done' : ''}"><label><input type="checkbox" data-deliv="${k}"${(spec.deliv || []).includes(k) ? ' checked' : ''}><span><b>${l}</b></span></label></li>`).join('')}</ul>
          <p class="fhint">Shooting in log? Expose for the skin, keep the same profile on every camera, and send the colorist the set LUT with the footage.</p></section></div>`;
    F.mediaImgs(el);
    const setL = fn => F.change(dd => { const C = F.deskW(dd, 'colour', () => ({ looks: [] })); const x = (C.looks || []).find(y => y.id === ui.look); if (x) fn(x); });
    el.onclick = async e => { const t = e.target;
      const lb = t.closest('[data-look]'); if (lb) { ui.look = lb.dataset.look; return F.refresh(); }
      if (t.closest('[data-coadd]')) { const n = await F.ask('New look', 'For example: Lagos day'); if (n) { const id = F.uid(); ui.look = id; F.change(dd => { const C = F.deskW(dd, 'colour', () => ({ looks: [] })); (C.looks = C.looks || []).push({ id, name: n, refs: [], scenes: [] }); }); } return; }
      if (t.closest('[data-coref]')) { const ids = await F.pickImages(); if (!ids.length) return; N.status('Finding the colours…'); const refs = [...(L.refs || []), ...ids]; let pal = [];
        try { const blobs = await Promise.all(refs.slice(-6).map(m => N.Store.getMedia(m))); const all = (await Promise.all(blobs.filter(Boolean).map(b => F.palette(b, 4)))).flat(); pal = [...new Set(all)].slice(0, 8); } catch (er) {}
        N.settled(); return setL(x => { x.refs = refs; x.palette = pal; }); }
      const rd = t.closest('[data-corefdel]'); if (rd) return setL(x => { x.refs.splice(+rd.dataset.corefdel, 1); });
      const hx = t.closest('[data-hex]'); if (hx) { try { await navigator.clipboard.writeText(hx.dataset.hex); N.toast(`Copied ${hx.dataset.hex}`); } catch (er) {} return; }
      if (t.closest('[data-codel]')) { if (await N.confirmBox(`Remove the look “${L.name}”?`, 'Remove')) F.change(dd => { const C = F.deskW(dd, 'colour', () => ({ looks: [] })); C.looks = C.looks.filter(x => x.id !== L.id); }); return; }
      if (t.closest('[data-cobook]')) return N.saveNode(el.querySelector('.dk-two'), `${d.title} look book`, 'pdf');
    };
    el.onchange = e => { const t = e.target;
      if (t.dataset.co) return setL(x => { x[t.dataset.co] = t.value.trim(); });
      if (t.dataset.cosc) return setL(x => { x.scenes = (x.scenes || []).filter(id => id !== t.dataset.cosc); if (t.checked) x.scenes.push(t.dataset.cosc); });
      if (t.dataset.cs) return F.change(dd => { const C = F.deskW(dd, 'colour', () => ({ looks: [] })); C.spec = C.spec || {}; C.spec[t.dataset.cs] = t.value.trim(); });
      if (t.dataset.deliv) return F.change(dd => { const C = F.deskW(dd, 'colour', () => ({ looks: [] })); C.spec = C.spec || {}; C.spec.deliv = (C.spec.deliv || []).filter(k => k !== t.dataset.deliv); if (t.checked) C.spec.deliv.push(t.dataset.deliv); });
    };
  } });

  /* ================= PRODUCER (the whole film at a glance) ================= */
  const KEY_CREW = [['Director', /direct(or|ed)(?!.*(photo|assist|art))/i], ['Producer', /produc/i], ['Director of photography', /photograph|\bdop\b|\bdp\b|cinematograph/i], ['Gaffer', /gaffer|lighting/i], ['Sound recordist', /sound|boom|mixer/i], ['1st AD', /assistant director|\bad\b/i], ['Editor', /edit/i], ['Art or production design', /art|production design|props/i], ['Hair and makeup', /makeup|hmu|hair/i], ['Wardrobe', /wardrobe|costume|stylist/i]];
  F.producerRisks = d => {
    const today = N.todayStr(0), risks = [], add = (lvl, text, go, label) => risks.push({ lvl, text, go, label });
    const b = d.budget, bt = b && F.budgetTotals ? F.budgetTotals(b) : null, cur = (b && b.cur) || '₦', money = v => cur + ' ' + Math.round(v).toLocaleString();
    const wrapped = d.days.filter(x => (x.set && x.set.wrapped) || (x.date && x.date < today)), pages = ss => ss.reduce((n, s) => n + (s.pages || 0), 0);
    const allPages = pages(d.scenes), shotPages = pages(wrapped.flatMap(x => F.dayScenes(d, x))), sched = new Set(d.days.flatMap(x => x.sceneIds)), unsched = d.scenes.filter(s => !sched.has(s.id));
    const next = d.days.find(x => x.date && x.date >= today && !(x.set && x.set.wrapped));
    if (bt && bt.plan) { if (bt.act > bt.total) add('bad', `Spending is ${money(bt.act - bt.total)} over the budget, including contingency`, 'budget');
      else if (wrapped.length && d.days.length && bt.act / Math.max(1, wrapped.length) * d.days.length > bt.total) add('warn', `At this rate the shoot ends about ${money(bt.act / wrapped.length * d.days.length - bt.total)} over budget`, 'budget'); }
    else add('warn', 'No budget yet', 'budget');
    if (unsched.length) add('warn', `${unsched.length} scene${unsched.length > 1 ? 's' : ''} not on the schedule (${unsched.slice(0, 6).map(s => s.num).join(', ')}${unsched.length > 6 ? '…' : ''})`, 'schedule');
    d.days.filter(x => !x.date && x.sceneIds.length).length && add('warn', 'Some shoot days have no date', 'schedule');
    const cast = d.people.filter(p => p.kind === 'cast'), crew = d.people.filter(p => p.kind === 'crew');
    const uncast = cast.filter(p => !p.name && d.scenes.some(s => (s.cast || []).includes(p.id)));
    if (uncast.length) add('bad', `Not cast yet: ${uncast.slice(0, 5).map(p => p.role).join(', ')}${uncast.length > 5 ? '…' : ''}`, 'casting');
    const nophone = d.people.filter(p => p.name && !p.phone); if (nophone.length) add('info', `${nophone.length} ${nophone.length > 1 ? 'people have' : 'person has'} no phone number for the call sheet`, 'people');
    const missing = KEY_CREW.filter(([, re]) => !crew.some(p => re.test(p.role || ''))); if (missing.length) add(missing.length > 4 ? 'warn' : 'info', `No one yet for: ${missing.map(x => x[0]).join(', ')}`, 'people');
    (d.locations || []).forEach(l => { const used = d.days.some(x => F.locationsOfDay && F.locationsOfDay(d, x).includes(l));
      if (l.permit === 'Refused') add('bad', `${l.name}: permit refused`, 'locations');
      else if (used && (!l.permit || l.permit === 'Asked')) add('warn', `${l.name}: permit ${l.permit === 'Asked' ? 'still waiting' : 'not sorted'}`, 'locations');
      if (num(l.fee) && !l.budgeted && b) add('info', `${l.name}: fee not in the budget`, 'locations'); });
    F.deskAlerts(d).filter(a => a.desk !== 'prod' && a.desk !== 'director').forEach(a => add(a.lvl, `${a.label}: ${a.text}`, 'desk:' + a.desk));
    if (F.weatherAlerts) F.nextDays(d, 4).forEach(x => x.wx && F.weatherAlerts(d, x, x.wx).filter(a => a.lvl === 'bad').forEach(a => add('bad', `${F.dayLabel(d, x)}: ${a.text}`, 'weather')));
    const circled = (d.takes || []).filter(t => t.mark === 'good' || t.mark === 'circle').length;
    const order = { bad: 0, warn: 1, info: 2 }; risks.sort((a, b2) => order[a.lvl] - order[b2.lvl]);
    return { risks, bt, money, wrapped, allPages, shotPages, next, cast, crew, uncast, circled };
  };
  F.desks.push({ id: 'prod', group: 'Production', label: 'Producer', who: 'Producer, line producer, PM', icon: '📋', render(el, d) {
    const { risks, bt, money, wrapped, allPages, shotPages, next, cast, crew, uncast, circled } = F.producerRisks(d);
    const go = r => r.go.startsWith('desk:') ? `data-dkgo="${r.go.slice(5)}"` : `data-ftab="${r.go}"`;
    el.innerHTML = `<header class="dk-top"><div><h2>Producer</h2><p>The whole film at a glance, and the things that could stop the shoot, worst first.</p></div><div class="cs-act"><button class="ib" data-prsave>Save as PDF</button></div></header>
      <div id="pdSheet"><div class="dk-cards">
        <div class="dk-card"><small>Budget</small><b>${bt && bt.plan ? money(bt.total) : '—'}</b><span>${bt && bt.plan ? `${money(bt.act)} spent · ${Math.round(bt.act / bt.total * 100)}%` : 'Not set'}</span>${bt && bt.plan ? `<i class="dk-bar"><em style="width:${Math.min(100, bt.act / bt.total * 100)}%"></em></i>` : ''}</div>
        <div class="dk-card"><small>Shoot days</small><b>${wrapped.length} of ${d.days.length}</b><span>${next ? `Next: ${esc(F.dayLabel(d, next))}` : d.days.length ? 'No days ahead' : 'None scheduled'}</span><i class="dk-bar"><em style="width:${d.days.length ? wrapped.length / d.days.length * 100 : 0}%"></em></i></div>
        <div class="dk-card"><small>Pages shot</small><b>${F.eighths(shotPages)} of ${F.eighths(allPages)}</b><span>${d.days.length ? `${F.eighths(Math.round(allPages / d.days.length))} pages a day planned` : ''}</span><i class="dk-bar"><em style="width:${allPages ? shotPages / allPages * 100 : 0}%"></em></i></div>
        <div class="dk-card"><small>People</small><b>${cast.length} cast · ${crew.length} crew</b><span>${uncast.length ? `${uncast.length} roles to cast` : 'All roles cast'} · ${circled} good takes</span></div></div>
      <section class="fsec"><h3>Needs attention <small class="fhint">${risks.filter(r => r.lvl !== 'info').length} important</small></h3>
        <ul class="dk-risks">${risks.map(r => `<li class="${r.lvl}"><span>${esc(r.text)}</span><button class="ib xs" ${go(r)}>Open</button></li>`).join('') || '<li class="good"><span>Nothing urgent. Good work.</span></li>'}</ul></section></div>`;
    el.onclick = e => { const g = e.target.closest('[data-dkgo]'); if (g) F.openDesk(g.dataset.dkgo); if (e.target.closest('[data-prsave]')) N.saveNode(el.querySelector('#pdSheet'), `${d.title} producer report`, 'pdf'); };
  } });

  /* ================= BTS (behind the scenes, social) ================= */
  const PLAT = ['Instagram', 'TikTok', 'YouTube', 'X', 'Facebook', 'WhatsApp Status', 'LinkedIn'];
  F.btsMoments = (d, day) => {
    const i = d.days.indexOf(day), sc = F.dayScenes(d, day), out = [];
    if (i === 0) out.push(['first', 'The first slate of the film', 'Film the clapper on the first take, and the crew before call']);
    sc.forEach(s => { const t = s.tags || {};
      if ((t.effects || []).length) out.push(['fx:' + s.id, `Effects in scene ${s.num}: ${t.effects.join(', ')}`, 'Film the setup and a safe wide of the moment']);
      if ((t.vehicles || []).length) out.push(['veh:' + s.id, `Vehicle shots in scene ${s.num}: ${t.vehicles.join(', ')}`, 'The camera rig on the car makes a great reel']);
      if (isExt(s) && isNight(s)) out.push(['night:' + s.id, `Night exterior, scene ${s.num}`, 'A wide of the lights and the set at night']); });
    const big = sc.slice().sort((a, b) => (b.cast || []).length - (a.cast || []).length)[0];
    if (big && (big.cast || []).length >= 3) out.push(['cast:' + big.id, `Full cast together in scene ${big.num}`, 'A group photo between setups']);
    if (sc.length) out.push(['vf:' + day.id, 'The monitor and the director at work', 'Over the shoulder, with the frame on the monitor']);
    if (i === d.days.length - 1 && i > 0) out.push(['wrap', 'Wrap: the last shot and “That’s a wrap!”', 'Then the whole crew photo']);
    return out;
  };
  F.desks.push({ id: 'bts', group: 'Publicity', label: 'BTS and publicity', who: 'BTS, social, marketing', icon: '📸',
    status(d) { const B = F.desk(d, 'bts', {}); return { ready: null, note: `${(B.media || []).length} photos and clips · ${(B.posts || []).filter(x => x.st === 'Posted').length} posted` }; }, render(el, d) {
    const B = F.desk(d, 'bts', {}), ui = this.ui = this.ui || {};
    if (!ui.day || !d.days.find(x => x.id === ui.day)) ui.day = firstDay(d);
    const day = d.days.find(x => x.id === ui.day), done = (B.done || {})[ui.day] || {}, own = (B.items || []).filter(x => x.day === ui.day), media = B.media || [];
    const posts = (B.posts || []).slice().sort((a, b) => String(a.date || '9').localeCompare(String(b.date || '9')));
    el.innerHTML = `<header class="dk-top"><div><h2>BTS</h2><p>The moments worth capturing each day, interviews to record, and the posts to build buzz for the film.</p></div></header>
      <div class="dk-two"><section class="fsec"><div class="dk-h"><h3>Capture list</h3>${d.days.length ? dayPick(d, ui, 'data-bday') : ''}</div>
        ${day ? `<ul class="dk-check">${F.btsMoments(d, day).map(([k, l, s]) => check(done, k, esc(l), esc(s))).join('')}${own.map(x => check(done, 'own:' + x.id, esc(x.text), '')).join('')}</ul><div class="row"><button class="add" data-btsadd>+ Moment</button></div>` : '<div class="empty-row">Add shoot days on the Schedule tab.</div>'}
        <h3 style="margin-top:14px">Interviews</h3><ul class="dk-iv">${(B.iv || []).map(x => `<li data-iv="${esc(x.id)}"><label><input type="checkbox" data-ivk="done"${x.done ? ' checked' : ''}> <b>${esc(x.who)}</b></label><textarea data-ivk="q" rows="2" placeholder="Questions: What drew you to this role? Hardest day?">${esc(x.q || '')}</textarea></li>`).join('') || '<li class="fhint">Short interviews with the director and lead cast make the best trailers and press kits.</li>'}</ul>
        <div class="row"><select data-ivadd aria-label="Add an interview"><option value="">+ Interview with…</option>${d.people.filter(p => p.name).map(p => `<option value="${esc(p.name)}${p.role ? ' (' + esc(p.role) + ')' : ''}">${esc(p.name)}${p.role ? ' · ' + esc(p.role) : ''}</option>`).join('')}</select></div></section>
        <section class="fsec"><h3>Posts</h3><table class="ftable dk-posts"><thead><tr><th>Date</th><th>Where</th><th>Idea</th><th>Status</th><th></th></tr></thead><tbody>${posts.map(x => `<tr data-po="${esc(x.id)}"><td><input type="date" data-pok="date" value="${esc(x.date || '')}"></td><td><select data-pok="plat">${PLAT.map(p => `<option${x.plat === p ? ' selected' : ''}>${p}</option>`).join('')}</select></td><td><input data-pok="idea" value="${esc(x.idea || '')}" placeholder="First look at Ada in costume"></td><td><select data-pok="st">${['Idea', 'Ready', 'Posted'].map(p => `<option${(x.st || 'Idea') === p ? ' selected' : ''}>${p}</option>`).join('')}</select></td><td class="act"><button class="ib xs" data-podel aria-label="Remove">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-row">Plan a post for each week: cast reveal, first day, a BTS reel, the poster, the trailer.</td></tr>'}</tbody></table>
          <div class="row"><button class="add" data-poadd>+ Post</button></div>
          <h3 style="margin-top:14px">BTS photos and clips <small class="fhint">${media.length}</small></h3>
          <div class="dk-refs bts">${media.slice().reverse().map(m => `<figure data-bm="${esc(m.id)}">${m.video ? `<video data-media="${esc(m.id)}" muted playsinline preload="metadata"></video>` : `<img data-media="${esc(m.id)}" alt="">`}<figcaption>${esc(m.day ? (F.dayLabel(d, d.days.find(x => x.id === m.day) || {}) || '') : '')}</figcaption><button class="ib xs" data-bmdl aria-label="Download">↓</button></figure>`).join('')}<label class="dk-addph">+ Add photos and clips<input type="file" accept="image/*,video/*" multiple data-bmadd hidden></label></div></section></div>`;
    F.mediaImgs(el); el.querySelectorAll('video[data-media]').forEach(async v => { const u = await N.Store.mediaUrl(v.dataset.media); if (u) v.src = u + '#t=0.5'; });
    const W = fn => F.change(dd => fn(F.deskW(dd, 'bts', () => ({}))));
    el.onchange = async e => { const t = e.target;
      if (t.dataset.bday !== undefined) { ui.day = t.value; return F.refresh(); }
      if (t.dataset.ck) return W(B2 => { B2.done = B2.done || {}; const x = B2.done[ui.day] = B2.done[ui.day] || {}; x[t.dataset.ck] = t.checked; });
      if (t.dataset.ivadd !== undefined && t.value) return W(B2 => (B2.iv = B2.iv || []).push({ id: F.uid(), who: t.value }));
      const iv = t.closest('[data-iv]'); if (iv && t.dataset.ivk) return W(B2 => { const x = B2.iv.find(y => y.id === iv.dataset.iv); x[t.dataset.ivk] = t.type === 'checkbox' ? t.checked : t.value; });
      const po = t.closest('[data-po]'); if (po && t.dataset.pok) return W(B2 => { const x = B2.posts.find(y => y.id === po.dataset.po); x[t.dataset.pok] = t.value; });
      if (t.dataset.bmadd !== undefined) { const files = [...t.files]; if (!files.length) return; N.status('Saving…'); const add = []; for (const f of files) add.push({ id: await N.Store.putMedia(f), video: f.type.startsWith('video/'), day: ui.day, t: Date.now() }); N.settled(); W(B2 => { B2.media = [...(B2.media || []), ...add]; }); }
    };
    el.onclick = async e => { const t = e.target;
      if (t.closest('[data-btsadd]')) { const n = await F.ask('Moment to capture', 'For example: Ada’s first scene'); if (n) W(B2 => (B2.items = B2.items || []).push({ id: F.uid(), day: ui.day, text: n })); return; }
      if (t.closest('[data-poadd]')) return W(B2 => (B2.posts = B2.posts || []).push({ id: F.uid(), date: N.todayStr(7), plat: 'Instagram', st: 'Idea' }));
      const pd = t.closest('[data-podel]'); if (pd) { const id = pd.closest('[data-po]').dataset.po; return W(B2 => { B2.posts = B2.posts.filter(x => x.id !== id); }); }
      const dl = t.closest('[data-bmdl]'); if (dl) { const id = dl.closest('[data-bm]').dataset.bm, blob = await N.Store.getMedia(id).catch(() => null); if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `BTS ${id}.${(blob.type.split('/')[1] || 'bin').split(';')[0]}`; document.body.append(a); a.click(); a.remove(); }
    };
  } });
})();
