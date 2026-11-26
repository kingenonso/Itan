// Lets Itàn open without internet after the first visit. Bump VERSION when you change app files.
const VERSION = 'itan-v21';
const FILES = ['./', 'index.html', 'css/app.css', 'css/film.css', 'js/config.js', 'js/storage-local.js', 'js/app.js', 'js/features/core.js', 'js/features/today.js', 'js/features/share.js', 'js/features/walk.js', 'js/features/transcribe.js', 'js/features/history.js', 'js/features/lock.js', 'js/features/tidy.js', 'js/features/templates.js', 'js/features/export.js', 'js/features/install.js', 'js/features/film-core.js', 'js/features/film-breakdown.js', 'js/features/film-schedule.js', 'js/features/film-shots.js', 'js/features/film-callsheet.js', 'js/features/film-review.js', 'js/features/film-script.js', 'js/features/film-lined.js', 'js/features/film-smart.js', 'js/features/film-budget.js', 'js/features/film-reports.js', 'js/features/live.js', 'js/features/film-sketch.js', 'js/features/film-animatic.js', 'js/features/film-shotlist.js', 'js/features/film-sun.js', 'js/features/film-camera.js', 'js/features/film-takes.js', 'js/features/film-set.js', 'js/features/film-post.js', 'js/features/comments.js', 'js/features/guest.js', 'js/features/film-casting.js', 'js/features/film-locations.js', 'js/features/viewfinder.js', 'js/features/film-weather.js', 'js/features/film-desks.js', 'js/features/film-desks2.js', 'js/features/film-desks3.js', 'js/features/film-alerts.js', 'js/features/welcome.js', 'js/features/backup.js', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'itan-inbox').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Things shared into Itàn from other apps: keep them until the app opens and picks them up
  if (e.request.method === 'POST' && u.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await e.request.formData(), c = await caches.open('itan-inbox');
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

// Weather and crew alerts: the server wakes this up with an empty push, then we ask it what's new.
try { self.window = self; importScripts('js/config.js'); } catch (e) {}
const LIVE = (self.APP_CONFIG && self.APP_CONFIG.live) || '';
async function pushId(sub) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint)); return btoa(String.fromCharCode(...new Uint8Array(h))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32); }
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let items = [];
    try { const sub = await self.registration.pushManager.getSubscription(); if (sub && LIVE) { const r = await fetch(`${LIVE}/push/latest?id=${await pushId(sub)}&since=${Date.now() - 6 * 36e5}`); items = (await r.json()).items || []; } } catch (err) {}
    if (!items.length) return self.registration.showNotification('Itàn', { body: 'There’s an update for your shoot. Open Itàn to see it.', icon: 'icons/icon-192.png', tag: 'itan-update' });
    for (const a of items.slice(0, 3)) await self.registration.showNotification(a.title, { body: a.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'itan-' + a.id, requireInteraction: a.lvl === 'crisis', vibrate: a.lvl === 'crisis' ? [300, 120, 300, 120, 300] : [120], data: { day: a.day } });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true }), url = new URL('./#weather', self.registration.scope).href;
    for (const c of all) { if ('focus' in c) { await c.focus(); c.postMessage({ type: 'itan-weather' }); return; } }
    await clients.openWindow(url);
  })());
});
