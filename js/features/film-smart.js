/* Smart breakdown: suggests tags for every scene, then lets you choose which to keep.
   It works offline with screenplay rules (things written in CAPITALS in action lines, names of characters)
   and film word lists. Optionally it can also ask Google Gemini, using a free key you get yourself. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const W = {
    props: 'phone,cellphone,mobile phone,gun,pistol,rifle,knife,machete,cutlass,bag,handbag,backpack,laptop,cup,mug,bottle,glass,plate,pot,spoon,letter,envelope,money,cash,naira,wallet,keys,key,book,notebook,diary,camera,ring,necklace,watch,cigarette,lighter,newspaper,umbrella,torch,flashlight,photo,photograph,picture frame,briefcase,suitcase,box,file,folder,document,contract,pen,remote,tv,television,radio,guitar,drum,microphone,candle,bible,quran,rosary,bowl,tray,food,cake,jollof,rice,drink,beer,wine,palm wine,chair,stool,mat,mirror,towel,blanket,pillow,rope,stick,cane,bucket,broom,generator,fan,ticket,passport,card,id card,syringe,pills,charger,headphones,earphones,sunglasses,flowers,gift,basket'.split(','),
    wardrobe: 'dress,gown,suit,uniform,jacket,coat,blazer,hat,cap,shoes,heels,sneakers,slippers,boots,agbada,ankara,aso ebi,aso-ebi,gele,kaftan,buba,iro,wrapper,senator,hoodie,tie,apron,jeans,shirt,t-shirt,skirt,trousers,shorts,singlet,scarf,hijab,veil,robe,pyjamas,pajamas,wedding dress,school uniform,lab coat,overalls,costume,bikini,towel wrapped'.split(','),
    makeup: 'blood,bloody,bleeding,wound,bruise,bruised,scar,sweat,sweating,tears,crying,wig,beard,moustache,mustache,braids,cut,swollen,pale,dirty,dust,mud,makeup,make-up,lipstick,tattoo,bald,grey hair,gray hair,old age,burn,burned,vomit,pregnant belly'.split(','),
    vehicles: 'car,taxi,cab,keke,keke napep,okada,danfo,molue,bus,truck,lorry,motorcycle,motorbike,bike,bicycle,van,suv,jeep,limousine,boat,canoe,ferry,ambulance,police car,police van,tanker,trailer,tricycle,helicopter,plane,aeroplane,airplane,train,tractor,wheelbarrow,mercedes,toyota,lexus,range rover,camry,corolla,hilux'.split(','),
    effects: 'rain,raining,fire,flames,explosion,explodes,smoke,gunshot,gunshots,shoots,fires a shot,thunder,lightning,fog,mist,snow,wind,storm,crash,crashes,blackout,power goes out,nepa takes light,lights flicker,flicker,sparks,glass shatters,shatters,breaks,slow motion,flashback,dream,vision,ghost,disappears,levitates,blood spurts,stab,stabs,punch,punches,fight,fights,falls,jumps,stunt,car chase,chase'.split(','),
    extras: 'crowd,passersby,passers-by,pedestrians,customers,shoppers,students,pupils,guests,wedding guests,police officers,policemen,soldiers,people,waiters,waitress,villagers,market women,traders,hawkers,worshippers,congregation,choir,dancers,party guests,partygoers,commuters,passengers,patients,nurses,doctors,workers,staff,security guards,bouncers,fans,spectators,audience,mourners,children,kids,thugs,area boys,touts,journalists,reporters,onlookers,neighbours,neighbors'.split(',')
  };
  const SKIP = new Set('INT,EXT,CONT,CONTINUED,CUT,FADE,DISSOLVE,TO,THE,END,V.O,O.S,O.C,POV,CLOSE,WIDE,ANGLE,INSERT,BACK,LATER,DAY,NIGHT,MORNING,EVENING,SUPER,TITLE,MONTAGE,SERIES,OF,SHOTS,A,I,OK,TV,ID,SMASH,MATCH,BEGIN,FLASHBACK,PRESENT,CONTINUOUS,MOMENTS'.split(','));
  const rx = w => new RegExp('(^|[^\\p{L}])(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:e?s)?)(?=$|[^\\p{L}])', 'iu');
  const has = (s, k, w) => (s.tags[k] || []).some(x => x.toLowerCase() === w.toLowerCase());

  // offline suggestions for one scene
  function suggest(d, s) {
    const out = {}; const add = (k, w) => { w = w.trim(); if (!w || w.length < 2 || has(s, k, w)) return; out[k] = out[k] || []; if (!out[k].some(x => x.toLowerCase() === w.toLowerCase())) out[k].push(w); };
    const lines = (s.text || '').split('\n'), action = [];
    const names = new Set(d.people.filter(p => p.kind === 'cast').map(p => (p.role || '').toUpperCase()).filter(Boolean));
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim(); if (!t) continue;
      const cue = t === t.toUpperCase() && /[A-Z]/.test(t) && t.length <= 38 && (lines[i + 1] || '').trim();
      if (cue) { i++; while (i < lines.length && lines[i].trim()) i++; continue; } // skip a character cue and its dialogue
      action.push(t);
    }
    const act = action.join('\n');
    // characters named in the action who aren't cast in this scene
    d.people.filter(p => p.kind === 'cast' && p.role && !(s.cast || []).includes(p.id)).forEach(p => { if (rx(p.role).test(act)) { out.cast = out.cast || []; out.cast.push(p.id); } });
    // screenplay rule: important things are written in CAPITALS in the action
    (act.match(/\b[A-Z][A-Z'-]{2,}(?:\s+[A-Z][A-Z'-]{2,}){0,2}\b/g) || []).forEach(w => {
      if (SKIP.has(w) || names.has(w) || w.split(/\s+/).every(x => SKIP.has(x))) return;
      const lw = w.toLowerCase(); const cat = Object.keys(W).find(k => W[k].some(x => lw === x || lw === x + 's' || lw.includes(x)));
      add(cat || (/(BANG|BOOM|CRASH|SLAM|THUD|RING|BUZZ|SCREAM|KNOCK|POP|HONK)/.test(w) ? 'effects' : 'props'), lw);
    });
    Object.entries(W).forEach(([k, list]) => list.forEach(w => { const m = act.match(rx(w)); if (m) add(k, m[2].toLowerCase()); }));
    // a word found as wardrobe or a vehicle shouldn't also be a prop
    if (out.props) out.props = out.props.filter(w => !['wardrobe', 'vehicles', 'effects', 'extras', 'makeup'].some(k => (out[k] || []).includes(w)));
    return out;
  }

  /* ---------- Gemini (optional, the user's own free key) ---------- */
  const MODEL_DEFAULT = 'gemini-2.5-flash';
  async function gemini(d, scenes, key, model) {
    const results = new Map(), batches = [];
    let cur = [], size = 0;
    scenes.forEach(s => { const t = `### SCENE ${s.num}: ${F.sceneLabel(s)}\n${(s.text || '').slice(0, 6000)}\n`; if (size + t.length > 40000 && cur.length) { batches.push(cur); cur = []; size = 0; } cur.push([s, t]); size += t.length; });
    if (cur.length) batches.push(cur);
    const cast = d.people.filter(p => p.kind === 'cast').map(p => p.role).filter(Boolean);
    for (let i = 0; i < batches.length; i++) {
      N.status(`Asking Gemini… ${i + 1} of ${batches.length}`);
      const prompt = `You are a film assistant director doing a script breakdown. For each scene below, list what the production must provide, as short lowercase nouns as written in the script.\nCategories: props (objects actors handle), wardrobe (notable costumes), makeup (blood, wounds, wigs, ageing), vehicles, effects (special effects, stunts, weather, sound effects that need doing on set), extras (background people, with a count if given).\nAlso list cast: speaking or named characters present, choosing from: ${cast.join(', ') || 'none known'}.\nOnly include things that are actually in the scene. Return JSON only.\n\n${batches[i].map(x => x[1]).join('\n')}`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json',
          responseSchema: { type: 'OBJECT', properties: { scenes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { scene: { type: 'STRING' }, cast: { type: 'ARRAY', items: { type: 'STRING' } }, props: { type: 'ARRAY', items: { type: 'STRING' } }, wardrobe: { type: 'ARRAY', items: { type: 'STRING' } }, makeup: { type: 'ARRAY', items: { type: 'STRING' } }, vehicles: { type: 'ARRAY', items: { type: 'STRING' } }, effects: { type: 'ARRAY', items: { type: 'STRING' } }, extras: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['scene'] } } }, required: ['scenes'] } } }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); const msg = (j.error && j.error.message) || res.statusText; throw new Error(res.status === 400 && /key/i.test(msg) ? 'That Gemini key isn’t valid' : res.status === 429 ? 'Gemini’s free limit is used up for now. Try again later.' : 'Gemini: ' + msg); }
      const j = await res.json(); const txt = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
      let data; try { data = JSON.parse(txt); } catch (e) { continue; }
      (data.scenes || []).forEach(r => { const s = batches[i].find(x => String(x[0].num) === String(r.scene).replace(/^scene\s*/i, ''))?.[0]; if (s) results.set(s.id, r); });
    }
    N.settled(); return results;
  }

  /* ---------- the review window ---------- */
  async function run(d, useAI) {
    const scenes = F.sortScenes(d).filter(s => s.text);
    if (!scenes.length) return N.toast('Bring in your script first. Suggestions come from the scene text.');
    const sug = new Map(scenes.map(s => [s.id, suggest(d, s)]));
    if (useAI) {
      const key = await N.Store.getKV('geminiKey').catch(() => ''), model = (await N.Store.getKV('geminiModel').catch(() => '')) || MODEL_DEFAULT;
      if (!key) return settings(d);
      try {
        const ai = await gemini(d, scenes, key, model);
        ai.forEach((r, id) => { const s = d.scenes.find(x => x.id === id), o = sug.get(id);
          F.CATS.slice(1).forEach(([k]) => (r[k] || []).forEach(w => { w = String(w).trim().toLowerCase(); if (w.length > 1 && w.length < 60 && !has(s, k, w)) { o[k] = o[k] || []; if (!o[k].includes(w)) o[k].push(w); } }));
          (r.cast || []).forEach(name => { const p = d.people.find(p => p.kind === 'cast' && (p.role || '').toUpperCase() === String(name).toUpperCase()); if (p && !(s.cast || []).includes(p.id)) { o.cast = o.cast || []; if (!o.cast.includes(p.id)) o.cast.push(p.id); } }); });
      } catch (e) { N.settled(); N.toast(e.message === 'Failed to fetch' ? 'Couldn’t reach Gemini. Check your internet. Showing offline suggestions.' : e.message); }
    }
    const total = [...sug.values()].reduce((n, o) => n + Object.values(o).reduce((m, a) => m + a.length, 0), 0);
    if (!total) return N.toast('No new suggestions. Your breakdown already covers what was found.');
    const label = (k, v) => k === 'cast' ? ((F.person(d, v) || {}).role || v) : v;
    const m = N.modal(`<h2>Suggested tags</h2><p>${total} suggestion${total === 1 ? '' : 's'} across ${[...sug.values()].filter(o => Object.keys(o).length).length} scenes${useAI ? ', from Itàn and Gemini' : ''}. Tap any you don’t want to switch them off, then add the rest.</p>
      <div class="sg-list">${scenes.filter(s => Object.keys(sug.get(s.id)).length).map(s => { const o = sug.get(s.id);
        return `<section class="sg-scene"><h4><span class="strip ${F.stripClass(s)}" aria-hidden="true"></span>${esc(s.num)}. ${esc(F.sceneLabel(s))}</h4><div class="chips">${F.CATS.filter(([k]) => o[k]).map(([k]) => o[k].map(v => `<button class="chip tg-${k} sg on" data-s="${esc(s.id)}" data-k="${k}" data-v="${esc(v)}" aria-pressed="true" title="${esc(F.CATS.find(c => c[0] === k)[1])}">${esc(label(k, v))}</button>`).join('')).join('')}</div></section>`; }).join('')}</div>
      <div class="row"><button class="pri" id="sgAdd">Add selected tags</button><button id="sgNone">Switch all off</button><button data-close>Cancel</button></div>`);
    m.classList.add('wide');
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.onclick = e => { const c = e.target.closest('.sg'); if (c) { c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on')); }
      if (e.target.closest('#sgNone')) m.querySelectorAll('.sg').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); };
    m.querySelector('#sgAdd').onclick = () => {
      const on = [...m.querySelectorAll('.sg.on')]; N.closeOv(); if (!on.length) return;
      F.change(dd => on.forEach(c => { const s = dd.scenes.find(x => x.id === c.dataset.s); if (!s) return; const k = c.dataset.k, v = c.dataset.v;
        if (k === 'cast') { s.cast = s.cast || []; if (!s.cast.includes(v)) s.cast.push(v); } else { s.tags[k] = s.tags[k] || []; if (!has(s, k, v)) s.tags[k].push(v); } }));
      N.toast(`Added ${on.length} tag${on.length === 1 ? '' : 's'}`);
    };
  }
  async function settings(d) {
    const key = await N.Store.getKV('geminiKey').catch(() => '') || '', model = await N.Store.getKV('geminiModel').catch(() => '') || MODEL_DEFAULT;
    const m = N.modal(`<h2>Check with Gemini</h2><p>Gemini, Google’s AI, can read your script and catch things the offline check misses. It’s free with your own key, and the key stays on this device.</p>
      <ol class="gm-steps"><li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> and sign in with a Google account.</li><li>Choose Create API key and copy it.</li><li>Paste it below.</li></ol>
      <label>Your Gemini key<input id="gmKey" type="password" value="${esc(key)}" placeholder="Paste your key" autocomplete="off" spellcheck="false"></label>
      <label>Model<input id="gmModel" value="${esc(model)}" spellcheck="false"></label>
      <p class="fhint">On Google’s free plan, Google may use what you send to improve its products. Don’t use it for a script you’ve promised to keep private. Each check sends your scene text to Google; nothing else from Itàn is sent.</p>
      <div class="row"><button class="pri" id="gmSave">Save and check</button>${key ? '<button id="gmForget">Remove key</button>' : ''}<button data-close>Cancel</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#gmSave').onclick = async () => { const k = m.querySelector('#gmKey').value.trim(); if (!k) return N.toast('Paste your key first'); await N.Store.setKV('geminiKey', k); await N.Store.setKV('geminiModel', m.querySelector('#gmModel').value.trim() || MODEL_DEFAULT); N.closeOv(); run(F.data(), true); };
    const fg = m.querySelector('#gmForget'); if (fg) fg.onclick = async () => { await N.Store.setKV('geminiKey', ''); N.closeOv(); N.toast('Gemini key removed from this device'); };
  }
  F.suggestTags = suggest;

  // add the buttons to the Breakdown tab
  N.hooks.ready.push(() => {
    const t = F.tabs.find(x => x.id === 'breakdown'); if (!t || t._smart) return; t._smart = true;
    const base = t.render;
    t.render = function (el, d) {
      base.call(this, el, d);
      const tools = el.querySelector('.bd-tools'); if (!tools || !d.scenes.length) return;
      const box = document.createElement('div'); box.className = 'bd-smart';
      box.innerHTML = `<button class="ib" data-smart="off" title="Find props, wardrobe, vehicles and more in every scene. Works offline.">✦ Suggest tags</button><button class="ib" data-smart="ai" title="Also ask Google Gemini, using your own free key">Check with Gemini</button><button class="ib xs" data-smart="set" aria-label="Gemini settings" title="Gemini settings">⚙</button>`;
      tools.after(box);
      box.onclick = e => { const b = e.target.closest('[data-smart]'); if (!b) return; e.stopPropagation(); b.dataset.smart === 'set' ? settings(d) : run(F.data(), b.dataset.smart === 'ai'); };
    };
  });
})();
