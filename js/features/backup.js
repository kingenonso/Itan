/* Backups, so a film is never lost.
   Cloud backup: every few minutes after a change, Itàn sends an encrypted copy of your boards (and pictures, voice notes,
   and videos if you choose) to the free Itàn Live server. It's locked with a recovery code that only you have:
   the server can't read it, and nobody can restore it without the code. Restore on any device with the code.
   Backup file: download everything as one file, and open it on any device.
   Browsers (especially iPhone Safari) can clear a website's saved data; this is the safety net. */
(function () {
  const N = window.N, esc = N.esc, Store = N.Store;
  const API = (window.APP_CONFIG && window.APP_CONFIG.live) || '';
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const WAIT = 2 * 60 * 1000, MAX_MEDIA = 95 * 1024 * 1024;
  let st = null, busy = false, dirty = false, timer = null, keys = null;
  const enc = new TextEncoder();

  /* ---------- the recovery code and what it unlocks ---------- */
  const newCode = () => 'ITAN-' + Array.from({ length: 6 }, () => Array.from(crypto.getRandomValues(new Uint8Array(4)), b => ABC[b % ABC.length]).join('')).join('-');
  const clean = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ITAN/, '');
  const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const sha = async s => crypto.subtle.digest('SHA-256', enc.encode(s));
  async function derive(code) {
    const c = clean(code); if (c.length !== 24) throw new Error('code');
    return { room: 'bk' + hex(await sha('room:' + c)).slice(0, 22), key: hex(await sha('key:' + c)).slice(0, 40), view: hex(await sha('view:' + c)).slice(0, 40),
      aes: await crypto.subtle.importKey('raw', await sha('enc:' + c), 'AES-GCM', false, ['encrypt', 'decrypt']) };
  }
  const seal = async (k, bytes) => { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k.aes, bytes); const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return out; };
  const open = async (k, buf) => { const b = new Uint8Array(buf); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, k.aes, b.slice(12)); };
  const gzip = async str => new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const gunzip = async buf => new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const api = (k, path, opt = {}) => fetch(`${API}/rooms/${k.room}/${path}`, { ...opt, headers: { 'X-Key': k.key, ...(opt.headers || {}) } });

  const save = () => Store.setKV('backup', st).catch(() => {});
  const ago = t => { if (!t) return 'never'; const s = (Date.now() - t) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' day' + (Math.round(s / 86400) === 1 ? '' : 's') + ' ago'; };

  /* ---------- backing up ---------- */
  async function backupNow(manual) {
    if (!API || !st || !st.on || busy) return;
    if (!navigator.onLine) { if (manual) N.toast('Backing up needs internet. It’ll try again when you’re online.'); return; }
    busy = true; dirty = false; paint();
    try {
      keys = keys || await derive(st.code);
      const docs = [...N.P.remote], json = JSON.stringify({ v: 1, t: Date.now(), docs });
      const hash = hex(await sha(json)).slice(0, 16);
      let manifest = null;
      if (!st.made) { // first time on this code: create the room
        const r = await fetch(`${API}/rooms/${keys.room}/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edit: keys.key, view: keys.view, root: 'backup000', title: 'Backup' }) });
        if (!r.ok && r.status !== 409) throw new Error('init'); st.made = true;
      }
      if (hash !== st.hash || manual) {
        const slot = st.slot === 'snapshot0' ? 'snapshot1' : 'snapshot0';
        const body = await seal(keys, await gzip(json));
        const up = await api(keys, `media/${slot}?replace=1`, { method: 'PUT', body }); if (!up.ok) throw new Error('upload');
        st.slot = slot; st.hash = hash;
      }
      // pictures, voice notes (and videos if chosen), each sent once
      st.sent = st.sent || {}; let skipped = 0;
      const media = await Store.listMedia().catch(() => []);
      for (const m of media) {
        if (st.sent[m.id]) continue;
        if (/^video\//.test(m.type) && !st.videos) { skipped++; continue; }
        if (m.size > MAX_MEDIA) { skipped++; continue; }
        const blob = await Store.getMedia(m.id); if (!blob) continue;
        const body = await seal(keys, new Uint8Array(await blob.arrayBuffer()));
        const r = await api(keys, `media/${m.id}`, { method: 'PUT', headers: { 'X-Type': blob.type || '' }, body });
        if (r.ok) st.sent[m.id] = blob.type || 1; else if (r.status === 413) skipped++; else throw new Error('media');
      }
      manifest = { kind: 'backup', latest: st.slot, t: Date.now(), media: Object.keys(st.sent).map(id => [id, st.sent[id] === 1 ? '' : st.sent[id]]) };
      const mr = await api(keys, 'form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manifest) }); if (!mr.ok) throw new Error('manifest');
      st.last = Date.now(); st.skipped = skipped; st.err = ''; await save();
      if (manual) N.toast('Backed up');
    } catch (e) { st.err = e.message === 'Failed to fetch' ? 'offline' : e.message; await save(); if (manual) N.toast('Backup didn’t finish. Check your internet. Itàn will try again.'); }
    finally { busy = false; paint(); }
  }
  const soon = () => { if (!st || !st.on) return; dirty = true; clearTimeout(timer); timer = setTimeout(() => backupNow(false), WAIT); paint(); };
  N.hooks.saved.push(soon);
  window.addEventListener('online', () => { if (st && st.on && (dirty || st.err)) backupNow(false); });

  /* ---------- restoring ---------- */
  async function restore(code) {
    let k; try { k = await derive(code); } catch (e) { return N.toast('That recovery code doesn’t look right. It has 24 letters and numbers after ITAN.'); }
    N.status('Finding your backup…');
    let man;
    try { const r = await api(k, 'form'); if (r.status === 403) throw new Error('nf'); man = (await r.json()).form; if (!man || !man.latest) throw new Error('nf'); }
    catch (e) { N.settled(); return N.toast(e.message === 'nf' ? 'No backup was found for that code.' : 'Couldn’t reach the backup. Check your internet.'); }
    let data;
    try { const r = await api(k, `media/${man.latest}`); data = JSON.parse(await gunzip(await open(k, await r.arrayBuffer()))); }
    catch (e) { N.settled(); return N.toast('That backup couldn’t be opened. Check the code.'); }
    N.settled();
    const boards = data.docs.filter(([key]) => key.startsWith('b:')).length;
    const ok = await N.confirmBox(`Restore ${boards} board${boards === 1 ? '' : 's'} backed up ${new Date(data.t).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}? Boards that are also on this device are replaced with the backed-up version; other boards stay.`, 'Restore');
    if (!ok) return;
    await Store.inject(data.docs);
    // bring the pictures and recordings back too
    const list = (man.media || []).map(x => Array.isArray(x) ? x : [x, '']); let n = 0;
    N.status(`Bringing back pictures and recordings… 0 of ${list.length}`);
    for (const [id, type] of list) {
      try { if (await Store.hasMedia(id)) { n++; continue; } const r = await api(k, `media/${id}`); if (!r.ok) continue; const bytes = await open(k, await r.arrayBuffer()); await Store.putMediaAs(id, new Blob([bytes], { type: type || '' })); n++; N.status(`Bringing back pictures and recordings… ${n} of ${list.length}`); } catch (e) {}
    }
    N.settled(); N.render();
    st = { on: true, code: code.trim().toUpperCase(), made: true, slot: man.latest, hash: '', last: Date.now(), sent: Object.fromEntries(list.map(([id, t]) => [id, t || 1])), videos: false };
    keys = k; await save(); paint();
    N.toast('Your boards are back. This device now keeps backing up with the same recovery code.');
  }

  /* ---------- the Backups window ---------- */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  async function panel() {
    const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
    const on = st && st.on;
    const m = N.modal(`<h2>Backups</h2><p>Itàn keeps your films on this device. Browsers can clear a website’s data, so keep a backup somewhere else too.</p>
      ${isIOS && !standalone ? '<p class="bk-warn">On iPhone and iPad, Safari can delete a website’s data if you don’t open it for about a week. Add Itàn to your Home Screen (Share → Add to Home Screen) and turn on cloud backup.</p>' : ''}
      <section class="bk-sec"><div class="bk-head"><div><b>Cloud backup</b><small>${on ? (busy ? 'Backing up now…' : st.err ? 'Couldn’t back up ' + ago(st.last === undefined ? 0 : st.last) + '. Will retry.' : 'On · last backup ' + ago(st.last)) : 'Off'}</small></div>
        <label class="bk-sw"><input type="checkbox" id="bkOn"${on ? ' checked' : ''}${API ? '' : ' disabled'}><span></span></label></div>
        <p class="fhint">A copy is sent a couple of minutes after you make changes. It’s encrypted with your recovery code before it leaves this device, so nobody else can read your scripts, not even the server. Free.</p>
        ${on ? `<div class="bk-code"><small>Your recovery code. Keep it somewhere safe, like a note or a message to yourself. Without it, the backup can’t be restored.</small><div><code id="bkCode">${esc(st.code)}</code><button class="ib" id="bkCopy">Copy</button><a class="ib" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('My Itàn recovery code: ' + st.code)}">Send to myself</a></div></div>
          <label class="bk-row"><input type="checkbox" id="bkVid"${st.videos ? ' checked' : ''}> Also back up videos (up to 95 MB each; uses more of the free space)</label>
          ${st.skipped ? `<p class="fhint">${st.skipped} video${st.skipped === 1 ? ' is' : 's are'} not in the cloud backup${st.videos ? ' (too big)' : ''}. Keep the originals on your drive.</p>` : ''}
          <div class="row"><button class="pri" id="bkNow">Back up now</button></div>` : ''}</section>
      <section class="bk-sec"><b>Restore from a cloud backup</b><p class="fhint">On a new phone or computer, type your recovery code to bring your boards back.</p>
        <div class="bk-restore"><input id="bkIn" placeholder="ITAN-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false"><button class="ib" id="bkRestore">Restore</button></div></section>
      <section class="bk-sec"><b>Backup file</b><p class="fhint">Download every board, picture and recording as one file to keep on a drive, or open one on any device.</p>
        <div class="row"><button class="ib" id="bkFile">Download a backup file</button><button class="ib" id="bkOpen">Open a backup file</button></div></section>
      <p class="fine">${persisted ? 'This browser has agreed not to clear Itàn’s data on its own.' : 'This browser may clear Itàn’s data when the device is low on space. <button class="linkish" id="bkKeep">Ask it not to</button>'}</p>
      <div class="row"><button data-close>Close</button></div>`);
    m.classList.add('wide');
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#bkOn').onchange = async e => {
      if (e.target.checked) { st = Object.assign({ code: newCode(), sent: {}, videos: false }, st || {}, { on: true }); keys = null; await save(); N.closeOv(); await backupNow(true); panel(); }
      else { const ok = await N.confirmBox('Turn off cloud backup on this device? Your last backup stays, and your recovery code still restores it.', 'Turn off'); if (ok) { st.on = false; await save(); } N.closeOv(); panel(); }
    };
    const q = id => m.querySelector(id);
    if (q('#bkCopy')) q('#bkCopy').onclick = async () => { try { await navigator.clipboard.writeText(st.code); N.toast('Recovery code copied'); } catch (e) { N.toast(st.code); } };
    if (q('#bkVid')) q('#bkVid').onchange = async e => { st.videos = e.target.checked; await save(); if (st.videos) backupNow(false); };
    if (q('#bkNow')) q('#bkNow').onclick = async () => { N.closeOv(); await backupNow(true); };
    q('#bkRestore').onclick = () => { const c = q('#bkIn').value; N.closeOv(); restore(c); };
    q('#bkFile').onclick = () => { N.closeOv(); N.exportBoard('home'); st = st || { on: false }; st.file = Date.now(); save(); };
    q('#bkOpen').onclick = () => { N.closeOv(); document.getElementById('boardFile').click(); };
    if (q('#bkKeep')) q('#bkKeep').onclick = async () => { const ok = await Store.keepSafe().catch(() => false); N.toast(ok ? 'Done. This browser won’t clear Itàn’s data on its own.' : 'This browser didn’t allow it. Installing Itàn as an app usually does.'); N.closeOv(); };
  }
  N.backups = panel;

  /* ---------- the button in the top bar ---------- */
  const btn = document.createElement('button'); btn.className = 'ib'; btn.id = 'bBackup';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg><i class="bk-dot"></i>';
  btn.onclick = panel;
  const theme = document.getElementById('bTheme') || document.getElementById('bShare'); if (theme) theme.parentNode.insertBefore(btn, theme);
  function paint() {
    const on = st && st.on, ok = on && !st.err, stale = on && st.last && Date.now() - st.last > 3 * 86400000;
    btn.dataset.state = !on ? 'off' : busy ? 'busy' : ok && !stale ? 'ok' : 'warn';
    btn.title = !on ? 'Backups: off. Tap to keep your films safe.' : busy ? 'Backing up…' : `Backups: last backup ${ago(st.last)}`;
    btn.setAttribute('aria-label', btn.title);
  }

  N.hooks.ready.push(async () => {
    st = await Store.getKV('backup').catch(() => null); paint();
    if (st && st.on) setTimeout(() => { if (dirty || !st.last || Date.now() - st.last > WAIT) backupNow(false); }, 8000);
    // once, after someone has real work in Itàn, suggest turning backups on
    setTimeout(() => {
      let askedHere = false; try { askedHere = !!localStorage.getItem('itan:bkAsked'); } catch (e) {}
      if ((st && (st.on || st.asked)) || askedHere || document.body.classList.contains('guesting') || document.querySelector('#dlg:not([hidden])') || N.isEditing()) return;
      const films = Object.values(N.S.boards).filter(b => b.extra && b.extra.film).length, boards = Object.keys(N.S.boards).length;
      if (!N.P.remote.size || (films < 1 && boards < 6)) return;
      st = Object.assign(st || {}, { asked: Date.now() }); save(); try { localStorage.setItem('itan:bkAsked', '1'); } catch (e) {}
      N.confirmBox('Keep your films safe? Turn on free cloud backup. It’s encrypted, and you can restore on any device with your recovery code.', 'Set up backups').then(ok => ok && panel());
    }, 6000);
  });
})();
