/* Welcome: the first time Itàn opens, a short introduction with three ways in:
   explore a sample film (The Last Danfo, already written, broken down, storyboarded and scheduled),
   start your own film, or just use boards. The sample comes with a guided tour of the film tools. */
(function () {
  const N = window.N, F = N.film, esc = N.esc, S = N.S;

  const SCRIPT = `INT. MAMA NKECHI'S HOUSE - DAY

NKECHI (50s) waits by the window. A pot of egusi soup cools on the stove. The CLOCK ticks.

The door opens. TUNDE (20s) steps in, sweating, holding a crumpled ENVELOPE.

TUNDE
Mama, I got in. Lagos. The film school.

NKECHI
(not turning around)
And who will pay for it?

TUNDE
I will. I'll find a way.

Nkechi finally turns. Her eyes are wet.

NKECHI
Then go. Before I change my mind.

EXT. OBALENDE BUS PARK - NIGHT

Rain. Conductors shout destinations. TUNDE runs through a crowd of hawkers with his BAG as the last DANFO pulls away.

CONDUCTOR
Last bus! CMS! Last bus!

INT. DANFO - NIGHT

Tunde squeezes onto the back seat. He opens the envelope again and smiles.
`;

  /* ---------- the sample film ---------- */
  async function sample() {
    N.closeOv();
    const home = S.boards.home, id = 'b' + N.uid();
    S.boards[id] = N.normalize({ id, title: 'The Last Danfo', parent: 'home', cards: [], links: [], created: Date.now() });
    const maxX = home.cards.reduce((x, c) => Math.max(x, (+c.x || 0) + (+c.w || 0)), 0);
    home.cards.push(N.newCard('board', maxX + 40, 60, { board: id, color: '#ff5a3c' }));
    N.touch(); N.show(id); await new Promise(r => setTimeout(r, 60));
    N.applyTemplate('film');
    const fr = S.boards[id]; fr.extra.film.title = 'The Last Danfo';
    // match the template's shot cards to the story
    const SHOTS = { '1A': 'Nkechi waits by the window', '1B': 'Tunde enters with the envelope', '1C': 'Nkechi turns, eyes wet', '2A': 'Tunde runs as the last danfo pulls away' };
    F.allShots().forEach(({ c }) => { const k = `${c.scene}${c.letter}`; if (SHOTS[k]) c.text = SHOTS[k]; });
    F.applyScript(SCRIPT);
    F.change(d => {
      d.screenplay = F.toScreenplay(SCRIPT);
      const role = r => d.people.find(p => p.kind === 'cast' && p.role === r);
      const names = { NKECHI: 'Ngozi Bassey', TUNDE: 'Chidera Obi', CONDUCTOR: 'Sola Ade' };
      d.people.forEach(p => { if (names[p.role]) p.name = names[p.role]; });
      d.people.push({ id: F.uid(), kind: 'crew', role: 'Director', name: 'You', phone: '' }, { id: F.uid(), kind: 'crew', role: 'Director of photography', name: 'Amaka Udo', phone: '' }, { id: F.uid(), kind: 'crew', role: 'Sound recordist', name: 'Femi Ojo', phone: '' });
      const [s1, s2, s3] = F.sortScenes(d);
      if (s1) s1.tags = { props: ['envelope', 'pot of egusi soup', 'clock'], wardrobe: ['Nkechi’s wrapper'] };
      if (s2) s2.tags = { props: ['bag'], vehicles: ['danfo'], effects: ['rain'], extras: ['conductors', 'hawkers'] };
      if (s3) s3.tags = { vehicles: ['danfo'], props: ['envelope'] };
      d.place = { name: 'Lagos, Nigeria', lat: 6.4541, lon: 3.3947, tz: 'Africa/Lagos' };
      d.days = [{ id: F.uid(), date: N.todayStr(7), call: '06:30', sceneIds: s1 ? [s1.id] : [], castCalls: {}, place: d.place },
        { id: F.uid(), date: N.todayStr(8), call: '16:00', sceneIds: [s2, s3].filter(Boolean).map(s => s.id), castCalls: {}, place: d.place }];
      d.days.forEach(day => { day.sunset = F.sunText ? F.sunText(day.date, d.place) : ''; });
      d.budget = { cur: '₦', cont: 10, depts: [
        { id: F.uid(), name: 'Cast', items: [{ id: F.uid(), desc: 'Nkechi', qty: 1, rate: 60000, units: 2, actual: '' }, { id: F.uid(), desc: 'Tunde', qty: 1, rate: 50000, units: 2, actual: '' }] },
        { id: F.uid(), name: 'Crew', items: [{ id: F.uid(), desc: 'Director of photography', qty: 1, rate: 80000, units: 2, actual: '' }, { id: F.uid(), desc: 'Sound recordist', qty: 1, rate: 40000, units: 2, actual: '' }] },
        { id: F.uid(), name: 'Transport', items: [{ id: F.uid(), desc: 'Danfo hire for the night', qty: 1, rate: 70000, units: 1, actual: '' }] },
        { id: F.uid(), name: 'Catering', items: [{ id: F.uid(), desc: 'Lunch for cast and crew', qty: 12, rate: 3500, units: 2, actual: '' }] }] };
      d.sample = true;
    });
    // the wide and the close-up cover their lines, so the lined script has something to show (scene 3 is left uncovered on purpose)
    if (F.tabs.find(t => t.id === 'lined')) { N.snap(); const d = F.data(), scs = []; let cur = null; d.screenplay.forEach(l => { if (l.t === 'scene') { cur = { lines: [] }; scs.push(cur); } else if (cur) cur.lines.push(l); });
      const cover = (sc, from, to) => sc && sc.lines.length ? { from: sc.lines[from < 0 ? sc.lines.length + from : from].id, to: sc.lines[to < 0 ? sc.lines.length + to : to].id } : null;
      F.allShots().forEach(({ c }) => { const k = `${c.scene}${c.letter}`;
        if (k === '1A') c.cover = cover(scs[0], 0, -1); if (k === '1B') c.cover = cover(scs[0], 1, 4); if (k === '1C') c.cover = cover(scs[0], -3, -1); if (k === '2A') c.cover = cover(scs[1], 0, -1); });
      N.touch(); }
    try { localStorage.setItem('itan:welcomed', '1'); } catch (e) {}
    setTimeout(() => { F.open('script'); tour(); }, 350);
  }

  async function ownFilm() {
    N.closeOv(); try { localStorage.setItem('itan:welcomed', '1'); } catch (e) {}
    const title = await F.ask('What’s your film called?', 'Title', '') || 'Our film';
    const home = S.boards.home, id = 'b' + N.uid();
    S.boards[id] = N.normalize({ id, title, parent: 'home', cards: [], links: [], created: Date.now() });
    const maxX = home.cards.reduce((x, c) => Math.max(x, (+c.x || 0) + (+c.w || 0)), 0);
    home.cards.push(N.newCard('board', maxX + 40, 60, { board: id }));
    N.touch(); N.show(id); await new Promise(r => setTimeout(r, 60)); N.applyTemplate('film');
    setTimeout(() => { F.open('script'); N.toast('Start with your script: write it here, or tap “Open a script” to bring one in.'); }, 350);
  }

  /* ---------- the welcome ---------- */
  function welcome() {
    const m = N.modal(`<div class="wl"><div class="wl-mark"><img src="icons/icon.svg" alt=""></div>
      <h2>Welcome to Itàn</h2><p class="wl-sub">Ìtàn means <i>story</i> in Yoruba. Every film starts with one.</p>
      <div class="wl-stages"><div><b>Prep</b><span>Write and break down the script, storyboard, schedule, budget and call sheets</span></div>
        <div><b>Shoot</b><span>Run the day from every phone: what’s shooting now, takes, the light, the clock</span></div>
        <div><b>Post</b><span>Review cuts, get client approval, track the edit and festivals</span></div></div>
      <div class="wl-go"><button class="pri big" id="wlSample">Explore a sample film</button><button class="wl-b" id="wlOwn">Start my own film</button><button class="wl-b" id="wlBoards">Just use boards</button></div>
      <p class="fine">It’s free, and everything stays on your device unless you share it.</p></div>`);
    m.classList.add('wide', 'wl-panel');
    m.querySelector('#wlSample').onclick = sample;
    m.querySelector('#wlOwn').onclick = ownFilm;
    m.querySelector('#wlBoards').onclick = () => { N.closeOv(); try { localStorage.setItem('itan:welcomed', '1'); } catch (e) {} };
  }
  N.welcome = welcome;

  /* ---------- the tour ---------- */
  const STEPS = [
    { tab: 'dk-director', sel: '.fstages', text: 'Itàn follows your film from start to finish: <b>Overview</b>, <b>Story</b>, <b>Plan</b>, <b>Shoot</b> and <b>Post</b>. Each stage has its tools, and the departments that work in it.' },
    { tab: 'dk-director', sel: '.dr-grid', text: 'The <b>Overview</b> is the director’s home: the next shoot day, how ready every department is, and what needs you, live as your team works.' },
    { tab: 'script', sel: '.sp-page', text: 'This is the script. It formats itself as you type, like Final Draft. You can also open a script from Final Draft, Fountain, a PDF or plain text.' },
    { tab: 'lined', sel: '.ls-stats', text: 'The <b>Lined script</b> draws each shot as a coloured line over the lines it covers. Scene 3 has no shots yet, so its lines are flagged in red, before the shoot, not in the edit.' },
    { tab: 'schedule', sel: '.board-cols', text: 'Scenes become colour-coded strips. Drag them into shoot days. Call sheets, Day Out of Days and reports are made from this.' },
    { tab: 'schedule', sel: '.fdesks', text: 'Each department has its own desk in the stage where it works: the 1st AD, art, wardrobe, makeup, props, lighting, grip, safety, transport and catering plan here.' },
    { tab: 'set', sel: '.set-start', text: 'On the day, <b>On set</b> turns every phone into the control room: the shot now and next, takes, the clock, and warnings before the light goes.' },
    { tab: 'post', sel: '.fbody', text: 'After the shoot, track the edit, sound and colour, send clients an approval link, and plan your festival run.' },
    { tab: null, sel: '#fwsClose', text: 'That’s the tour. Tap <b>Done</b> to see the film’s boards: storyboards, locations and moodboards. Use <b>Live</b> on any board to bring your team in. Have fun with The Last Danfo.' }
  ];
  let tip = null, ring = null, k = 0;
  function tour() { k = 0; show(); }
  N.tour = () => { if (F.root()) { F.open(); tour(); } };
  function end() { if (tip) tip.remove(); if (ring) ring.remove(); tip = ring = null; document.removeEventListener('keydown', key, true); }
  const key = e => { if (!tip) return; if (e.key === 'Escape') { e.stopPropagation(); end(); } if (e.key === 'ArrowRight') { e.stopPropagation(); next(1); } if (e.key === 'ArrowLeft') { e.stopPropagation(); next(-1); } };
  function next(dir) { k += dir; if (k < 0) k = 0; if (k >= STEPS.length) return end(); show(); }
  function show() {
    const st = STEPS[k];
    if (st.tab) F.open(st.tab);
    setTimeout(() => {
      const t = document.querySelector('.fws ' + st.sel) || document.querySelector(st.sel);
      if (!tip) { tip = document.createElement('div'); tip.className = 'tour'; tip.setAttribute('role', 'dialog'); document.body.append(tip); ring = document.createElement('div'); ring.className = 'tour-ring'; document.body.append(ring); document.addEventListener('keydown', key, true); }
      tip.innerHTML = `<p>${st.text}</p><div class="tour-foot"><span>${k + 1} of ${STEPS.length}</span><button class="ib" data-t="skip">${k === STEPS.length - 1 ? 'Close' : 'Skip tour'}</button>${k ? '<button class="ib" data-t="back">Back</button>' : ''}${k < STEPS.length - 1 ? '<button class="pri" data-t="next">Next</button>' : ''}</div>`;
      tip.onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'skip') end(); else next(b.dataset.t === 'next' ? 1 : -1); };
      if (!t) { ring.style.display = 'none'; tip.style.left = '50%'; tip.style.top = '40%'; tip.style.transform = 'translate(-50%,-50%)'; return; }
      t.scrollIntoView({ block: 'nearest' });
      const r = t.getBoundingClientRect(), pad = 6; ring.style.display = '';
      Object.assign(ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: Math.min(r.height, innerHeight - r.top - 20) + pad * 2 + 'px' });
      tip.style.transform = ''; const tw = Math.min(360, innerWidth - 24), below = r.top + Math.min(r.height, 260) + 16;
      tip.style.width = tw + 'px'; tip.style.left = Math.max(12, Math.min(innerWidth - tw - 12, r.left + Math.min(r.width, 600) / 2 - tw / 2)) + 'px';
      tip.style.top = (below + 160 < innerHeight ? below : Math.max(12, r.top - 170)) + 'px';
      tip.querySelector('[data-t=next], [data-t=skip]').focus();
    }, 260);
  }

  // first run: welcome brand-new users only (not people with boards already, and not people opening a link)
  N.hooks.ready.push(() => {
    let seen = false; try { seen = !!localStorage.getItem('itan:welcomed'); } catch (e) {}
    if (seen || /^#(join|review|crew|cast)=/.test(N.startHash || location.hash) || document.body.classList.contains('guesting') || (N.live && N.live.joining)) return;
    const own = [...N.P.remote.keys()].length;
    if (own > 0) { try { localStorage.setItem('itan:welcomed', '1'); } catch (e) {} return; }
    setTimeout(() => { if (!document.querySelector('#dlg:not([hidden])') && !document.body.classList.contains('guesting')) welcome(); }, 500);
  });
})();
