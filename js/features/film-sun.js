/* Sun and weather for call sheets.
   Pick the location once (searched with Open-Meteo, free and without an account); Itàn works out sunrise, sunset
   and golden hour for the shoot date, and fills in the forecast when the date is within 16 days. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;

  /* ---------- where the sun is (the standard astronomical formulas used by most sun apps) ---------- */
  const rad = Math.PI / 180, DAY = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397, J0 = 0.0009;
  const toDays = d => d / DAY - 0.5 + J1970 - J2000, fromJulian = j => new Date((j + 0.5 - J1970) * DAY);
  const M = d => rad * (357.5291 + 0.98560028 * d);
  const L = m => m + rad * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) + rad * 102.9372 + Math.PI;
  const dec = l => Math.asin(Math.sin(e) * Math.sin(l));
  F.sunTimes = (dateStr, lat, lon) => {
    const [y, mo, d] = dateStr.split('-').map(Number), date = Date.UTC(y, mo - 1, d, 12) - lon / 15 * 36e5;
    const lw = rad * -lon, phi = rad * lat, dd = toDays(date), n = Math.round(dd - J0 - lw / (2 * Math.PI));
    const ds = J0 + lw / (2 * Math.PI) + n, m = M(ds), l = L(m), dc = dec(l), noon = J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
    const at = h => { const w = Math.acos((Math.sin(h * rad) - Math.sin(phi) * Math.sin(dc)) / (Math.cos(phi) * Math.cos(dc))); if (isNaN(w)) return null;
      const set = J2000 + (J0 + (w + lw) / (2 * Math.PI) + n) + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l); return [fromJulian(noon - (set - noon)), fromJulian(set)]; };
    const sun = at(-0.833), gold = at(6), blue = at(-4);
    return sun && { sunrise: sun[0], sunset: sun[1], noon: fromJulian(noon), goldAm: blue && gold ? [blue[0], gold[0]] : null, goldPm: blue && gold ? [gold[1], blue[1]] : null };
  };
  const fmt = (d, tz) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz || undefined });
  F.sunText = (dateStr, p) => {
    const s = F.sunTimes(dateStr, p.lat, p.lon); if (!s) return '';
    return `Sunrise ${fmt(s.sunrise, p.tz)} · Sunset ${fmt(s.sunset, p.tz)}` + (s.goldAm ? ` · Golden hour ${fmt(s.goldAm[0], p.tz)}–${fmt(s.goldAm[1], p.tz)} and ${fmt(s.goldPm[0], p.tz)}–${fmt(s.goldPm[1], p.tz)}` : '');
  };

  /* ---------- weather ---------- */
  const WX = { 0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorms', 96: 'Thunderstorms with hail', 99: 'Thunderstorms with hail' };
  async function weather(dateStr, p) {
    const days = Math.round((new Date(dateStr + 'T12:00:00') - new Date()) / DAY);
    if (days < -1) return { note: 'That date has passed' };
    if (days > 15) return { note: `Forecast appears 16 days before the shoot (about ${new Date(new Date(dateStr + 'T12:00:00') - 15 * DAY).toLocaleDateString([], { day: 'numeric', month: 'short' })})` };
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
    const r = await fetch(u); if (!r.ok) throw new Error('weather'); const j = (await r.json()).daily;
    const rain = j.precipitation_probability_max && j.precipitation_probability_max[0];
    return { text: `${WX[j.weather_code[0]] || 'Mixed'}, ${Math.round(j.temperature_2m_min[0])}–${Math.round(j.temperature_2m_max[0])}°C${rain != null ? `, ${rain}% chance of rain` : ''}, wind up to ${Math.round(j.wind_speed_10m_max[0])} km/h` };
  }

  /* ---------- choosing a place ---------- */
  function pickPlace(initial) {
    return new Promise(res => {
      const m = N.modal(`<h2>Where are you shooting?</h2><p>Type the town or area. Itàn uses it for sunrise, sunset and the weather.</p>
        <label>Town or area<input id="plQ" value="${esc(initial || '')}" placeholder="Port Harcourt" autocomplete="off"></label><ul class="pl-res" id="plRes"></ul>
        <div class="row"><button data-close>Cancel</button></div>`);
      const q = m.querySelector('#plQ'), out = m.querySelector('#plRes'); let tm, results = [];
      const search = async () => { const v = q.value.trim(); if (v.length < 2) { out.innerHTML = ''; return; }
        try { const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(v)}&count=6&language=en&format=json`); results = (await r.json()).results || [];
          out.innerHTML = results.map((x, k) => `<li><button data-pl="${k}"><b>${esc(x.name)}</b><span>${esc([x.admin1, x.country].filter(Boolean).join(', '))}</span></button></li>`).join('') || '<li class="fhint">No places found. Try a nearby town.</li>'; }
        catch (e) { out.innerHTML = '<li class="fhint">Searching needs internet</li>'; } };
      q.oninput = () => { clearTimeout(tm); tm = setTimeout(search, 300); };
      m.querySelector('[data-close]').onclick = () => { N.closeOv(); res(null); };
      out.onclick = e => { const b = e.target.closest('[data-pl]'); if (!b) return; const x = results[+b.dataset.pl]; N.closeOv(); res({ name: [x.name, x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude, tz: x.timezone }); };
      setTimeout(() => { q.focus(); if (initial) search(); }, 50);
    });
  }

  // fill one shoot day's sun and weather (asks for the place the first time)
  F.fillSunWeather = async (dayId, choose) => {
    const d = F.data(); const day = d.days.find(x => x.id === dayId); if (!day) return;
    if (!day.date) return N.toast('Set the date for this day first');
    let p = day.place || d.place;
    if (!p || choose) { p = await pickPlace(p ? p.name.split(',')[0] : ''); if (!p) return; }
    const sun = F.sunText(day.date, p); let wx = null;
    N.status('Checking the weather…');
    try { wx = await weather(day.date, p); } catch (e) { wx = { note: 'Couldn’t reach the weather service. Check your internet.' }; }
    N.settled();
    F.change(dd => { const dy = dd.days.find(x => x.id === dayId); dy.place = p; dd.place = dd.place || p; dy.sunset = sun; if (wx.text) { dy.weather = wx.text; dy.wxAt = Date.now(); } });
    N.toast(wx.text ? 'Sun times and forecast added' : `Sun times added. ${wx.note}.`);
  };
})();
