/* Today: every unticked checklist item from every board in one list, grouped by due date.
   Reminders show a notification while Notera is open (or installed and running). */
(function () {
  const N = window.N, $ = N.$, esc = N.esc;
  const btn = $('#bToday');

  function allItems() {
    const out = [];
    for (const b of Object.values(N.S.boards)) {
      if (N.hooks.isLocked(b.id)) continue;
      for (const c of b.cards) if (c.type === 'todo') c.items.forEach((it, i) => { if (!it.d && it.t.trim()) out.push({ b, c, it, i }); });
    }
    return out;
  }
  function groups() {
    const t = N.todayStr(), g = { late: [], today: [], soon: [], later: [], none: [] };
    const wk = N.todayStr(7);
    for (const x of allItems()) {
      const d = x.it.due;
      if (!d) g.none.push(x); else if (d < t) g.late.push(x); else if (d === t) g.today.push(x); else if (d <= wk) g.soon.push(x); else g.later.push(x);
    }
    for (const k of ['late', 'today', 'soon', 'later']) g[k].sort((a, b) => a.it.due.localeCompare(b.it.due));
    return g;
  }
  function badge() {
    const g = groups(), n = g.late.length + g.today.length;
    const el = btn.querySelector('.badge');
    el.textContent = n; el.hidden = !n;
    btn.classList.toggle('alert', g.late.length > 0);
  }
  N.hooks.render.push(badge);
  N.hooks.saved.push(() => setTimeout(badge, 0));

  function row(x, k) {
    const path = N.pathOf(x.b.id).map(p => p.title || 'Untitled').join(' › ');
    return `<li class="trow" data-k="${k}"><button class="ck" data-tick="${k}" aria-label="Tick"><svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3"/></svg></button>
      <button class="tgo" data-go="${k}"><span>${esc(x.it.t)}</span><small>${esc(x.c.text || 'Checklist')} · ${esc(path)}</small></button>
      ${x.it.due ? `<span class="due${x.it.due < N.todayStr() ? ' late' : x.it.due === N.todayStr() ? ' now' : ''}">${esc(N.dueLabel(x.it.due))}</span>` : ''}</li>`;
  }
  let list = [];
  function open() {
    const g = groups(); list = [];
    const sec = (title, arr, cls) => {
      if (!arr.length) return '';
      return `<h3 class="tsec ${cls || ''}">${title} <em>${arr.length}</em></h3><ul class="tlist">${arr.map(x => { list.push(x); return row(x, list.length - 1); }).join('')}</ul>`;
    };
    const body = sec('Overdue', g.late, 'late') + sec('Today', g.today, 'now') + sec('Next 7 days', g.soon) + sec('Later', g.later) + sec('No date', g.none);
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const m = N.modal(`<h2>Today</h2><p>Unticked items from every checklist, soonest first. Add a date to any item with the calendar button beside it.</p>
      <div class="tbody">${body || '<div class="nores">Nothing left to do. Add a checklist to any board to see its items here.</div>'}</div>
      <div class="row">${perm === 'default' ? '<button class="pri" id="tRem">Turn on reminders</button>' : ''}<button data-close>Close</button></div>
      ${perm === 'granted' ? '<p class="fine">Reminders are on. They appear while Notera is open or installed on this device.</p>' : perm === 'denied' ? '<p class="fine">Reminders are blocked in this browser’s settings for this site.</p>' : ''}`);
    m.classList.add('wide');
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.addEventListener('click', e => {
      const t = e.target.closest('[data-tick]'), g2 = e.target.closest('[data-go]');
      if (t) {
        const x = list[+t.dataset.tick]; N.snap(); x.it.d = true; N.touch();
        const li = t.closest('li'); li.classList.add('done'); setTimeout(() => { li.classList.add('gone'); setTimeout(() => { li.remove(); }, 320); }, 380);
        if (x.b.id === N.S.cur) N.render(); badge();
      } else if (g2) { const x = list[+g2.dataset.go]; N.closeOv(); N.openBoard(x.b.id, () => requestAnimationFrame(() => N.focusCard(x.c.id))); }
    });
    const r = m.querySelector('#tRem');
    if (r) r.onclick = async () => { const p = await Notification.requestPermission().catch(() => 'denied'); N.toast(p === 'granted' ? 'Reminders are on' : 'Reminders stay off'); N.closeOv(); remind(); };
  }
  btn.addEventListener('click', open);
  document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey && !N.isEditing() && $('#dlg').hidden && $('#search').hidden) { e.preventDefault(); open(); } });

  // Reminders: once per item per day, for items due today or overdue
  async function remind() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const g = groups(), due = [...g.late, ...g.today], day = N.todayStr();
    let seen = {}; try { seen = JSON.parse(localStorage.getItem('notera:reminded') || '{}'); } catch (e) {}
    for (const k of Object.keys(seen)) if (seen[k] !== day) delete seen[k];
    const fresh = due.filter(x => seen[x.c.id + '|' + x.it.t] !== day);
    if (!fresh.length) return;
    fresh.forEach(x => seen[x.c.id + '|' + x.it.t] = day);
    try { localStorage.setItem('notera:reminded', JSON.stringify(seen)); } catch (e) {}
    const title = fresh.length === 1 ? fresh[0].it.t : `${fresh.length} things due`;
    const body = fresh.length === 1 ? `${fresh[0].it.due < day ? 'Overdue' : 'Due today'} · ${fresh[0].c.text || 'Checklist'}` : fresh.slice(0, 3).map(x => '• ' + x.it.t).join('\n');
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'notera-due' });
      else new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'notera-due' });
    } catch (e) {}
  }
  setTimeout(remind, 4000);
  setInterval(remind, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { badge(); remind(); } });
})();
