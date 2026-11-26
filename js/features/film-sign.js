/* Contracts signed on the phone.
   From the Clearances desk, Itàn fills in an actor release, crew agreement, location release, music licence or brand
   agreement with the film's details. Edit anything, then send a signing link (or hand over your phone). The person
   reads it, signs with their finger, and the signed copy, with both signatures and the time, lands back in Clearances.
   These are plain-language starting points, not legal advice: have a lawyer look at them for bigger productions. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const K = () => N.guestKit;
  const L = d => { d.desks = d.desks || {}; return (d.desks.legal = d.desks.legal || {}); };
  const day = s => s ? new Date(s + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const today = () => new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  const KINDS = { 'Actor release': 'actor', 'Crew agreement': 'crew', 'Location release': 'loc', 'Music licence': 'music', 'Brand agreement': 'brand' };

  // what Itàn already knows about the person or thing being cleared
  function facts(d, r) {
    const prod = L(d).company || (L(d).me || {}).name || (d.contact || '').split('·')[0].trim() || '[producer or company name]', out = { film: d.title, prod, date: today() };
    const [kind, id] = r.k.split(':');
    const datesOf = ids => { const ds = d.days.filter(x => x.date && F.dayScenes(d, x).some(s => ids(s))).map(x => x.date).sort(); return ds.length ? (ds.length > 1 ? `${day(ds[0])} to ${day(ds[ds.length - 1])}` : day(ds[0])) : 'the dates on the schedule'; };
    if (kind === 'cast') { const p = F.person(d, id) || {}; Object.assign(out, { name: p.name, role: p.role, dates: datesOf(s => (s.cast || []).includes(id)), fee: p.fee || '' }); }
    if (kind === 'crew') { const p = F.person(d, id) || {}; Object.assign(out, { name: p.name, role: p.role, dates: datesOf(() => true), fee: p.fee || '' }); }
    if (kind === 'loc') { const l = (d.locations || []).find(x => x.id === id) || {}; Object.assign(out, { name: l.contact || '', place: l.name, address: l.address || '', fee: l.fee || '', dates: datesOf(s => (l.places || []).includes(String(s.loc || '').toUpperCase())) }); }
    if (kind === 'mus') { const c = ((F.desk(d, 'music', {}).cues) || []).find(x => x.id === id) || {}; Object.assign(out, { name: c.by || '', song: c.title || '', fee: c.cost || '' }); }
    if (kind === 'brand') { const b = ((F.desk(d, 'brands', {}).deals) || []).find(x => x.id === id) || {}; Object.assign(out, { name: b.contact || b.brand || '', brand: b.brand || '', fee: b.value || '', gets: b.gets || '' }); }
    return out;
  }
  const cur = d => (d.budget && d.budget.cur) || '₦';
  const money = (d, v) => v ? `${cur(d)}${Number(String(v).replace(/[^\d.]/g, '') || 0).toLocaleString()}` : '[amount]';
  // the documents, in plain language
  function draft(d, kind, f) {
    const P = f.prod, nm = f.name || '[name]';
    const head = (title, intro) => `${title}\n\n${intro}\n\nDate: ${f.date}\n`;
    const end = `\nThis agreement is the whole agreement between us about this. If any part can’t be enforced, the rest still applies. It is governed by the laws of the country where the film is made.`;
    if (kind === 'actor') return head('ACTOR RELEASE AND AGREEMENT', `Between ${P} (“the Producer”), making the film “${f.film}” (“the Film”), and ${nm} (“the Actor”).`) + `
1. Role. The Actor will play ${f.role || '[character]'} in the Film, on ${f.dates}, and attend rehearsals, fittings and any reshoots agreed in advance.
2. Payment. The Producer will pay the Actor ${money(d, f.fee)} in total. Half is paid on the first shoot day and the rest within 14 days of the Actor’s last shoot day, unless agreed otherwise in writing.
3. Permission. The Actor allows the Producer to record, edit and use the Actor’s performance, image, voice and name in the Film, its trailers, posters, behind-the-scenes material and publicity, in any media, anywhere, for as long as the Film exists.
4. Ownership. The Producer owns the recordings and the Film. The Actor can show clips of their own performance in their showreel once the Film is released.
5. Credit. The Actor will be credited as ${f.role || 'their character'} in the Film’s credits.
6. Conduct. The Actor will arrive on time, keep the story and set private until release, and tell the Producer about anything that may affect their safety.
7. Safety. The Producer will plan stunts and risky scenes with care, and the Actor can refuse anything unsafe.` + end;
    if (kind === 'crew') return head('CREW AGREEMENT (DEAL MEMO)', `Between ${P} (“the Producer”), making the film “${f.film}” (“the Film”), and ${nm} (“the Crew Member”).`) + `
1. Job. The Crew Member will work as ${f.role || '[job]'} on ${f.dates}, about 12 hours a day including a meal break.
2. Payment. ${money(d, f.fee)} ${f.fee ? '' : '(rate per day or total) '}paid within 14 days of the last working day, unless agreed otherwise in writing. Transport and meals on shoot days are provided by the Producer.
3. Equipment. Any equipment the Crew Member brings stays theirs; the Producer is responsible for loss or damage on set if it was listed before the shoot.
4. Ownership. Everything the Crew Member creates for the Film belongs to the Producer. The Crew Member may show their work from the Film in their portfolio after release.
5. Credit. The Crew Member will be credited as ${f.role || 'their job'} in the Film’s credits.
6. Privacy. The Crew Member will keep the story, script and set private until the Producer releases them.
7. Cancellation. If a shoot day is cancelled less than 24 hours before, the Producer pays half the day’s rate.` + end;
    if (kind === 'loc') return head('LOCATION RELEASE', `Between ${P} (“the Producer”), making the film “${f.film}” (“the Film”), and ${nm} (“the Owner”), who owns or controls ${f.place || 'the location'}${f.address ? ', ' + f.address : ''} (“the Location”).`) + `
1. Permission. The Owner allows the Producer, cast and crew to enter the Location and film there on ${f.dates}, with set-up and packing time, and to show the Location in the Film and its publicity, anywhere and forever.
2. Fee. The Producer will pay the Owner ${money(d, f.fee)}, half before the first day and the rest on the last day.
3. Care. The Producer will look after the Location, and leave it as it was found. Any damage caused by the production will be repaired or paid for.
4. Name. The Location may be shown as a different place in the story. The Owner’s name and address won’t be shown unless the Owner agrees.
5. Authority. The Owner confirms they have the right to give this permission.` + end;
    if (kind === 'music') return head('MUSIC LICENCE', `Between ${nm} (“the Rights Holder”) and ${P} (“the Producer”), making the film “${f.film}” (“the Film”).`) + `
1. Music. The Rights Holder owns or controls the song and recording “${f.song || '[title]'}” (“the Music”).
2. Licence. The Rights Holder allows the Producer to use the Music in the Film and its trailers and publicity, in any media, anywhere, for as long as the Film exists. This does not transfer ownership of the Music.
3. Fee. The Producer will pay ${money(d, f.fee)} on signing.
4. Credit. The Music will be credited in the Film’s end credits.
5. Authority. The Rights Holder confirms they control both the song and the recording, or have permission from whoever does.` + end;
    if (kind === 'brand') return head('BRAND PLACEMENT AGREEMENT', `Between ${f.brand || nm} (“the Brand”), represented by ${nm}, and ${P} (“the Producer”), making the film “${f.film}” (“the Film”).`) + `
1. What the Brand gets: ${f.gets || '[what the brand gets, e.g. the product seen in two scenes, a mention, the logo in the credits]'}.
2. Fee. The Brand will pay ${money(d, f.fee)}, half on signing and the rest when the Brand is shown the scenes.
3. Creative control. The Producer keeps the final say on the story and the edit, and will make a fair effort to keep what the Brand gets in the final film. If something is cut, the Producer will offer an equal alternative or return that part of the fee.
4. Proof. The Producer will send stills from the scenes with the Brand before release.
5. Use. The Brand can share the stills and the trailer once the Producer releases them.` + end;
    return head('AGREEMENT', `Between ${P} (“the Producer”), making the film “${f.film}”, and ${nm}.`) + `\n1. [What is agreed]\n2. Payment: ${money(d, f.fee)}\n3. Permission to use in the Film and its publicity, anywhere and forever.` + end;
  }

  /* ---------- a finger-signature pad ---------- */
  F.sigPad = (host) => {
    host.innerHTML = `<canvas class="sig-c" width="900" height="260" aria-label="Sign here"></canvas><div class="sig-row"><span>Sign above with your finger or mouse</span><button type="button" class="linkish" data-sigclear>Clear</button></div>`;
    const c = host.querySelector('canvas'), g = c.getContext('2d'); let down = false, any = false, last = null;
    g.lineWidth = 4; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#13151f';
    const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    c.onpointerdown = e => { down = true; last = pt(e); c.setPointerCapture(e.pointerId); e.preventDefault(); };
    c.onpointermove = e => { if (!down) return; const p = pt(e); g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; any = true; };
    c.onpointerup = c.onpointercancel = () => { down = false; };
    host.querySelector('[data-sigclear]').onclick = () => { g.clearRect(0, 0, c.width, c.height); any = false; };
    return { empty: () => !any, blob: () => new Promise(r => c.toBlob(r, 'image/png')) };
  };

  // the signed copy, as a picture kept in Clearances
  async function signedCopy(doc, theirs, mine) {
    await N.loadLib('img');
    const host = document.createElement('div'); host.className = 'sheet sign-doc'; host.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px';
    const u = async m => m ? await N.Store.mediaUrl(m) : '';
    host.innerHTML = `<pre>${esc(doc.text)}</pre><div class="sign-two"><div>${theirs.sig ? `<img src="${await u(theirs.sig)}" alt="">` : ''}<b>${esc(theirs.name)}</b><small>Signed ${esc(new Date(theirs.at).toLocaleString())}</small></div>
      <div>${mine && mine.sig ? `<img src="${await u(mine.sig)}" alt="">` : '<i>&nbsp;</i>'}<b>${esc((mine && mine.name) || 'For the Producer')}</b><small>${mine && mine.sig ? 'For the Producer' : 'Producer to sign'}</small></div></div><footer>Signed with Itàn</footer>`;
    document.body.append(host); await Promise.all([...host.querySelectorAll('img')].map(i => i.decode().catch(() => {})));
    try { const url = await window.htmlToImage.toJpeg(host, { quality: .92, pixelRatio: 2, backgroundColor: '#ffffff', style: { position: 'static', left: '0', top: '0' } }); return await N.Store.putMedia(await (await fetch(url)).blob()); } finally { host.remove(); }
  }
  async function markSigned(k, theirs) {
    const d = F.data(), doc = L(d).docs[k], mine = L(d).me && L(d).me.sig ? L(d).me : null;
    let copy = null; try { copy = await signedCopy(doc, theirs, mine); } catch (e) {}
    F.change(dd => { const LL = L(dd); LL.docs[k].status = 'signed'; LL.docs[k].signed = theirs; LL.st = LL.st || {}; LL.st[k] = { ...(LL.st[k] || {}), s: 'signed', file: copy || (LL.st[k] || {}).file }; });
  }

  /* ---------- preparing a document ---------- */
  F.signDoc = async row => {
    const d = F.data(), kind = KINDS[row.kind] || 'other', LL = L(d), old = (LL.docs || {})[row.k];
    const f = { ...facts(d, row), ...(old ? old.f : {}) };
    const m = N.modal(`<h2>${esc(row.kind)}: ${esc(row.what || '')}</h2><p class="fhint">A plain-language starting point, not legal advice. Change anything before it’s signed.</p>
      <div class="sign-f"><label>Their full name<input data-sf="name" value="${esc(f.name || '')}"></label><label>Amount (${esc(cur(d))})<input data-sf="fee" value="${esc(f.fee || '')}" inputmode="decimal"></label><label>Producer or company<input data-sf="prod" value="${esc(f.prod)}"></label>${kind === 'brand' ? `<label class="span2">What the brand gets<input data-sf="gets" value="${esc(f.gets || '')}"></label>` : ''}</div>
      <textarea id="sgText" rows="14" class="sign-text">${esc(old && old.edited ? old.text : draft(d, kind, f))}</textarea>
      ${old && old.status === 'signed' ? `<p class="ap-st ap-approved">Signed by ${esc(old.signed.name)} on ${esc(new Date(old.signed.at).toLocaleString())}</p>` : old && old.status === 'sent' ? '<p class="ap-st">Waiting for their signature</p>' : ''}
      <div class="row"><button class="pri" id="sgLink">Send a signing link</button><button id="sgHere">Sign here on this phone</button><button id="sgMe">${LL.me && LL.me.sig ? 'Change your signature' : 'Add your signature (producer)'}</button><button data-close>Close</button></div>`);
    m.classList.add('wide');
    let edited = !!(old && old.edited); const ta = m.querySelector('#sgText');
    ta.oninput = () => { edited = true; };
    m.querySelectorAll('[data-sf]').forEach(i => i.oninput = () => { f[i.dataset.sf] = i.value.trim(); if (!edited) ta.value = draft(d, kind, f); });
    const save = status => F.change(dd => { const X = L(dd); X.docs = X.docs || {}; X.docs[row.k] = { ...(X.docs[row.k] || {}), kind, title: row.kind, what: row.what, f: { ...f }, text: ta.value, edited, status: status || (X.docs[row.k] || {}).status || 'draft' }; if (f.prod && !/^\[/.test(f.prod)) X.company = f.prod; }, true);
    m.querySelector('[data-close]').onclick = () => { save(); N.closeOv(); F.refresh(); };
    m.querySelector('#sgMe').onclick = () => { save(); producerSig(() => F.signDoc(row)); };
    m.querySelector('#sgHere').onclick = () => { if (!f.name) return N.toast('Add their full name first'); save(); signHere(row.k); };
    m.querySelector('#sgLink').onclick = async () => {
      if (!f.name) return N.toast('Add their full name first'); save();
      if (!K() || !K().API) return N.toast('Signing links need the Itàn Live server');
      try { N.status('Preparing the link…');
        if (!L(F.data()).room) { const g = await K().makeRoom('sg' + F.root().id.replace(/[^A-Za-z0-9_-]/g, ''), d.title + ' · signatures', { guestUpload: true }); await K().api(g, 'form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'sign', title: d.title }) }); F.change(dd => { L(dd).room = { ...g, seen: 0 }; }, true); }
        const g = L(F.data()).room, doc = L(F.data()).docs[row.k], id = 'dc' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('');
        const up = await K().api(g, `media/${id}`, { method: 'PUT', headers: { 'X-Type': 'application/json' }, body: JSON.stringify({ k: row.k, title: doc.title, film: d.title, name: f.name, prod: f.prod, text: doc.text }) }); if (!up.ok) throw new Error('up');
        F.change(dd => { const x = L(dd).docs[row.k]; x.status = x.status === 'signed' ? 'signed' : 'sent'; x.media = id; L(dd).st = L(dd).st || {}; L(dd).st[row.k] = { ...(L(dd).st[row.k] || {}), s: (L(dd).st[row.k] || {}).s === 'signed' ? 'signed' : 'sent' }; }, true);
        N.settled(); N.closeOv();
        const url = K().linkOf('sign', g) + '.' + id;
        const mm = N.modal(`<h2>Signing link for ${esc(f.name)}</h2><p>They open it, read the ${esc(row.kind.toLowerCase())}, and sign with their finger. The signed copy comes back to Clearances.</p>${K().linkBox('Signing link', url, `Hello ${f.name.split(' ')[0]}, please read and sign your ${row.kind.toLowerCase()} for “${d.title}”:`)}<div class="row"><button class="pri" data-close>Done</button></div>`);
        mm.querySelector('[data-close]').onclick = () => { N.closeOv(); F.refresh(); }; K().wireCopy(mm);
      } catch (e) { N.settled(); N.toast('Couldn’t make the link. Check your internet.'); }
    };
  };
  function producerSig(after) {
    const d = F.data(), m = N.modal(`<h2>Your signature</h2><p>Signed once, added to every agreement as the Producer.</p><label>Your name<input id="psN" value="${esc((L(d).me || {}).name || (d.contact || '').split('·')[0].trim())}"></label><div id="psPad" class="sig-pad"></div><div class="row"><button class="pri" id="psOk">Save my signature</button><button data-close>Cancel</button></div>`);
    const pad = F.sigPad(m.querySelector('#psPad')); m.querySelector('[data-close]').onclick = () => { N.closeOv(); after && after(); };
    m.querySelector('#psOk').onclick = async () => { const name = m.querySelector('#psN').value.trim(); if (!name || pad.empty()) return N.toast('Add your name and sign'); const id = await N.Store.putMedia(await pad.blob()); F.change(dd => { L(dd).me = { name, sig: id }; }, true); N.closeOv(); N.toast('Your signature is saved'); after && after(); };
  }
  function signHere(k) {
    const d = F.data(), doc = L(d).docs[k];
    const m = N.modal(`<h2>${esc(doc.title)}</h2><p>Hand the phone to ${esc(doc.f.name)}. They read it and sign below.</p><pre class="sign-read">${esc(doc.text)}</pre>
      <label>Full name<input id="shN" value="${esc(doc.f.name || '')}"></label><div id="shPad" class="sig-pad"></div><label class="inline"><input type="checkbox" id="shOk"> I have read this and I agree to it</label>
      <div class="row"><button class="pri" id="shSign">Sign</button><button data-close>Cancel</button></div>`);
    m.classList.add('wide'); const pad = F.sigPad(m.querySelector('#shPad')); m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#shSign').onclick = async () => { const name = m.querySelector('#shN').value.trim(); if (!name || pad.empty() || !m.querySelector('#shOk').checked) return N.toast('Add the name, sign, and tick that you agree');
      N.status('Saving…'); const sig = await N.Store.putMedia(await pad.blob()); await markSigned(k, { name, sig, at: Date.now(), how: 'in person' }); N.settled(); N.closeOv(); N.toast(`Signed by ${name}. The copy is in Clearances.`); };
  }

  // signatures that came back through links
  async function sync(quiet = true) {
    const d = F.data(); if (!d || !L(d).room || !K()) return 0; const g = L(d).room;
    try { const r = await K().api(g, `feedback?after=${g.seen || 0}`); if (!r.ok) return 0; const items = (await r.json()).items; if (!items.length) return 0; let n = 0;
      for (const { id, t, body: b } of items) { if (b.kind === 'signed' && b.k && L(F.data()).docs && L(F.data()).docs[b.k]) {
          let sig = null; try { const blob = await (await K().api(g, `media/${b.sig}`)).blob(); sig = await N.Store.putMedia(blob); } catch (e) {}
          await markSigned(b.k, { name: String(b.name || '').slice(0, 80), sig, at: t, how: 'signing link' }); n++; } }
      F.change(dd => { L(dd).room.seen = Math.max(...items.map(x => x.id)); }, true);
      if (n && quiet) N.toast(`${n} agreement${n === 1 ? '' : 's'} signed`); return n;
    } catch (e) { return 0; }
  }
  F.syncSignatures = sync;
  N.hooks.ready.push(() => { if (document.body.classList.contains('guesting')) return; setTimeout(() => F.data() && sync(), 5000); setInterval(() => { if (!document.hidden && F.root() && F.data() && (F.data().desks || {}).legal && F.data().desks.legal.room) sync(); }, 120000); });

  /* ---------- what the signer sees ---------- */
  N.guestPages = N.guestPages || {};
  N.guestPages.sign = async (body, f, g, key, send, docId) => {
    let doc; try { doc = await (await fetch(`${K().API}/rooms/${g.room}/media/${docId}?key=${encodeURIComponent(key)}`)).json(); } catch (e) { body.innerHTML = '<h1>This link isn’t working</h1><p>Ask the person who sent it for a new one.</p>'; return; }
    const doneKey = 'itan:signed:' + docId;
    if (localStorage.getItem(doneKey)) { body.innerHTML = `<p class="gs-kick">${esc(doc.film)}</p><h1>You’ve signed this</h1><p>Thank you. ${esc(doc.prod || 'The producer')} has your signed ${esc(String(doc.title || '').toLowerCase())}.</p><pre class="sign-read">${esc(doc.text)}</pre>`; return; }
    body.innerHTML = `<p class="gs-kick">${esc(doc.film)} · for ${esc(doc.name)}</p><h1>${esc(doc.title)}</h1><p>Please read it all. If something is wrong, contact ${esc(doc.prod || 'the producer')} before signing.</p>
      <pre class="sign-read">${esc(doc.text)}</pre><form class="gs-form" id="sgF"><label>Your full name<input name="name" required value="${esc(doc.name || '')}" autocomplete="name"></label><div id="sgPad" class="sig-pad"></div>
      <label class="inline"><input type="checkbox" name="ok" required> I have read this and I agree to it</label><div class="gs-prog" id="sgProg" hidden><i style="width:100%"></i><span>Sending…</span></div><button class="pri big" type="submit">Sign</button></form>`;
    const pad = F.sigPad(body.querySelector('#sgPad'));
    body.querySelector('#sgF').onsubmit = async e => { e.preventDefault(); if (pad.empty()) return N.toast('Please sign in the box'); const name = e.target.name.value.trim(), btn = e.target.querySelector('[type=submit]'); btn.disabled = true; body.querySelector('#sgProg').hidden = false;
      try { const id = 's' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('');
        const up = await fetch(`${K().API}/rooms/${g.room}/media/${id}`, { method: 'PUT', headers: { 'X-Key': key, 'X-Type': 'image/png' }, body: await pad.blob() }); if (!up.ok) throw new Error('up');
        await send({ kind: 'signed', k: doc.k, doc: docId, name, sig: id }); localStorage.setItem(doneKey, '1');
        body.innerHTML = `<p class="gs-kick">${esc(doc.film)}</p><h1>Signed. Thank you, ${esc(name.split(' ')[0])}!</h1><p>${esc(doc.prod || 'The producer')} now has your signed ${esc(String(doc.title || '').toLowerCase())}. You can ask them for a copy any time.</p>`;
      } catch (x) { btn.disabled = false; body.querySelector('#sgProg').hidden = true; N.toast('Couldn’t send. Check your internet and try again.'); } };
  };
})();
