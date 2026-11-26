/* Board tools island at the top: each feature adds its buttons through N.hooks.tools. */
(function () {
  const N = window.N, box = N.$('#btools');
  N.hooks.tools = N.hooks.tools || [];
  N.hooks.render.push(b => {
    box.innerHTML = N.hooks.tools.map(f => { try { return f(b) || ''; } catch (e) { console.error(e); return ''; } }).join('');
    box.classList.toggle('island', !!box.innerHTML.trim());
  });
})();
