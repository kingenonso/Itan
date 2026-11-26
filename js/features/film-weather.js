/* Weather for the shoot: an hour-by-hour forecast for each shoot day, from crew call to wrap, at that day's location.
   Itàn reads the day's scenes, so it warns about what matters: rain on exterior scenes, storms near lights and power,
   wind for sound and frames, heat for cast and crew, and cloud that changes the light between shots.
   When rain is likely on an outdoor day, it suggests an indoor day to swap with (a cover set).
   Forecasts come from Open-Meteo (free, no account) up to 16 days ahead; further out, it shows what that date
   has usually been like over the past five years. Alerts for the next few days show when you open Itàn. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const API = 'https://api.open-meteo.com/v1/forecast', PAST = 'https://archive-api.open-meteo.com/v1/archive';
  const STALE = 3 * 36e5, DAY = 864e5;
  const WX = { 0: ['Clear', '☀'], 1: ['Mostly clear', '🌤'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁'], 45: ['Fog', '🌫'], 48: ['Fog', '🌫'], 51: ['Light drizzle', '🌦'], 53: ['Drizzle', '🌦'], 55: ['Heavy drizzle', '🌧'], 56: ['Freezing drizzle', '🌧'], 57: ['Freezing drizzle', '🌧'], 61: ['Light rain', '🌦'], 63: ['Rain', '🌧'], 65: ['Heavy rain', '🌧'], 66: ['Freezing rain', '🌧'], 67: ['Freezing rain', '🌧'], 71: ['Light snow', '🌨'], 73: ['Snow', '🌨'], 75: ['Heavy snow', '❄'], 77: ['Snow grains', '🌨'], 80: ['Showers', '🌦'], 81: ['Showers', '🌧'], 82: ['Violent showers', '⛈'], 85: ['Snow showers', '🌨'], 86: ['Snow showers', '🌨'], 95: ['Thunderstorm', '⛈'], 96: ['Thunderstorm with hail', '⛈'], 99: ['Thunderstorm with hail', '⛈'] };
  const wx = c => WX[c] || ['Mixed', '🌥'];
  const hr = s => { const h = +s.slice(11, 13); return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`; };
  const daysAway = date => Math.round((new Date(date + 'T12:00:00') - new Date(N.todayStr(0) + 'T12:00:00')) / DAY);

  // where a day is: its pinned location, else the place picked for sun times, else the film's place
  F.placeOfDay = (d, day) => { const l = F.locationsOfDay ? F.locationsOfDay(d, day).find(x => x.lat) : null; return l ? { name: l.name, lat: +l.lat, lon: +l.lon } : day.place || d.place || null; };
  const isExt = s => /EXT/i.test(s.ie || ''), isNight = s => /NIGHT|EVENING|DUSK/i.test(s.dn || '');

  async function fetchDay(d, day) {
    const p = F.placeOfDay(d, day); if (!p || !day.date) return null;
    const away = daysAway(day.date); if (away < -1) return null;
    if (away > 15) return typical(p, day.date);
    const u = `${API}?latitude=${p.lat}&longitude=${p.lon}&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,cloud_cover,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_gusts_10m_max&timezone=auto&start_date=${day.date}&end_date=${day.date}`;
    const r = await fetch(u); if (!r.ok) throw new Error('weather'); const j = await r.json(), h = j.hourly, dl = j.daily;
    const hours = h.time.map((t, i) => ({ t, temp: h.temperature_2m[i], feels: h.apparent_temperature[i], rain: h.precipitation_probability[i] || 0, mm: h.precipitation[i] || 0, code: h.weather_code[i], wind: h.wind_speed_10m[i], gust: h.wind_gusts_10m[i], cloud: h.cloud_cover[i], uv: h.uv_index ? h.uv_index[i] : null }));
    return { kind: 'forecast', at: Date.now(), place: p.name || '', tz: j.timezone_abbreviation || '', hours, code: dl.weather_code[0], tmax: dl.temperature_2m_max[0], tmin: dl.temperature_2m_min[0], rain: dl.precipitation_probability_max[0], mm: dl.precipitation_sum[0], gust: dl.wind_gusts_10m_max[0] };
  }
  // further than 16 days: the same week in each of the last five years
  async function typical(p, date) {
    const [y, m, dd] = date.split('-').map(Number), now = new Date().getFullYear(), rows = [];
    await Promise.all([1, 2, 3, 4, 5].map(async k => {
      const yr = Math.min(y, now) - k, c = new Date(Date.UTC(yr, m - 1, dd)), a = new Date(c - 3 * DAY).toISOString().slice(0, 10), b = new Date(+c + 3 * DAY).toISOString().slice(0, 10);
      try { const r = await fetch(`${PAST}?latitude=${p.lat}&longitude=${p.lon}&start_date=${a}&end_date=${b}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max&timezone=auto`); if (!r.ok) return; const j = (await r.json()).daily;
        j.time.forEach((_, i) => rows.push({ mm: j.precipitation_sum[i] || 0, tmax: j.temperature_2m_max[i], tmin: j.temperature_2m_min[i], gust: j.wind_gusts_10m_max[i] })); } catch (e) {}
    }));
    if (!rows.length) throw new Error('weather');
    const avg = k => rows.reduce((n, r) => n + (r[k] || 0), 0) / rows.length;
    return { kind: 'typical', at: Date.now(), place: p.name || '', years: 5, rainDays: Math.round(rows.filter(r => r.mm >= 1).length / rows.length * 100), heavy: Math.round(rows.filter(r => r.mm >= 10).length / rows.length * 100), tmax: avg('tmax'), tmin: avg('tmin'), gust: avg('gust') };
  }

  // the hours that matter: crew call to about 12 hours later (longer when there are night scenes)
  function window_(day, w, scenes) {
    if (!w || !w.hours) return [];
    const call = +(day.call || '07:00').split(':')[0], night = scenes.some(isNight), end = Math.min(23, call + (night ? 16 : 12));
    return w.hours.filter(h => { const x = +h.t.slice(11, 13); return x >= Math.max(0, call - 1) && x <= end; });
  }

  // what this weather means for these scenes
  F.weatherAlerts = (d, day, w) => {
    if (!w) return [];
    const scenes = F.dayScenes(d, day), ext = scenes.filter(isExt), out = [];
    if (w.kind === 'typical') {
      if (w.rainDays >= 40) out.push({ lvl: 'warn', text: `It has rained on ${w.rainDays}% of days around this date in recent years`, hint: ext.length ? `${ext.length} exterior scene${ext.length > 1 ? 's' : ''} that day. Plan a cover set and pack rain covers.` : 'Plan for wet roads and slower travel.' });
      if (w.tmax >= 35) out.push({ lvl: 'warn', text: `Usually hot: around ${Math.round(w.tmax)}°C`, hint: 'Budget water, shade and breaks.' });
      return out;
    }
    const hs = window_(day, w, scenes), wet = hs.filter(h => h.rain >= 50 || h.mm >= 1), storm = hs.filter(h => h.code >= 95), gust = Math.max(0, ...hs.map(h => h.gust || 0)), hot = Math.max(-99, ...hs.map(h => h.feels ?? h.temp)), uv = Math.max(0, ...hs.map(h => h.uv || 0));
    const span = list => !list.length ? '' : list.length === 1 ? `around ${hr(list[0].t)}` : `${hr(list[0].t)}–${hr(list[list.length - 1].t)}`;
    if (storm.length) out.push({ lvl: 'bad', crisis: true, text: `Thunderstorms likely ${span(storm)}`, hint: ext.length ? 'Stop exterior work and keep lights, stands and power cables away from rain and open ground. Have a safe indoor place for everyone.' : 'Keep the generator and cable runs covered, and plan for slow, wet travel between places.' });
    if ((+w.mm || 0) >= 30) out.push({ lvl: 'bad', crisis: true, text: `Very heavy rain, about ${Math.round(w.mm)} mm`, hint: 'Roads and low ground may flood. Plan travel, move gear off the floor, and keep power away from water.' });
    if (wet.length && ext.length) out.push({ lvl: storm.length ? 'warn' : 'bad', text: `Rain likely ${span(wet)} with ${ext.length} exterior scene${ext.length > 1 ? 's' : ''} (${ext.map(s => s.num).join(', ')})`, hint: 'Shoot exteriors before the rain if you can, and keep a cover set ready.' });
    else if (wet.length) out.push({ lvl: 'warn', text: `Rain likely ${span(wet)}`, hint: 'Interiors only today, but plan for wet travel, gear moves and rain on windows in shot.' });
    if (gust >= 60) out.push({ lvl: 'bad', crisis: true, text: `Dangerous wind, gusts to ${Math.round(gust)} km/h`, hint: 'Take down frames, flags and tents, lower light stands, no drones, and keep people clear of trees and loose roofing.' });
    else if (gust >= 50 && !ext.length) out.push({ lvl: 'warn', text: `Strong gusts up to ${Math.round(gust)} km/h`, hint: 'Secure anything outside: the generator, tents and the van. Wind noise may come through windows.' });
    else if (gust >= 50) out.push({ lvl: 'bad', text: `Strong gusts up to ${Math.round(gust)} km/h`, hint: 'Sandbag every stand, take down large frames and flags, and use furry windshields on mics. Not safe for drones.' });
    else if (gust >= 30 && ext.length) out.push({ lvl: 'warn', text: `Breezy, gusts up to ${Math.round(gust)} km/h`, hint: 'Sandbag stands and bring wind protection for the mics. Check drone limits.' });
    if (hot >= 42) out.push({ lvl: 'bad', crisis: true, text: `Extreme heat: feels like ${Math.round(hot)}°C`, hint: 'Shorter takes, shade for everyone, water and oral rehydration salts, and a medic or first aider on set. Watch for dizziness and headaches.' });
    else if (hot >= 38) out.push({ lvl: 'bad', text: `Very hot: feels like ${Math.round(hot)}°C`, hint: 'Lots of water, shade, cool-down breaks, and keep cameras and batteries out of direct sun.' });
    else if (hot >= 36) out.push({ lvl: 'warn', text: `Hot: feels like ${Math.round(hot)}°C`, hint: 'Extra water and shade for cast and crew.' });
    if (hot <= 3) out.push({ lvl: 'warn', text: `Cold: feels like ${Math.round(hot)}°C`, hint: 'Warm layers and hot drinks; batteries drain faster in the cold.' });
    if (uv >= 8 && ext.length) out.push({ lvl: 'warn', text: `Very high sun (UV ${Math.round(uv)})`, hint: 'Sunscreen and hats. Harsh overhead light at midday: plan diffusion or shoot the wide shots early.' });
    const day_ = hs.filter(h => { const x = +h.t.slice(11, 13); return x >= 8 && x <= 17; }), clouds = day_.map(h => h.cloud);
    if (ext.length && clouds.length && Math.max(...clouds) - Math.min(...clouds) >= 60) out.push({ lvl: 'info', text: 'Cloud comes and goes', hint: 'The light will change between takes. Watch continuity and keep a diffusion frame ready to even it out.' });
    if (hs.some(h => h.code === 45 || h.code === 48)) out.push({ lvl: 'info', text: 'Morning fog', hint: 'Slow roads to the location, and a free atmosphere for wide shots.' });
    return out;
  };
  F.weatherSummary = w => !w ? '' : w.kind === 'typical' ? `Usually ${Math.round(w.tmin)}–${Math.round(w.tmax)}°C; rain on ${w.rainDays}% of days around this date (past 5 years)` : `${wx(w.code)[0]}, ${Math.round(w.tmin)}–${Math.round(w.tmax)}°C, ${w.rain ?? 0}% chance of rain, gusts to ${Math.round(w.gust || 0)} km/h`;

  // an indoor day to swap with when it's likely to rain on an outdoor one
  function coverDay(d, day) {
    const pages = ss => ss.reduce((n, s) => n + (s.pages || 0), 0), mine = pages(F.dayScenes(d, day));
    return d.days.filter(x => x.id !== day.id && !(x.set && x.set.started) && (!x.date || x.date >= N.todayStr(0))).map(x => ({ x, ss: F.dayScenes(d, x) }))
      .filter(o => o.ss.length && o.ss.every(s => !isExt(s))).sort((a, b) => Math.abs(pages(a.ss) - mine) - Math.abs(pages(b.ss) - mine))[0];
  }

  // keep forecasts fresh (stored on the day, so teammates and the call sheet see them too)
  let busy = false;
  F.refreshWeather = async (force, onlySoon) => {
    const d = F.data(); if (!d || busy || !navigator.onLine) return 0; busy = true; let n = 0, fail = 0; const got = {};
    try {
      for (const day of d.days) {
        if (!day.date || daysAway(day.date) < -1 || (onlySoon && daysAway(day.date) > 4)) continue;
        const old = day.wx, wantKind = daysAway(day.date) > 15 ? 'typical' : 'forecast';
        if (!force && old && old.kind === wantKind && Date.now() - old.at < (wantKind === 'typical' ? 7 * DAY : STALE)) continue;
        try { const w = await fetchDay(d, day); if (w) { got[day.id] = w; n++; } } catch (e) { fail++; }
      }
      // saved without an undo step: a forecast isn't an edit anyone would want to undo
      if (n) { const dd = F.data(); if (dd) { dd.days.forEach(day => { const w = got[day.id]; if (!w) return; day.wx = w; if (!day.weather || day.wxAuto) { day.weather = F.weatherSummary(w); day.wxAuto = true; } }); N.touch(); } }
      if (fail && !n && force) N.toast('Couldn’t reach the weather service. Check your internet.');
    } finally { busy = false; }
    if (n) alertCheck();
    if (n && F.pushSync) F.pushSync();
    return n;
  };

  /* ---------- the Weather tab ---------- */
  F.tabs.push({ id: 'weather', label: 'Weather', order: 31, render(el, d) {
    const days = d.days;
    if (!days.length) { el.innerHTML = `<div class="fwrap"><div class="empty-row big">Weather is checked for each shoot day.<br>Add days with dates on the Schedule tab first.</div><div class="row" style="justify-content:center"><button class="pri" data-ftab="schedule">Go to Schedule</button></div></div>`; return; }
    const cards = days.map((day, i) => {
      const scenes = F.dayScenes(d, day), ext = scenes.filter(isExt).length, p = F.placeOfDay(d, day), w = day.wx;
      const head = `<header><div><b>Day ${i + 1}</b> ${day.date ? esc(new Date(day.date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })) : '<span class="fhint">no date</span>'}</div>
        <small>${p ? esc(p.name || 'Pinned location') : '<button class="linkish" data-wxplace="' + esc(day.id) + '">Choose a place</button>'} · ${scenes.length} scene${scenes.length === 1 ? '' : 's'}${ext ? `, ${ext} outside` : ''}</small></header>`;
      if (!day.date) return `<article class="wx-day">${head}<p class="fhint">Set a date on the Schedule tab to see the weather.</p></article>`;
      const away = daysAway(day.date);
      if (away < -1) return `<article class="wx-day past">${head}<p class="fhint">${day.weather ? esc(day.weather) : 'This day has passed.'}</p></article>`;
      if (!p) return `<article class="wx-day">${head}<p class="fhint">Pin the day’s location on the Locations tab, or choose a place, to see its weather.</p></article>`;
      if (!w) return `<article class="wx-day">${head}<p class="fhint">Not checked yet.</p></article>`;
      const al = F.weatherAlerts(d, day, w), cv = al.some(a => a.lvl === 'bad' && /Rain|Thunder/.test(a.text)) ? coverDay(d, day) : null;
      const alerts = al.map(a => `<div class="wx-al ${a.lvl}"><b>${esc(a.text)}</b><span>${esc(a.hint)}</span></div>`).join('') || (w.kind === 'forecast' ? '<div class="wx-al good"><b>Looks good for shooting</b></div>' : '');
      if (w.kind === 'typical') return `<article class="wx-day">${head}<div class="wx-big"><span class="wx-ic">📅</span><div><b>${Math.round(w.tmin)}–${Math.round(w.tmax)}°C</b><p>What this date has usually been like. The real forecast arrives ${esc(new Date(new Date(day.date + 'T12:00:00') - 15 * DAY).toLocaleDateString([], { day: 'numeric', month: 'short' }))}, 16 days before.</p></div></div>
        <div class="wx-stats"><span><b>${w.rainDays}%</b> of days had rain</span><span><b>${w.heavy}%</b> heavy rain</span><span>gusts about <b>${Math.round(w.gust || 0)}</b> km/h</span></div>${alerts}</article>`;
      const hs = window_(day, w, scenes), ic = wx(w.code);
      return `<article class="wx-day">${head}<div class="wx-big"><span class="wx-ic">${ic[1]}</span><div><b>${Math.round(w.tmin)}–${Math.round(w.tmax)}°C · ${esc(ic[0])}</b><p>${w.rain ?? 0}% chance of rain${w.mm ? `, about ${(+w.mm).toFixed(1)} mm` : ''} · gusts to ${Math.round(w.gust || 0)} km/h</p></div></div>
        <div class="wx-hours" role="table" aria-label="Hour by hour from crew call">${hs.map(h => `<div class="wx-h${h.rain >= 50 ? ' wet' : ''}" role="row"><small>${hr(h.t)}</small><span class="wx-hi" title="${esc(wx(h.code)[0])}">${wx(h.code)[1]}</span><b>${Math.round(h.temp)}°</b><i style="--r:${h.rain}%">${h.rain}%</i><small>${Math.round(h.wind)} km/h</small></div>`).join('')}</div>
        ${alerts}${cv ? `<div class="wx-cover"><span>Cover set: Day ${days.indexOf(cv.x) + 1} is all interiors (${cv.ss.map(s => s.num).join(', ')}).</span>${N.P.canWrite ? `<button class="ib" data-wxswap="${esc(day.id)}" data-with="${esc(cv.x.id)}">Swap the scenes of these two days</button>` : ''}</div>` : ''}
        <p class="wx-at">Updated ${esc(new Date(w.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }))} · times are local to the location${w.tz ? ` (${esc(w.tz)})` : ''}</p></article>`;
    }).join('');
    el.innerHTML = `<div class="fwrap wide wx"><div class="rp-bar"><p class="fhint">Forecasts appear 16 days before each shoot day. Turn on alerts and Itàn checks every 3 hours, even when it’s closed, and warns this phone about a weather crisis or rain on an outdoor day. Ask everyone on the team to turn them on.</p>
      <div class="cs-act"><button class="ib" id="wxNotify">${F.pushOn && F.pushOn() ? '🔔 Alerts on (turn off)' : '🔔 Alert me on this phone'}</button>${F.alertCrew ? '<button class="ib" id="wxCrew">Alert the crew</button>' : ''}<button class="pri" id="wxNow">Check now</button></div></div><div class="wx-grid">${cards}</div></div>`;
    el.onclick = async e => {
      const t = e.target;
      if (t.closest('#wxNow')) { N.status('Checking the weather…'); const n = await F.refreshWeather(true); N.settled(); if (!n) N.toast(navigator.onLine ? 'No days to check. Add dates and a location.' : 'You’re offline'); F.refresh(); return; }
      if (t.closest('#wxNotify')) { if (F.pushOn && F.pushOn()) await F.pushDisable(); else if (F.pushEnable) await F.pushEnable(); F.refresh(); return; }
      if (t.closest('#wxCrew')) return F.alertCrew('');
      const pl = t.closest('[data-wxplace]'); if (pl && F.fillSunWeather) { await F.fillSunWeather(pl.dataset.wxplace, true); await F.refreshWeather(true); F.refresh(); return; }
      const sw = t.closest('[data-wxswap]'); if (sw) {
        const a = d.days.find(x => x.id === sw.dataset.wxswap), b = d.days.find(x => x.id === sw.dataset.with);
        if (!a || !b || !(await N.confirmBox(`Swap the scenes of Day ${d.days.indexOf(a) + 1} and Day ${d.days.indexOf(b) + 1}? The dates stay the same. Check cast and location bookings after.`, 'Swap'))) return;
        F.change(dd => { const x = dd.days.find(y => y.id === a.id), y = dd.days.find(z => z.id === b.id); [x.sceneIds, y.sceneIds] = [y.sceneIds, x.sceneIds]; delete x.wx; delete y.wx; });
        N.toast('Swapped. Updating the weather…'); await F.refreshWeather(true); F.refresh();
      }
    };
    if (days.some(day => day.date && daysAway(day.date) >= -1 && F.placeOfDay(d, day) && (!day.wx || Date.now() - day.wx.at > STALE))) setTimeout(() => F.refreshWeather().then(n => n && F.isOpen() && F.tab() === 'weather' && F.refresh()), 50);
  } });

  /* ---------- alerts when you open Itàn ---------- */
  function upcoming(d) {
    return d.days.map((day, i) => ({ day, i, away: day.date ? daysAway(day.date) : 99 })).filter(o => o.away >= 0 && o.away <= 3 && o.day.wx)
      .map(o => ({ ...o, al: F.weatherAlerts(d, o.day, o.day.wx).filter(a => a.lvl === 'bad' || (a.lvl === 'warn' && /Rain|rain|Thunder/.test(a.text))).sort((a, b) => (a.lvl === 'bad' ? 0 : 1) - (b.lvl === 'bad' ? 0 : 1)) })).filter(o => o.al.length).sort((a, b) => a.away - b.away);
  }
  function alertCheck() {
    const d = F.data(); if (!d) return; const list = upcoming(d); let bar = document.querySelector('.wx-banner');
    if (!list.length) { if (bar) bar.remove(); return; }
    if (F.crisisCheck) F.crisisCheck(list);
    const top = list[0], when = top.away === 0 ? 'Today' : top.away === 1 ? 'Tomorrow' : new Date(top.day.date + 'T00:00:00').toLocaleDateString([], { weekday: 'long' }), worst = top.al.find(a => a.lvl === 'bad') || top.al[0];
    const key = 'itan:wxdismiss:' + top.day.id + ':' + worst.text;
    try { if (sessionStorage.getItem(key)) return; } catch (e) {}
    if (!bar) { bar = document.createElement('div'); bar.className = 'wx-banner'; bar.setAttribute('role', 'status'); document.body.append(bar); }
    bar.className = 'wx-banner ' + worst.lvl;
    bar.innerHTML = `<span class="wx-ic">${worst.lvl === 'bad' ? '⚠' : '☂'}</span><div><b>${esc(when)}, Day ${top.i + 1}: ${esc(worst.text)}</b><small>${esc(worst.hint)}${list.length > 1 || top.al.length > 1 ? ` · ${list.reduce((n, o) => n + o.al.length, 0) - 1} more` : ''}</small></div><button class="pri" data-wxopen>See weather</button><button class="ib" data-wxx aria-label="Dismiss">✕</button>`;
    bar.onclick = e => { if (e.target.closest('[data-wxopen]')) { bar.remove(); F.open('weather'); } if (e.target.closest('[data-wxx]')) { try { sessionStorage.setItem(key, '1'); } catch (er) {} bar.remove(); } };
    // a system notification, once per alert
    try {
      const nk = 'itan:wxnote:' + top.day.id + ':' + worst.text;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && !localStorage.getItem(nk)) { localStorage.setItem(nk, '1'); new Notification(`${d.title}: ${when}, Day ${top.i + 1}`, { body: `${worst.text}. ${worst.hint}`, icon: 'icons/icon-192.png', tag: nk }); }
    } catch (e) {}
  }
  const tick = () => { if (!F.data()) { const b = document.querySelector('.wx-banner'); if (b) b.remove(); return; } F.refreshWeather(false, true).then(n => { if (!n) alertCheck(); }); };
  N.hooks.ready.push(() => { setTimeout(tick, 1500); setInterval(tick, 30 * 60000); window.addEventListener('online', tick); });
  let lastBoard = null; N.hooks.render.push(() => { const r = F.root(); const id = r && r.id; if (id !== lastBoard) { lastBoard = id; setTimeout(tick, 300); } });
  F.weatherCheck = alertCheck;
})();
