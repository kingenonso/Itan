/* Comments on cards: talk about a card right where it is. Type @ and a name to mention someone;
   they get a notice the next time Itàn is open (and straight away when you're working live together). */
(function () {
  const N = window.N, esc = N.esc, S = N.S;
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }); };
  const myName = () => (N.live && N.live.me() && N.live.me().name) || localStorage.getItem('itan:name') || '';
  const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  async function ensureName() {
    if (myName()) return myName();
    if (N.live && N.live.askName) { const me = await N.live.askName(); return me && me.name; }
    const n = await (N.film ? N.film.ask('Your name', 'So people know who wrote the comment') : Promise.resolve(prompt('Your name')));
    if (n) localStorage.setItem('itan:name', n); return n;
  }
  // people you can mention: who's online, the film's cast and crew, and anyone who has commented
  function names() {
    const set = new Set();
    if (N.live) N.live.people().forEach(p => set.add(p.name));
    const d = N.film && N.film.root() && N.film.data(); if (d) d.people.forEach(p => p.name && set.add(p.name));
    Object.values(S.boards).forEach(b => b.cards.forEach(c => (c.comments || []).forEach(m => set.add(m.by))));
    set.delete(myName()); set.delete(''); return [...set].sort();
  }
  const fmt = t => esc(t).replace(/(^|\s)@([\p{L}\p{N}][\p{L}\p{N}._-]*(?: [\p{Lu}][\p{L}]+)?)/gu, '$1<b class="cm-at">@$2</b>');

  N.hooks.ctxExtras.push((ids) => ids.length === 1 ? '<button class="cb" data-a="comment">Comment</button>' : '');
  N.hooks.ctxAct.comment = c => c && panel(c);
  N.hooks.cardBadges.push(c => { const open = (c.comments || []).filter(m => !m.done).length; return open ? `<button class="cm-badge" data-cm title="${open} comment${open === 1 ? '' : 's'}"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>${open}</button>` : ''; });
  N.world.addEventListener('click', e => { const b = e.target.closest('[data-cm]'); if (!b) return; e.stopPropagation(); const c = N.find(b.closest('.card').dataset.id); if (c) panel(c); });

  function panel(c) {
    const boardId = N.S.cur, now = () => ((S.boards[boardId] || { cards: [] }).cards.find(x => x.id === c.id)) || c;
    const m = N.modal(`<h2>Comments</h2><p>${esc((c.text || c.title || N.TN[c.type] || 'Card').split('\n')[0].slice(0, 80))}</p>
      <ol class="cm-list" id="cmList"></ol>
      <div class="cm-new"><textarea id="cmText" rows="2" placeholder="Write a comment. Type @ to mention someone."></textarea><ul class="cm-sug" id="cmSug" hidden></ul></div>
      <div class="row"><button class="pri" id="cmPost">Post comment</button><button data-close>Close</button></div>`);
    m.classList.add('wide');
    const list = m.querySelector('#cmList'), ta = m.querySelector('#cmText'), sug = m.querySelector('#cmSug');
    const draw = () => { c = now(); const cs = c.comments || [];
      list.innerHTML = cs.map(x => `<li class="${x.done ? 'done' : ''}" data-cid="${esc(x.id)}"><span class="lv-face" style="--c:${esc(x.color || '#4636ef')}">${esc(initials(x.by))}</span>
        <div class="cm-body"><div class="cm-meta"><b>${esc(x.by || 'Someone')}</b><small>${ago(x.t)}</small></div><p>${fmt(x.text)}</p></div>
        <div class="cm-act"><button class="ib xs" data-cdone title="${x.done ? 'Reopen' : 'Mark as resolved'}">${x.done ? 'Reopen' : 'Resolve'}</button>${x.by === myName() ? '<button class="ib xs" data-cdel aria-label="Delete comment">✕</button>' : ''}</div></li>`).join('') || '<li class="empty-row">No comments yet</li>';
      list.scrollTop = list.scrollHeight; };
    draw();
    const post = async () => {
      const text = ta.value.trim(); if (!text) return ta.focus();
      const by = await ensureName(); if (!by) return;
      const me = N.live && N.live.me();
      const cur = now(); N.snap(); cur.comments = [...(cur.comments || []), { id: N.uid(), by, color: (me && me.color) || '#4636ef', t: Date.now(), text, done: false }]; N.touch(); N.render();
      c = cur; ta.value = ''; draw(); seenNow();
    };
    m.querySelector('#cmPost').onclick = post;
    m.querySelector('[data-close]').onclick = N.closeOv;
    ta.addEventListener('keydown', e => {
      if (!sug.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab')) {
        const items = [...sug.children], i = items.findIndex(x => x.classList.contains('on'));
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(items[Math.max(0, i)].dataset.n); return; }
        e.preventDefault(); items.forEach(x => x.classList.remove('on')); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].classList.add('on'); return;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); post(); }
    });
    const word = () => { const v = ta.value.slice(0, ta.selectionStart), mm = v.match(/(^|\s)@([^\s@]*)$/); return mm ? mm[2] : null; };
    const pick = n => { const pos = ta.selectionStart, v = ta.value, before = v.slice(0, pos).replace(/@([^\s@]*)$/, '@' + n + ' '); ta.value = before + v.slice(pos); ta.selectionStart = ta.selectionEnd = before.length; sug.hidden = true; ta.focus(); };
    ta.addEventListener('input', () => { const w = word(); if (w === null) { sug.hidden = true; return; }
      const ns = names().filter(n => n.toLowerCase().includes(w.toLowerCase())).slice(0, 6);
      sug.innerHTML = ns.map((n, i) => `<li data-n="${esc(n)}" class="${i ? '' : 'on'}">${esc(n)}</li>`).join(''); sug.hidden = !ns.length; });
    sug.addEventListener('mousedown', e => { const li = e.target.closest('[data-n]'); if (li) { e.preventDefault(); pick(li.dataset.n); } });
    list.addEventListener('click', e => {
      const li = e.target.closest('[data-cid]'); if (!li) return; const cur = now();
      if (e.target.closest('[data-cdone]')) { N.snap(); const x = cur.comments.find(y => y.id === li.dataset.cid); x.done = !x.done; N.touch(); N.render(); c = cur; draw(); }
      if (e.target.closest('[data-cdel]')) { N.snap(); cur.comments = cur.comments.filter(y => y.id !== li.dataset.cid); N.touch(); N.render(); c = cur; draw(); }
    });
    setTimeout(() => ta.focus(), 60);
  }

  /* ---------- mentions ---------- */
  let seen = null;
  const load = () => { if (seen) return; try { seen = new Set(JSON.parse(localStorage.getItem('itan:mentions') || '[]')); } catch (e) { seen = new Set(); } };
  const save = () => { try { localStorage.setItem('itan:mentions', JSON.stringify([...seen].slice(-500))); } catch (e) {} };
  function mentions() {
    const me = myName(); if (!me) return []; const re = new RegExp('(^|\\s)@' + me.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'iu'), out = [];
    Object.values(S.boards).forEach(b => b.cards.forEach(c => (c.comments || []).forEach(m => { if (!m.done && m.by !== me && re.test(m.text)) out.push({ m, b, c }); })));
    return out;
  }
  function seenNow() { load(); mentions().forEach(x => seen.add(x.m.id)); save(); }
  let checkT;
  N.hooks.render.push(() => { clearTimeout(checkT); checkT = setTimeout(() => {
    load(); const fresh = mentions().filter(x => !seen.has(x.m.id)); if (!fresh.length) return;
    fresh.forEach(x => seen.add(x.m.id)); save();
    const x = fresh[fresh.length - 1], msg = `${x.m.by} mentioned you on “${x.b.title || 'Untitled board'}”: ${x.m.text.slice(0, 80)}`;
    N.toast(fresh.length > 1 ? `${fresh.length} new mentions. Latest: ${msg}` : msg);
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) { try { new Notification('Itàn', { body: msg, icon: 'icons/icon-192.png', tag: 'itan-mention' }); } catch (e) {} }
  }, 400); });
})();
