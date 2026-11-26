/* Sharing: send boards through the phone's share sheet (WhatsApp, Telegram, email…),
   and receive pictures, videos, audio, links, text and .board files from other apps
   when Notera is installed (they land on an "Inbox" board). */
(function () {
  const N = window.N, $ = N.$, esc = N.esc;
  N.hooks.shareExtras = N.hooks.shareExtras || [];

  async function send(rootId) {
    const file = await N.exportBoard(rootId, 'share');
    const title = (N.S.boards[rootId].title || 'Board');
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title, text: `“${title}” from Notera. Open it in Notera with Share → Open a board file.` }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    // No share sheet on this device: save the file instead
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    N.toast(`Saved “${file.name}”. Attach it in WhatsApp or email to send it.`);
  }

  $('#bShare').onclick = () => {
    const cur = N.B(), canSheet = !!(navigator.canShare && navigator.share);
    const extras = N.hooks.shareExtras.map((x, i) => `<button data-x="${i}">${esc(x.label)}</button>`).join('');
    const m = N.modal(`<h2>Share</h2><p>${canSheet ? 'Send a board straight to WhatsApp, Telegram, email or anywhere else on this device. ' : ''}The other person opens it in Notera with “Open a board file”. Pictures, videos and voice notes go inside the file.</p>
      <div class="row"><button class="pri" id="shCur">${canSheet ? 'Send' : 'Download'} “${esc(cur.title || 'Untitled board')}”</button><button id="shAll">${canSheet ? 'Send' : 'Download'} everything</button><button id="shOpen">Open a board file</button></div>
      ${extras ? `<p class="fine" style="margin-bottom:0">Or save it for people who don’t use Notera:</p><div class="row">${extras}</div>` : ''}
      <div class="row" style="padding-top:0"><button data-close>Close</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#shCur').onclick = () => { N.closeOv(); send(N.S.cur); };
    m.querySelector('#shAll').onclick = () => { N.closeOv(); send('home'); };
    m.querySelector('#shOpen').onclick = () => { N.closeOv(); $('#boardFile').click(); };
    m.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { N.closeOv(); N.hooks.shareExtras[+b.dataset.x].run(); });
  };

  // Receive from other apps (installed app on Android/desktop Chrome and Edge)
  async function inbox() {
    if (!('caches' in window)) return;
    const c = await caches.open('notera-inbox'); const meta = await c.match('inbox/meta'); if (!meta) return;
    const info = await meta.json().catch(() => ({})); await c.delete('inbox/meta');
    const S = N.S;
    if (!S.boards.inbox) {
      N.snap();
      S.boards.inbox = N.normalize({ id: 'inbox', title: 'Inbox', parent: 'home', cards: [], links: [], created: Date.now() });
      const home = S.boards.home, pt = { x: 60, y: Math.max(40, ...home.cards.filter(x => !x.col).map(x => x.y + 220)) };
      home.cards.push(N.newCard('board', pt.x, pt.y, { board: 'inbox', color: '#4636ef' })); N.touch();
    }
    N.show('inbox'); try { location.hash = 'inbox'; } catch (e) {}
    const pt = N.centerPt(280), files = [];
    for (let i = 0; i < (info.count || 0); i++) {
      const r = await c.match('inbox/' + i); if (!r) continue;
      const blob = await r.blob(), name = decodeURIComponent(r.headers.get('x-name') || 'file');
      files.push(new File([blob], name, { type: blob.type || r.headers.get('content-type') || '' })); await c.delete('inbox/' + i);
    }
    const boards = files.filter(f => /\.board$/i.test(f.name)), media = files.filter(f => !/\.board$/i.test(f.name));
    const url = (info.url || (String(info.text || '').match(/https?:\/\/\S+/) || [])[0] || '').trim();
    const text = [info.title, info.text].filter(Boolean).join('\n').replace(url, '').trim();
    if (url) N.addCard('link', { x: pt.x, y: pt.y - 120 }, null, { url, text: info.title || url });
    else if (text) N.addCard('note', { x: pt.x, y: pt.y - 120 }, null, { text });
    if (media.length) await N.addMedia(media, pt, null);
    for (const f of boards) await N.importBoardFile(f);
    N.toast('Added to your Inbox board');
  }
  N.hooks.ready.push(() => { inbox().catch(() => {}); });
})();
