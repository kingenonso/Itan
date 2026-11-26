/* Table read: hear the film before you shoot it.
   Share one link. Each actor picks their character and records their lines on their phone, with the line before
   as their cue. Itàn puts every recording in script order, and plays the whole script back like a radio play:
   the actors' voices for dialogue, a narrator (the device's voice) for scene headings and action.
   The director can record any line too: missing parts, or the narrator. Save the dialogue as one audio file. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const K = () => N.guestKit;
  const T = d => (d.tableread = d.tableread || { takes: {}, pick: {} });
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const who = x => String(x || '').replace(/\s*\(.*\)/, '').trim().toUpperCase();
  // every line of the script, with a steady key for each spoken line
  F.readLines = d => {
    const out = [], seen = {}; let speaker = null, scene = '', n = 0;
    (d.screenplay || []).forEach(l => {
      const x = (l.x || '').trim(); if (!x) return;
      if (l.t === 'scene') { n++; scene = String(n); speaker = null; out.push({ t: 'scene', x, scene }); return; }
      if (l.t === 'char') { speaker = who(x); return; }
      if (l.t === 'paren') { out.push({ t: 'paren', x, scene, char: speaker }); return; }
      if (l.t === 'dial' && speaker) { const base = speaker + '|' + x; seen[base] = (seen[base] || 0) + 1; out.push({ t: 'dial', x, scene, char: speaker, k: 'l' + hash(base + '#' + seen[base]) }); return; }
      speaker = null; out.push({ t: l.t === 'trans' ? 'trans' : 'action', x, scene });
    });
    return out;
  };
  const chars = lines => [...new Set(lines.filter(l => l.t === 'dial').map(l => l.char))];
  const actorOf = (d, c) => (d.people.find(p => p.kind === 'cast' && who(p.role) === c) || {}).name || '';
  const takeOf = (d, k) => { const tr = T(d), list = (tr.takes || {})[k] || []; return list[Math.min(list.length - 1, tr.pick && tr.pick[k] != null ? tr.pick[k] : list.length - 1)]; };
  const srcOf = async (d, tk) => tk.local ? N.Store.mediaUrl(tk.media) : `${K().API}/rooms/${T(d).link.room}/media/${tk.media}?key=${encodeURIComponent(T(d).link.key)}`;

  async function sync(quiet = true) {
    const d = F.data(); if (!d || !T(d).link || !K()) return 0; const g = T(d).link;
    try { const r = await K().api(g, `feedback?after=${g.seen || 0}`); if (!r.ok) return 0; const items = (await r.json()).items; if (!items.length) return 0;
      F.change(dd => { const tr = T(dd); items.forEach(({ id, t, body: b }) => { if (b.kind === 'line' && b.k && b.media) { (tr.takes[b.k] = tr.takes[b.k] || []).push({ media: String(b.media), by: String(b.name || '').slice(0, 60), char: String(b.char || '').slice(0, 60), t }); delete tr.pick[b.k]; } tr.link.seen = Math.max(tr.link.seen || 0, id); }); }, !(F.isOpen() && F.tab() === 'tableread'));
      const n = items.filter(x => x.body.kind === 'line').length; if (n && quiet) N.toast(`${n} new line${n === 1 ? '' : 's'} recorded for the table read`); return n;
    } catch (e) { return 0; }
  }
  // the script goes up as a file (it's too big for a form), refreshed when the script changes
  async function publish(d) {
    const tr = T(d), lines = F.readLines(d), body = JSON.stringify({ title: d.title, lines: lines.filter(l => l.t !== 'paren').map(l => l.t === 'dial' ? { t: 'd', c: l.char, x: l.x, k: l.k, s: l.scene } : { t: l.t === 'scene' ? 's' : 'a', x: l.x.slice(0, 400), s: l.scene }) });
    const sig = hash(body); if (tr.link.sig === sig) return;
    const id = 'tr' + sig + Math.random().toString(36).slice(2, 8);
    const r = await K().api(tr.link, `media/${id}`, { method: 'PUT', headers: { 'X-Type': 'application/json' }, body }); if (!r.ok) throw new Error('up');
    await K().api(tr.link, 'form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'read', title: d.title, script: id }) });
    F.change(dd => { T(dd).link.sig = sig; T(dd).link.script = id; }, true);
  }
  async function linkModal(d) {
    if (!K() || !K().API) return N.toast('Table read links need the Itàn Live server');
    try { N.status('Preparing the link…');
      if (!T(d).link) { const g = await K().makeRoom('tr' + F.root().id.replace(/[^A-Za-z0-9_-]/g, ''), d.title + ' · table read', { guestUpload: true }); F.change(dd => { T(dd).link = { ...g, seen: 0 }; }, true); }
      await publish(F.data()); N.settled();
    } catch (e) { N.settled(); return N.toast('Couldn’t make the link. Check your internet.'); }
    const g = T(F.data()).link, m = N.modal(`<h2>Table read link</h2><p>Send this to your cast. Each actor picks their character and records their lines on their phone. Their recordings come back here in script order.</p>
      ${K().linkBox('Table read link', K().linkOf('read', g), `We're doing a table read of “${d.title}”. Record your lines here:`)}
      <p class="fhint">Changed the script? Open this again and the link shows the new version.</p><div class="row"><button class="pri" data-close>Done</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv; K().wireCopy(m);
  }

  /* ---------- recording a line here (the director, a missing actor, the narrator) ---------- */
  let rec = null;
  async function recordHere(k) {
    if (rec) { rec.stop(); return; }
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return N.toast('Itàn needs the microphone to record'); }
    const mr = new MediaRecorder(stream), chunks = []; mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec = { k, stop: () => mr.state !== 'inactive' && mr.stop() };
    mr.onstop = async () => { stream.getTracks().forEach(t => t.stop()); rec = null; if (!chunks.length) return F.refresh(); const id = await N.Store.putMedia(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
      F.change(dd => { const tr = T(dd); (tr.takes[k] = tr.takes[k] || []).push({ media: id, local: true, by: (N.live && N.live.me && N.live.me() && N.live.me().name) || 'Recorded here', t: Date.now() }); delete tr.pick[k]; }); };
    mr.start(); F.refresh();
  }

  /* ---------- playing the read ---------- */
  let player = null;
  function stopPlay() { if (!player) return; player.stop = true; try { speechSynthesis.cancel(); } catch (e) {} if (player.audio) player.audio.pause(); player = null; document.querySelectorAll('.tr-l.now').forEach(x => x.classList.remove('now')); const b = document.querySelector('#trPlay'); if (b) b.textContent = '▶ Play the table read'; }
  const say = (text, rate) => new Promise(res => { try { const u = new SpeechSynthesisUtterance(text); u.rate = rate || 1.05; u.onend = u.onerror = () => res(); speechSynthesis.speak(u); setTimeout(res, 400 + text.length * 90); } catch (e) { res(); } });
  async function play(d, from = 0) {
    stopPlay(); const P = player = { stop: false }, lines = F.readLines(d), tr = T(d);
    const b = document.querySelector('#trPlay'); if (b) b.textContent = '■ Stop';
    for (let i = from; i < lines.length && !P.stop; i++) {
      const l = lines[i], row = document.querySelector(`.tr-l[data-i="${i}"]`);
      document.querySelectorAll('.tr-l.now').forEach(x => x.classList.remove('now')); if (row) { row.classList.add('now'); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      if (l.t === 'dial') { const tk = takeOf(d, l.k);
        if (tk) { const u = await srcOf(d, tk); if (u && !P.stop) await new Promise(res => { const a = P.audio = new Audio(u); a.onended = a.onerror = () => res(); a.play().catch(() => res()); }); await new Promise(r => setTimeout(r, 250)); }
        else if (tr.narrate !== false && tr.fill !== false) await say(`${l.char.toLowerCase()}: ${l.x}`, 1.1); }
      else if (l.t === 'paren') continue;
      else if (tr.narrate !== false) await say(l.t === 'scene' ? l.x.replace(/^(INT|EXT)\.?\/?(INT|EXT)?\.?/i, m => /EXT/i.test(m) ? 'Exterior.' : 'Interior.').replace(/\s[–-]\s/g, ', ') : l.x, l.t === 'scene' ? 1 : 1.1);
    }
    if (player === P) stopPlay();
  }
  // the dialogue as one audio file
  async function saveAudio(d) {
    const lines = F.readLines(d).filter(l => l.t === 'dial'), clips = [];
    N.status('Putting the recordings together…');
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    for (const l of lines) { const tk = takeOf(d, l.k); if (!tk) continue; try { const u = await srcOf(d, tk), buf = await (await fetch(u)).arrayBuffer(); clips.push(await ac.decodeAudioData(buf)); } catch (e) {} }
    if (!clips.length) { N.settled(); ac.close(); return N.toast('No recordings yet'); }
    const rate = 44100, gap = Math.round(0.35 * rate), len = clips.reduce((n, c) => n + Math.round(c.duration * rate) + gap, 0), out = new Float32Array(len); let pos = 0;
    for (const c of clips) { const off = new OfflineAudioContext(1, Math.round(c.duration * rate), rate), s = off.createBufferSource(); s.buffer = c; s.connect(off.destination); s.start(); const r = await off.startRendering(); out.set(r.getChannelData(0), pos); pos += r.length + gap; }
    ac.close();
    const wav = new DataView(new ArrayBuffer(44 + len * 2)), w = (o, s) => [...s].forEach((ch, i) => wav.setUint8(o + i, ch.charCodeAt(0)));
    w(0, 'RIFF'); wav.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, rate, true); wav.setUint32(28, rate * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); w(36, 'data'); wav.setUint32(40, len * 2, true);
    for (let i = 0; i < len; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, out[i])) * 0x7fff, true);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })); a.download = `${d.title} table read.wav`; document.body.append(a); a.click(); a.remove(); N.settled(); N.toast('Saved the table read as audio');
  }

  /* ---------- the tab ---------- */
  let only = '';
  F.tabs.push({ id: 'tableread', label: 'Table read', order: 7, render(el, d) {
    const tr = T(d), lines = F.readLines(d), cs = chars(lines), dial = lines.filter(l => l.t === 'dial');
    if (!dial.length) { el.innerHTML = `<div class="fwrap"><div class="empty-row big">The table read uses the script’s dialogue. Write or open the script on the Script tab first.</div><div class="row" style="justify-content:center"><button class="pri" data-ftab="script">Go to Script</button></div></div>`; return; }
    const got = l => !!takeOf(d, l.k), done = dial.filter(got).length;
    el.innerHTML = `<div class="fwrap wide trd"><div class="rp-bar"><div><b class="tr-big">${done} of ${dial.length}</b> <span class="fhint">lines recorded</span></div>
        <div class="cs-act"><label class="tr-tog"><input type="checkbox" id="trNar"${tr.narrate !== false ? ' checked' : ''}> Narrator reads headings and action</label><button class="ib" id="trWav">Save as audio</button>${tr.link ? '<button class="ib" id="trCheck">Check for recordings</button>' : ''}<button class="ib" id="trLink">${tr.link ? 'Table read link' : 'Get a link for the cast'}</button><button class="pri" id="trPlay">${player ? '■ Stop' : '▶ Play the table read'}</button></div></div>
      <div class="tr-two"><aside class="tr-cast"><h3>Cast</h3>${cs.map(c => { const mine = dial.filter(l => l.char === c), n = mine.filter(got).length; return `<button data-only="${esc(c)}" class="${only === c ? 'on' : ''}"><b>${esc(c)}</b><small>${esc(actorOf(d, c) || 'Not cast yet')}</small><i class="dk-bar"><em style="width:${n / mine.length * 100}%"></em></i><span>${n}/${mine.length}</span></button>`; }).join('')}${only ? '<button class="linkish" data-only="">Show everyone</button>' : ''}</aside>
      <section class="tr-script sheet">${lines.map((l, i) => { if (only && l.t !== 'scene' && l.char !== only) return ''; const tk = l.t === 'dial' ? takeOf(d, l.k) : null, n = l.t === 'dial' ? ((tr.takes || {})[l.k] || []).length : 0;
        return l.t === 'scene' ? `<h4 class="tr-l" data-i="${i}">${esc(l.x)}</h4>` : l.t === 'dial' ? `<div class="tr-l tr-d${tk ? ' got' : ''}${rec && rec.k === l.k ? ' rec' : ''}" data-i="${i}" data-k="${esc(l.k)}"><span class="tr-c">${esc(l.char)}</span><p>${esc(l.x)}</p>
          <div class="tr-act">${tk ? `<button class="ib xs" data-hear title="Play">▶</button><small>${esc(tk.by || '')}${n > 1 ? ` · take ${(tr.pick[l.k] ?? n - 1) + 1} of ${n} <button class="linkish" data-next>next take</button>` : ''}</small>` : '<small class="tr-miss">Not recorded</small>'}<button class="ib xs" data-rec title="Record this line here">${rec && rec.k === l.k ? '■' : '🎙'}</button><button class="ib xs" data-from title="Play from here">⤓</button></div></div>`
          : l.t === 'paren' ? `<p class="tr-l tr-p" data-i="${i}">${esc(l.x)}</p>` : `<p class="tr-l tr-a" data-i="${i}">${esc(l.x)}</p>`; }).join('')}</section></div></div>`;
    el.onclick = async e => { const t = e.target, row = t.closest('[data-k]');
      if (t.closest('#trPlay')) return player ? stopPlay() : play(d, 0);
      if (t.closest('#trLink')) return linkModal(d);
      if (t.closest('#trCheck')) { const n = await sync(false); N.toast(n ? `${n} new line${n === 1 ? '' : 's'}` : 'No new recordings yet'); return; }
      if (t.closest('#trWav')) return saveAudio(d);
      const o = t.closest('[data-only]'); if (o) { only = o.dataset.only; return F.refresh(); }
      if (!row) return; const k = row.dataset.k;
      if (t.closest('[data-rec]')) return recordHere(k);
      if (t.closest('[data-hear]')) { stopPlay(); const u = await srcOf(d, takeOf(d, k)); if (u) new Audio(u).play().catch(() => {}); return; }
      if (t.closest('[data-next]')) return F.change(dd => { const tr2 = T(dd), n = tr2.takes[k].length; tr2.pick[k] = ((tr2.pick[k] ?? n - 1) + 1) % n; }, false);
      if (t.closest('[data-from]')) return play(d, +row.dataset.i);
    };
    el.onchange = e => { if (e.target.id === 'trNar') F.change(dd => { T(dd).narrate = e.target.checked; }, true); };
  } });
  F.setStage('tableread', 'story');

  /* ---------- what actors see ---------- */
  N.guestPages = N.guestPages || {};
  N.guestPages.read = async (body, f, g, key, send) => {
    let sc; try { sc = await (await fetch(`${K().API}/rooms/${g.room}/media/${f.script}?key=${encodeURIComponent(key)}`)).json(); } catch (e) { body.innerHTML = '<h1>This link isn’t working</h1><p>Ask the person who sent it for a new one.</p>'; return; }
    const L = sc.lines, cs = [...new Set(L.filter(l => l.t === 'd').map(l => l.c))], done = JSON.parse(localStorage.getItem('itan:read:' + g.room) || '{}');
    let me = localStorage.getItem('itan:readAs:' + g.room) || '', name = localStorage.getItem('itan:guestName') || '';
    const pickView = () => { body.innerHTML = `<p class="gs-kick">Table read</p><h1>${esc(sc.title || 'Our film')}</h1><p>Choose your character. You’ll record your lines one by one, with the line before as your cue. Find a quiet room.</p>
        <label>Your name<input id="trN" value="${esc(name)}" autocomplete="name"></label><div class="cst-groles">${cs.map(c => `<button class="cst-grole tr-pick" data-c="${esc(c)}"><span><b>${esc(c)}</b><small>${L.filter(l => l.c === c).length} lines</small></span></button>`).join('')}</div>`;
      body.onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; name = body.querySelector('#trN').value.trim(); if (!name) { N.toast('Add your name first'); return body.querySelector('#trN').focus(); } localStorage.setItem('itan:guestName', name); me = b.dataset.c; localStorage.setItem('itan:readAs:' + g.room, me); readView(); }; };
    let cur = null, mr = null, stream = null;
    const readView = () => {
      const mine = L.map((l, i) => ({ ...l, i })).filter(l => l.t === 'd' && l.c === me);
      if (cur == null) cur = Math.max(0, mine.findIndex(l => !done[l.k]));
      const l = mine[cur], cue = l ? [...L.slice(0, l.i)].reverse().find(x => x.t === 'd' || x.t === 's') : null, n = mine.filter(x => done[x.k]).length;
      body.innerHTML = `<p class="gs-kick">${esc(sc.title || '')} · table read</p><h1>${esc(me)}</h1><div class="tr-gprog"><i style="width:${n / mine.length * 100}%"></i></div><p class="fhint">${n} of ${mine.length} lines sent${n === mine.length ? ' · all done, thank you!' : ''} · <button class="linkish" id="trSwitch">Not ${esc(me)}?</button></p>
        ${l ? `<div class="tr-card">${cue ? `<p class="tr-cue"><small>${cue.t === 's' ? 'Scene' : esc(cue.c)}</small>${esc(cue.x)}</p>` : ''}<p class="tr-mine"><small>${esc(me)} · line ${cur + 1} of ${mine.length}</small>${esc(l.x)}</p>
          <button class="tr-recbtn${mr ? ' on' : ''}" id="trRec">${mr ? '■ Stop and send' : done[l.k] ? '🎙 Record again' : '🎙 Record'}</button>${done[l.k] ? '<p class="tr-ok">✓ Sent</p>' : ''}
          <div class="row"><button class="ib" id="trPrev"${cur ? '' : ' disabled'}>← Back</button><button class="ib" id="trNext"${cur < mine.length - 1 ? '' : ' disabled'}>Next →</button></div></div>` : ''}
        <div class="gs-prog" id="trProg" hidden><i style="width:100%"></i><span>Sending…</span></div>`;
      body.onclick = async e => { const t = e.target;
        if (t.closest('#trSwitch')) return pickView();
        if (t.closest('#trPrev')) { cur--; return readView(); } if (t.closest('#trNext')) { cur++; return readView(); }
        if (t.closest('#trRec')) {
          if (mr) { mr.stop(); return; }
          try { stream = stream || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (er) { return N.toast('Allow the microphone to record your lines'); }
          const chunks = []; mr = new MediaRecorder(stream); mr.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
          mr.onstop = async () => { const type = mr.mimeType || 'audio/webm'; mr = null; if (!chunks.length) return readView(); const prog = body.querySelector('#trProg'); prog.hidden = false;
            try { const id = 'r' + Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join('');
              const up = await fetch(`${K().API}/rooms/${g.room}/media/${id}`, { method: 'PUT', headers: { 'X-Key': key, 'X-Type': type }, body: new Blob(chunks, { type }) }); if (!up.ok) throw new Error('up');
              await send({ kind: 'line', k: l.k, char: me, media: id, name }); done[l.k] = 1; localStorage.setItem('itan:read:' + g.room, JSON.stringify(done)); if (cur < mine.length - 1) cur++;
            } catch (er) { N.toast('Couldn’t send. Check your internet and record again.'); }
            readView(); };
          mr.start(); readView();
        }
      };
    };
    me && cs.includes(me) && name ? readView() : pickView();
  };

  N.hooks.ready.push(() => { if (document.body.classList.contains('guesting')) return; setInterval(() => { if (!document.hidden && F.root() && F.data() && F.data().tableread && F.data().tableread.link) sync(); }, 120000); });
})();
