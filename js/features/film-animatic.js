/* Animatic: plays the storyboard frames in shot order, each for as long as you set,
   with an optional voice-over recorded while it plays. Save it as a video to send to the team. */
(function () {
  const N = window.N, F = N.film, esc = N.esc, S = N.S;
  const label = c => `${c.scene || '?'}${c.letter || ''}`;
  const DEF = 3;
  const order = list => list.slice().sort((a, b) => String(a.c.scene).localeCompare(String(b.c.scene), undefined, { numeric: true }) || String(a.c.letter).localeCompare(String(b.c.letter)));
  const dur = c => Math.max(0.5, +c.dur || DEF);

  async function open() {
    const d = F.data(); if (!d) return;
    const all = order(F.allShots());
    if (!all.length) return N.toast('Add Shot cards first. Each shot becomes a frame of the animatic.');
    const scenes = [...new Set(all.map(x => String(x.c.scene || '?')))];
    let scene = 'all', i = 0, t0 = 0, playing = false, raf = 0, voice = null, rec = null;
    const list = () => scene === 'all' ? all : all.filter(x => String(x.c.scene) === scene);
    const imgs = new Map();
    await Promise.all(all.map(async ({ c }) => { if (!c.frame) return; const u = await N.Store.mediaUrl(c.frame); if (!u) return; const im = new Image(); im.src = u; await im.decode().catch(() => {}); imgs.set(c.id, im); }));
    d.animatic = d.animatic || {};
    const el = document.createElement('div'); el.className = 'fws anim'; document.body.append(el); document.body.classList.add('filming');
    el.innerHTML = `<header class="fhead"><div class="ftitle"><b>Animatic · ${esc(d.title)}</b></div><span class="spacer"></span>
        <label class="fpsl">Scenes<select id="anScene"><option value="all">All scenes</option>${scenes.map(s => `<option value="${esc(s)}">Scene ${esc(s)}</option>`).join('')}</select></label>
        <button class="ib" id="anVoice">Record voice-over</button><button class="ib" id="anSave">Save as video</button><button class="ib" id="anClose">Done</button></header>
      <div class="an"><div class="an-main"><canvas id="anC" width="1280" height="720"></canvas>
        <div class="an-bar"><button class="ib" id="anPlay" aria-label="Play">▶</button><div class="an-track" id="anTrack"></div><span id="anTime">0:00</span></div></div>
        <aside class="an-list"><h3>Shots and timing</h3><p class="fhint">Seconds each shot stays on screen.</p><ol id="anList"></ol></aside></div>`;
    const cv = el.querySelector('#anC'), g = cv.getContext('2d');
    const total = () => list().reduce((n, x) => n + dur(x.c), 0);
    const at = t => { let acc = 0; const L = list(); for (let k = 0; k < L.length; k++) { if (t < acc + dur(L[k].c)) return { k, into: t - acc }; acc += dur(L[k].c); } return { k: L.length - 1, into: dur(L[L.length - 1].c) }; };
    const startOf = k => list().slice(0, k).reduce((n, x) => n + dur(x.c), 0);
    const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    function paint(ctx, k, into) {
      const L = list(), x = L[k]; if (!x) return; const c = x.c, im = imgs.get(c.id);
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 1280, 720);
      if (im) { const s = Math.min(1280 / im.naturalWidth, 720 / im.naturalHeight), z = 1 + 0.03 * (into / dur(c)); ctx.save(); ctx.translate(640, 360); ctx.scale(z, z); ctx.drawImage(im, -im.naturalWidth * s / 2, -im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s); ctx.restore(); }
      else { ctx.fillStyle = '#2a2c3d'; ctx.fillRect(80, 60, 1120, 600); ctx.fillStyle = '#c9cbe0'; ctx.font = '600 34px Sora, sans-serif'; ctx.textAlign = 'center'; wrap(ctx, c.text || 'No frame yet', 640, 340, 900, 44); ctx.textAlign = 'left'; }
      // caption
      ctx.fillStyle = 'rgba(10,10,20,.62)'; ctx.fillRect(0, 640, 1280, 80);
      ctx.fillStyle = '#ffbd2e'; ctx.font = '700 30px Sora, sans-serif'; ctx.fillText(label(c), 32, 691);
      ctx.fillStyle = '#fff'; ctx.font = '400 24px Sora, sans-serif'; const spec = [c.size, c.lens, c.move].filter(Boolean).join(' · ');
      ctx.fillText(((spec ? spec + '  —  ' : '') + (c.text || '')).slice(0, 90), 32 + ctx.measureText(label(c)).width + 120, 690);
    }
    function wrap(ctx, text, x, y, w, lh) { const words = text.split(/\s+/); let line = '', lines = []; words.forEach(wd => { if (ctx.measureText(line + wd).width > w && line) { lines.push(line); line = ''; } line += wd + ' '; }); lines.push(line); lines.forEach((l, j) => ctx.fillText(l.trim(), x, y + (j - (lines.length - 1) / 2) * lh)); }
    function drawList() {
      const L = list(), tt = total();
      el.querySelector('#anList').innerHTML = L.map((x, k) => `<li class="${k === i ? 'on' : ''}" data-k="${k}"><button class="an-go" data-go="${k}"><b>${esc(label(x.c))}</b><span>${esc(x.c.text || x.c.size || '')}</span></button><input type="number" min="0.5" max="60" step="0.5" value="${dur(x.c)}" data-dur="${esc(x.c.id)}" aria-label="Seconds for shot ${esc(label(x.c))}" ${N.P.canWrite ? '' : 'readonly'}></li>`).join('');
      el.querySelector('#anTrack').innerHTML = L.map((x, k) => `<button class="seg-${k === i ? 'on' : 'off'}" data-go="${k}" style="flex:${dur(x.c)}" title="${esc(label(x.c))}"></button>`).join('') + `<i id="anHead"></i>`;
      el.querySelector('#anTime').textContent = `${mmss(startOf(i))} / ${mmss(tt)}`;
    }
    const head = t => { const h = el.querySelector('#anHead'); if (h) h.style.left = (t / (total() || 1) * 100) + '%'; };
    function show(t) { const p = at(t); if (p.k !== i) { i = p.k; drawList(); } paint(g, p.k, p.into); head(t); el.querySelector('#anTime').textContent = `${mmss(t)} / ${mmss(total())}`; }
    let start = 0, from = 0;
    function loop(now) { const t = from + (now - start) / 1000; if (t >= total()) { stop(); show(Math.max(0, total() - 0.001)); return; } show(t); raf = requestAnimationFrame(loop); }
    async function play(t = startOf(i)) {
      playing = true; from = t; start = performance.now(); el.querySelector('#anPlay').textContent = '❚❚';
      if (d.animatic.voice && scene === 'all' && !rec) { const u = await N.Store.mediaUrl(d.animatic.voice); if (u) { voice = new Audio(u); voice.currentTime = t; voice.play().catch(() => {}); } }
      raf = requestAnimationFrame(loop);
    }
    function stop() { playing = false; cancelAnimationFrame(raf); el.querySelector('#anPlay').textContent = '▶'; if (voice) { voice.pause(); voice = null; } if (rec) rec.stop(); }
    const jump = k => { const was = playing; stop(); i = k; drawList(); show(startOf(k)); if (was) play(); };
    drawList(); show(0);
    el.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('#anClose')) return close();
      if (t.closest('#anPlay')) return playing ? stop() : play(startOf(i));
      const go = t.closest('[data-go]'); if (go) return jump(+go.dataset.go);
      if (t.closest('#anVoice')) return recordVoice();
      if (t.closest('#anSave')) return saveVideo();
    });
    el.addEventListener('change', e => {
      if (e.target.id === 'anScene') { stop(); scene = e.target.value; i = 0; drawList(); show(0); }
      if (e.target.dataset.dur) { const x = all.find(y => y.c.id === e.target.dataset.dur); if (x && N.P.canWrite) { N.snap(); x.c.dur = Math.max(0.5, Math.min(60, +e.target.value || DEF)); N.touch(); drawList(); show(startOf(i)); } }
    });
    const key = e => { if (/INPUT|SELECT/.test(document.activeElement.tagName)) return; if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); playing ? stop() : play(); } else if (e.key === 'ArrowRight') { e.stopPropagation(); jump(Math.min(list().length - 1, i + 1)); } else if (e.key === 'ArrowLeft') { e.stopPropagation(); jump(Math.max(0, i - 1)); } else if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', key, true);
    function close() { stop(); document.removeEventListener('keydown', key, true); el.remove(); document.body.classList.remove('filming'); if (F.isOpen()) F.refresh(); }

    async function recordVoice() {
      if (scene !== 'all') { el.querySelector('#anScene').value = 'all'; scene = 'all'; i = 0; drawList(); }
      let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return N.toast('Itàn needs the microphone to record a voice-over'); }
      stop(); const chunks = []; const mr = new MediaRecorder(stream); mr.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
      rec = { stop: () => { if (mr.state !== 'inactive') mr.stop(); } };
      mr.onstop = async () => { stream.getTracks().forEach(x => x.stop()); rec = null; el.querySelector('#anVoice').textContent = 'Record voice-over'; el.classList.remove('recording');
        if (!chunks.length) return; const id = await N.Store.putMedia(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); N.snap(); d.animatic.voice = id; N.touch(); N.toast('Voice-over saved. It plays with the animatic.'); };
      el.querySelector('#anVoice').textContent = 'Recording… tap ■ to stop'; el.classList.add('recording');
      mr.start(); i = 0; drawList(); play(0);
    }
    async function saveVideo() {
      if (!window.MediaRecorder || !cv.captureStream) return N.toast('This browser can’t save video. Try Chrome or Edge.');
      stop(); i = 0; drawList();
      const vs = cv.captureStream(30); let ac = null, src = null;
      if (d.animatic.voice && scene === 'all') { const u = await N.Store.mediaUrl(d.animatic.voice); if (u) { ac = new AudioContext(); const a = new Audio(u); a.crossOrigin = 'anonymous'; src = { a, node: ac.createMediaElementSource(a) }; const dest = ac.createMediaStreamDestination(); src.node.connect(dest); dest.stream.getAudioTracks().forEach(tr => vs.addTrack(tr)); } }
      const type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      const mr = new MediaRecorder(vs, type ? { mimeType: type, videoBitsPerSecond: 6e6 } : undefined), chunks = [];
      mr.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
      const done = new Promise(r => mr.onstop = r);
      N.status('Saving the animatic… it plays through once'); el.classList.add('recording');
      mr.start(); if (src) src.a.play().catch(() => {});
      await new Promise(r => { const t0 = performance.now(), T = total(); const step = now => { const t = (now - t0) / 1000; if (t >= T) return r(); show(t); requestAnimationFrame(step); }; requestAnimationFrame(step); });
      mr.stop(); if (src) src.a.pause(); await done; if (ac) ac.close();
      el.classList.remove('recording'); N.settled();
      const ext = (mr.mimeType || '').includes('mp4') ? 'mp4' : 'webm', a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'video/webm' })); a.download = `${d.title || 'Film'} animatic.${ext}`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      N.toast('Animatic saved as a video');
    }
  }
  F.openAnimatic = open;

  // a Play animatic button on the Shots tab
  N.hooks.ready.push(() => {
    const t = F.tabs.find(x => x.id === 'shots'); if (!t || t._anim) return; t._anim = true;
    const base = t.render;
    t.render = function (el, d) { base.call(this, el, d); const act = el.querySelector('.sl-act'); if (act && F.allShots().length) { act.insertAdjacentHTML('afterbegin', '<button class="pri" id="anOpen">▶ Play animatic</button>'); act.querySelector('#anOpen').onclick = open; } };
  });
})();
