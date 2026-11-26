/* Board tools island at the top: each feature adds its buttons through N.hooks.tools. */
(function () {
  const N = window.N, box = N.$('#btools');
  N.hooks.tools = N.hooks.tools || [];
  N.hooks.render.push(b => {
    box.innerHTML = N.hooks.tools.map(f => { try { return f(b) || ''; } catch (e) { console.error(e); return ''; } }).join('');
    box.classList.toggle('island', !!box.innerHTML.trim());
  });
})();

/* Studio (dark) or Daylight (light) */
(function () {
  const N = window.N, root = document.documentElement;
  const MOON = '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>', SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';
  const b = document.createElement('button'); b.className = 'ib'; b.id = 'bTheme';
  const set = t => { root.dataset.theme = t; try { localStorage.setItem('itan:theme', t); } catch (e) {} b.innerHTML = t === 'dark' ? SUN : MOON; b.title = t === 'dark' ? 'Switch to Daylight' : 'Switch to Studio (dark)'; b.setAttribute('aria-label', b.title);
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#1c1d20' : '#e8e8e5'; };
  set(root.dataset.theme === 'light' ? 'light' : 'dark');
  b.onclick = () => set(root.dataset.theme === 'dark' ? 'light' : 'dark');
  const share = document.getElementById('bShare'); if (share) share.parentNode.insertBefore(b, share);
})();
