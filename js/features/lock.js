/* PIN lock: a locked board (and every board inside it) asks for a PIN before it opens, and its
   contents are hidden from previews, search and the Today list. This keeps casual eyes out on a
   shared phone; it is not encryption. There is no way to recover a forgotten PIN. */
(function () {
  const N = window.N, S = N.S, esc = N.esc;
  const open = new Set();
  const enc = new TextEncoder();
  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  async function hash(pin, salt) {
    const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' }, key, 256));
  }
  const lockedSelf = id => { const b = S.boards[id]; return !!(b && b.extra && b.extra.lock && !open.has(id)); };
  function isLocked(id) { let b = S.boards[id], g = 0; while (b && g++ < 60) { if (lockedSelf(b.id)) return true; b = b.parent ? S.boards[b.parent] : null; } return false; }
  N.hooks.isLocked = isLocked;
  function firstLocked(id) { const chain = []; let b = S.boards[id], g = 0; while (b && g++ < 60) { chain.unshift(b.id); b = b.parent ? S.boards[b.parent] : null; } return chain.find(lockedSelf); }

  function ask(id) {
    const b = S.boards[id];
    return new Promise(res => {
      const m = N.modal(`<h2>“${esc(b.title || 'Board')}” is locked</h2><p>Enter its PIN to open it.</p>
        <form class="pinf"><input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN"><button class="pri">Open</button></form><p id="pinErr" class="fine"></p><div class="row" style="padding-top:0"><button data-close>Cancel</button></div>`);
      N.S.confirmRes = () => res(false);
      m.querySelector('[data-close]').onclick = N.closeOv;
      const inp = m.querySelector('#pin'); setTimeout(() => inp.focus(), 30);
      m.querySelector('form').onsubmit = async e => {
        e.preventDefault();
        const h = await hash(inp.value, b.extra.lock.salt);
        if (h === b.extra.lock.hash) { open.add(id); N.S.confirmRes = null; N.$('#dlg').hidden = true; res(true); N.requestRender(); }
        else { m.querySelector('#pinErr').textContent = 'That PIN isn’t right.'; inp.value = ''; m.querySelector('.panel, form').classList.add('shake'); setTimeout(() => m.querySelector('form').classList.remove('shake'), 400); }
      };
    });
  }
  const prev = N.hooks.beforeOpen;
  N.hooks.beforeOpen = async id => { if (!(await prev(id))) return false; let l; while ((l = firstLocked(id))) { if (!(await ask(l))) return false; } return true; };
  N.hooks.ready.push(() => { const l = firstLocked(S.cur); if (l) { const target = S.cur; N.show('home'); N.openBoard(target); } });

  function setPin(b) {
    const m = N.modal(`<h2>Lock “${esc(b.title || 'this board')}”</h2><p>Choose a PIN of 4 to 8 digits. You’ll need it to open this board and every board inside it. It can’t be recovered if you forget it.</p>
      <form class="pinf"><input id="p1" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="PIN" aria-label="New PIN"><input id="p2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="Again" aria-label="Repeat PIN"><button class="pri">Lock</button></form><p id="pinErr" class="fine"></p><div class="row" style="padding-top:0"><button data-close>Cancel</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    setTimeout(() => m.querySelector('#p1').focus(), 30);
    m.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const a = m.querySelector('#p1').value, c = m.querySelector('#p2').value;
      if (!/^\d{4,8}$/.test(a)) return m.querySelector('#pinErr').textContent = 'Use 4 to 8 digits.';
      if (a !== c) return m.querySelector('#pinErr').textContent = 'The two PINs don’t match.';
      const salt = N.uid() + N.uid(); N.snap(); b.extra.lock = { salt, hash: await hash(a, salt) }; open.add(b.id); N.touch(); N.closeOv(); N.render();
      N.toast('Locked. It stays open until you lock it again or close Notera.');
    };
  }
  N.hooks.tools.push(b => {
    if (b.id === 'home' || !N.P.canWrite) return '';
    const has = b.extra && b.extra.lock;
    return `<button class="ib${has ? ' locked' : ''}" id="lkBtn" title="${has ? 'This board is locked with a PIN' : 'Lock this board with a PIN'}"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0${has ? 'v2.5' : ''}"/></svg><span class="hide-s">${has ? 'Locked' : 'Lock'}</span></button>`;
  });
  N.$('#btools').addEventListener('click', e => {
    if (!e.target.closest('#lkBtn')) return; const b = N.B();
    if (!b.extra.lock) return setPin(b);
    const m = N.modal(`<h2>Board lock</h2><p>“${esc(b.title || 'This board')}” asks for a PIN before it opens.</p><div class="row"><button class="pri" id="lkNow">Lock now</button><button id="lkChange">Change PIN</button><button id="lkOff">Remove lock</button><button data-close>Close</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#lkNow').onclick = () => { N.closeOv(); open.delete(b.id); N.openBoard(b.parent || 'home'); };
    m.querySelector('#lkChange').onclick = () => { N.closeOv(); setPin(b); };
    m.querySelector('#lkOff').onclick = () => { N.closeOv(); N.snap(); delete b.extra.lock; N.touch(); N.render(); N.toast('Lock removed'); };
  });
})();
