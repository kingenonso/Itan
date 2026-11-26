// Lets Itàn open without internet after the first visit. Bump VERSION when you change app files.
const VERSION = 'itan-5c5da3c8'; // set by scripts/build-web.js
const FILES = ['./', 'index.html', 'css/itan.min.css?v=5c5da3c8', 'js/config.js', 'js/itan.min.js?v=5c5da3c8', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
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
