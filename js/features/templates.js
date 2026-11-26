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

  const T = [
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
    cards = []; t.build(); const b = N.B(); N.snap();
    b.cards.push(...cards); if (b.title === 'Untitled board' || !b.title) b.title = t.name;
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
