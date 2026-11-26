// Lets Notera open without internet after the first visit. Bump VERSION when you change app files.
const VERSION = 'notera-v10';
const FILES = ['./', 'index.html', 'css/app.css', 'css/film.css', 'js/config.js', 'js/storage-local.js', 'js/app.js', 'js/features/core.js', 'js/features/today.js', 'js/features/share.js', 'js/features/walk.js', 'js/features/transcribe.js', 'js/features/history.js', 'js/features/lock.js', 'js/features/tidy.js', 'js/features/templates.js', 'js/features/export.js', 'js/features/install.js', 'js/features/film-core.js', 'js/features/film-breakdown.js', 'js/features/film-schedule.js', 'js/features/film-shots.js', 'js/features/film-callsheet.js', 'js/features/film-review.js', 'js/features/film-script.js', 'js/features/film-smart.js', 'js/features/film-budget.js', 'js/features/film-reports.js', 'js/features/live.js', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'notera-inbox').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Things shared into Notera from other apps: keep them until the app opens and picks them up
  if (e.request.method === 'POST' && u.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await e.request.formData(), c = await caches.open('notera-inbox');
      const files = form.getAll('media').filter(f => f && f.size);
      for (let i = 0; i < files.length; i++) await c.put('inbox/' + i, new Response(files[i], { headers: { 'content-type': files[i].type || 'application/octet-stream', 'x-name': encodeURIComponent(files[i].name || 'file') } }));
      await c.put('inbox/meta', new Response(JSON.stringify({ title: form.get('title') || '', text: form.get('text') || '', url: form.get('url') || '', count: files.length }), { headers: { 'content-type': 'application/json' } }));
      return Response.redirect(new URL('./#inbox', self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Network first so updates show up; fall back to the saved copy when offline.
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
