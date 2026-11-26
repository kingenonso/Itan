/* Casting: post your roles, share one link, and actors audition from their phones with a headshot and a self-tape
   (a video upload or a link). Review everyone per role, shortlist, call back, compare side by side, and cast:
   the actor goes straight onto the People tab and the call sheets. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const K = () => N.guestKit;
  const ST = [['new', 'New'], ['short', 'Shortlist'], ['callback', 'Callback'], ['cast', 'Cast'], ['no', 'Not this time']];
  let roleSel = null, filter = 'all';
  const C = d => (d.casting = d.casting || { roles: [], subs: [] });
  const fileUrl = (link, id) => `${K().API}/rooms/${link.room}/media/${id}?key=${encodeURIComponent(link.key)}`;
  const stars = n => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  const formOf = d => JSON.stringify({ kind: 'cast', title: d.title, roles: C(d).roles.filter(r => r.open !== false).map(r => ({ id: r.id, name: r.name, desc: r.desc || '', age: r.age || '', sides: r.sides || '' })) });

  async function sync(quiet = true) {
    const d = F.data(); if (!d || !C(d).link || !K()) return 0;
    const g = C(d).link, fs = formOf(d);
    try {
      if (g.form !== fs) { const r = await K().api(g, 'form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: fs }); if (r.ok) F.change(dd => { dd.casting.link.form = fs; }, true); }
      const r = await K().api(g, `feedback?after=${g.seen || 0}`); if (!r.ok) return 0; const items = (await r.json()).items; if (!items.length) return 0;
      F.change(dd => { const cs = dd.casting; items.forEach(({ id, t, body: x }) => { if (x.kind === 'audition' && x.name && x.role) cs.subs.push({ id: 'au' + id, t, role: String(x.role), name: String(x.name).slice(0, 80), phone: String(x.phone || '').slice(0, 40), age: String(x.age || '').slice(0, 20), place: String(x.place || '').slice(0, 80), link: /^https?:\/\//.test(x.link || '') ? String(x.link).slice(0, 400) : '', photo: x.photo || '', tape: x.tape || '', tapeType: x.tapeType || '', note: String(x.note || '').slice(0, 800), st: 'new', stars: 0, notes: '' }); cs.link.seen = Math.max(cs.link.seen || 0, id); }); });
      if (quiet) N.toast(`${items.length} new audition${items.length === 1 ? '' : 's'} for “${d.title}”`);
      return items.length;
    } catch (e) { return 0; }
  }
  F.syncCasting = sync;

  F.tabs.push({ id: 'casting', label: 'Casting', order: 49.5, render(el, d) {
    const cs = C(d);
    if (!roleSel || !cs.roles.find(r => r.id === roleSel)) roleSel = cs.roles[0] && cs.roles[0].id;
    const role = cs.roles.find(r => r.id === roleSel);
    const fromScript = d.people.filter(p => p.kind === 'cast' && p.role && !cs.roles.some(r => r.name.toUpperCase() === p.role.toUpperCase())).length;
    const subs = cs.subs.filter(s => role && s.role === role.id && (filter === 'all' || s.st === filter)).sort((a, b) => (b.stars || 0) - (a.stars || 0) || b.t - a.t);
    const count = (r, st) => cs.subs.filter(s => s.role === r.id && (!st || s.st === st)).length;
    const shortN = role ? cs.subs.filter(s => s.role === role.id && ['short', 'callback', 'cast'].includes(s.st)).length : 0;
    el.innerHTML = `<div class="fwrap wide cst">
      <div class="rp-bar"><div class="cst-roles">${cs.roles.map(r => `<button data-role="${esc(r.id)}" class="${r.id === roleSel ? 'on' : ''}${r.open === false ? ' closed' : ''}"><b>${esc(r.name)}</b><small>${r.castId ? 'Cast ✓' : count(r) + ' audition' + (count(r) === 1 ? '' : 's') + (count(r, 'new') ? ` · ${count(r, 'new')} new` : '')}</small></button>`).join('')}
          <button class="add" id="csAdd">+ Role</button>${fromScript ? `<button class="add" id="csFromScript">+ ${fromScript} from the script</button>` : ''}</div>
        <div class="cs-act">${cs.link ? '<button class="ib" id="csCheck">Check for auditions</button><button class="pri" id="csLink">Casting link</button>' : cs.roles.length ? '<button class="pri" id="csLink">Get a casting link</button>' : ''}</div></div>
      ${!cs.roles.length ? `<div class="empty-row big">Add the roles you’re casting. Share one link, and actors send a headshot and a self-tape from their phone.</div>` : role ? `
      <section class="fsec cst-role"><div class="cst-rhead"><input data-rf="name" value="${esc(role.name)}" class="cst-name" aria-label="Role name"><label class="cst-open"><input type="checkbox" data-rf="open"${role.open !== false ? ' checked' : ''}> Taking auditions</label><button class="ib xs" id="csDelRole">Remove role</button></div>
        <div class="cst-fields"><label>Who they are<textarea data-rf="desc" rows="2" placeholder="Nkechi, 50s. A tired market woman who hides how proud she is of her son.">${esc(role.desc || '')}</textarea></label>
          <label>Playing age<input data-rf="age" value="${esc(role.age || '')}" placeholder="45–60"></label>
          <label class="span2">Lines to read in the self-tape (sides)<textarea data-rf="sides" rows="4" placeholder="Paste the lines actors should perform.">${esc(role.sides || '')}</textarea>${d.screenplay && d.screenplay.length ? '<button class="linkish" id="csSides">Use this character’s lines from the script</button>' : ''}</label></div></section>
      <div class="rp-bar"><div class="seg">${[['all', 'Everyone'], ['new', 'New'], ['short', 'Shortlist'], ['callback', 'Callback'], ['cast', 'Cast']].map(([k, l]) => `<button data-filter="${k}" class="${k === filter ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${shortN > 1 ? `<button class="ib" id="csCompare">Compare the shortlist (${shortN})</button>` : ''}</div>
      <div class="cst-grid">${subs.map(s => `<button class="cst-card st-${s.st}" data-sub="${esc(s.id)}">${s.photo && cs.link ? `<img src="${esc(fileUrl(cs.link, s.photo))}" alt="" loading="lazy">` : `<span class="cst-ph">${esc((s.name || '?').trim()[0] || '?')}</span>`}
          <div><b>${esc(s.name)}</b><small>${esc([s.age, s.place].filter(Boolean).join(' · '))}</small><span class="cst-meta"><i class="pill p-${s.st}">${(ST.find(x => x[0] === s.st) || ST[0])[1]}</i>${s.stars ? `<em>${stars(s.stars)}</em>` : ''}${s.tape || s.link ? '<em>▶ tape</em>' : ''}</span></div></button>`).join('') || `<p class="empty-row">${cs.link ? 'No auditions here yet.' : 'Get a casting link and share it to start receiving auditions.'}</p>`}</div>` : ''}
    </div>`;
    el.onclick = e => click(e, d, role);
    el.onchange = e => { const k = e.target.dataset.rf; if (!k || !role) return; const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim(); F.change(dd => { const r = dd.casting.roles.find(x => x.id === role.id); r[k] = v; }, k !== 'open' && k !== 'name'); };
  } });

  async function click(e, d, role) {
    const t = e.target;
    const rb = t.closest('[data-role]'); if (rb) { roleSel = rb.dataset.role; return F.refresh(); }
    const fb = t.closest('[data-filter]'); if (fb) { filter = fb.dataset.filter; return F.refresh(); }
    if (t.closest('#csAdd')) { const n = await F.ask('New role', 'Character name'); if (n) { const id = F.uid(); roleSel = id; F.change(dd => C(dd).roles.push({ id, name: n.toUpperCase(), desc: '', age: '', sides: '', open: true })); } return; }
    if (t.closest('#csFromScript')) return F.change(dd => { const cs = C(dd); dd.people.filter(p => p.kind === 'cast' && p.role && !cs.roles.some(r => r.name.toUpperCase() === p.role.toUpperCase())).forEach(p => cs.roles.push({ id: F.uid(), name: p.role.toUpperCase(), desc: '', age: '', sides: '', open: true })); });
    if (t.closest('#csDelRole')) { const n = C(d).subs.filter(s => s.role === role.id).length; if (await N.confirmBox(`Remove ${role.name}${n ? ` and its ${n} audition${n === 1 ? '' : 's'}` : ''}?`, 'Remove')) F.change(dd => { const cs = dd.casting; cs.roles = cs.roles.filter(r => r.id !== role.id); cs.subs = cs.subs.filter(s => s.role !== role.id); }); return; }
    if (t.closest('#csSides')) { const lines = sidesFor(d, role.name); if (!lines) return N.toast(`${role.name} has no lines in the script`); F.change(dd => { dd.casting.roles.find(r => r.id === role.id).sides = lines; }); return; }
    if (t.closest('#csLink')) return link(d);
    if (t.closest('#csCheck')) { const n = await sync(false); return N.toast(n ? `${n} new audition${n === 1 ? '' : 's'}` : 'No new auditions yet'); }
    if (t.closest('#csCompare')) return compare(d, role);
    const sb = t.closest('[data-sub]'); if (sb) return detail(d, sb.dataset.sub);
  }
  // the character's dialogue, ready to read
  function sidesFor(d, name) {
    const sp = d.screenplay || [], out = []; let speaking = false, lines = 0;
    for (const l of sp) { if (l.t === 'char') { speaking = l.x.replace(/\s*\(.*\)/, '').trim().toUpperCase() === name.toUpperCase(); if (speaking) out.push('\n' + l.x.toUpperCase()); }
      else if (speaking && (l.t === 'dial' || l.t === 'paren')) { out.push(l.t === 'paren' && !/^\(/.test(l.x) ? '(' + l.x + ')' : l.x); lines++; } else speaking = false; if (lines >= 12) break; }
    return out.join('\n').trim();
  }
  async function link(d) {
    if (!K() || !K().API) return N.toast('Casting links need the Itàn Live server');
    if (!C(d).link) {
      N.status('Making the link…');
      try { const g = await K().makeRoom('ca' + F.root().id.replace(/[^A-Za-z0-9_-]/g, ''), d.title, { guestUpload: true }); F.change(dd => { dd.casting.link = { ...g, seen: 0, form: '' }; }); await sync(); }
      catch (e) { N.settled(); return N.toast('Couldn’t make the link. Check your internet.'); }
      N.settled();
    } else await sync();
    const g = F.data().casting.link;
    const m = N.modal(`<h2>Casting link</h2><p>Share it on WhatsApp, Instagram or casting groups. Actors pick a role, read your description and sides, and send a headshot and a self-tape (a video up to 60 MB, or a YouTube or Drive link).</p>
      ${K().linkBox('Casting link', K().linkOf('cast', g), `Casting call for “${d.title}”. Audition from your phone:`)}
      <p class="fine">Only open roles are shown. Untick “Taking auditions” on a role to close it.</p><div class="row"><button class="pri" data-close>Done</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv; K().wireCopy(m);
  }

  function detail(d, id) {
    const cs = C(d), s = cs.subs.find(x => x.id === id); if (!s) return; const role = cs.roles.find(r => r.id === s.role) || { name: '' };
    const tape = s.tape && cs.link ? `<video src="${esc(fileUrl(cs.link, s.tape))}" controls playsinline preload="metadata"></video>` : s.link ? `<a class="pri cst-tapelink" href="${esc(s.link)}" target="_blank" rel="noopener">▶ Watch the self-tape</a>` : '<p class="fhint">No self-tape sent.</p>';
    const tel = s.phone.replace(/[^\d+]/g, ''), wa = tel.replace(/^0/, '234').replace(/^\+/, '');
    const m = N.modal(`<div class="cst-detail"><div class="cst-dl">${s.photo && cs.link ? `<img src="${esc(fileUrl(cs.link, s.photo))}" alt="Headshot of ${esc(s.name)}">` : ''}${tape}${s.link && s.tape ? `<a class="linkish" href="${esc(s.link)}" target="_blank" rel="noopener">Their link</a>` : ''}</div>
      <div class="cst-dr"><small>${esc(role.name)}</small><h2>${esc(s.name)}</h2><p>${esc([s.age && 'Age ' + s.age, s.place].filter(Boolean).join(' · '))}</p>
        ${s.phone ? `<p class="cst-contact"><a class="ib" href="tel:${esc(tel)}">Call</a><a class="ib" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a><span>${esc(s.phone)}</span></p>` : ''}
        ${s.note ? `<blockquote>${esc(s.note)}</blockquote>` : ''}
        <div class="cst-stars" role="group" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}" class="${n <= (s.stars || 0) ? 'on' : ''}" aria-label="${n} star${n === 1 ? '' : 's'}">★</button>`).join('')}</div>
        <div class="cst-st">${ST.map(([k, l]) => `<button data-st="${k}" class="pill p-${k}${s.st === k ? ' on' : ''}">${l}</button>`).join('')}</div>
        <label class="cst-notes">Your notes<textarea id="csNotes" rows="3" placeholder="Strong in the second half; try her as the mother at callback.">${esc(s.notes || '')}</textarea></label>
        <div class="row"><button class="pri" data-close>Done</button><button id="csDel">Delete audition</button></div></div></div>`);
    m.classList.add('wide');
    const upd = fn => F.change(dd => { const x = dd.casting.subs.find(y => y.id === id); if (x) fn(x, dd); }, true);
    m.onclick = async e => {
      const st = e.target.closest('[data-st]'); if (st) { const v = st.dataset.st; upd((x, dd) => { x.st = v; if (v === 'cast') castAs(dd, x); }); m.querySelectorAll('[data-st]').forEach(b => b.classList.toggle('on', b === st)); if (v === 'cast') N.toast(`${s.name} is cast as ${role.name}, and added to People`); return; }
      const sr = e.target.closest('[data-star]'); if (sr) { const n = +sr.dataset.star, v = (s.stars || 0) === n ? 0 : n; upd(x => { x.stars = v; }); s.stars = v; m.querySelectorAll('[data-star]').forEach(b => b.classList.toggle('on', +b.dataset.star <= v)); return; }
      if (e.target.closest('#csDel')) { if (!(await N.confirmBox(`Delete ${s.name}’s audition? Their headshot and self-tape are removed too.`, 'Delete'))) return; for (const f of [s.photo, s.tape]) if (f && cs.link) K().api(cs.link, `media/${f}`, { method: 'DELETE' }).catch(() => {}); F.change(dd => { dd.casting.subs = dd.casting.subs.filter(x => x.id !== id); }); N.closeOv(); return; }
      if (e.target.closest('[data-close]')) { N.closeOv(); F.refresh(); }
    };
    m.querySelector('#csNotes').onchange = e => upd(x => { x.notes = e.target.value; });
  }
  // casting someone puts them on the People tab as that character
  function castAs(dd, x) {
    const role = dd.casting.roles.find(r => r.id === x.role); if (!role) return;
    dd.casting.subs.forEach(o => { if (o.role === x.role && o.id !== x.id && o.st === 'cast') o.st = 'callback'; });
    role.castId = x.id;
    const p = dd.people.find(q => q.kind === 'cast' && (q.role || '').toUpperCase() === role.name.toUpperCase());
    if (p) { p.name = x.name; p.phone = x.phone; } else dd.people.push({ id: F.uid(), kind: 'cast', role: role.name, name: x.name, phone: x.phone, num: String(dd.people.filter(q => q.kind === 'cast').length + 1) });
  }
  function compare(d, role) {
    const cs = C(d), list = cs.subs.filter(s => s.role === role.id && ['short', 'callback', 'cast'].includes(s.st)).slice(0, 4);
    const m = N.modal(`<h2>${esc(role.name)}: shortlist</h2><p>Press “Play all” to watch the self-tapes together.</p>
      <div class="cst-cmp" style="--n:${list.length}">${list.map(s => `<div>${s.tape && cs.link ? `<video src="${esc(fileUrl(cs.link, s.tape))}" playsinline preload="metadata" controls></video>` : s.photo && cs.link ? `<img src="${esc(fileUrl(cs.link, s.photo))}" alt="">` : ''}<b>${esc(s.name)}</b><small>${s.stars ? stars(s.stars) : ''} ${esc((ST.find(x => x[0] === s.st) || ST[0])[1])}</small>${!s.tape && s.link ? `<a class="linkish" href="${esc(s.link)}" target="_blank" rel="noopener">Watch their link</a>` : ''}</div>`).join('')}</div>
      <div class="row"><button class="pri" id="cmpPlay">Play all</button><button id="cmpStop">Pause all</button><button data-close>Close</button></div>`);
    m.classList.add('wide', 'cst-cmpw');
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#cmpPlay').onclick = () => m.querySelectorAll('video').forEach(v => { v.currentTime = 0; v.play().catch(() => {}); });
    m.querySelector('#cmpStop').onclick = () => m.querySelectorAll('video').forEach(v => v.pause());
  }

  /* ---------- what actors see ---------- */
  N.guestPages = N.guestPages || {};
  N.guestPages.cast = (body, f, g, key, send) => {
    const roles = f.roles || [];
    if (!roles.length) { body.innerHTML = `<h1>Casting is closed</h1><p>There are no open roles for “${esc(f.title || 'this film')}” right now.</p>`; return; }
    body.innerHTML = `<p class="gs-kick">Casting call</p><h1>${esc(f.title || 'Our film')}</h1><p>Choose a role, then send your details, a headshot and a self-tape.</p>
      <div class="cst-groles">${roles.map((r, i) => `<label class="cst-grole"><input type="radio" name="role" value="${esc(r.id)}"${i ? '' : ' checked'}><span><b>${esc(r.name)}</b>${r.age ? `<small>Playing age ${esc(r.age)}</small>` : ''}${r.desc ? `<em>${esc(r.desc)}</em>` : ''}</span></label>`).join('')}</div>
      <div id="gsSides"></div>
      <form class="gs-form" id="csF"><label>Full name<input name="name" required autocomplete="name"></label>
        <label>Phone or WhatsApp<input name="phone" required inputmode="tel" autocomplete="tel"></label>
        <div class="gs-two"><label>Age<input name="age" inputmode="numeric"></label><label>Where you’re based<input name="place" placeholder="Lagos"></label></div>
        <label>Headshot (a clear photo of your face)<input type="file" name="photo" accept="image/*" required></label>
        <fieldset><legend>Self-tape</legend><label>Upload a video (up to 60 MB)<input type="file" name="tape" accept="video/*"></label><span class="gs-or">or</span><label>Paste a link (YouTube, Google Drive, Instagram)<input name="link" type="url" placeholder="https://"></label></fieldset>
        <label>Anything else (optional)<textarea name="note" rows="2" placeholder="Your experience, languages, special skills"></textarea></label>
        <div class="gs-prog" id="csProg" hidden><i></i><span></span></div>
        <button class="pri big" type="submit">Send my audition</button></form>`;
    const showSides = () => { const id = body.querySelector('[name=role]:checked').value, r = roles.find(x => x.id === id);
      body.querySelector('#gsSides').innerHTML = r && r.sides ? `<details class="gs-sides" open><summary>Lines to perform for ${esc(r.name)}</summary><pre>${esc(r.sides)}</pre></details>` : ''; };
    body.querySelectorAll('[name=role]').forEach(i => i.onchange = showSides); showSides();
    const prog = body.querySelector('#csProg');
    const put = (file, label) => new Promise((res, rej) => {
      const id = 'a' + Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join('');
      const x = new XMLHttpRequest(); x.open('PUT', `${K().API}/rooms/${g.room}/media/${id}`); x.setRequestHeader('X-Key', key); x.setRequestHeader('X-Type', file.type || '');
      x.upload.onprogress = e => { if (e.lengthComputable) { prog.querySelector('i').style.width = Math.round(e.loaded / e.total * 100) + '%'; prog.querySelector('span').textContent = `Sending your ${label}… ${Math.round(e.loaded / e.total * 100)}%`; } };
      x.onload = () => x.status < 300 ? res(id) : rej(new Error(x.status === 413 ? 'big' : x.status === 507 ? 'full' : 'up')); x.onerror = () => rej(new Error('net')); x.send(file);
    });
    // shrink big photos before sending
    const shrink = async file => { try { const img = await createImageBitmap(file), s = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return await new Promise(r => c.toBlob(r, 'image/jpeg', .86)); } catch (e) { return file; } };
    body.querySelector('#csF').onsubmit = async e => {
      e.preventDefault(); const fd = new FormData(e.target), tape = fd.get('tape'), link = (fd.get('link') || '').trim(), photo = fd.get('photo');
      if ((!tape || !tape.size) && !link) return N.toast('Add a self-tape: upload a video or paste a link');
      if (tape && tape.size > 60 * 1024 * 1024) return N.toast('That video is over 60 MB. Upload it to YouTube or Google Drive and paste the link instead.');
      const btn = e.target.querySelector('[type=submit]'); btn.disabled = true; prog.hidden = false;
      try {
        const pid = await put(await shrink(photo), 'headshot');
        const tid = tape && tape.size ? await put(tape, 'self-tape') : '';
        await send({ kind: 'audition', role: body.querySelector('[name=role]:checked').value, name: fd.get('name').trim(), phone: fd.get('phone').trim(), age: fd.get('age').trim(), place: fd.get('place').trim(), link, photo: pid, tape: tid, tapeType: tape && tape.size ? tape.type : '', note: fd.get('note').trim() });
        const r = roles.find(x => x.id === body.querySelector('[name=role]:checked').value);
        body.innerHTML = `<h1>Thank you, ${esc(fd.get('name').trim().split(' ')[0])}!</h1><p>Your audition for ${esc(r ? r.name : 'the role')} in “${esc(f.title || 'the film')}” has been sent. The team will contact you if you’re shortlisted.</p>`;
      } catch (x) { btn.disabled = false; prog.hidden = true; N.toast(x.message === 'big' ? 'That file is too big. Paste a link instead.' : x.message === 'full' ? 'This casting call can’t take more uploads. Paste a link to your self-tape instead.' : 'Couldn’t send. Check your internet and try again.'); }
    };
  };

  // check for new auditions now and then while Itàn is open
  N.hooks.ready.push(() => { if (document.body.classList.contains('guesting')) return; setInterval(() => { if (!document.hidden && F.root() && F.data() && F.data().casting && F.data().casting.link) sync(); }, 180000); });
})();
