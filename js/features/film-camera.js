/* Camera tools: how much storage a shoot needs, what a lens sees on a given sensor,
   and the shutter speed and ND filter for the look you want. Figures are standard manufacturer bitrates. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  // recording formats and their bitrates in megabits per second (Mbps)
  const FORMATS = [
    ['Sony XAVC S-I 4K (All-Intra)', { 24: 240, 25: 250, 30: 300, 50: 500, 60: 600 }],
    ['Sony XAVC HS 4K (H.265)', { 24: 100, 25: 100, 30: 100, 50: 150, 60: 150, 100: 200, 120: 200 }],
    ['Sony XAVC S 4K (H.264)', { 24: 100, 25: 100, 30: 100, 50: 150, 60: 150, 100: 200, 120: 200 }],
    ['Sony XAVC S HD', { 24: 50, 25: 50, 30: 50, 50: 50, 60: 50, 100: 100, 120: 100 }],
    ['Apple ProRes 422 HQ, 4K UHD', { 24: 707, 25: 737, 30: 884, 50: 1473, 60: 1768 }],
    ['Apple ProRes 422, 4K UHD', { 24: 471, 25: 491, 30: 589, 50: 982, 60: 1178 }],
    ['Apple ProRes 422 LT, 4K UHD', { 24: 328, 25: 342, 30: 409, 50: 684, 60: 818 }],
    ['Apple ProRes 422 HQ, 1080p', { 24: 176, 25: 184, 30: 220, 50: 367, 60: 440 }],
    ['Apple ProRes 422, 1080p', { 24: 117, 25: 122, 30: 147, 50: 245, 60: 294 }],
    ['Canon XF-AVC 4K Intra', { 24: 410, 25: 410, 30: 410, 50: 810, 60: 810 }],
    ['Canon XF-AVC 4K Long GOP', { 24: 160, 25: 160, 30: 160, 50: 260, 60: 260 }],
    ['Panasonic 4K 10-bit All-I', { 24: 400, 25: 400, 30: 400, 50: 800, 60: 800 }],
    ['DJI / phone 4K H.265 (high)', { 24: 100, 25: 100, 30: 100, 50: 150, 60: 150 }],
    ['Custom: type the bitrate', null]
  ];
  const SENSORS = [['Full frame', 36, 24], ['Super 35 / APS-C (Sony, Fuji)', 23.5, 15.6], ['APS-C (Canon)', 22.3, 14.9], ['Blackmagic 6K Super 35', 23.1, 12.99], ['Micro Four Thirds', 17.3, 13], ['1-inch', 13.2, 8.8], ['Phone main camera (about 1/1.3")', 9.8, 7.4]];
  const FFDIAG = Math.hypot(36, 24);
  const RATES = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 120];
  const SHUTTERS = [24, 25, 30, 40, 48, 50, 60, 80, 100, 120, 125, 160, 200, 240, 250, 320, 400, 500, 640, 800, 1000];

  const deg = r => r * 180 / Math.PI;
  const gb = mbps => mbps / 8 * 3600 / 1000; // gigabytes per hour
  const size = g => g >= 1000 ? (g / 1000).toFixed(g >= 10000 ? 0 : 1) + ' TB' : Math.round(g) + ' GB';
  const fpsKey = (fmt, f) => { const ks = Object.keys(fmt).map(Number); return ks.reduce((a, b) => Math.abs(b - f) < Math.abs(a - f) ? b : a); };

  F.tabs.push({ id: 'camera', label: 'Camera', order: 42, render(el, d) {
    const c = d.camera = Object.assign({ fmt: 0, fps: 24, custom: 300, mins: 90, days: Math.max(1, d.days.length), cams: 1, copies: 2, card: 256, sensor: 0, focal: 35, dist: 3, tfps: 24, angle: 180, mN: 4, mT: 250, mISO: 800, wN: 2, wT: 50, wISO: 800 }, d.camera || {});
    const f = FORMATS[c.fmt] || FORMATS[0], mbps = f[1] ? f[1][fpsKey(f[1], c.fps)] : +c.custom || 0;
    const perHour = gb(mbps), perDay = perHour * c.mins / 60 * c.cams, shoot = perDay * c.days, withCopies = shoot * c.copies;
    const cardMins = mbps ? Math.floor(c.card * 1000 / (mbps / 8) / 60) : 0;
    const s = SENSORS[c.sensor] || SENSORS[0], fl = +c.focal || 1;
    const h = 2 * deg(Math.atan(s[1] / (2 * fl))), v = 2 * deg(Math.atan(s[2] / (2 * fl))), dg = 2 * deg(Math.atan(Math.hypot(s[1], s[2]) / (2 * fl)));
    const crop = FFDIAG / Math.hypot(s[1], s[2]), wide = 2 * c.dist * Math.tan(h * Math.PI / 360), tall = 2 * c.dist * Math.tan(v * Math.PI / 360);
    const shutterExact = 1 / (c.tfps * 360 / c.angle), nearest = SHUTTERS.reduce((a, b) => Math.abs(1 / b - shutterExact) < Math.abs(1 / a - shutterExact) ? b : a);
    // stops of ND: how much more light the wanted settings let in than the metered correct exposure
    const stops = Math.log2((1 / c.wT) * c.wISO / (c.wN * c.wN)) - Math.log2((1 / c.mT) * c.mISO / (c.mN * c.mN));
    const ndStops = Math.max(0, Math.round(stops * 3) / 3);
    const num = (k, v, extra = '') => `<input data-cam="${k}" value="${esc(v)}" inputmode="decimal" ${extra}>`;
    el.innerHTML = `<div class="fwrap wide cam">
      <section class="fsec"><h3>Storage for the shoot</h3><p class="fhint">How much card and drive space you need, including backup copies.</p>
        <div class="cam-grid"><label class="span2">Recording format<select data-cam="fmt">${FORMATS.map(([n], k) => `<option value="${k}"${k === +c.fmt ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <label>Frame rate<select data-cam="fps">${RATES.map(r => `<option${r === +c.fps ? ' selected' : ''}>${r}</option>`).join('')}</select></label>
          ${f[1] ? `<div class="cam-out sm"><small>Bitrate</small><b>${mbps} Mbps</b></div>` : `<label>Bitrate (Mbps)${num('custom', c.custom)}</label>`}
          <label>Minutes recorded per day, per camera${num('mins', c.mins)}</label><label>Shoot days${num('days', c.days)}</label><label>Cameras${num('cams', c.cams)}</label>
          <label>Copies (main drive + backups)<select data-cam="copies">${[1, 2, 3].map(n => `<option value="${n}"${n === +c.copies ? ' selected' : ''}>${n === 1 ? '1, no backup' : n === 2 ? '2, one backup' : '3, two backups (safest)'}</option>`).join('')}</select></label></div>
        <div class="cam-res"><div><small>Per hour of footage</small><b>${size(perHour)}</b></div><div><small>Per shoot day</small><b>${size(perDay)}</b></div><div><small>Whole shoot</small><b>${size(shoot)}</b></div><div class="big"><small>Drive space with copies</small><b>${size(withCopies)}</b></div></div>
        <p class="cam-card">A <select data-cam="card">${[64, 128, 160, 256, 512, 1024].map(n => `<option value="${n}"${n === +c.card ? ' selected' : ''}>${n >= 1024 ? '1 TB' : n + ' GB'}</option>`).join('')}</select> card holds about <b>${cardMins >= 60 ? Math.floor(cardMins / 60) + ' h ' + (cardMins % 60) + ' min' : cardMins + ' min'}</b> of this format. Each camera fills about <b>${mbps ? Math.ceil(perDay / c.cams / c.card) : 0}</b> card${mbps && Math.ceil(perDay / c.cams / c.card) === 1 ? '' : 's'} a day.</p></section>
      <section class="fsec"><h3>What the lens sees</h3><p class="fhint">Field of view for a lens on your camera’s sensor, and how much of the scene fits in the frame.</p>
        <div class="cam-grid"><label class="span2">Sensor<select data-cam="sensor">${SENSORS.map(([n], k) => `<option value="${k}"${k === +c.sensor ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <label>Lens (mm)${num('focal', c.focal)}</label><label>Subject distance (m)${num('dist', c.dist)}</label></div>
        <div class="cam-res"><div><small>Across</small><b>${h.toFixed(1)}°</b></div><div><small>Up and down</small><b>${v.toFixed(1)}°</b></div><div><small>Diagonal</small><b>${dg.toFixed(1)}°</b></div><div class="big"><small>Looks like on full frame</small><b>${Math.round(fl * crop)} mm</b></div></div>
        <p class="cam-card">At ${esc(c.dist)} m the frame is about <b>${wide.toFixed(1)} m wide</b> and <b>${tall.toFixed(1)} m tall</b>. ${wide < 0.6 ? 'That’s a close-up.' : wide < 1.6 ? 'About a medium shot of one person.' : wide < 4 ? 'About a full shot of one or two people.' : 'A wide shot.'}</p></section>
      <section class="fsec"><h3>Shutter and ND filter</h3><p class="fhint">For natural motion blur, the shutter is usually half the frame time (a 180° shutter). An ND filter cuts light so you can keep that shutter and a wide aperture outdoors.</p>
        <div class="cam-grid"><label>Frame rate<select data-cam="tfps">${RATES.map(r => `<option${r === +c.tfps ? ' selected' : ''}>${r}</option>`).join('')}</select></label>
          <label>Shutter angle<select data-cam="angle">${[45, 90, 144, 172.8, 180, 270, 360].map(a => `<option${a === +c.angle ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
          <div class="cam-out span2"><small>Shutter speed</small><b>1/${Math.round(1 / shutterExact)}</b><span>Nearest on most cameras: 1/${nearest}</span></div></div>
        <h4>ND filter</h4><p class="fhint">First, set the camera’s meter for a correct exposure. Then enter the settings you’d rather shoot at.</p>
        <div class="cam-grid nd"><span class="lbl">Correct exposure now</span><label>f/${num('mN', c.mN)}</label><label>Shutter 1/${num('mT', c.mT)}</label><label>ISO${num('mISO', c.mISO)}</label>
          <span class="lbl">Settings you want</span><label>f/${num('wN', c.wN)}</label><label>Shutter 1/${num('wT', c.wT)}</label><label>ISO${num('wISO', c.wISO)}</label></div>
        <div class="cam-res">${stops > 0.15 ? `<div class="big"><small>ND needed</small><b>${ndStops.toFixed(ndStops % 1 ? 1 : 0)} stops</b></div><div><small>Filter strength</small><b>ND ${(0.3 * ndStops).toFixed(1)}</b></div><div><small>Closest common filter</small><b>ND${Math.pow(2, Math.round(ndStops))}</b></div>` : stops < -0.15 ? `<div class="big warn"><small>Not enough light</small><b>${Math.abs(stops).toFixed(1)} stops short</b></div><div class="span3"><small>Try</small><b>A wider aperture, a higher ISO or more light</b></div>` : `<div class="big"><small>ND needed</small><b>None</b></div>`}</div></section>
    </div>`;
    el.onchange = e => { const k = e.target.dataset.cam; if (!k) return; F.change(dd => { dd.camera = Object.assign({}, dd.camera || {}, { [k]: +e.target.value || 0 }); }); };
  } });
})();
