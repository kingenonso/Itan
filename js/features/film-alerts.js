/* Alerts that reach the whole team's phones, even when Itàn is closed.
   Turn them on once per device ("Alert me on this phone"). Itàn's free server then checks the forecast for the
   next three shoot days every 3 hours and sends a notification for a weather crisis (thunderstorm, flooding rain,
   dangerous wind or heat) or rain on an outdoor day. Anyone on the team can also send a message to every phone
   following the film ("Alert the crew"), or send it on WhatsApp to people who don't use Itàn.
   When a crisis is close, Itàn opens a crisis screen with the safety plan and what to do next. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const API = (window.APP_CONFIG || {}).live || '';
  const can = () => 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined' && !!API;
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  const on = id => { try { return localStorage.getItem('itan:push:' + id) === '1'; } catch (e) { return false; } };
  const filmKey = () => { const d = F.data(); if (!d) return null; if (!d.pushId) { d.pushId = N.uid() + N.uid(); N.touch(); } return d.pushId; };
  F.pushOn = () => { const d = F.data(); return !!(d && d.pushId && on(d.pushId) && typeof Notification !== 'undefined' && Notification.permission === 'granted'); };

  function summary(d) {
    return d.days.map(day => { const p = F.placeOfDay(d, day); return p && day.date ? { id: day.id, date: day.date, lat: +(+p.lat).toFixed(3), lon: +(+p.lon).toFixed(3), ext: F.dayScenes(d, day).some(s => /EXT/i.test(s.ie || '')), label: F.dayLabel(d, day) } : null; }).filter(Boolean);
  }
  async function subscription(create) {
    const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
    if (!sub && create) { const { key } = await (await fetch(API + '/push/key')).json(); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }); }
    return sub;
  }
  let lastSent = '';
  F.pushSync = async (force) => {
    const d = F.data(); if (!d || !d.pushId || !on(d.pushId) || !can() || Notification.permission !== 'granted') return null;
    const days = summary(d), sig = JSON.stringify([d.title, days]); if (!force && sig === lastSent) return null;
    try { const sub = await subscription(false); if (!sub) return null;
      const r = await fetch(API + '/push/sub', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ film: d.pushId, title: d.title, endpoint: sub.endpoint, days }) });
      if (!r.ok) return null; lastSent = sig; return await r.json(); } catch (e) { return null; }
  };
  F.pushEnable = async () => {
    if (!can()) { N.toast(/iPhone|iPad/.test(navigator.userAgent) ? 'On iPhone, add Itàn to your Home Screen first (Share › Add to Home Screen), then turn alerts on from there' : 'This browser can’t receive alerts. Try Chrome, Edge, Firefox or the installed app.'); return false; }
    const p = await Notification.requestPermission(); if (p !== 'granted') { N.toast('Notifications are blocked for Itàn. Allow them in the browser’s site settings.'); return false; }
    const key = filmKey(); if (!key) return false;
    try { N.status('Turning on alerts…'); await subscription(true); try { localStorage.setItem('itan:push:' + key, '1'); localStorage.setItem('itan:pushfilm', F.root().id); } catch (e) {}
      const res = await F.pushSync(true); N.settled();
      if (!res) { N.toast('Couldn’t reach Itàn’s alert server. Check your internet and try again.'); return false; }
      N.toast(`Alerts are on for ${res.devices} device${res.devices === 1 ? '' : 's'}. Ask your crew to turn them on too.`); return true;
    } catch (e) { N.settled(); N.toast('This device couldn’t sign up for alerts. Try again, or use the installed app.'); return false; }
  };
  F.pushDisable = async () => { const d = F.data(); if (!d || !d.pushId) return; try { const sub = await subscription(false); if (sub) await fetch(API + '/push/unsub', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ film: d.pushId, endpoint: sub.endpoint }) }); localStorage.removeItem('itan:push:' + d.pushId); } catch (e) {} N.toast('Alerts are off on this device'); };

  /* ---------- "Alert the crew": to every phone following the film, and on WhatsApp ---------- */
  F.alertCrew = (text = '', crisis = false) => {
    const d = F.data(); if (!d) return;
    const m = N.modal(`<h2>${crisis ? '⚠ ' : ''}Alert the crew</h2><p>Sends a notification to everyone who turned on alerts for <b>${esc(d.title)}</b>, and gives you the same message for WhatsApp.</p>
      <label>Message<textarea id="acText" rows="4" maxlength="300">${esc(text)}</textarea></label>
      <label class="inline"><input type="checkbox" id="acCrisis"${crisis ? ' checked' : ''}> Mark as urgent (stays on screen until they open it)</label>
      <div class="row"><button class="pri" id="acPush">Send to phones</button><button id="acWa">Send on WhatsApp</button><button data-close>Cancel</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    const msg = () => m.querySelector('#acText').value.trim();
    m.querySelector('#acWa').onclick = () => { if (!msg()) return; window.open('https://wa.me/?text=' + encodeURIComponent(`${d.title}: ${msg()}`), '_blank', 'noopener'); };
    m.querySelector('#acPush').onclick = async () => {
      if (!msg()) return N.toast('Write the message first'); const key = filmKey();
      try { const r = await fetch(API + '/push/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ film: key, title: `${m.querySelector('#acCrisis').checked ? '⚠ ' : ''}${d.title}`, text: msg(), lvl: m.querySelector('#acCrisis').checked ? 'crisis' : 'info' }) }); const j = await r.json();
        if (!r.ok) return N.toast(j.error || 'Couldn’t send'); N.closeOv();
        N.toast(j.devices ? `Sent to ${j.devices} device${j.devices === 1 ? '' : 's'}. Use WhatsApp for anyone without alerts on.` : 'No one has alerts on yet. Send it on WhatsApp instead.');
      } catch (e) { N.toast('You’re offline. Send it on WhatsApp instead.'); }
    };
  };

  /* ---------- the crisis screen ---------- */
  F.crisisCheck = list => {
    const d = F.data(); if (!d) return;
    const hit = list.filter(o => o.away <= 2).flatMap(o => o.al.filter(a => a.crisis).map(a => ({ ...o, a })))[0]; if (!hit) return;
    const k = 'itan:crisis:' + hit.day.id + ':' + hit.a.text; try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) {}
    if (document.querySelector('.crisis')) return;
    const when = hit.away === 0 ? 'Today' : hit.away === 1 ? 'Tomorrow' : new Date(hit.day.date + 'T00:00:00').toLocaleDateString([], { weekday: 'long' });
    const safe = F.desk(d, 'safety', {}), hosp = safe.hospital || hit.day.hospital || '', em = safe.emergency || '', meet = safe.meet || '';
    const el = document.createElement('div'); el.className = 'crisis'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-label', 'Weather crisis');
    el.innerHTML = `<div class="crisis-card"><span class="crisis-badge">Weather crisis</span><h2>${esc(when)}, Day ${hit.i + 1}: ${esc(hit.a.text)}</h2><p>${esc(hit.a.hint)}</p>
      <dl class="crisis-safe"><div><dt>Nearest hospital</dt><dd>${esc(hosp) || '<span>Not set</span>'}</dd></div><div><dt>Emergency number</dt><dd>${esc(em) || '<span>Not set</span>'}</dd></div><div><dt>Meeting point</dt><dd>${esc(meet) || '<span>Not set</span>'}</dd></div></dl>
      <div class="crisis-act"><button class="pri" data-c="crew">Alert the crew</button><button data-c="wx">See the forecast</button><button data-c="safe">Safety plan</button><button data-c="x">Close</button></div></div>`;
    document.body.append(el); el.querySelector('.pri').focus();
    el.onclick = e => { const c = e.target.closest('[data-c]'); if (!c) return; el.remove();
      if (c.dataset.c === 'crew') F.alertCrew(`Weather crisis for ${when.toLowerCase()} (Day ${hit.i + 1}): ${hit.a.text}. ${hit.a.hint}`, true);
      if (c.dataset.c === 'wx') F.open('weather'); if (c.dataset.c === 'safe') F.openDesk && F.openDesk('safety'); };
    el.onkeydown = e => { if (e.key === 'Escape') el.remove(); };
  };

  // opened from a notification
  const fromNote = () => { let id = null; try { id = localStorage.getItem('itan:pushfilm'); } catch (e) {} if (id && N.S.boards[id]) { N.show(id); setTimeout(() => F.open('weather'), 50); } };
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'itan-weather') fromNote(); });
  N.hooks.ready.push(() => { if (N.startHash === '#weather') setTimeout(fromNote, 200); setTimeout(() => F.data() && F.pushSync(), 4000); });
})();
