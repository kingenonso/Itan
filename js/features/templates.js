/* Templates: ready-made starting points shown on any empty board. */
(function () {
  const N = window.N, esc = N.esc;
  // helpers that build cards at positions
  let cards;
  const add = (type, x, y, props = {}) => { const c = N.newCard(type, x, y, props); delete c.o; c.o = Date.now() * 100 + cards.length; cards.push(c); return c; };
  const list = (title, items, x, y, w = 300, props = {}) => add('todo', x, y, { text: title, w, items: items.map(t => typeof t === 'string' ? { t, d: false } : t), ...props });
  const col = (title, notes, x, y, w = 260) => { const c = add('column', x, y, { text: title, w, items: [] }); notes.forEach(t => { const k = add('note', 0, 0, { text: t, col: c.id }); c.items.push(k.id); }); return c; };
  const note = (t, x, y, w = 280, color) => add('note', x, y, { text: t, w, ...(color ? { color } : {}) });
  const head = (t, x, y, w = 520) => add('heading', x, y, { text: t, w });
  const inDays = n => N.todayStr(n);
  // A board card whose board is filled by fill(); nested boards work the same way
  let parentId = null;
  const sub = (title, color, x, y, fill) => {
    const S = N.S, id = 'b' + N.uid();
    S.boards[id] = N.normalize({ id, title, parent: parentId || S.cur, cards: [], links: [], created: Date.now() });
    const outer = cards, outerParent = parentId; cards = []; parentId = id;
    fill(); S.boards[id].cards = cards;
    cards = outer; parentId = outerParent;
    return add('board', x, y, { board: id, color, w: 190 });
  };
  const launch = (view, x, y, w = 300) => add('film', x, y, { view, w });
  const shotCol = (title, shots, x, y, w = 300) => { const c = add('column', x, y, { text: title, w, items: [] }); shots.forEach(([scene, letter, size, lens, move, angle, text]) => { const k = add('shot', 0, 0, { scene, letter, size, lens, move, angle, text, status: 'todo', col: c.id }); c.items.push(k.id); }); return c; };

  const T = [
    { id: 'film', name: 'Film production', after: b => { if (N.film && !b.extra.film) { b.extra.film = { title: ['Film production', 'Untitled board', ''].includes(b.title) ? 'Our film' : b.title, scenes: [], people: [], days: [], script: '', fps: 24 }; } }, build() {
      head('Our film', 40, 30, 600);
      note('Logline\n\nOne or two sentences: who wants what, what stands in the way, and what happens if they fail.', 40, 110, 320, '#8f5ae8');
      const pre = sub('Pre-production', '#4b6bff', 400, 110, () => {
        head('Pre-production', 40, 30);
        list('Before the shoot', ['Lock the script', 'Break down the script', 'Storyboard key scenes', 'Make the shot list', 'Cast the actors', 'Scout and confirm locations', 'Get permission for every location', 'Book the crew', 'Plan the shoot days', 'Confirm the budget', 'Gear list and rentals', 'Release forms ready'], 40, 110, 320);
        sub('Script and story', '#8f5ae8', 400, 110, () => {
          head('Script and story', 40, 30);
          launch('script', 720, 110, 320);
          launch('breakdown', 720, 220, 320);
          note('Logline\n\n', 40, 110, 300); note('Synopsis\n\nBeginning:\nMiddle:\nEnd:', 360, 110, 320);
          col('Characters', ['Name · age · what they want', 'Name · age · what they want'], 40, 300, 300);
          col('Script drafts', ['Draft 1 · paste a link to the script or drop the PDF here'], 360, 300, 320);
        });
        sub('Storyboard', '#e0508f', 610, 110, () => {
          head('Storyboard', 40, 30);
          note('Drop a sketch or reference picture into each column under its shot. Record a voice note to explain the feel of a scene.', 40, 100, 520);
          ['Scene 1', 'Scene 2', 'Scene 3'].forEach((t, i) => col(t, ['Shot 1 · what we see', 'Shot 2 · what we see'], 40 + i * 300, 190, 280));
        });
        sub('Shot list', '#2a9ec4', 820, 110, () => {
          head('Shot list', 40, 30);
          note('Add a Shot from the dock for each shot. Drop a sketch or photo on a shot to use it as the storyboard frame, and tap its status as you shoot.', 40, 100, 600);
          launch('shots', 680, 100, 300);
          shotCol('Scene 1 · INT. House · Day', [['1', 'A', 'Wide', '17mm', 'Static', 'Eye level', 'Establish the room'], ['1', 'B', 'Medium', '28mm', 'Push in', 'Eye level', 'Lead enters'], ['1', 'C', 'Close-up', '50mm', 'Handheld', 'Low', 'Reaction']], 40, 200, 300);
          shotCol('Scene 2 · EXT. Street · Night', [['2', 'A', 'Wide', '20mm', 'Gimbal', 'Eye level', 'Walking towards camera']], 360, 200, 300);
          col('Pickups and extras', ['B-roll · hands, details, textures'], 680, 200, 300);
        });
        sub('Locations', '#36a86d', 400, 330, () => {
          head('Locations', 40, 30);
          col('Ideas', ['Location name · paste a map link'], 40, 110); col('Scouted', [], 320, 110); col('Confirmed', [], 600, 110);
          note('For each location\n\nAddress:\nContact and phone:\nPermission or fee:\nPower sockets:\nNoise:\nBest light (time of day):\nParking and toilets:', 880, 110, 300, '#36a86d');
        });
        sub('Cast and crew', '#f39a1e', 610, 330, () => {
          head('Cast and crew', 40, 30);
          launch('people', 40, 110, 320);
          note('Characters from your script are added automatically when you bring the script into the breakdown. Add actors’ names and phone numbers there so they appear on call sheets.', 40, 210, 320);
          list('Paperwork', ['Actor release forms', 'Location agreements', 'Crew agreements and rates'], 400, 110, 300);
        });
        sub('Schedule', '#737a84', 820, 330, () => {
          head('Shoot schedule', 40, 30);
          launch('schedule', 40, 100, 320);
          launch('reports', 40, 210, 320);
          note('Drag scene strips into shoot days. Shoot scenes in the same place together, whatever their order in the story. Group by location does that for you.', 400, 100, 360);
        });
        sub('Budget', '#36a86d', 400, 550, () => {
          head('Budget', 40, 30);
          launch('budget', 40, 110, 320);
          note('The budget adds up every department, with a contingency on top, and tracks what you actually spend. Add cast and crew fills in a line for everyone on the People tab.', 400, 110, 360);
        });
        sub('Gear', '#2a9ec4', 610, 550, () => {
          head('Gear', 40, 30);
          list('Camera', ['Camera body and batteries', 'Lenses', 'Memory cards, formatted', 'Monitor', 'Gimbal or tripod'], 40, 110, 280);
          list('Sound', ['Recorder or mic', 'Lavalier mics', 'Headphones', 'Spare batteries'], 350, 110, 280);
          list('Light and grip', ['Key light', 'Fill or bounce', 'Stands and sandbags', 'Extension cables'], 660, 110, 280);
          list('Data', ['Hard drive 1', 'Hard drive 2 (backup)', 'Card reader', 'Laptop and charger'], 970, 110, 280);
        });
      });
      const prod = sub('Production', '#ff5a3c', 610, 110, () => {
        head('Production', 40, 30);
        list('Every shoot day', ['Call sheet sent the night before', 'Batteries charged', 'Cards formatted', 'White balance and exposure checked', 'Slate every take', 'Record 30 seconds of room tone', 'Back up cards twice before formatting'], 40, 110, 320);
        sub('Call sheets', '#ff5a3c', 400, 110, () => {
          head('Call sheets', 40, 30);
          launch('callsheets', 40, 110, 320);
          note('Each shoot day on the schedule gets a call sheet with its scenes, cast and call times. Add the address, parking, weather and nearest hospital, then send it to everyone on WhatsApp.', 400, 110, 360, '#ff5a3c');
        });
        sub('Shot tracker', '#2a9ec4', 610, 110, () => {
          head('Shot tracker', 40, 30);
          launch('shots', 40, 100, 320);
          note('Tap a shot’s status as you go: To shoot, Done, Pickup. The shot list shows what’s left for the day.', 400, 100, 360);
        });
        sub('Continuity', '#e0508f', 400, 330, () => {
          head('Continuity', 40, 30);
          note('Take a photo at the end of every scene and drop it here, so wardrobe, props and hair match when you come back.', 40, 100, 560);
          col('Scene 1', ['Wardrobe:', 'Props:', 'Hair and makeup:'], 40, 190, 280); col('Scene 2', [], 340, 190, 280);
        });
        sub('Footage log', '#737a84', 610, 330, () => {
          head('Footage log', 40, 30);
          list('Cards backed up', ['A001 · Day 1 · scenes 1–2 · drive 1 and 2'], 40, 110, 360);
          note('Good takes\n\n1A take 3 · best\n1B take 2 · focus soft at the end', 430, 110, 320, '#36a86d');
        });
      });
      const post = sub('Post-production', '#36a86d', 820, 110, () => {
        head('Post-production', 40, 30);
        list('After the shoot', ['Back up and organise footage', 'Sync sound', 'Assembly edit', 'Rough cut', 'Picture lock', 'Colour grade', 'Sound mix', 'Music licensed', 'Titles and credits', 'Subtitles', 'Export masters', 'Deliver'], 40, 110, 320);
        sub('Edit', '#4b6bff', 400, 110, () => {
          head('Edit', 40, 30);
          col('Assembly', ['Every usable take, in script order'], 40, 110); col('Rough cut', [], 320, 110); col('Fine cut', [], 600, 110); col('Locked', [], 880, 110);
        });
        sub('Colour', '#e2c02a', 610, 110, () => {
          head('Colour', 40, 30);
          note('Pipeline\n\nLog footage → colour space transform → balance → look → output for Rec.709 (or your delivery format)', 40, 110, 360);
          note('Look notes\n\nDrop reference stills and pick colours for the mood.', 420, 110, 300);
          add('swatch', 40, 300, { hex: '#1d2a3a', text: 'Shadows', w: 140 }); add('swatch', 196, 300, { hex: '#c98a5b', text: 'Skin', w: 140 }); add('swatch', 352, 300, { hex: '#e9dcc4', text: 'Highlights', w: 140 });
        });
        sub('Sound and music', '#8f5ae8', 400, 330, () => {
          head('Sound and music', 40, 30);
          list('Sound', ['Clean up dialogue', 'Fill gaps with room tone', 'Sound effects', 'Music', 'Final mix and levels'], 40, 110, 300);
          col('Music ideas', ['Track · artist · licence'], 370, 110, 300);
        });
        sub('Feedback', '#f39a1e', 610, 330, () => {
          head('Feedback', 40, 30);
          note('Drop each cut here as a video, then press Review on it: pause anywhere and pin a note to that moment. Export the notes as markers for DaVinci Resolve.', 40, 100, 560, '#f39a1e');
          col('New notes', [], 40, 190); col('Fixing', [], 320, 190); col('Done', [], 600, 190);
        });
        sub('Delivery', '#36a86d', 400, 550, () => {
          head('Delivery', 40, 30);
          list('Deliverables', ['Master file', 'Online version', 'Vertical cut 9:16 for social', 'Trailer', 'Poster and stills', 'Subtitle file', 'Archive copy of the project and footage'], 40, 110, 320);
        });
      });
      launch('breakdown', 40, 560, 320); launch('schedule', 400, 330, 300);
      list('Key dates', [{ t: 'Script locked', d: false, due: inDays(14) }, { t: 'First shoot day', d: false, due: inDays(30) }, { t: 'Picture lock', d: false, due: inDays(60) }, { t: 'Release', d: false, due: inDays(90) }], 40, 320, 320);
      cards.push({ id: N.uid(), _link: [pre.id, prod.id] }, { id: N.uid(), _link: [prod.id, post.id] });
    } },
    { id: 'event', name: 'Wedding or event', build() {
      head('Our event', 40, 30);
      col('To book', ['Venue', 'Caterer', 'Photographer', 'DJ / MC', 'Decorator'], 40, 110);
      col('Booked', [], 320, 110); col('Paid', [], 600, 110);
      list('Guest list', ['Family', 'Friends', 'Colleagues'], 880, 110, 280);
      note('Budget\n\nTotal:\nSpent so far:\nLeft:', 880, 330, 280, '#36a86d');
      list('On the day', ['Confirm vendors', 'Collect outfits', 'Charge phones and cameras', 'Thank-you speech'], 40, 520, 300);
      add('swatch', 360, 520, { hex: '#7b2d43', text: 'Colour 1', w: 140 }); add('swatch', 512, 520, { hex: '#e6c07b', text: 'Colour 2', w: 140 }); add('swatch', 664, 520, { hex: '#f4efe6', text: 'Colour 3', w: 140 });
    } },
    { id: 'biz', name: 'Business plan', build() {
      head('Business plan', 40, 30);
      const qs = [['The problem', 'What problem do customers have?'], ['Customers', 'Who exactly will pay? Where are they?'], ['Offer and price', 'What do we sell, and for how much?'], ['Getting customers', 'WhatsApp, Instagram, referrals, walk-ins…'], ['Costs', 'Start-up costs:\nMonthly costs:'], ['Competitors', 'Who else does this? Why choose us?']];
      qs.forEach(([t, q], i) => note(t + '\n\n' + q, 40 + (i % 3) * 300, 110 + Math.floor(i / 3) * 210, 280));
      list('Next 30 days', [{ t: 'Talk to 10 possible customers', d: false, due: inDays(7) }, { t: 'Price the first offer', d: false, due: inDays(10) }, { t: 'Register the business name', d: false, due: inDays(30) }], 960, 110, 300);
    } },
    { id: 'content', name: 'Content calendar', build() {
      head('Content calendar', 40, 30);
      ['Ideas', 'Scripting', 'Filming', 'Editing', 'Posted'].forEach((t, i) => col(t, i === 0 ? ['Behind the scenes', 'Answer a common question', 'Before and after'] : [], 40 + i * 280, 110));
      note('Best posting times\n\nWeekdays: 7–9 pm\nWeekends: 12–2 pm', 1440, 110, 260, '#2a9ec4');
    } },
    { id: 'study', name: 'Study timetable', build() {
      head('Study timetable', 40, 30);
      col('This week', ['Topic 1 notes', 'Practice questions'], 40, 110); col('Revising', [], 320, 110); col('Done', [], 600, 110);
      list('Exam dates', [{ t: 'First paper', d: false, due: inDays(30) }, { t: 'Second paper', d: false, due: inDays(37) }], 880, 110, 300);
      note('Goals\n\n• \n• \n• ', 880, 330, 300, '#8f5ae8');
    } },
    { id: 'move', name: 'Moving house', build() {
      head('Moving house', 40, 30);
      list('Before moving', ['Give notice to landlord', 'Book a van or truck', 'Pack room by room', 'Change address with bank'], 40, 110, 300);
      list('Moving day', ['Meter readings', 'Keys handed over', 'Check every room is empty'], 370, 110, 300);
      list('First week', ['Set up internet', 'Change locks', 'Meet the neighbours'], 700, 110, 300);
      note('Useful contacts\n\nLandlord:\nMovers:\nElectrician:', 1030, 110, 260, '#f39a1e');
    } },
    { id: 'trip', name: 'Trip', build() {
      head('Trip plan', 40, 30);
      list('Pack', ['Passport / ID', 'Chargers', 'Clothes for 5 days', 'Medicines'], 40, 110, 280);
      note('Itinerary\n\nDay 1:\nDay 2:\nDay 3:', 350, 110, 300);
      col('Places to see', ['', ''], 680, 110);
      note('Budget\n\nTransport:\nStay:\nFood:', 960, 110, 260, '#36a86d');
    } },
    { id: 'week', name: 'Weekly planner', build() {
      head('This week', 40, 30);
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Weekend'].forEach((d, i) => col(d, [], 40 + i * 240, 110, 220));
    } },
    { id: 'mood', name: 'Moodboard', build() {
      head('Moodboard', 40, 30);
      ['#1f3a5f', '#e8b04b', '#d9d4c7', '#a44a3f'].forEach((h, i) => add('swatch', 40 + i * 166, 110, { hex: h, text: '', w: 150 }));
      note('Words for the mood\n\nCalm · warm · handmade', 40, 290, 300);
      note('Drop pictures and videos onto the board to collect references.', 370, 290, 300);
    } }
  ];
  function apply(t) {
    if (!N.P.canWrite) return;
    N.snap(); cards = []; parentId = null; t.build(); const b = N.B();
    const links = cards.filter(c => c._link); cards = cards.filter(c => !c._link);
    b.cards.push(...cards); if (t.after) t.after(b); links.forEach(l => b.links.push({ id: N.uid(), from: l._link[0], to: l._link[1] })); if (b.title === 'Untitled board' || !b.title) b.title = t.name;
    N.touch(); N.S.entering = true; N.render(); requestAnimationFrame(() => N.fit(1));
  }
  const empty = N.$('#empty');
  const tray = document.createElement('div'); tray.className = 'tpl';
  tray.innerHTML = '<span>Or start from a template</span><div>' + T.map(t => `<button data-tpl="${t.id}">${esc(t.name)}</button>`).join('') + '</div>';
  empty.append(tray);
  tray.addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b) apply(T.find(t => t.id === b.dataset.tpl)); });
  N.hooks.render.push(() => { tray.hidden = !N.P.canWrite; });
  N.templates = T;
})();
