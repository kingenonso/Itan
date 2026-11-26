/* Voice to text, on this device. Off until the person turns it on, because it needs a one-time
   download of a speech model (about 80 MB). After that it works offline. Uses Whisper through
   Transformers.js, running in a background worker so the board stays smooth. */
(function () {
  const N = window.N, S = N.S, esc = N.esc;
  const MODEL = 'Xenova/whisper-base';
  const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';
  let on = false, worker = null, seq = 0;
  const waiting = new Map(), tried = new Set(), queue = [];
  let busy = false;

  N.Store.getKV('stt').then(v => { on = !!v; if (on) N.requestRender(); }).catch(() => {});

  function makeWorker() {
    const code = `import { pipeline, env } from '${LIB}';
      env.allowLocalModels = false; let asr = null;
      self.onmessage = async e => {
        const { id, audio } = e.data;
        try {
          if (!asr) asr = await pipeline('automatic-speech-recognition', '${MODEL}', { progress_callback: p => self.postMessage({ progress: p }) });
          const out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, language: 'english', task: 'transcribe' });
          self.postMessage({ id, text: String(out.text || '').trim() });
        } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
      };`;
    const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })), { type: 'module' });
    w.onmessage = e => {
      const d = e.data;
      if (d.progress) { const p = d.progress; if (p.status === 'progress' && p.total) N.status(`Getting voice to text ready ${Math.round(p.loaded / p.total * 100)}%`); return; }
      const cb = waiting.get(d.id); waiting.delete(d.id); if (cb) cb(d);
    };
    w.onerror = () => { N.toast('Voice to text couldn’t start in this browser.'); worker = null; };
    return w;
  }
  async function toPCM(blob) {
    const buf = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
    const decoded = await new Promise((res, rej) => ac.decodeAudioData(buf.slice(0), res, rej)); ac.close && ac.close();
    const len = Math.ceil(decoded.duration * 16000), off = new OfflineAudioContext(1, Math.max(1, len), 16000);
    const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
    const out = await off.startRendering(); return out.getChannelData(0);
  }
  function run(blob) {
    return new Promise(async (res, rej) => {
      try {
        const audio = await toPCM(blob);
        if (!worker) worker = makeWorker();
        const id = ++seq; waiting.set(id, d => d.error ? rej(new Error(d.error)) : res(d.text));
        worker.postMessage({ id, audio }, [audio.buffer]);
      } catch (e) { rej(e); }
    });
  }
  async function pump() {
    if (busy || !queue.length) return; busy = true;
    const job = queue.shift();
    try {
      const blob = await N.Store.getMedia(job.media); if (!blob) throw new Error('missing');
      N.status('Turning speech into text…');
      const text = await run(blob);
      job.apply(text || '(no speech found)'); N.touch(); N.requestRender();
    } catch (e) { console.warn('transcribe', e); N.toast('A recording couldn’t be turned into text.'); }
    busy = false; N.settled(); pump();
  }
  function enqueue(media, apply) { if (tried.has(media)) return; tried.add(media); queue.push({ media, apply }); pump(); }

  // Look for recordings without text on the board being shown
  N.hooks.render.push(b => {
    if (!on) return;
    for (const c of b.cards) if (c.type === 'audio' && c.media && c.transcript == null) enqueue(c.media, t => { const k = b.cards.find(x => x.id === c.id); if (k) k.transcript = t; });
    if (b.voice && !b.extra.voiceText) enqueue(b.voice, t => { b.extra.voiceText = t; });
    const w = b.extra.walk; if (w && w.media && !w.text) enqueue(w.media, t => { w.text = t; });
  });
  N.hooks.transcribe = null; // handled by the board scan above

  async function enable() {
    const m = N.modal(`<h2>Turn on voice to text</h2><p>Itàn can write out what you say in voice notes, board explanations and walkthroughs, so you can read them quickly and find them in search.</p>
      <p>It works on this device, without sending your voice anywhere. The first time, it downloads a speech model of about 80 MB, so use Wi-Fi if data is expensive. After that it works offline.</p>
      <div class="row"><button class="pri" id="sttOn">Download and turn on</button><button data-close>Not now</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#sttOn').onclick = async () => { N.closeOv(); on = true; await N.Store.setKV('stt', true).catch(() => {}); N.toast('Voice to text is on. Recordings will get their text shortly.'); N.requestRender(); };
  }
  // A "Write it out" button on voice notes without text
  N.hooks.audioExtra = c => c.transcript != null
    ? `<div class="tscript txt" contenteditable="${N.P.canWrite ? 'plaintext-only' : 'false'}" spellcheck="false" data-f="transcript" data-ph="Transcript">${esc(c.transcript)}</div>`
    : (on ? '<div class="tscript wait">Writing it out…</div>' : `<button class="add tsbtn" data-act="transcribe">Write it out as text</button>`);
  N.world.addEventListener('click', e => { if (e.target.closest('[data-act=transcribe]')) { e.stopPropagation(); enable(); } }, true);
  N.sttEnable = enable;
})();
