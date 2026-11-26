/* Film workspace: the shared home for a film's script breakdown, schedule, call sheets, shots and people.
   The film's data lives on the film's top board (board.extra.film), so every board inside it can reach it,
   it travels in .board files, and undo works on it like anything else. */
(function () {
  const N = window.N, S = N.S, esc = N.esc, $ = N.$;
  const F = N.film = { tabs: [] };
  const blank = title => ({ title: title || 'Our film', scenes: [], people: [], days: [], script: '', fps: 24 });

  F.root = (id = S.cur) => { let b = S.boards[id], g = 0; while (b && g++ < 60) { if (b.extra && b.extra.film) return b; b = b.parent ? S.boards[b.parent] : null; } return null; };
  F.data = () => { const r = F.root(); return r ? r.extra.film : null; };
  F.start = (board = N.B()) => { if (!board.extra.film) { N.snap(); board.extra.film = blank(board.title); N.touch(); } return board; };
  F.change = (fn, quiet) => { const d = F.data(); if (!d) return; N.snap(); fn(d); N.touch(); if (!quiet) F.refresh(); };
  F.uid = () => N.uid();
  // Ask for one line of text in a Itàn dialog (browser prompts are blocked in some places)
  F.ask = (title, placeholder, value = '') => new Promise(res => {
    const m = N.modal(`<h2>${esc(title)}</h2><form class="pinf askf"><input id="askIn" value="${esc(value)}" placeholder="${esc(placeholder || '')}" autocomplete="off"><button class="pri">OK</button></form><div class="row" style="padding-top:8px"><button data-close>Cancel</button></div>`);
    N.S.confirmRes = () => res(null);
    m.querySelector('[data-close]').onclick = N.closeOv;
    const i = m.querySelector('#askIn'); setTimeout(() => i.focus(), 30);
    m.querySelector('form').onsubmit = e => { e.preventDefault(); N.S.confirmRes = null; N.$('#dlg').hidden = true; res(i.value.trim() || null); };
  });
  // Scene helpers shared by every tab
  F.eighths = n => { n = Math.max(0, Math.round(n || 0)); const w = Math.floor(n / 8), r = n % 8; return (w ? w : '') + (r ? (w ? ' ' : '') + r + '/8' : (w ? '' : '0')); };
  F.sceneLabel = s => `${s.ie || 'INT'}. ${s.loc || 'Location'}${s.dn ? ' – ' + s.dn : ''}`;
  F.stripClass = s => { const e = /EXT/i.test(s.ie || ''), n = /NIGHT|EVENING|DUSK/i.test(s.dn || ''); return (e ? 'ext' : 'int') + (n ? '-night' : '-day'); };
  F.person = (d, id) => d.people.find(p => p.id === id);
  F.castOf = (d, s) => (s.cast || []).map(id => F.person(d, id)).filter(Boolean).sort((a, b) => (+a.num || 999) - (+b.num || 999));
  F.sortScenes = d => d.scenes.slice().sort((a, b) => String(a.num).localeCompare(String(b.num), undefined, { numeric: true }));

  /* ---------- the workspace ---------- */
  let ws = null, tab = 'breakdown';
  F.open = (which) => {
    let r = F.root();
    if (!r) { r = F.start(N.B()); N.toast('This board is now a film project'); }
    if (which) tab = which;
    if (!ws) {
      ws = document.createElement('div'); ws.className = 'fws'; ws.setAttribute('role', 'dialog'); ws.setAttribute('aria-label', 'Film workspace');
      document.body.append(ws); document.body.classList.add('filming');
      ws.addEventListener('click', e => { const t = e.target.closest('[data-ftab]'); if (t) { tab = t.dataset.ftab; F.refresh(); } if (e.target.closest('#fwsClose')) F.close(); });
    }
    F.refresh();
  };
  F.close = () => { if (!ws) return; ws.remove(); ws = null; document.body.classList.remove('filming'); N.render(); };
  F.isOpen = () => !!ws;
  F.tab = () => tab;
  // when a teammate changes the film while the workspace is open, show it (unless you're typing)
  let lastSnap = '';
  N.hooks.render.push(() => { if (!ws) return; const d = F.data(); if (!d) return; const snap = JSON.stringify(d); if (snap === lastSnap) return; if (N.isEditing() && ws.contains(document.activeElement)) return; lastSnap = snap; F.refresh(); });
  F.refresh = () => {
    if (!ws) return; const d = F.data(); if (!d) return F.close();
    const t = F.tabs.find(x => x.id === tab) || F.tabs[0]; tab = t.id;
    const sc = ws.querySelector('.fbody') ? ws.querySelector('.fbody').scrollTop : 0;
    ws.innerHTML = `<header class="fhead"><div class="ftitle"><span class="clap">${F.icon}</span><input id="fTitle" value="${esc(d.title)}" aria-label="Film title" ${N.P.canWrite ? '' : 'readonly'}></div>
      <nav class="ftabs">${F.tabs.map(x => `<button data-ftab="${x.id}" class="${x.id === tab ? 'on' : ''}">${esc(x.label)}</button>`).join('')}</nav>
      <button class="ib" id="fwsClose" aria-label="Close film workspace">Done</button></header><div class="fbody" data-tab="${t.id}"></div>`;
    lastSnap = JSON.stringify(d);
    const body = ws.querySelector('.fbody'); t.render(body, d); body.scrollTop = sc; const on = ws.querySelector('.ftabs .on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
    ws.querySelector('#fTitle').onchange = e => F.change(dd => { dd.title = e.target.value.trim() || 'Our film'; }, true);
  };
  document.addEventListener('keydown', e => { if (ws && e.key === 'Escape' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && $('#dlg').hidden) { e.stopPropagation(); F.close(); } }, true);

  const CLAP = '<path d="M4 9.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><path d="M4 9.5l-.6-3.2a1 1 0 0 1 .8-1.2l13.6-2.5a1 1 0 0 1 1.2.8l.5 2.6z"/><path d="M8 4.3l2.2 3.6M13 3.4l2.2 3.6"/>';
  F.icon = `<svg viewBox="0 0 24 24">${CLAP}</svg>`;
  // Top-bar button when you're inside a film
  N.hooks.tools.push(b => F.root(b.id) ? `<button class="ib filmbtn" id="fOpen" title="Open the film workspace: breakdown, schedule, call sheets, shots, people">${F.icon}<span class="hide-s">Film</span></button>` : '');
  $('#btools').addEventListener('click', e => { if (e.target.closest('#fOpen')) F.open(); });

  /* ---------- launcher cards on boards ---------- */
  const VIEWS = { script: 'Screenplay', budget: 'Budget', reports: 'Reports', breakdown: 'Script breakdown', schedule: 'Shooting schedule', callsheets: 'Call sheets', shots: 'Shot list', people: 'Cast and crew' };
  F.summary = (view, d) => {
    if (!d) return 'Open';
    const sc = d.scenes.length, days = d.days.length, shots = F.allShots ? F.allShots().length : 0;
    if (view === 'script') return d.screenplay && d.screenplay.length ? `${d.screenplay.filter(l => l.t === 'scene').length} scenes written` : 'Write your script';
    if (view === 'budget') return d.budget && F.budgetTotals ? (d.budget.cur + ' ' + Math.round(F.budgetTotals(d.budget).total).toLocaleString()) : 'Plan what it will cost';
    if (view === 'reports') return 'Day Out of Days, one-liner and more';
    return view === 'breakdown' ? (sc ? `${sc} scene${sc === 1 ? '' : 's'}` : 'Paste your script to start')
      : view === 'schedule' ? (days ? `${days} shoot day${days === 1 ? '' : 's'} · ${sc} scenes` : 'Plan your shoot days')
      : view === 'callsheets' ? (days ? `${days} call sheet${days === 1 ? '' : 's'}` : 'Made from your schedule')
      : view === 'shots' ? (shots ? `${shots} shot${shots === 1 ? '' : 's'}` : 'Every shot in the film')
      : `${d.people.filter(p => p.kind === 'cast').length} cast · ${d.people.filter(p => p.kind === 'crew').length} crew`;
  };
  N.TYPES.push('film'); N.DEFW.film = 260; N.MINW.film = 200; N.EH.film = 90; N.TN.film = 'Film workspace';
  N.hooks.cardTypes.film = {
    render: c => { const v = VIEWS[c.view] ? c.view : 'breakdown', d = F.root() ? F.data() : null;
      return `<button class="flaunch" data-fview="${v}"><span class="fl-ic">${F.icon}</span><span class="fl-t"><b>${esc(VIEWS[v])}</b><small>${esc(F.summary(v, d))}</small></span><span class="fl-go">Open</span></button>`; }
  };
  N.world.addEventListener('click', e => { const b = e.target.closest('[data-fview]'); if (b) F.open(b.dataset.fview); });

  /* ---------- People tab ---------- */
  F.tabs.push({ id: 'people', label: 'People', order: 50, render(el, d) {
    const row = p => `<tr data-pid="${esc(p.id)}">${p.kind === 'cast' ? `<td class="num"><input data-k="num" value="${esc(p.num || '')}" aria-label="Cast number" inputmode="numeric"></td>` : ''}
      <td><input data-k="role" value="${esc(p.role || '')}" placeholder="${p.kind === 'cast' ? 'Character' : 'Job'}" aria-label="${p.kind === 'cast' ? 'Character' : 'Job'}"></td>
      <td><input data-k="name" value="${esc(p.name || '')}" placeholder="Name" aria-label="Name"></td>
      <td><input data-k="phone" value="${esc(p.phone || '')}" placeholder="Phone" aria-label="Phone" inputmode="tel"></td>
      <td class="act"><button class="ib" data-del="${esc(p.id)}" aria-label="Remove">✕</button></td></tr>`;
    const table = (kind, title, hint) => { const ps = d.people.filter(p => p.kind === kind); if (kind === 'cast') ps.sort((a, b) => (+a.num || 999) - (+b.num || 999));
      return `<section class="fsec"><h3>${title}</h3><p class="fhint">${hint}</p><table class="ftable stack"><thead><tr>${kind === 'cast' ? '<th>No.</th>' : ''}<th>${kind === 'cast' ? 'Character' : 'Job'}</th><th>Name</th><th>Phone</th><th></th></tr></thead><tbody>${ps.map(row).join('') || `<tr><td colspan="5" class="empty-row">No ${kind} yet</td></tr>`}</tbody></table><button class="add" data-addp="${kind}">+ Add ${kind === 'cast' ? 'cast member' : 'crew member'}</button></section>`; };
    el.innerHTML = `<div class="fwrap">${table('cast', 'Cast', 'Characters found in your script appear here. Cast numbers are used on strips and call sheets.')}${table('crew', 'Crew', 'Everyone behind the camera. They’re listed on call sheets.')}</div>`;
    el.onchange = e => { const tr = e.target.closest('[data-pid]'); if (!tr) return; F.change(dd => { const p = F.person(dd, tr.dataset.pid); if (p) p[e.target.dataset.k] = e.target.value.trim(); }, true); };
    el.onclick = e => {
      const a = e.target.closest('[data-addp]'), del = e.target.closest('[data-del]');
      if (a) F.change(dd => { const kind = a.dataset.addp; dd.people.push({ id: F.uid(), kind, num: kind === 'cast' ? String(Math.max(0, ...dd.people.filter(p => p.kind === 'cast').map(p => +p.num || 0)) + 1) : '', role: '', name: '', phone: '' }); });
      if (del) F.change(dd => { dd.people = dd.people.filter(p => p.id !== del.dataset.del); dd.scenes.forEach(s => s.cast = (s.cast || []).filter(id => id !== del.dataset.del)); });
    };
  } });
  // keep tabs in a fixed order whatever order the files load in
  F.sortTabs = () => F.tabs.sort((a, b) => (a.order || 0) - (b.order || 0));
  N.hooks.ready.push(F.sortTabs);
})();
