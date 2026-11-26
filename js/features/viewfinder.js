/* The Director's Viewfinder: the phone camera shows exactly what a cinema camera and lens would see.
   Pick the camera (its sensor size) and the lens; Itàn crops the phone's picture to that field of view, inside your frame
   lines (16:9, 2.39, 9:16…). Turn on the sun to see its path across the sky for the shoot date, drawn over the picture
   from the phone's motion sensors; point at the real sun and tap Align to make it accurate to a couple of degrees.
   Snap a frame and it becomes a storyboard frame on a shot card, or a scouting photo for a location,
   with the lens, direction and time saved. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const CAMS = [['Full frame (Sony FX3, FX6, A7S III, Canon R5)', 36], ['Super 35 (Sony FX30, Canon C70, RED Komodo)', 24.9], ['Blackmagic 6K / 6K Pro (Super 35)', 23.1], ['Blackmagic 4K (Micro Four Thirds)', 18.96], ['APS-C (Sony a6000 series, Fuji)', 23.5], ['Canon APS-C', 22.3], ['Micro Four Thirds (Panasonic GH)', 17.3], ['ARRI Alexa Mini LF', 36.7], ['ARRI Alexa Mini (Super 35)', 28.25], ['1-inch (some drones)', 13.2]];
  const LENSES = [14, 18, 24, 28, 35, 50, 65, 85, 100, 135];
  const FRAMES = [['16:9', 16 / 9], ['2.39', 2.39], ['1.85', 1.85], ['4:3', 4 / 3], ['1:1', 1], ['9:16', 9 / 16], ['4:5', 4 / 5]];
  const PHONE_LONG = 34.6;  // a phone's 4:3 picture, in full-frame millimetres along its long side
  let st = {};
  try { st = JSON.parse(localStorage.getItem('itan:vf') || '{}'); } catch (e) {}
  st = Object.assign({ cam: 0, lens: 35, frame: 0, phone: 26, thirds: true, sun: false }, st);
  const keep = () => { try { const { headOff, elevOff, ...rest } = st; localStorage.setItem('itan:vf', JSON.stringify(rest)); } catch (e) {} };
  const rad = Math.PI / 180;

  N.viewfinder = async (opt = {}) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return N.toast('This browser can’t use the camera. Try Chrome, Safari or the Itàn app.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }); }
    catch (e) { return N.toast(e.name === 'NotAllowedError' ? 'Allow camera access to use the viewfinder' : 'No camera found on this device'); }
    const d = F.data(), loc = opt.location && d && (d.locations || []).find(l => l.id === opt.location);
    let place = loc && loc.lat ? { lat: loc.lat, lon: loc.lon } : d && d.place ? { lat: d.place.lat, lon: d.place.lon } : null;
    let date = loc && d ? (d.days.find(x => x.date && x.sceneIds.some(id => d.scenes.some(s => s.id === id && (loc.places || []).includes(String(s.loc || '').toUpperCase())))) || {}).date || N.todayStr(0) : N.todayStr(0);
    let minute = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
    let orient = null, headOff = 0, elevOff = 0, aligned = false, raf = 0, closed = false;

    const el = document.createElement('div'); el.className = 'vf'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Director’s viewfinder');
    el.innerHTML = `<div class="vf-stage"><video playsinline muted autoplay></video><canvas class="vf-pic"></canvas><canvas class="vf-hud"></canvas>
        <div class="vf-info"><b class="vf-lens"></b><span class="vf-cam"></span><span class="vf-warn" hidden></span></div>
        <div class="vf-turn" hidden>Turn your phone sideways for this frame</div></div>
      <div class="vf-bar">
        <div class="vf-lenses">${LENSES.map(f => `<button data-lens="${f}">${f}</button>`).join('')}<button data-lens="custom" title="Another focal length">mm…</button></div>
        <div class="vf-row"><select class="vf-camsel" aria-label="Camera">${CAMS.map(([n], i) => `<option value="${i}">${esc(n)}</option>`).join('')}</select>
          <select class="vf-framesel" aria-label="Frame lines">${FRAMES.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}</select>
          <button class="ib vf-tog" data-t="thirds">Thirds</button><button class="ib vf-tog" data-t="sun">☀ Sun path</button>
          <span class="vf-spacer"></span><button class="ib" data-a="set" aria-label="Viewfinder settings">⚙</button><button class="ib" data-a="close">Close</button></div>
        <div class="vf-sunrow" hidden><label>Date<input type="date" class="vf-date" value="${esc(date)}"></label><label class="vf-time">Time <b></b><input type="range" min="300" max="1260" step="5" class="vf-min"></label><button class="ib" data-a="align" title="Point the middle of the frame at the real sun, then tap">Align to sun</button></div>
        <button class="vf-snap" data-a="snap" aria-label="Snap this frame"><span></span></button></div>`;
    document.body.append(el); document.body.classList.add('sketching');
    const video = el.querySelector('video'), pic = el.querySelector('.vf-pic'), hud = el.querySelector('.vf-hud'), pg = pic.getContext('2d'), hg = hud.getContext('2d');
    video.srcObject = stream; await video.play().catch(() => {});
    const $ = s => el.querySelector(s);
    if (opt.lens) st.lens = parseFloat(opt.lens) || st.lens;

    // what the chosen camera and lens see, and the matching crop of the phone's picture
    function geometry() {
      const vw = video.videoWidth || 1280, vh = video.videoHeight || 720, aspect = FRAMES[st.frame][1], sensorW = CAMS[st.cam][1];
      const srcLong = Math.max(vw, vh), frameWide = aspect >= 1, useW = frameWide ? vw : vh;   // the source side that becomes the frame's long side
      const portraitMismatch = frameWide ? vw < vh : vw > vh;
      const dimMm = PHONE_LONG * (useW / srcLong);                      // that side in full-frame millimetres
      const tanPhone = dimMm / (2 * st.phone);
      // the frame's long side spans the sensor width (for tall frames, the camera is turned on its side)
      const tanT = sensorW / (2 * st.lens);
      let crop = useW * (tanT / tanPhone), wider = 0;
      if (crop > useW) { wider = crop / useW; crop = useW; }
      let cw = frameWide ? crop : crop * aspect, ch = frameWide ? crop / aspect : crop;
      if (cw > vw) { const k = vw / cw; cw *= k; ch *= k; } if (ch > vh) { const k = vh / ch; cw *= k; ch *= k; }
      const fovH = 2 * Math.atan(frameWide ? tanT : tanT * aspect) / rad, fovV = 2 * Math.atan(frameWide ? tanT / aspect : tanT) / rad;
      return { vw, vh, sx: (vw - cw) / 2, sy: (vh - ch) / 2, cw, ch, aspect, wider, portraitMismatch, fovH, fovV, equiv: Math.round(st.lens * 36 / sensorW) };
    }
    function layout() {
      const g = geometry(), stage = $('.vf-stage'), W = stage.clientWidth, H = stage.clientHeight;
      let w = W, h = W / g.aspect; if (h > H) { h = H; w = H * g.aspect; }
      [pic, hud].forEach(c => { c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.left = (W - w) / 2 + 'px'; c.style.top = (H - h) / 2 + 'px'; });
      const dpr = Math.min(2, devicePixelRatio || 1); pic.width = Math.round(w * dpr); pic.height = Math.round(h * dpr); hud.width = pic.width; hud.height = pic.height;
      $('.vf-lens').textContent = `${st.lens}mm`; $('.vf-cam').textContent = `${CAMS[st.cam][0].split(' (')[0]} · ${Math.round(g.fovH)}° across${CAMS[st.cam][1] !== 36 ? ` · like ${g.equiv}mm on full frame` : ''}`;
      const warn = $('.vf-warn'); warn.hidden = !g.wider; if (g.wider) warn.textContent = `Wider than this phone can see. The real ${st.lens}mm frame takes in about ${g.wider.toFixed(1)}× the width shown here.`;
      $('.vf-turn').hidden = !g.portraitMismatch;
      el.querySelectorAll('[data-lens]').forEach(b => b.classList.toggle('on', +b.dataset.lens === st.lens));
      $('.vf-camsel').value = st.cam; $('.vf-framesel').value = st.frame;
      el.querySelectorAll('.vf-tog').forEach(b => b.classList.toggle('on', !!st[b.dataset.t]));
      $('.vf-sunrow').hidden = !st.sun; const mi = $('.vf-min'); mi.value = minute; $('.vf-time b').textContent = clock(minute);
      $('[data-a=align]').textContent = aligned ? 'Aligned ✓' : 'Align to sun';
      return g;
    }
    const clock = m => { const d0 = new Date(); d0.setHours(0, m, 0, 0); return d0.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
    let G = layout();

    // where the camera is pointing, from the phone's motion sensors
    const onOrient = e => {
      let a = e.alpha; if (e.webkitCompassHeading != null) a = 360 - e.webkitCompassHeading; else if (!e.absolute && e.type !== 'deviceorientationabsolute') a = null;
      if (a == null || e.beta == null) return; orient = { a, b: e.beta, g: e.gamma || 0 };
    };
    async function startSensors() {
      try { if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) { const p = await DeviceOrientationEvent.requestPermission(); if (p !== 'granted') N.toast('Allow motion access so the sun path can follow the phone'); } } catch (e) {}
      window.addEventListener('deviceorientationabsolute', onOrient, true); window.addEventListener('deviceorientation', onOrient, true);
      if (!place && navigator.geolocation) navigator.geolocation.getCurrentPosition(p => { place = { lat: p.coords.latitude, lon: p.coords.longitude }; }, () => {}, { timeout: 10000 });
      return true;
    }
    // the camera's direction (forward, right, up) in the world: east, north, up
    function basis() {
      if (!orient) return null;
      const A = orient.a * rad, B = orient.b * rad, Gm = orient.g * rad, cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B), cG = Math.cos(Gm), sG = Math.sin(Gm);
      const X = [cA * cG - sA * sB * sG, sA * cG + cA * sB * sG, -cB * sG], Y = [-sA * cB, cA * cB, sB], Z = [cA * sG + sA * sB * cG, sA * sG - cA * sB * cG, cB * cG];
      const f = Z.map(v => -v), ang = (((screen.orientation && screen.orientation.angle) || window.orientation || 0) + 360) % 360;
      const neg = v => v.map(x => -x);
      const [r, u] = ang === 90 ? [neg(Y), X] : ang === 270 ? [Y, neg(X)] : ang === 180 ? [neg(X), neg(Y)] : [X, Y];
      return { f, r, u };
    }
    const vec = (az, alt) => [Math.cos(alt * rad) * Math.sin(az * rad), Math.cos(alt * rad) * Math.cos(az * rad), Math.sin(alt * rad)];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    function project(bs, az, alt, w, h) {
      const s = vec(az - headOff, alt - elevOff), z = dot(s, bs.f); if (z <= 0.05) return null;
      const x = dot(s, bs.r) / z / Math.tan(G.fovH / 2 * rad), y = dot(s, bs.u) / z / Math.tan(G.fovV / 2 * rad);
      return [w / 2 + x * w / 2, h / 2 - y * h / 2];
    }

    function draw() {
      if (closed) return;
      if (video.readyState >= 2) { const g = G; pg.drawImage(video, g.sx, g.sy, g.cw, g.ch, 0, 0, pic.width, pic.height); }
      const w = hud.width, h = hud.height; hg.clearRect(0, 0, w, h);
      if (st.thirds) { hg.strokeStyle = 'rgba(255,255,255,.35)'; hg.lineWidth = 1; hg.beginPath(); [1, 2].forEach(i => { hg.moveTo(w * i / 3, 0); hg.lineTo(w * i / 3, h); hg.moveTo(0, h * i / 3); hg.lineTo(w, h * i / 3); }); hg.stroke(); }
      hg.strokeStyle = 'rgba(255,255,255,.8)'; hg.lineWidth = 2; hg.beginPath(); hg.moveTo(w / 2 - 12, h / 2); hg.lineTo(w / 2 + 12, h / 2); hg.moveTo(w / 2, h / 2 - 12); hg.lineTo(w / 2, h / 2 + 12); hg.stroke();
      if (st.sun) { hg.save(); hg.shadowColor = 'rgba(0,0,0,.85)'; hg.shadowBlur = 5; sunLayer(w, h); hg.restore(); }
      raf = requestAnimationFrame(draw);
    }
    function sunLayer(w, h) {
      const bs = basis(), font = Math.round(h / 28);
      hg.font = `600 ${font}px Sora, sans-serif`; hg.textAlign = 'center';
      if (!place) { hg.fillStyle = '#fff'; hg.fillText('Finding where you are…', w / 2, h * .12); return; }
      if (!bs) { hg.fillStyle = '#fff'; hg.fillText('Move the phone a little so it can find north…', w / 2, h * .12); return; }
      // compass heading along the top
      const head = (Math.atan2(bs.f[0], bs.f[1]) / rad + headOff + 360) % 360, elev = Math.asin(Math.max(-1, Math.min(1, bs.f[2]))) / rad + elevOff;
      hg.fillStyle = '#ffbd2e'; hg.fillText(`${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(head / 45) % 8]} ${Math.round(head)}°  ·  tilt ${Math.round(elev)}°`, w / 2, 6 + font * 1.1);
      const base = new Date(date + 'T00:00:00').getTime(), times = F.sunTimes(date, place.lat, place.lon); if (!times) return;
      // the day's path, with hour marks
      hg.lineWidth = Math.max(2, h / 200); hg.strokeStyle = 'rgba(255,189,46,.9)'; hg.setLineDash([h / 60, h / 90]); hg.beginPath(); let pen = false;
      for (let t = times.sunrise.getTime() - 1800000; t <= times.sunset.getTime() + 1800000; t += 600000) {
        const p = F.sunPos(new Date(t), place.lat, place.lon), q = project(bs, p.az, p.alt, w, h);
        if (q) { pen ? hg.lineTo(q[0], q[1]) : hg.moveTo(q[0], q[1]); pen = true; } else pen = false;
      }
      hg.stroke(); hg.setLineDash([]);
      for (let hr = Math.ceil(times.sunrise.getHours()); hr <= times.sunset.getHours(); hr++) {
        const t = new Date(base); t.setHours(hr, 0, 0, 0); const p = F.sunPos(t, place.lat, place.lon), q = project(bs, p.az, p.alt, w, h); if (!q) continue;
        hg.fillStyle = '#ffbd2e'; hg.beginPath(); hg.arc(q[0], q[1], font / 4, 0, 7); hg.fill(); hg.fillStyle = '#fff'; hg.fillText(new Date(t).toLocaleTimeString([], { hour: 'numeric' }), q[0], q[1] - font * .6);
      }
      // the sun at the chosen time, and the horizon
      const at = new Date(base + minute * 60000), p = F.sunPos(at, place.lat, place.lon), q = project(bs, p.az, p.alt, w, h);
      const hz1 = project(bs, head - G.fovH, 0, w, h), hz2 = project(bs, head + G.fovH, 0, w, h);
      if (hz1 && hz2) { hg.strokeStyle = 'rgba(255,255,255,.4)'; hg.lineWidth = 1; hg.beginPath(); hg.moveTo(hz1[0], hz1[1]); hg.lineTo(hz2[0], hz2[1]); hg.stroke(); }
      const inside = q && q[0] > -font && q[0] < w + font && q[1] > -font && q[1] < h + font;
      if (inside) { const r = font * 1.2; const gr = hg.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 2.4); gr.addColorStop(0, 'rgba(255,226,122,1)'); gr.addColorStop(.4, 'rgba(255,189,46,.7)'); gr.addColorStop(1, 'rgba(255,189,46,0)');
        hg.fillStyle = gr; hg.beginPath(); hg.arc(q[0], q[1], r * 2.4, 0, 7); hg.fill(); hg.fillStyle = '#fff'; hg.fillText(clock(minute), q[0], q[1] + r * 2.4 + font * .4); }
      else { const dx = ((p.az - head + 540) % 360) - 180; hg.fillStyle = '#ffbd2e'; hg.fillText(p.alt < 0 ? `The sun is down at ${clock(minute)}` : Math.abs(dx) < G.fovH / 2 ? `☀ at ${clock(minute)} is ${p.alt - elev > 0 ? 'above ↑' : 'below ↓'} the frame` : `☀ at ${clock(minute)} is ${dx > 0 ? 'to your right →' : '← to your left'} (${Math.abs(Math.round(dx))}°)`, w / 2, h - font * 1.2); }
      if (!aligned) { hg.fillStyle = 'rgba(255,255,255,.75)'; hg.font = `400 ${Math.round(font * .8)}px Sora, sans-serif`; hg.fillText('Rough until aligned: point the + at the real sun and tap Align to sun', w / 2, h - font * (inside ? .6 : 2.6)); }
    }

    const onResize = () => { G = layout(); };
    window.addEventListener('resize', onResize); if (screen.orientation) screen.orientation.addEventListener('change', onResize);
    video.addEventListener('loadedmetadata', onResize); setTimeout(onResize, 400);
    raf = requestAnimationFrame(draw);
    if (st.sun) startSensors();

    function close() { closed = true; cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); window.removeEventListener('deviceorientationabsolute', onOrient, true); window.removeEventListener('deviceorientation', onOrient, true);
      window.removeEventListener('resize', onResize); document.removeEventListener('keydown', key, true); el.remove(); document.body.classList.remove('sketching'); keep(); }
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } if (e.key === ' ' ) { e.preventDefault(); e.stopPropagation(); snap(); } };
    document.addEventListener('keydown', key, true);

    el.addEventListener('click', async e => {
      const t = e.target;
      const lb = t.closest('[data-lens]'); if (lb) { if (lb.dataset.lens === 'custom') { const v = await F.ask('Focal length', 'Millimetres, for example 40', String(st.lens)); const n = parseFloat(v); if (n >= 4 && n <= 1200) st.lens = n; } else st.lens = +lb.dataset.lens; G = layout(); keep(); return; }
      const tg = t.closest('.vf-tog'); if (tg) { const k = tg.dataset.t; st[k] = !st[k]; if (k === 'sun' && st.sun && !(await startSensors())) st.sun = false; G = layout(); keep(); return; }
      const a = t.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'close') return close();
      if (a.dataset.a === 'snap') return snap();
      if (a.dataset.a === 'set') { const v = await F.ask('Your phone’s camera', 'Its main lens in full-frame millimetres. Most phones are 24 to 26.', String(st.phone)); const n = parseFloat(v); if (n >= 12 && n <= 40) { st.phone = n; G = layout(); keep(); } return; }
      if (a.dataset.a === 'align') {
        const bs = basis(); if (!bs || !place) return N.toast('Turn on the sun path and wait for the compass first');
        const now = F.sunPos(new Date(), place.lat, place.lon); if (now.alt < -1) return N.toast('The sun is down. Align when you can see it.');
        const head = Math.atan2(bs.f[0], bs.f[1]) / rad, elev = Math.asin(Math.max(-1, Math.min(1, bs.f[2]))) / rad;
        headOff = ((now.az - head + 540) % 360) - 180; elevOff = now.alt - elev; aligned = true; G = layout();
        N.toast(`Aligned. The compass was out by ${Math.abs(Math.round(headOff))}°`); return;
      }
    });
    el.addEventListener('change', e => {
      if (e.target.classList.contains('vf-camsel')) { st.cam = +e.target.value; G = layout(); keep(); }
      if (e.target.classList.contains('vf-framesel')) { st.frame = +e.target.value; G = layout(); keep(); }
      if (e.target.classList.contains('vf-date')) date = e.target.value || date;
    });
    el.addEventListener('input', e => { if (e.target.classList.contains('vf-min')) { minute = +e.target.value; $('.vf-time b').textContent = clock(minute); } });

    // snap: the framed picture (without the guides) goes to a shot, a location, or a download
    async function snap() {
      const sh = document.createElement('canvas'), g = G, scale = Math.min(1, 2400 / g.cw); sh.width = Math.round(g.cw * scale); sh.height = Math.round(g.ch * scale);
      sh.getContext('2d').drawImage(video, g.sx, g.sy, g.cw, g.ch, 0, 0, sh.width, sh.height);
      el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 220);
      const blob = await new Promise(r => sh.toBlob(r, 'image/jpeg', .9)); if (!blob) return;
      const bs = basis(), heading = bs ? Math.round((Math.atan2(bs.f[0], bs.f[1]) / rad + headOff + 360) % 360) : null, lensTxt = `${st.lens}mm`;
      const meta = { t: Date.now(), heading, lens: lensTxt, cam: CAMS[st.cam][0].split(' (')[0], frame: FRAMES[st.frame][0] };
      if (opt.mode === 'shot' && opt.save) { close(); await opt.save(blob, meta); N.toast('Frame saved on the shot'); return; }
      if (opt.mode === 'scout' && opt.location) { const media = await N.Store.putMedia(blob); F.addLocationPhoto(opt.location, { media, ...meta, lat: place && place.lat, lon: place && place.lon }); N.toast('Saved to the location. Keep scouting.'); return; }
      // otherwise ask where it goes
      const dd = F.data(), shots = dd ? F.allShots() : [], locs = dd ? (dd.locations || []) : [];
      const m = N.modal(`<h2>Keep this frame</h2><p>${esc(lensTxt)} on ${esc(meta.cam)}${heading != null ? `, facing ${heading}°` : ''}.</p>
        ${shots.length ? `<label>Use as the storyboard frame for<select id="vfShot"><option value="">Choose a shot…</option>${shots.map(x => `<option value="${esc(x.c.id)}">${esc(x.c.scene + x.c.letter)} ${esc(x.c.text || x.c.size || '')}</option>`).join('')}</select></label>` : ''}
        ${locs.length ? `<label>Or save as a scouting photo of<select id="vfLoc"><option value="">Choose a location…</option>${locs.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></label>` : ''}
        <div class="row"><button class="pri" id="vfKeep">Save</button><button id="vfDl">Download</button><button data-close>Discard</button></div>`);
      m.querySelector('[data-close]').onclick = N.closeOv;
      m.querySelector('#vfDl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `frame ${lensTxt}.jpg`; document.body.append(a); a.click(); a.remove(); N.closeOv(); };
      m.querySelector('#vfKeep').onclick = async () => {
        const sid = m.querySelector('#vfShot') && m.querySelector('#vfShot').value, lid = m.querySelector('#vfLoc') && m.querySelector('#vfLoc').value;
        if (!sid && !lid) return N.toast('Choose a shot or a location, or Download');
        const media = await N.Store.putMedia(blob);
        if (sid) { const x = F.allShots().find(y => y.c.id === sid); if (x) { N.snap(); x.c.frame = media; x.c.lens = lensTxt; N.touch(); N.render(); } }
        if (lid) F.addLocationPhoto(lid, { media, ...meta, lat: place && place.lat, lon: place && place.lon });
        N.closeOv(); N.toast('Saved');
      };
    }
  };

  // the viewfinder is one of the ways to make a shot's storyboard frame
  if (F && F.pickFrame) {
    const base = F.pickFrame;
    F.pickFrame = async (c, save) => {
      await base(c, save);
      const row = document.querySelector('#dlg .row'); if (!row || !navigator.mediaDevices) return;
      const b = document.createElement('button'); b.id = 'skVf'; b.textContent = 'Frame it with the viewfinder';
      b.onclick = () => { N.closeOv(); N.viewfinder({ mode: 'shot', lens: c.lens, save: (blob, meta) => { if (meta.lens) c.lens = meta.lens; return save(blob); } }); };
      row.insertBefore(b, row.lastElementChild);
    };
  }
})();
