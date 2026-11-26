/* Set Mode: the shoot day's control room, on every phone.
   NOW and NEXT shots in big type, what the next setup needs, a clock that says whether the day is ahead or behind,
   warnings before the light goes, one-tap takes that move everyone on, and a wrap report at the end of the day.
   Everyone working live on the film sees the same screen; people with a view link can follow from anywhere. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const label = c => `${c.scene || '?'}${c.letter || ''}`;
  const hm = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const mins = ms => Math.round(ms / 60000);
  const dur = m => { m = Math.round(Math.abs(m)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`; };
  const atTime = (dateStr, hhmm) => { if (!dateStr || !hhmm) return null; const [h, m] = hhmm.split(':').map(Number); const d = new Date(dateStr + 'T00:00:00'); d.setHours(h, m || 0, 0, 0); return d.getTime(); };
  const canEdit = () => N.P.canWrite && !document.body.classList.contains('lv-view');
  let pickDay = null, tick = 0;

  // all shot cards for a day, in schedule order (scene order of the day, then shot letter)
  function dayShots(d, day) {
    const all = F.allShots().map(x => x.c), scenes = F.dayScenes(d, day).map(s => String(s.num));
    const list = all.filter(c => (c.status || 'todo') !== 'done' && (!scenes.length || scenes.includes(String(c.scene))));
    const order = s => scenes.length ? scenes.indexOf(String(s)) : 0;
    return list.sort((a, b) => order(a.scene) - order(b.scene) || String(a.scene).localeCompare(String(b.scene), undefined, { numeric: true }) || String(a.letter).localeCompare(String(b.letter)));
  }
  const shotById = id => { const x = F.allShots().find(y => y.c.id === id); return x && x.c; };
  const sceneOf = (d, c) => d.scenes.find(s => String(s.num) === String(c.scene));
  const isExt = (d, c) => { const s = sceneOf(d, c); return !!s && /EXT/i.test(s.ie || ''); };

  // where the day stands right now
  function pace(d, day) {
    const S = day.set, now = Date.now(), order = S.order.filter(id => shotById(id));
    const left = order.filter(id => !S.st[id]), curId = left[0] || null;
    const plan = id => +S.plan[id] || S.each;
    const curStart = curId && S.t[curId] ? S.t[curId] : (S.last || S.started);
    const curLeft = curId ? Math.max(0, plan(curId) * 60000 - (now - curStart)) : 0;
    const restMs = left.slice(1).reduce((n, id) => n + plan(id) * 60000, 0);
    const projected = now + curLeft + restMs;
    const target = S.wrapAt || atTime(day.date, S.wrap) || (S.started + 11 * 3600000);
    // finishing time of each remaining shot at this pace
    const finish = {}; let tcur = now + curLeft; if (curId) finish[curId] = tcur;
    left.slice(1).forEach(id => { tcur += plan(id) * 60000; finish[id] = tcur; });
    return { order, left, curId, curStart, projected, target, delta: projected - target, finish, done: order.filter(id => S.st[id] === 'done'), skipped: order.filter(id => S.st[id] === 'skip') };
  }

  // what the next setup needs, from the breakdown
  function needs(d, c) {
    const s = sceneOf(d, c); if (!s) return '';
    const cast = F.castOf(d, s).map(p => p.role).filter(Boolean);
    const rows = [['cast', 'Cast', cast], ...F.CATS.slice(1).map(([k, l]) => [k, l, (s.tags && s.tags[k]) || []])].filter(r => r[2].length);
    return rows.map(([k, l, items]) => `<p><span class="tl tg-${k}">${l}</span> ${items.map(esc).join(', ')}</p>`).join('');
  }

  // the light: golden hour and sunset warnings for outdoor shots still to do
  function light(d, day, p) {
    const place = day.place || d.place; if (!place || !F.sunTimes || day.date !== N.todayStr(0)) return '';
    const sun = F.sunTimes(day.date, place.lat, place.lon); if (!sun) return '';
    const now = Date.now(), set = sun.sunset.getTime(), gold = sun.goldPm ? sun.goldPm[0].getTime() : null;
    const late = p.left.filter(id => isExt(d, shotById(id)) && p.finish[id] > set);
    let msg = '';
    if (now < set) {
      msg = gold && now < gold ? `Golden hour in <b>${dur(mins(gold - now))}</b> · sunset ${hm(set)}` : `Sunset in <b>${dur(mins(set - now))}</b> (${hm(set)})`;
      if (late.length) msg += `<br><b>${late.length} outside shot${late.length === 1 ? '' : 's'} (${late.map(id => esc(label(shotById(id)))).join(', ')}) won’t finish before dark at this pace.</b>`;
    } else msg = `The sun set at ${hm(set)}.`;
    return `<div class="set-light${late.length ? ' warn' : ''}"><span class="sun-ic">☀</span><div>${msg}</div>${late.length && canEdit() ? '<button class="ib" data-set="outsideFirst">Move outside shots up</button>' : ''}</div>`;
  }

  // shots you could drop to wrap on time: coverage (later letters) and inserts first, never the first shot of a scene
  function suggestions(d, p, S) {
    if (p.delta <= 5 * 60000) return [];
    const first = new Map(); p.order.forEach(id => { const c = shotById(id); if (!first.has(String(c.scene))) first.set(String(c.scene), id); });
    const firstIds = new Set(first.values());
    const rank = c => /insert|extreme/i.test(c.size || '') ? 0 : /close/i.test(c.size || '') ? 1 : 2;
    const cands = p.left.slice(1).map(shotById).filter(c => c && !firstIds.has(c.id)).sort((a, b) => rank(a) - rank(b));
    const out = []; let saved = 0;
    for (const c of cands) { if (saved >= p.delta) break; out.push(c); saved += (+S.plan[c.id] || S.each) * 60000; }
    return out;
  }

  F.tabs.push({ id: 'set', label: 'On set', order: 35, render(el, d) {
    if (!d.days.length) { el.innerHTML = `<div class="fwrap"><div class="empty-row big">Set Mode runs your shoot day. First add shoot days and scenes on the Schedule tab, and Shot cards for each scene.</div><div class="row" style="justify-content:center"><button class="pri" data-ftab="schedule">Go to Schedule</button></div></div>`; return; }
    const today = N.todayStr(0);
    const running = d.days.find(x => x.set && x.set.started && !x.set.wrapped);
    if (!pickDay || !d.days.find(x => x.id === pickDay)) pickDay = (running || d.days.find(x => x.date === today) || d.days.find(x => !(x.set && x.set.wrapped)) || d.days[0]).id;
    const i = d.days.findIndex(x => x.id === pickDay), day = d.days[i];
    const seg = `<div class="seg days set-days">${d.days.map((x, j) => `<button data-sday="${esc(x.id)}" class="${x.id === pickDay ? 'on' : ''}">Day ${j + 1}${x.set && x.set.wrapped ? ' ✓' : x.set && x.set.started ? ' ●' : ''}</button>`).join('')}</div>`;
    if (!day.set || !day.set.started) el.innerHTML = `<div class="fwrap set">${seg}${startView(d, day, i)}</div>`;
    else if (day.set.wrapped) el.innerHTML = `<div class="fwrap set">${seg}${wrapView(d, day, i)}</div>`;
    else el.innerHTML = `<div class="fwrap set live">${seg}${runView(d, day, i)}</div>`;
    el.onclick = e => click(e, d, day, i);
    el.onchange = e => change(e, d, day);
  } });

  function startView(d, day, i) {
    const shots = dayShots(d, day), call = day.call || '07:00';
    const wrapDefault = (() => { const [h, m] = call.split(':').map(Number); const w = (h + 11) % 24; return `${String(w).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`; })();
    const avail = (() => { const a = atTime('2000-01-01', call), b = atTime('2000-01-01', day.wrapPlan || wrapDefault); let x = (b - a) / 60000; if (x <= 0) x += 1440; return x - 60; })(); // minus an hour for lunch
    const each = shots.length ? Math.max(5, Math.round(avail / shots.length / 5) * 5) : 20;
    return `<section class="fsec set-start"><h2>Day ${i + 1}${day.date ? ' · ' + esc(new Date(day.date + 'T00:00:00').toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })) : ''}</h2>
      <p class="fhint">${shots.length} shot${shots.length === 1 ? '' : 's'} planned${F.dayScenes(d, day).length ? ' from this day’s scenes' : ' (no scenes scheduled for this day, so every unfinished shot is listed)'}.</p>
      <div class="set-form"><label>Crew call<input type="time" data-sf="call" value="${esc(call)}"></label><label>Wrap by<input type="time" data-sf="wrapPlan" value="${esc(day.wrapPlan || wrapDefault)}"></label>
        <div class="cam-out"><small>Time per shot</small><b>${each} min</b><span>Your hours, less an hour for lunch, shared across the shots. Change any shot once you start.</span></div></div>
      ${shots.length ? `<ol class="set-plan">${shots.map(c => `<li><b>${esc(label(c))}</b><span>${esc([c.size, c.lens].filter(Boolean).join(' · '))}${c.text ? ' — ' + esc(c.text) : ''}</span>${isExt(d, c) ? '<em>outside</em>' : ''}</li>`).join('')}</ol>` : '<p class="fhint">No Shot cards for these scenes yet. Add them on any board in the film, then come back.</p>'}
      ${canEdit() && shots.length ? `<div class="row" style="padding:12px 0 0"><button class="pri big" data-set="start" data-each="${each}" data-wrap="${esc(day.wrapPlan || wrapDefault)}">▶ Start shoot day</button></div>` : canEdit() ? '' : '<p class="fhint">Waiting for the shoot day to start.</p>'}</section>`;
  }

  function runView(d, day, i) {
    const S = day.set, p = pace(d, day), cur = p.curId && shotById(p.curId), nxtId = p.left[1], nxt = nxtId && shotById(nxtId);
    const takes = cur ? (d.takes || []).filter(t => t.day === day.id && String(t.scene) === String(cur.scene) && String(t.shot) === String(cur.letter)).sort((a, b) => a.n - b.n) : [];
    const lastTake = takes[takes.length - 1];
    const behind = p.delta > 2 * 60000, ahead = p.delta < -2 * 60000;
    const sug = suggestions(d, p, S);
    const sceneChange = cur && nxt && String(cur.scene) !== String(nxt.scene);
    const frame = c => c.frame && N.Store.cachedUrl(c.frame) ? `<img src="${esc(N.Store.cachedUrl(c.frame))}" alt="">` : '';
    if (cur && cur.frame && N.Store.cachedUrl(cur.frame) === undefined) N.Store.mediaUrl(cur.frame).then(() => F.refresh());
    const doneN = p.done.length, total = p.order.length;
    return `<div class="set-clock ${behind ? 'behind' : ahead ? 'ahead' : 'ontime'}" data-clock>
        <div><small>${behind ? 'Behind' : ahead ? 'Ahead' : 'On time'}</small><b data-c="delta">${behind || ahead ? dur(mins(p.delta)) : '✓'}</b></div>
        <div><small>Wrap at this pace</small><b data-c="proj">${hm(p.projected)}</b><span>target ${hm(p.target)}</span></div>
        <div><small>Shots</small><b>${doneN}/${total}</b><span>${p.skipped.length ? p.skipped.length + ' skipped' : 'done'}</span></div>
        <div><small>Rolling for</small><b data-c="run">${dur(mins(Date.now() - S.started))}</b></div></div>
      ${light(d, day, p)}
      ${cur ? `<section class="set-now"><div class="set-tag">NOW</div><div class="set-shot">${frame(cur)}<div><h1>${esc(label(cur))}</h1><p class="set-spec">${esc([cur.size, cur.lens, cur.move, cur.angle].filter(Boolean).join(' · ')) || 'Shot'}</p>${cur.text ? `<p>${esc(cur.text)}</p>` : ''}
          <p class="set-timer" data-c="shot">On this shot ${dur(mins(Date.now() - p.curStart))} of ${dur(+S.plan[cur.id] || S.each)} planned</p></div></div>
        <div class="set-takes"><span>Takes</span>${takes.map(t => `<b class="tkc mk-${t.mark || 'none'}" title="${esc(t.note || '')}">${t.n}</b>`).join('') || '<em>none yet</em>'}</div>
        ${canEdit() ? `<div class="set-btns"><button class="pri big" data-set="take">+ Take ${(lastTake ? lastTake.n : 0) + 1}</button>
          ${lastTake ? `<button class="mkb circle" data-set="mark" data-m="circle">◯ Circle take ${lastTake.n}<small>and move on</small></button><button class="mkb ok" data-set="mark" data-m="ok">✓ OK</button><button class="mkb ng" data-set="mark" data-m="ng">✕ No good</button>` : ''}</div>
          <div class="set-btns small"><button class="ib" data-set="done">Shot done</button><button class="ib" data-set="skip">Skip this shot</button>${p.done.length + p.skipped.length ? '<button class="ib" data-set="back">Back one shot</button>' : ''}</div>` : ''}</section>` : `<section class="set-now"><div class="set-tag">ALL SHOTS DONE</div><h1>That’s a wrap?</h1></section>`}
      ${nxt ? `<section class="set-next"><div class="set-tag">NEXT</div><div class="set-shot">${frame(nxt)}<div><h2>${esc(label(nxt))}</h2><p class="set-spec">${esc([nxt.size, nxt.lens, nxt.move].filter(Boolean).join(' · '))}</p>${nxt.text ? `<p>${esc(nxt.text)}</p>` : ''}</div></div>
        ${sceneChange ? `<p class="set-change">New scene: ${esc(F.sceneLabel(sceneOf(d, nxt) || { ie: '', loc: 'Scene ' + nxt.scene }))}</p>` : ''}<div class="set-needs">${needs(d, nxt) || '<p class="fhint">Nothing tagged in the breakdown for this scene.</p>'}</div></section>` : ''}
      ${behind && sug.length ? `<section class="fsec set-sug"><h3>To wrap on time</h3><p class="fhint">You could drop or combine these, saving about ${dur(sug.reduce((n, c) => n + (+S.plan[c.id] || S.each), 0))}. Coverage and inserts are suggested before the first shot of any scene.</p>
        <ul>${sug.map(c => `<li><b>${esc(label(c))}</b> ${esc(c.size || '')} · ${+S.plan[c.id] || S.each} min ${canEdit() ? `<button class="ib xs" data-set="skipid" data-id="${esc(c.id)}">Skip</button>` : ''}</li>`).join('')}</ul></section>` : ''}
      <section class="fsec"><h3>The rest of the day</h3><ol class="set-rest">${p.left.slice(cur ? 1 : 0).map(id => { const c = shotById(id); return `<li data-id="${esc(id)}"><b>${esc(label(c))}</b><span>${esc(c.size || '')}${isExt(d, c) ? ' · outside' : ''}</span><small>done by ${hm(p.finish[id])}</small>
          ${canEdit() ? `<input type="number" min="1" max="600" value="${+S.plan[id] || S.each}" data-plan="${esc(id)}" aria-label="Minutes for ${esc(label(c))}"><span class="mm">min</span><button class="ib xs" data-set="up" data-id="${esc(id)}" aria-label="Move earlier">↑</button><button class="ib xs" data-set="skipid" data-id="${esc(id)}">Skip</button>` : `<span class="mm">${+S.plan[id] || S.each} min</span>`}</li>`; }).join('') || '<li class="empty-row">Nothing after this</li>'}</ol>
        ${p.skipped.length ? `<p class="fhint">Skipped: ${p.skipped.map(id => esc(label(shotById(id)))).join(', ')}${canEdit() ? ' · <button class="linkish" data-set="unskip">bring them back</button>' : ''}</p>` : ''}</section>
      ${canEdit() ? `<div class="row" style="justify-content:center;padding:8px 0 30px"><button class="ib wrapb" data-set="wrap">🎬 Wrap the day</button></div>` : ''}`;
  }

  function wrapView(d, day, i) {
    const S = day.set, order = S.order.filter(id => shotById(id)), done = order.filter(id => S.st[id] === 'done'), skipped = order.filter(id => S.st[id] !== 'done');
    const takes = (d.takes || []).filter(t => t.day === day.id), circ = takes.filter(t => t.mark === 'circle');
    const scenes = F.dayScenes(d, day), sceneDone = scenes.filter(s => order.map(shotById).filter(c => String(c.scene) === String(s.num)).every(c => S.st[c.id] === 'done'));
    const pages = sceneDone.reduce((n, s) => n + (s.pages || 0), 0), target = S.wrapAt || atTime(day.date, S.wrap);
    const diff = target ? S.wrapped - target : 0, next = d.days[i + 1];
    return `<div class="cs-act set-wrapact"><button class="pri" data-wsave="share">Send report</button><button class="ib" data-wsave="png">Save as picture</button><button class="ib" data-wsave="pdf">Save as PDF</button>${canEdit() ? '<button class="ib" data-set="reopen">Reopen the day</button>' : ''}</div>
      <div class="sheet rpt" id="wrSheet"><header><div><small>Wrap report</small><h2>${esc(d.title)}</h2><p>Day ${i + 1} of ${d.days.length}${day.date ? ' · ' + esc(new Date(day.date + 'T00:00:00').toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : ''}</p></div>
        <div class="callbox"><small>Wrapped</small><b>${hm(S.wrapped)}</b></div></header>
        <div class="wr-grid"><div><small>Rolled</small><p>${hm(S.started)}</p></div><div><small>Wrap target</small><p>${target ? hm(target) : '—'}${target ? `<br><b class="${diff > 0 ? 'late' : 'early'}">${diff > 60000 ? dur(mins(diff)) + ' over' : diff < -60000 ? dur(mins(diff)) + ' early' : 'on time'}</b>` : ''}</p></div>
          <div><small>Shots</small><p><b>${done.length}</b> of ${order.length}</p></div><div><small>Takes</small><p><b>${takes.length}</b>, ${circ.length} circled</p></div><div><small>Scenes finished</small><p>${sceneDone.map(s => esc(s.num)).join(', ') || '—'}</p></div><div><small>Pages shot</small><p>${F.eighths(pages)}</p></div></div>
        <h3>Shots</h3><table class="ftable"><thead><tr><th>Shot</th><th>What</th><th class="c">Takes</th><th class="c">Circled take</th><th>Time on it</th></tr></thead><tbody>
        ${order.map(id => { const c = shotById(id), ts = takes.filter(t => String(t.scene) === String(c.scene) && String(t.shot) === String(c.letter)); const st = S.st[id];
          return `<tr class="${st === 'done' ? '' : 'ng'}"><td><b>${esc(label(c))}</b></td><td>${esc([c.size, c.text].filter(Boolean).join(' — '))}</td><td class="c">${ts.length || ''}</td><td class="c">${ts.filter(t => t.mark === 'circle').map(t => t.n).join(', ')}</td><td>${st === 'done' && S.t[id] && S.e[id] ? dur(mins(S.e[id] - S.t[id])) : st === 'skip' ? 'Skipped' : 'Not shot'}</td></tr>`; }).join('')}</tbody></table>
        ${skipped.length ? `<h3>Still to shoot</h3><p>${skipped.map(id => esc(label(shotById(id)))).join(', ')}</p>` : ''}
        <footer>Made with Itàn</footer></div>
      ${skipped.length && next && canEdit() ? `<div class="row" style="justify-content:center"><button class="pri" data-set="carry">Move the ${skipped.length} unshot shot${skipped.length === 1 ? '' : 's'} to Day ${i + 2}</button></div>` : ''}`;
  }

  function click(e, d, day, i) {
    const t = e.target, sd = t.closest('[data-sday]'); if (sd) { pickDay = sd.dataset.sday; return F.refresh(); }
    const sv = t.closest('[data-wsave]'); if (sv) return N.saveNode(document.querySelector('.fws #wrSheet'), `${d.title || 'Film'} wrap report day ${i + 1}`, sv.dataset.wsave);
    const b = t.closest('[data-set]'); if (!b || !canEdit()) return; const a = b.dataset.set, now = Date.now();
    const upd = fn => F.change(dd => { const dy = dd.days.find(x => x.id === day.id); fn(dy, dd); });
    const curOf = dy => dy.set.order.find(id => shotById(id) && !dy.set.st[id]);
    const finish = (dy, id, how) => { dy.set.st[id] = how; dy.set.e[id] = now; dy.set.last = now; const nx = curOf(dy); if (nx && !dy.set.t[nx]) dy.set.t[nx] = now; };
    if (a === 'start') {
      const shots = dayShots(d, day), each = +b.dataset.each || 20;
      if (d.days.some(x => x.id !== day.id && x.set && x.set.started && !x.set.wrapped)) return N.toast('Another shoot day is still running. Wrap it first.');
      const wrap = b.dataset.wrap || '19:00';
      return upd(dy => { const order = shots.map(c => c.id); let wrapAt = atTime(N.todayStr(0), wrap); if (wrapAt < now) wrapAt += 86400000; // wrap after midnight
        dy.set = { started: now, each, order, plan: {}, st: {}, t: order.length ? { [order[0]]: now } : {}, e: {}, wrap, wrapAt }; });
    }
    if (a === 'take') { const c = shotById(curOf(day)); if (!c) return; let st = {}; try { st = JSON.parse(localStorage.getItem('itan:takes') || '{}'); } catch (x) {}
      return F.change(dd => { dd.takes = dd.takes || []; const n = dd.takes.filter(x => x.day === day.id && String(x.scene) === String(c.scene) && String(x.shot) === String(c.letter)).reduce((m, x) => Math.max(m, x.n), 0) + 1;
        dd.takes.push({ id: F.uid(), day: day.id, scene: c.scene, shot: c.letter, n, cam: st.cam || 'A', roll: st.roll || 'A001', snd: st.snd || '', clip: '', note: '', mark: '', t: now }); }); }
    if (a === 'mark') { const c = shotById(curOf(day)); if (!c) return; const m = b.dataset.m;
      return F.change(dd => { const ts = dd.takes.filter(x => x.day === day.id && String(x.scene) === String(c.scene) && String(x.shot) === String(c.letter)); const last = ts.sort((x, y) => x.n - y.n)[ts.length - 1]; if (!last) return; last.mark = m;
        if (m === 'circle') { const dy = dd.days.find(x => x.id === day.id); finish(dy, c.id, 'done'); c.status = 'done'; N.toast(`${label(c)} circled. Moving on.`); } }); }
    if (a === 'done') { const id = curOf(day); if (!id) return; const c = shotById(id); return upd(dy => { finish(dy, id, 'done'); if (c) c.status = 'done'; }); }
    if (a === 'skip') { const id = curOf(day); if (!id) return; return upd(dy => finish(dy, id, 'skip')); }
    if (a === 'skipid') { const id = b.dataset.id; return upd(dy => { dy.set.st[id] = 'skip'; }); }
    if (a === 'unskip') return upd(dy => { Object.keys(dy.set.st).forEach(id => { if (dy.set.st[id] === 'skip') delete dy.set.st[id]; }); });
    if (a === 'back') { const fin = day.set.order.filter(id => day.set.st[id]).sort((x, y) => (day.set.e[y] || 0) - (day.set.e[x] || 0)); if (!fin.length) return; const id = fin[0];
      return upd(dy => { delete dy.set.st[id]; delete dy.set.e[id]; dy.set.t[id] = now; const c = shotById(id); if (c && c.status === 'done') c.status = 'todo';
        const o = dy.set.order.filter(x => x !== id); dy.set.order = [...o.filter(x => dy.set.st[x]), id, ...o.filter(x => !dy.set.st[x])]; }); }
    if (a === 'up') { const id = b.dataset.id; return upd(dy => { const o = dy.set.order, k = o.indexOf(id), cur = curOf(dy); let j = k - 1; while (j >= 0 && dy.set.st[o[j]]) j--; if (j < 0 || o[j] === cur) return; [o[j], o[k]] = [o[k], o[j]]; }); }
    if (a === 'outsideFirst') return upd((dy, dd) => { const o = dy.set.order, cur = curOf(dy), done = o.filter(id => dy.set.st[id]), rest = o.filter(id => !dy.set.st[id] && id !== cur);
      const ext = rest.filter(id => isExt(dd, shotById(id))), int = rest.filter(id => !isExt(dd, shotById(id))); dy.set.order = [...done, ...(cur ? [cur] : []), ...ext, ...int]; N.toast('Outside shots moved up, right after this one'); });
    if (a === 'wrap') return N.confirmBox('Wrap the day? Itàn makes the wrap report. You can reopen the day if you need to.', 'Wrap').then(ok => ok && upd(dy => { dy.set.wrapped = Date.now(); }));
    if (a === 'reopen') return upd(dy => { delete dy.set.wrapped; });
    if (a === 'carry') { const next = d.days[i + 1]; const skipped = day.set.order.filter(id => shotById(id) && day.set.st[id] !== 'done');
      return F.change(dd => { const nx = dd.days.find(x => x.id === next.id); const scenes = new Set(skipped.map(id => String(shotById(id).scene)));
        dd.scenes.filter(s => scenes.has(String(s.num))).forEach(s => { if (!nx.sceneIds.includes(s.id)) nx.sceneIds.unshift(s.id); });
        nx.carry = [...new Set([...(nx.carry || []), ...skipped])]; N.toast(`Their scenes are now on Day ${i + 2}`); }); }
  }
  function change(e, d, day) {
    const t = e.target;
    if (t.dataset.sf) return F.change(dd => { const dy = dd.days.find(x => x.id === day.id); dy[t.dataset.sf] = t.value; });
    if (t.dataset.plan && canEdit()) F.change(dd => { const dy = dd.days.find(x => x.id === day.id); dy.set.plan[t.dataset.plan] = Math.max(1, Math.min(600, +t.value || dy.set.each)); });
  }

  // keep the clocks moving without redrawing the whole screen
  setInterval(() => {
    if (!F.isOpen() || F.tab() !== 'set' || document.hidden) return;
    tick++; const d = F.data(); if (!d) return; const day = d.days.find(x => x.id === pickDay);
    if (!day || !day.set || !day.set.started || day.set.wrapped) return;
    if (N.isEditing()) return;
    if (tick % 2 === 0) F.refresh();
  }, 15000);
})();
