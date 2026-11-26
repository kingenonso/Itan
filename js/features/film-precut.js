/* The Pre-cut: watch the film before you shoot it.
   Itàn lays the storyboard frames along the script, and times them with the actors' real voices from the table read:
   each frame stays on screen for exactly as long as its lines take to say, and action is timed by reading pace.
   You get a rough, watchable film with real performances, the runtime of every scene, and the scenes that play
   long for their page count, before a single day is shot. Save it as a video for investors. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const WIDE = /wide|full|establish|aerial/i;
  const words = t => (String(t || '').match(/\S+/g) || []).length;
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const hms = s => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round(s % 3600 / 60)}m` : `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
  const buffers = new Map(); let ac = null;
  const ctx = () => (ac = ac || new (window.AudioContext || window.webkitAudioContext)());

  // the voices from the table read, decoded once (their length is the timing)
  async function decodeTakes(d, keys, onProg) {
    let n = 0;
    for (const k of keys) { const tk = F.readTake && F.readTake(d, k); if (!tk || buffers.has(tk.media)) { n++; continue; }
      try { const u = await F.readSrc(d, tk), buf = await (await fetch(u)).arrayBuffer(); buffers.set(tk.media, await ctx().decodeAudioData(buf)); } catch (e) { buffers.set(tk.media, null); }
      onProg && onProg(++n, keys.length); }
  }

  // the timeline: every script line becomes a moment, with the shot that covers it on screen
  F.precut = d => {
    const lines = F.readLines ? F.readLines(d) : [], keyOf = new Map(lines.filter(l => l.id).map(l => [l.id, l])), scenes = F.scriptScenes ? F.scriptScenes(d) : [];
    const bd = F.sortScenes(d), events = []; let t = 0; const report = [];
    scenes.forEach(sc => {
      const shots = F.allShots().map(x => x.c).filter(c => String(c.scene) === String(sc.num)).sort((a, b) => String(a.letter).localeCompare(String(b.letter)));
      const ids = sc.lines.map(l => l.id), range = c => { if (!c.cover) return null; const a = ids.indexOf(c.cover.from), b = ids.indexOf(c.cover.to); return a < 0 || b < 0 ? null : [Math.min(a, b), Math.max(a, b)]; };
      const counted = sc.lines.map((l, k) => [l, k]).filter(([l]) => (l.t === 'action' || l.t === 'dial') && (l.x || '').trim());
      let speaker = null; const start = t, info = bd.find(x => String(x.num) === String(sc.num)) || {};
      let est = 0, real = 0;
      events.push({ kind: 'slug', start: t, dur: 1.4, scene: sc.num, text: sc.head.x, shot: shots[0] || null }); t += 1.4;
      sc.lines.forEach((l, k) => {
        if (l.t === 'char') { speaker = String(l.x || '').replace(/\s*\(.*\)/, '').trim().toUpperCase(); return; }
        if (l.t !== 'dial' && l.t !== 'paren') speaker = l.t === 'action' || l.t === 'trans' ? null : speaker;
        if (!(l.t === 'action' || l.t === 'dial') || !(l.x || '').trim()) return;
        // which shot is on screen for this line
        const cov = shots.filter(c => { const r = range(c); return r && k >= r[0] && k <= r[1]; });
        let shot = null;
        if (cov.length) shot = (l.t === 'dial' && speaker && cov.find(c => !WIDE.test(c.size || '') && (c.text || '').toUpperCase().includes(speaker))) || cov.slice().sort((a, b) => { const ra = range(a), rb = range(b); return (ra[1] - ra[0]) - (rb[1] - rb[0]); })[0];
        else if (shots.length) shot = shots[Math.min(shots.length - 1, Math.floor(counted.findIndex(([, j]) => j === k) / Math.max(1, counted.length) * shots.length))];
        let dur, take = null, kind = l.t === 'dial' ? 'line' : 'action';
        if (kind === 'line') { const rl = keyOf.get(l.id), tk = rl && F.readTake ? F.readTake(d, rl.k) : null, buf = tk ? buffers.get(tk.media) : null;
          if (buf) { dur = buf.duration + 0.25; take = buf; real += dur; } else { dur = Math.max(1.2, words(l.x) / 2.6 + 0.4); est += dur; } }
        else { dur = Math.min(14, Math.max(1.6, words(l.x) / 2.4)); }
        events.push({ kind, start: t, dur, scene: sc.num, text: l.x, char: kind === 'line' ? speaker : '', shot, take }); t += dur;
      });
      const secs = t - start, pages = (info.pages || 0) / 8;
      report.push({ num: sc.num, head: sc.head.x, start, secs, pages, est, real, perPage: pages ? secs / 60 / pages : null });
    });
    return { events, total: t, report };
  };

  /* ---------- drawing a moment ---------- */
  const imgs = new Map();
  async function loadFrames(evs) { for (const e of evs) { const c = e.shot; if (!c || !c.frame || imgs.has(c.frame)) continue; const u = await N.Store.mediaUrl(c.frame); if (!u) { imgs.set(c.frame, null); continue; } const im = new Image(); im.src = u; await im.decode().catch(() => {}); imgs.set(c.frame, im); } }
  function wrap(g, text, x, y, w, lh, max = 3) { const ws = String(text).split(/\s+/); let line = '', out = []; ws.forEach(wd => { if (g.measureText(line + wd).width > w && line) { out.push(line); line = ''; } line += wd + ' '; }); out.push(line); out.slice(0, max).forEach((l, j) => g.fillText(l.trim(), x, y + j * lh)); return Math.min(out.length, max); }
  function paint(g, P, t, opt) {
    const W = 1280, H = 720, i = Math.max(0, P.events.findIndex(e => t < e.start + e.dur)), e = P.events[i] || P.events[P.events.length - 1]; if (!e) return e;
    const c = e.shot, im = c && c.frame ? imgs.get(c.frame) : null;
    g.fillStyle = '#0d0d10'; g.fillRect(0, 0, W, H);
    if (im) { // a slow push on each shot, like a camera breathing
      let s0 = i; while (s0 > 0 && P.events[s0 - 1].shot === c) s0--; let s1 = i; while (s1 < P.events.length - 1 && P.events[s1 + 1].shot === c) s1++;
      const a = P.events[s0].start, b = P.events[s1].start + P.events[s1].dur, z = 1 + 0.04 * Math.min(1, (t - a) / Math.max(1, b - a));
      const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * z; g.drawImage(im, (W - im.naturalWidth * s) / 2, (H - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
    } else { g.fillStyle = '#1d1e27'; g.fillRect(0, 0, W, H); g.fillStyle = '#8f91a8'; g.font = '600 30px Sora, sans-serif'; g.textAlign = 'center'; wrap(g, c ? `${c.scene}${c.letter || ''} · ${[c.size, c.text].filter(Boolean).join(' — ') || 'No frame drawn yet'}` : 'No shots planned for this scene yet', W / 2, H / 2 - 30, 900, 42); g.textAlign = 'left'; }
    // scene title at the start of each scene
    const sl = P.events.slice(0, i + 1).reverse().find(x => x.kind === 'slug');
    if (sl && t - sl.start < 3) { const a = Math.min(1, 3 - (t - sl.start)); g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, 86); g.fillStyle = '#ffbd2e'; g.font = '800 26px Sora, sans-serif'; g.fillText(`SCENE ${sl.scene}`, 40, 52); g.fillStyle = '#fff'; g.font = '600 26px Sora, sans-serif'; g.fillText(String(sl.text).slice(0, 70), 210, 52); g.globalAlpha = 1; }
    // subtitles
    if (opt.subs && (e.kind === 'line' || (e.kind === 'action' && opt.action))) {
      g.font = e.kind === 'line' ? '600 30px Sora, sans-serif' : 'italic 400 25px Sora, sans-serif'; g.textAlign = 'center';
      const txt = e.kind === 'line' ? e.text : e.text, n = Math.min(3, Math.ceil(g.measureText(txt).width / 1050)), y = H - 40 - (n - 1) * 38;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(90, y - 66, W - 180, 54 + n * 38);
      if (e.kind === 'line') { g.fillStyle = '#ffbd2e'; g.font = '700 20px Sora, sans-serif'; g.fillText(e.char || '', W / 2, y - 36); g.font = '600 30px Sora, sans-serif'; }
      g.fillStyle = e.kind === 'line' ? '#fff' : '#d8d8e2'; wrap(g, txt, W / 2, y, 1050, 38); g.textAlign = 'left';
    }
    if (opt.marks) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(W - 210, 14, 196, 34); g.fillStyle = '#fff'; g.font = '600 17px Sora, sans-serif'; g.fillText(`${c ? c.scene + (c.letter || '') : '—'}   ${mmss(t)} / ${mmss(P.total)}`, W - 198, 37); if (e.kind === 'line' && !e.take) { g.fillStyle = '#ff9b91'; g.font = '600 14px Sora, sans-serif'; g.fillText('not recorded yet · timed by length', W - 270, 70); } }
    return e;
  }

  /* ---------- the tab ---------- */
  let P = null, playing = null, pos = 0, opt = { subs: true, action: false, marks: true, narr: false };
  F.tabs.push({ id: 'precut', label: 'Pre-cut', order: 8, render(el, d) {
    const lines = F.readLines ? F.readLines(d) : [];
    if (!lines.some(l => l.t === 'dial' || l.t === 'action')) { el.innerHTML = `<div class="fwrap"><div class="empty-row big">The Pre-cut is made from the script, the storyboard and the table read. Write or open the script first.</div><div class="row" style="justify-content:center"><button class="pri" data-ftab="script">Go to Script</button></div></div>`; return; }
    el.innerHTML = `<div class="fwrap wide pc"><div class="rp-bar"><div><b class="tr-big" id="pcTotal">…</b> <span class="fhint">estimated running time</span></div><div class="cs-act">
        <label class="tr-tog"><input type="checkbox" data-o="subs"${opt.subs ? ' checked' : ''}> Subtitles</label><label class="tr-tog"><input type="checkbox" data-o="action"${opt.action ? ' checked' : ''}> Show action</label><label class="tr-tog"><input type="checkbox" data-o="narr"${opt.narr ? ' checked' : ''}> Narrator reads action</label>
        <button class="ib" id="pcSave">Save as video</button></div></div>
      <div class="pc-two"><div class="pc-main"><canvas id="pcC" width="1280" height="720"></canvas><div class="an-bar"><button class="ib" id="pcPlay" aria-label="Play">▶</button><div class="pc-track" id="pcTrack"></div><span id="pcTime">0:00</span></div>
        <p class="fhint" id="pcNote"></p></div>
      <aside class="pc-rep"><h3>Scene by scene</h3><ol id="pcRep"></ol></aside></div></div>`;
    const cv = el.querySelector('#pcC'), g = cv.getContext('2d');
    const build = async () => {
      const keys = lines.filter(l => l.t === 'dial').map(l => l.k);
      g.fillStyle = '#0d0d10'; g.fillRect(0, 0, 1280, 720); g.fillStyle = '#fff'; g.font = '600 28px Sora, sans-serif'; g.textAlign = 'center'; g.fillText('Putting the Pre-cut together…', 640, 360); g.textAlign = 'left';
      await decodeTakes(d, keys, (n, all) => { g.fillStyle = '#0d0d10'; g.fillRect(0, 380, 1280, 60); g.fillStyle = '#aaa'; g.font = '20px Sora, sans-serif'; g.textAlign = 'center'; g.fillText(`Measuring the table read: ${n} of ${all} lines`, 640, 410); g.textAlign = 'left'; });
      P = F.precut(d); await loadFrames(P.events); pos = Math.min(pos, P.total);
      const rec = lines.filter(l => l.t === 'dial' && F.readTake && F.readTake(d, l.k)).length, all = keys.length, framed = new Set(P.events.filter(e => e.shot && e.shot.frame).map(e => e.shot.id)).size, shots = new Set(P.events.filter(e => e.shot).map(e => e.shot.id)).size;
      el.querySelector('#pcTotal').textContent = hms(P.total);
      el.querySelector('#pcNote').innerHTML = `${rec} of ${all} lines use the actors’ voices${rec < all ? ' (the rest are timed by length)' : ''} · ${framed} of ${shots} shots have a storyboard frame. ${rec < all ? '<button class="linkish" data-ftab="tableread">Record more in the Table read</button>' : ''}${framed < shots ? ' <button class="linkish" data-ftab="shots">Draw frames</button>' : ''}`;
      const max = Math.max(...P.report.map(r => r.secs));
      el.querySelector('#pcRep').innerHTML = P.report.map(r => { const flag = r.perPage == null ? '' : r.perPage > 1.6 ? 'long' : r.perPage < 0.55 ? 'fast' : '';
        return `<li class="${flag}"><button data-seek="${r.start}"><b>${esc(r.num)}</b><span>${esc(r.head)}</span><em>${mmss(r.secs)}</em></button><i class="dk-bar"><em style="width:${r.secs / max * 100}%"></em></i>${flag ? `<small>${flag === 'long' ? `Plays long: ${r.perPage.toFixed(1)} min a page` : `Plays fast: ${r.perPage.toFixed(1)} min a page`}</small>` : r.pages ? `<small>${r.perPage.toFixed(1)} min a page</small>` : ''}${r.est > r.secs * 0.5 ? '<small class="pc-est">mostly estimated</small>' : ''}</li>`; }).join('');
      el.querySelector('#pcTrack').innerHTML = P.report.map(r => `<button data-seek="${r.start}" style="flex:${r.secs}" title="Scene ${esc(r.num)} · ${mmss(r.secs)}"></button>`).join('') + '<i id="pcHead"></i>';
      show(pos);
    };
    const show = t => { if (!P) return; const e = paint(g, P, t, opt); const h = el.querySelector('#pcHead'); if (h) h.style.left = (t / (P.total || 1) * 100) + '%'; el.querySelector('#pcTime').textContent = `${mmss(t)} / ${mmss(P.total)}`; return e; };
    const stop = () => { if (!playing) return; playing.stop = true; playing.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); try { speechSynthesis.cancel(); } catch (e) {} cancelAnimationFrame(playing.raf); playing = null; const b = el.querySelector('#pcPlay'); if (b) b.textContent = '▶'; };
    const play = (from = pos, dest) => new Promise(res => {
      stop(); const a = ctx(); a.resume(); const t0 = a.currentTime + 0.15, srcs = [], me = playing = { srcs, stop: false, res };
      P.events.forEach(e => { if (!e.take || e.start + e.dur < from) return; const s = a.createBufferSource(); s.buffer = e.take; s.connect(dest || a.destination); const off = Math.max(0, from - e.start); if (off < e.take.duration) { s.start(t0 + Math.max(0, e.start - from), off); srcs.push(s); } });
      let lastE = null; el.querySelector('#pcPlay').textContent = '❚❚';
      const loop = () => { if (me.stop) return res(); pos = from + Math.max(0, a.currentTime - t0); if (pos >= P.total) { pos = 0; stop(); show(P.total - 0.01); return res(); }
        const e = show(pos); if (opt.narr && !dest && e && e !== lastE && e.kind === 'action') { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(e.text); u.rate = 1.15; speechSynthesis.speak(u); } catch (x) {} } lastE = e;
        me.raf = requestAnimationFrame(loop); };
      me.raf = requestAnimationFrame(loop);
    });
    el.onclick = async e => { const t = e.target;
      if (t.closest('#pcPlay')) { if (!P) return; if (playing) { stop(); return; } play(pos >= P.total - 0.1 ? 0 : pos); return; }
      const sk = t.closest('[data-seek]'); if (sk && P) { const was = !!playing; stop(); pos = +sk.dataset.seek; show(pos); if (was) play(pos); return; }
      if (t.closest('#pcSave')) return save();
    };
    el.querySelector('#pcTrack').addEventListener('click', e => { if (e.target.closest('[data-seek]') || !P) return; const r = e.currentTarget.getBoundingClientRect(); const was = !!playing; stop(); pos = (e.clientX - r.left) / r.width * P.total; show(pos); if (was) play(pos); });
    el.onchange = e => { const k = e.target.dataset.o; if (k) { opt[k] = e.target.checked; if (!playing) show(pos); } };
    async function save() {
      if (!P) return; if (!window.MediaRecorder || !cv.captureStream) return N.toast('This browser can’t save video. Try Chrome or Edge.');
      if (!(await N.confirmBox(`Save the Pre-cut as a video? It plays through once in real time (${hms(P.total)}). Keep this tab open until it finishes.`, 'Save video'))) return;
      const a = ctx(), dest = a.createMediaStreamDestination(), vs = cv.captureStream(30), stream = new MediaStream([...vs.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const type = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(x => MediaRecorder.isTypeSupported(x)) || '';
      const mr = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 5e6 } : undefined), chunks = []; mr.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
      const done = new Promise(r => mr.onstop = r); el.classList.add('recording'); N.status('Saving the Pre-cut… it plays through once');
      mr.start(1000); pos = 0; await play(0, dest); mr.stop(); await done; el.classList.remove('recording'); N.settled();
      const ext = (mr.mimeType || '').includes('mp4') ? 'mp4' : 'webm', link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'video/webm' })); link.download = `${d.title} pre-cut.${ext}`; document.body.append(link); link.click(); link.remove();
      N.toast('Pre-cut saved as a video');
    }
    build();
  } });
  F.setStage('precut', 'story');
  // stop the sound when you leave the tab
  N.hooks.render.push(() => { if (playing && !(F.isOpen() && F.tab() === 'precut')) { playing.stop = true; playing.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); playing = null; } });
})();
