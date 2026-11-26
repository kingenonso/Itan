/* Links for people outside the team, through the free Itàn Live server:
   - Approval link: a client or producer watches a cut in the browser, leaves notes at exact moments, then approves it or asks for changes.
     Their notes arrive in the video's review notes.
   - Crew sign-up link: crew enter their name, job, phone and the shoot days they're free. Add them to the People tab in one tap.
   Guests don't need an account or the app: the link opens a simple page. */
(function () {
  const N = window.N, F = N.film, esc = N.esc, S = N.S;
  const API = (window.APP_CONFIG && window.APP_CONFIG.live) || '';
  const WEB = (window.APP_CONFIG && window.APP_CONFIG.web) || 'https://kingenonso.github.io/Itan/';
  const MAX = 95 * 1024 * 1024;
  const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join('');
  const base = () => (/^https?:/.test(location.protocol) && !/localhost|127\.0\.0\.1|tauri/.test(location.host) ? location.origin + location.pathname : WEB);
  const linkOf = (kind, g) => `${base()}#${kind}=${g.room}.${g.view}`;
  const api = (g, path, opt = {}) => fetch(`${API}/rooms/${g.room}/${path}`, { ...opt, headers: { 'X-Key': opt.key || g.key, ...(opt.headers || {}) } });
  const short = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  async function makeRoom(root, title) {
    const g = { room: rnd(16), key: rnd(18), view: rnd(18) };
    const r = await fetch(`${API}/rooms/${g.room}/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edit: g.key, view: g.view, root, title: String(title || '').slice(0, 150) }) });
    if (!r.ok) throw new Error('init'); return g;
  }
  const findCard = id => { for (const b of Object.values(S.boards)) { const c = b.cards.find(x => x.id === id); if (c) return c; } return null; };
  const linkBox = (label, url, msg) => `<div class="lv-link"><div><b>${label}</b></div><input readonly value="${esc(url)}" aria-label="${label}"><button class="ib" data-copy="${esc(url)}">Copy</button><a class="ib" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg + ' ' + url)}">WhatsApp</a></div>`;
  const wireCopy = m => m.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) { b.previousElementSibling.select(); document.execCommand('copy'); } N.toast('Link copied'); });

  /* ================= approval links (owner side) ================= */
  F.approval = async (cardId) => {
    if (!API) return N.toast('Approval links need the Itàn Live server');
    let c = findCard(cardId); if (!c) return;
    if (!c.approval) {
      const blob = await N.Store.getMedia(c.media).catch(() => null); if (!blob) return N.toast('This video isn’t on this device');
      if (blob.size > MAX) return N.toast('This video is over 95 MB. Export a smaller review copy (for example 1080p H.264) and add that instead.');
      const ok = await N.confirmBox(`Upload “${c.text || 'this video'}” (${(blob.size / 1048576).toFixed(0)} MB) so your client can watch it in their browser and approve it? Anyone with the link can watch it.`, 'Upload and get link');
      if (!ok) return;
      N.status('Uploading the video…');
      try {
        const d = F.data(), title = c.text || (d ? d.title + ' · cut' : 'Video'), g = await makeRoom('rv' + c.id.replace(/[^A-Za-z0-9_-]/g, ''), title);
        const up = await api(g, `media/${c.media}`, { method: 'PUT', headers: { 'X-Type': blob.type || 'video/mp4' }, body: blob }); if (!up.ok) throw new Error('upload');
        await api(g, 'form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'review', title, film: d ? d.title : '', media: c.media, fps: c.fps || (d && d.fps) || 24 }) });
        c = findCard(cardId); N.snap(); c.approval = { ...g, status: 'waiting', seen: 0, at: Date.now() }; N.touch(); N.render();
      } catch (e) { N.settled(); return N.toast('Couldn’t upload. Check your internet and try again.'); }
      N.settled();
    }
    c = findCard(cardId); const a = c.approval;
    await syncApproval(cardId, true);
    c = findCard(cardId);
    const status = { waiting: 'Waiting for the client', approved: `Approved${a.by ? ' by ' + a.by : ''}`, changes: `Changes asked${a.by ? ' by ' + a.by : ''}` }[c.approval.status] || '';
    const m = N.modal(`<h2>Approval link</h2><p>Send this to your client or producer. They watch “${esc(c.text || 'the video')}” in their browser, leave notes at exact moments, and approve it or ask for changes. Their notes show up in Review.</p>
      <p class="ap-st ap-${esc(c.approval.status)}">${esc(status)}${c.approval.msg ? ': “' + esc(c.approval.msg) + '”' : ''}</p>
      ${linkBox('Approval link', linkOf('review', a), `Please review “${c.text || 'the cut'}”:`)}
      <div class="row"><button class="pri" data-close>Done</button><button id="apCheck">Check for new notes</button><button id="apNew">New link for a new cut</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv; wireCopy(m);
    m.querySelector('#apCheck').onclick = async () => { N.closeOv(); const n = await syncApproval(cardId, true); N.toast(n ? `${n} new note${n === 1 ? '' : 's'} from your client` : 'Nothing new yet'); };
    m.querySelector('#apNew').onclick = async () => { N.closeOv(); const k = findCard(cardId); N.snap(); delete k.approval; N.touch(); F.approval(cardId); };
  };
  async function syncApproval(cardId, quiet) {
    let c = findCard(cardId); if (!c || !c.approval || !API) return 0;
    let items; try { const r = await api(c.approval, `feedback?after=${c.approval.seen || 0}`); if (!r.ok) return 0; items = (await r.json()).items; } catch (e) { return 0; }
    if (!items.length) return 0;
    c = findCard(cardId); N.snap(); let notes = 0, verdict = null;
    items.forEach(({ id, t, body: b }) => {
      if (b.kind === 'note' && b.text) { c.notes = [...(c.notes || []), { id: 'fb' + id, t: Math.max(0, +b.t || 0), text: `${String(b.name || 'Client').slice(0, 40)}: ${String(b.text).slice(0, 2000)}`, done: false, from: 'client' }]; notes++; }
      if (b.kind === 'verdict') { verdict = b; c.approval.status = b.status === 'approved' ? 'approved' : 'changes'; c.approval.by = String(b.name || '').slice(0, 40); c.approval.msg = String(b.text || '').slice(0, 500); c.approval.when = t; }
      c.approval.seen = Math.max(c.approval.seen || 0, id);
    });
    N.touch(); N.render();
    if (!quiet || verdict) N.toast(verdict ? `${c.approval.by || 'Your client'} ${c.approval.status === 'approved' ? 'approved' : 'asked for changes to'} “${c.text || 'the video'}”` : `${notes} new note${notes === 1 ? '' : 's'} on “${c.text || 'the video'}”`);
    return notes;
  }
  F.syncApproval = syncApproval;
  async function syncAll() {
    if (!API || !navigator.onLine) return;
    for (const b of Object.values(S.boards)) for (const c of b.cards) if (c.approval && c.approval.room) await syncApproval(c.id);
    const r = N.film && Object.values(S.boards).filter(b => b.extra && b.extra.film && b.extra.film.signup);
    if (r) for (const b of r) await syncSignups(b.id);
  }

  /* ================= crew sign-ups (owner side) ================= */
  const formOf = d => ({ kind: 'crew', title: d.title, days: d.days.map((x, i) => ({ id: x.id, label: `Day ${i + 1}`, date: x.date || '', call: x.call || '' })) });
  async function syncSignups(rootId, quiet = true) {
    const b = S.boards[rootId], d = b && b.extra && b.extra.film; if (!d || !d.signup) return 0;
    const g = d.signup, fs = JSON.stringify(formOf(d));
    try {
      if (g.form !== fs) { const r = await api(g, 'form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: fs }); if (r.ok) { N.snap(); S.boards[rootId].extra.film.signup.form = fs; N.touch(); } }
      const r = await api(g, `feedback?after=${g.seen || 0}`); if (!r.ok) return 0; const items = (await r.json()).items; if (!items.length) return 0;
      N.snap(); const dd = S.boards[rootId].extra.film; dd.signups = dd.signups || [];
      items.forEach(({ id, t, body: x }) => { if (x.kind === 'signup' && x.name) dd.signups.push({ id: 'su' + id, t, name: String(x.name).slice(0, 60), phone: String(x.phone || '').slice(0, 40), job: String(x.job || '').slice(0, 60), days: Array.isArray(x.days) ? x.days.map(String).slice(0, 100) : [], note: String(x.note || '').slice(0, 500), added: false }); dd.signup.seen = Math.max(dd.signup.seen || 0, id); });
      N.touch(); if (F.isOpen()) F.refresh();
      if (!quiet) return items.length; N.toast(`${items.length} new crew sign-up${items.length === 1 ? '' : 's'} for “${dd.title}”`); return items.length;
    } catch (e) { return 0; }
  }
  async function crewLink(d) {
    if (!API) return N.toast('Sign-up links need the Itàn Live server');
    const root = F.root();
    if (!d.signup) {
      N.status('Making the link…');
      try { const g = await makeRoom('cr' + root.id.replace(/[^A-Za-z0-9_-]/g, ''), d.title); F.change(dd => { dd.signup = { ...g, seen: 0, form: '' }; }); await syncSignups(root.id); }
      catch (e) { N.settled(); return N.toast('Couldn’t make the link. Check your internet.'); }
      N.settled();
    }
    const g = F.data().signup;
    const m = N.modal(`<h2>Crew sign-up link</h2><p>Send it to crew you’d like to hire. They enter their name, job and phone, and tick the shoot days they’re free. You’ll see them here on the People tab.</p>
      ${linkBox('Sign-up link', linkOf('crew', g), `Crew call for “${d.title}”. Tell us your job and which days you’re free:`)}
      <p class="fine">The shoot days on the form update when you change your schedule.</p><div class="row"><button class="pri" data-close>Done</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv; wireCopy(m);
  }

  // sign-ups on the People tab
  N.hooks.ready.push(() => {
    const t = F && F.tabs.find(x => x.id === 'people'); if (!t || t._guest) return; t._guest = true;
    const base0 = t.render;
    t.render = function (el, d) {
      base0.call(this, el, d);
      if (!API) return;
      const su = (d.signups || []).slice().sort((a, b) => b.t - a.t), days = d.days;
      const sec = document.createElement('section'); sec.className = 'fsec su';
      sec.innerHTML = `<h3>Crew sign-ups</h3><p class="fhint">Share a link so crew can put themselves forward and say which shoot days they’re free.</p>
        ${su.length ? `<div class="fs-wrap"><table class="ftable su-t"><thead><tr><th>Name</th><th>Job</th><th>Phone</th>${days.map((x, i) => `<th class="c" title="${esc(x.date ? F.fmtDate(x.date) : '')}">Day ${i + 1}</th>`).join('')}<th></th></tr></thead><tbody>
          ${su.map(x => `<tr data-su="${esc(x.id)}"><td><b>${esc(x.name)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}</td><td>${esc(x.job)}</td><td>${esc(x.phone)}</td>${days.map(dy => `<td class="c">${x.days.includes(dy.id) ? '<span class="su-y">✓</span>' : '<span class="su-n">–</span>'}</td>`).join('')}
          <td class="act">${x.added ? '<span class="fhint">Added</span>' : '<button class="ib xs su-add" data-suadd>Add to crew</button>'}</td></tr>`).join('')}
          <tr class="tot"><td colspan="3">Free each day</td>${days.map(dy => `<td class="c"><b>${su.filter(x => x.days.includes(dy.id)).length}</b></td>`).join('')}<td></td></tr></tbody></table></div>` : ''}
        <div class="row" style="padding:10px 0 0"><button class="pri" id="suLink">${d.signup ? 'Show the sign-up link' : 'Get a crew sign-up link'}</button>${d.signup ? '<button class="ib" id="suCheck">Check for new sign-ups</button>' : ''}</div>`;
      el.querySelector('.fwrap').append(sec);
      sec.onclick = async e => {
        if (e.target.closest('#suLink')) return crewLink(d);
        if (e.target.closest('#suCheck')) { const n = await syncSignups(F.root().id, false); return N.toast(n ? `${n} new sign-up${n === 1 ? '' : 's'}` : 'No new sign-ups yet'); }
        const add = e.target.closest('[data-suadd]'); if (add) { const id = add.closest('[data-su]').dataset.su; F.change(dd => { const x = dd.signups.find(y => y.id === id); x.added = true; dd.people.push({ id: F.uid(), kind: 'crew', role: x.job, name: x.name, phone: x.phone, num: '' }); }); N.toast('Added to your crew'); }
      };
    };
  });

  /* ================= what guests see ================= */
  async function guest(kind, room, key) {
    document.body.classList.add('guesting');
    const g = { room, key };
    const el = document.createElement('div'); el.className = 'guest'; document.body.append(el);
    el.innerHTML = `<div class="gs-wrap"><header class="gs-head"><img src="icons/icon.svg" alt="" width="34" height="34"><span>Itàn</span></header><div class="gs-body"><p class="fhint">Loading…</p></div></div>`;
    const body = el.querySelector('.gs-body');
    let info; try { const r = await api(g, 'form', { key }); if (!r.ok) throw new Error(r.status); info = await r.json(); } catch (e) { body.innerHTML = `<h1>This link isn’t working</h1><p>It may have been replaced by a newer one. Ask the person who sent it.</p>`; return; }
    const f = info.form || {}; let name = localStorage.getItem('itan:guestName') || '';
    const send = async o => { const r = await api(g, 'feedback', { key, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }); if (!r.ok) throw new Error('send'); };
    if (kind === 'review' && f.kind === 'review') {
      const mine = JSON.parse(localStorage.getItem('itan:sent:' + room) || '[]');
      body.innerHTML = `<p class="gs-kick">${f.film ? esc(f.film) + ' · ' : ''}For your review</p><h1>${esc(f.title || 'Video')}</h1>
        <video id="gsV" src="${esc(`${API}/rooms/${room}/media/${f.media}?key=${encodeURIComponent(key)}`)}" controls playsinline preload="metadata"></video>
        <div class="gs-note"><label>Your name<input id="gsName" value="${esc(name)}" placeholder="Your name" autocomplete="name"></label>
          <label class="grow">Note at <b id="gsAt">0:00</b><input id="gsText" placeholder="What should change at this moment?"></label><button class="pri" id="gsAdd">Add note</button></div>
        <p class="fhint">Pause where you want something changed, write a note, and press Add note. The video pauses when you start typing.</p>
        <ol class="gs-list" id="gsList"></ol>
        <section class="gs-verdict"><h2>Finished watching?</h2><textarea id="gsMsg" rows="2" placeholder="Anything else to say (optional)"></textarea>
          <div class="row"><button class="pri ok" id="gsApprove">Approve this cut</button><button id="gsChanges">Ask for changes</button></div></section>`;
      const v = body.querySelector('#gsV'), at = body.querySelector('#gsAt'), list = body.querySelector('#gsList');
      const draw = () => { list.innerHTML = mine.map(x => `<li><button data-seek="${x.t}">${short(x.t)}</button><span>${esc(x.text)}</span></li>`).join(''); };
      draw();
      v.addEventListener('timeupdate', () => { at.textContent = short(v.currentTime); });
      body.querySelector('#gsText').addEventListener('focus', () => v.pause());
      const who = () => { name = body.querySelector('#gsName').value.trim(); if (!name) { body.querySelector('#gsName').focus(); N.toast('Add your name first'); return null; } localStorage.setItem('itan:guestName', name); return name; };
      body.querySelector('#gsAdd').onclick = async () => { const tx = body.querySelector('#gsText'), text = tx.value.trim(); if (!text) return tx.focus(); if (!who()) return; const t = +v.currentTime.toFixed(2);
        try { await send({ kind: 'note', t, text, name }); mine.push({ t, text }); localStorage.setItem('itan:sent:' + room, JSON.stringify(mine)); tx.value = ''; draw(); N.toast('Note sent'); } catch (e) { N.toast('Couldn’t send. Check your internet.'); } };
      body.querySelector('#gsText').addEventListener('keydown', e => { if (e.key === 'Enter') body.querySelector('#gsAdd').click(); });
      list.onclick = e => { const b = e.target.closest('[data-seek]'); if (b) { v.currentTime = +b.dataset.seek; v.play(); } };
      const verdict = async status => { if (!who()) return; try { await send({ kind: 'verdict', status, text: body.querySelector('#gsMsg').value.trim(), name });
        body.querySelector('.gs-verdict').innerHTML = `<h2>${status === 'approved' ? 'Thank you, you approved this cut.' : 'Thank you. Your notes have been sent.'}</h2><p>The team can see ${status === 'approved' ? 'your approval' : 'what you asked for'} now.</p>`; } catch (e) { N.toast('Couldn’t send. Check your internet.'); } };
      body.querySelector('#gsApprove').onclick = () => verdict('approved');
      body.querySelector('#gsChanges').onclick = () => verdict('changes');
    } else if (kind === 'crew' && f.kind === 'crew') {
      const JOBS = ['Director of photography', 'Camera operator', 'Focus puller', 'Gaffer', 'Grip', 'Sound recordist', 'Boom operator', 'Production designer', 'Art assistant', 'Costume', 'Hair and makeup', 'Script supervisor', 'Assistant director', 'Production assistant', 'Driver', 'Caterer', 'Editor', 'Photographer (stills)', 'Drone operator'];
      body.innerHTML = `<p class="gs-kick">Crew call</p><h1>${esc(f.title || 'Our film')}</h1><p>Tell the team who you are and which shoot days you’re free.</p>
        <form class="gs-form" id="gsF"><label>Full name<input name="name" required value="${esc(name)}" autocomplete="name"></label>
          <label>Your job on set<input name="job" required list="gsJobs" placeholder="For example: Gaffer"></label><datalist id="gsJobs">${JOBS.map(j => `<option value="${esc(j)}">`).join('')}</datalist>
          <label>Phone or WhatsApp<input name="phone" required inputmode="tel" autocomplete="tel"></label>
          ${f.days && f.days.length ? `<fieldset><legend>Days you’re free</legend><div class="gs-days">${f.days.map(x => `<label><input type="checkbox" name="days" value="${esc(x.id)}"><span><b>${esc(x.label)}</b>${x.date ? `<small>${esc(new Date(x.date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }))}${x.call ? ' · call ' + esc(x.call) : ''}</small>` : ''}</span></label>`).join('')}</div></fieldset>` : '<p class="fhint">Shoot dates aren’t set yet. The team will contact you.</p>'}
          <label>Anything else (optional)<textarea name="note" rows="2" placeholder="Rates, your gear, a link to your work"></textarea></label>
          <button class="pri big" type="submit">Send</button></form>`;
      body.querySelector('#gsF').onsubmit = async e => { e.preventDefault(); const fd = new FormData(e.target);
        const o = { kind: 'signup', name: fd.get('name').trim(), job: fd.get('job').trim(), phone: fd.get('phone').trim(), days: fd.getAll('days'), note: fd.get('note').trim() };
        localStorage.setItem('itan:guestName', o.name);
        try { await send(o); body.innerHTML = `<h1>Thanks, ${esc(o.name.split(' ')[0])}!</h1><p>Your details went to the team for “${esc(f.title || 'the film')}”. They’ll be in touch.</p>`; } catch (x) { N.toast('Couldn’t send. Check your internet.'); } };
    } else body.innerHTML = `<h1>This link isn’t working</h1><p>Ask the person who sent it for a new one.</p>`;
  }

  // the review player gets a Get approval link button, and video cards show the approval status
  F.approvalLabel = c => c.approval ? ({ waiting: ' · waiting for approval', approved: ' · approved ✓', changes: ' · changes asked' }[c.approval.status] || '') : '';

  N.hooks.ready.push(() => {
    const h = location.hash.match(/^#(review|crew)=([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{8,64})$/);
    if (h) { guest(h[1], h[2], h[3]); return; }
    setTimeout(syncAll, 3000);
    setInterval(() => { if (!document.hidden) syncAll(); }, 120000);
  });
})();
