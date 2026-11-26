/* Script check: what the script will be like to watch, and what it will cost to shoot, while you're still writing.
   - Shape: every scene as a strip along the film (length, inside or outside, day or night, how talky), with the
     quarter marks where act breaks usually land, and stretches that may sag.
   - Voices: who speaks, how much, and where each character disappears for long stretches.
   - Cost: shoot days, locations (and the ones used only once), night and exterior scenes, extras, vehicles,
     effects and risky scenes, and the scenes that cost the most for their screen time.
   - Writing: long speeches, dense action and headings missing INT/EXT or DAY/NIGHT.
   It all runs on the device, from the script and the breakdown. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const words = t => (String(t || '').match(/\S+/g) || []).length;
  const who = x => String(x || '').replace(/\s*\(.*\)/, '').trim().toUpperCase();
  const isExt = s => /EXT/i.test(s.ie || ''), isNight = s => /NIGHT|EVENING|DUSK/i.test(s.dn || '');
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const pg = e => `${F.eighths(e)} page${e > 8 ? 's' : ''}`;

  F.scriptHealth = d => {
    const sc = F.scriptScenes ? F.scriptScenes(d) : [], bd = F.sortScenes(d), A = (d.desks && d.desks.ad) || {}, perDay = 8 * 60 / (+A.mpp || 60) * 0.55 * 8; // eighths a day
    const scenes = sc.map((s, i) => {
      const b = bd.find(x => String(x.num) === String(s.num)) || {}, head = s.head.x || '';
      let speaker = null, dial = 0, act = 0, lines = 0; const talk = {}, longSpeech = [], dense = [];
      s.lines.forEach(l => { const x = (l.x || '').trim(); if (!x) return;
        if (l.t === 'char') { speaker = who(x); lines += 2; return; }
        if (l.t === 'dial' && speaker) { const w = words(x); dial += w; talk[speaker] = (talk[speaker] || 0) + w; lines += Math.ceil(x.length / 35); if (w > 70) longSpeech.push({ who: speaker, w }); return; }
        if (l.t === 'paren') { lines++; return; }
        speaker = null; const w = words(x); act += w; lines += Math.ceil(x.length / 60) + 1; if (w > 80) dense.push(w); });
      const ie = b.ie || (head.match(/^(INT\.?\/EXT|EXT|INT|I\/E)/i) || [''])[0].toUpperCase(), dn = b.dn || (head.match(/(DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS|LATER)\s*$/i) || [''])[0].toUpperCase();
      const loc = b.loc || head.replace(/^(INT\.?\/EXT\.?|EXT\.?|INT\.?|I\/E\.?)\s*/i, '').replace(/\s*[-–]\s*(DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS|LATER).*$/i, '').trim().toUpperCase();
      const eighths = b.pages || Math.max(1, Math.round(lines / 55 * 8));
      const tags = b.tags || {}, extras = (tags.extras || []).reduce((n, w) => n + (parseInt(String(w).match(/\d+/)) || 3), 0);
      const hz = F.hazardsOf ? F.hazardsOf({ ...b, summary: b.summary || s.lines.filter(l => l.t === 'action').map(l => l.x).join(' '), ie, dn, loc, tags }) : [];
      return { i, num: s.num, head, ie, dn, loc, eighths, dial, act, talk, longSpeech, dense, extras, tags, hz, cast: Object.keys(talk), b };
    });
    const total = scenes.reduce((n, s) => n + s.eighths, 0), chars = {};
    scenes.forEach(s => Object.entries(s.talk).forEach(([c, w]) => { const x = chars[c] = chars[c] || { name: c, words: 0, scenes: [] }; x.words += w; x.scenes.push(s.i); }));
    const allWords = Object.values(chars).reduce((n, c) => n + c.words, 0);
    // where each character goes missing for a long stretch
    const gaps = Object.values(chars).filter(c => c.scenes.length >= 2 && c.words / (allWords || 1) > 0.08).map(c => { let best = null; for (let k = 1; k < c.scenes.length; k++) { const a = c.scenes[k - 1], b = c.scenes[k], span = scenes.slice(a + 1, b).reduce((n, s) => n + s.eighths, 0); if (!best || span > best.span) best = { a, b, span }; } return best && best.span / total > 0.28 ? { c: c.name, ...best } : null; }).filter(Boolean);
    // stretches in the middle that may sag: talky scenes in a row with no new place or new face
    const sags = []; let run = [];
    const seenLoc = new Set(), seenChar = new Set(); let acc = 0;
    scenes.forEach(s => { const pos = acc / total; acc += s.eighths; const fresh = !seenLoc.has(s.loc) || s.cast.some(c => !seenChar.has(c)); seenLoc.add(s.loc); s.cast.forEach(c => seenChar.add(c));
      const talky = s.dial > 0 && s.dial / (s.dial + s.act) > 0.72 && !isExt(s);
      if (pos > 0.25 && pos < 0.8 && talky && !fresh) run.push(s); else { if (run.length >= 3) sags.push(run); run = []; } });
    if (run.length >= 3) sags.push(run);
    // cost
    const locs = {}; scenes.forEach(s => { const l = locs[s.loc] = locs[s.loc] || { loc: s.loc, scenes: [], eighths: 0 }; l.scenes.push(s); l.eighths += s.eighths; });
    const once = Object.values(locs).filter(l => l.scenes.length === 1 && l.eighths <= 6 && Object.keys(locs).length > 2);
    const nights = scenes.filter(isNight), exts = scenes.filter(isExt), days = Math.max(1, Math.ceil(total / perDay), Math.ceil(Object.keys(locs).length / 2));
    const cost = s => (isNight(s) ? 2 : 0) + (isExt(s) ? 1 : 0) + Math.min(3, s.extras / 10) + (s.tags.vehicles || []).length + (s.tags.effects || []).length * 1.5 + s.hz.length * 0.7 + (locs[s.loc].scenes.length === 1 ? 2 : 0);
    const pricey = scenes.map(s => ({ s, c: cost(s), per: cost(s) / Math.max(1, s.eighths) * 8 })).filter(x => x.c >= 3).sort((a, b) => b.per - a.per).slice(0, 5);
    const bad = scenes.filter(s => !/INT|EXT|I\/E/.test(s.ie) || !s.dn);
    // the list of things worth a look, most useful first
    const notes = [];
    pricey.slice(0, 3).forEach(x => notes.push({ lvl: 'cost', text: `Scene ${x.s.num} costs a lot for its length (${pg(x.s.eighths)}): ${[isNight(x.s) && 'night', isExt(x.s) && 'outside', x.s.extras && `${x.s.extras} extras`, ...(x.s.tags.vehicles || []), ...(x.s.tags.effects || []), locs[x.s.loc].scenes.length === 1 && 'a location used only here'].filter(Boolean).join(', ')}.`, s: x.s }));
    once.forEach(l => notes.push({ lvl: 'cost', text: `${l.loc} is used for one short scene (${pg(l.eighths)}). A whole company move for a few seconds: could it happen somewhere you already shoot?`, s: l.scenes[0] }));
    if (nights.length / (scenes.length || 1) > 0.35) notes.push({ lvl: 'cost', text: `${nights.length} of ${scenes.length} scenes are at night. Night shoots need lights, power and late crew calls, and cost more each day.` });
    gaps.forEach(g => notes.push({ lvl: 'story', text: `${g.c} disappears from scene ${scenes[g.a].num} to scene ${scenes[g.b].num}, about ${pct(g.span, total)}% of the film. Will the audience miss them?`, s: scenes[g.a] }));
    sags.forEach(r => notes.push({ lvl: 'story', text: `Scenes ${r[0].num} to ${r[r.length - 1].num} are talk in familiar rooms with no new place or face, in the middle of the film. A stretch like this can sag: add movement, a change of place, or cut.`, s: r[0] }));
    Object.values(chars).filter(c => c.scenes.length === 1 && c.words < 25 && Object.keys(chars).length > 3).forEach(c => notes.push({ lvl: 'cost', text: `${c.name} speaks only once (${c.words} words). Could another character say it? One fewer actor to cast and pay.` }));
    scenes.filter(s => s.eighths > 24).forEach(s => notes.push({ lvl: 'story', text: `Scene ${s.num} is ${pg(s.eighths)} long. Long scenes take most of a shoot day and often drag: is there a way in later or out earlier?`, s }));
    scenes.forEach(s => s.longSpeech.forEach(x => notes.push({ lvl: 'write', text: `${x.who} has a ${x.w}-word speech in scene ${s.num}. Long speeches are hard to play; could it be shown instead?`, s })));
    scenes.filter(s => s.dense.length).forEach(s => notes.push({ lvl: 'write', text: `Scene ${s.num} has a block of action over 80 words. Break it into short paragraphs, one picture each.`, s }));
    bad.forEach(s => notes.push({ lvl: 'write', text: `Scene ${s.num}’s heading is missing ${!/INT|EXT|I\/E/.test(s.ie) ? 'INT or EXT' : 'DAY or NIGHT'}. The schedule and call sheets need it.`, s }));
    return { scenes, total, chars: Object.values(chars).sort((a, b) => b.words - a.words), allWords, locs: Object.values(locs), once, nights, exts, days, pricey, notes, extras: scenes.reduce((n, s) => n + s.extras, 0) };
  };

  let filter = 'all';
  F.tabs.push({ id: 'health', label: 'Script check', order: 5.5, render(el, d) {
    const H = F.scriptHealth(d);
    if (!H.scenes.length) { el.innerHTML = `<div class="fwrap"><div class="empty-row big">Script check reads your script: how it will play, who speaks, and what it will cost to shoot. Write or open a script first.</div><div class="row" style="justify-content:center"><button class="pri" data-ftab="script">Go to Script</button></div></div>`; return; }
    const W = 1000, total = H.total, x = s => H.scenes.slice(0, s.i).reduce((n, y) => n + y.eighths, 0) / total * W;
    const color = s => isExt(s) ? (isNight(s) ? '#3c8a57' : '#e7b416') : (isNight(s) ? '#5a6fd8' : '#c9ccd8');
    const strip = `<svg viewBox="0 0 ${W} 130" class="hc-strip" role="img" aria-label="Scenes along the film">
      ${H.scenes.map(s => { const w = s.eighths / total * W, t = s.dial / Math.max(1, s.dial + s.act), h = 30 + 60 * t; return `<g data-hs="${esc(s.num)}"><title>Scene ${esc(s.num)} · ${esc(s.head)} · ${pg(s.eighths)} · ${Math.round(t * 100)}% dialogue</title><rect x="${x(s) + 0.5}" y="${100 - h}" width="${Math.max(1.5, w - 1)}" height="${h}" rx="2" fill="${color(s)}"/></g>`; }).join('')}
      ${[0.25, 0.5, 0.75].map(q => `<line x1="${q * W}" x2="${q * W}" y1="0" y2="104" class="hc-q"/><text x="${q * W}" y="122" class="hc-qt">${q === 0.5 ? 'Midpoint' : q === 0.25 ? 'End of act one' : 'Start of act three'}</text>`).join('')}
      ${H.notes.filter(n => n.lvl === 'story' && /sag/.test(n.text)).map(n => { const s = n.s; return `<rect x="${x(s)}" y="0" width="12" height="6" fill="#e0352b"/>`; }).join('')}</svg>`;
    const maxW = Math.max(1, ...H.chars.map(c => c.words));
    const matrix = `<div class="hc-mx">${H.chars.slice(0, 10).map(c => `<div class="hc-row"><b>${esc(c.name)}</b><span class="hc-share">${pct(c.words, H.allWords)}%</span><div class="hc-dots">${H.scenes.map(s => s.talk[c.name] ? `<i style="left:${(x(s) + s.eighths / total * W / 2) / W * 100}%;--r:${Math.max(5, Math.min(18, Math.sqrt(s.talk[c.name]) * 2))}px" title="Scene ${esc(s.num)}: ${s.talk[c.name]} words"></i>` : '').join('')}</div></div>`).join('')}</div>`;
    const cnt = k => H.notes.filter(n => n.lvl === k).length, shown = H.notes.filter(n => filter === 'all' || n.lvl === filter);
    el.innerHTML = `<div class="fwrap wide hc"><div class="dk-cards">
        <div class="dk-card"><small>Running time</small><b>about ${Math.round(total / 8)} min</b><span>${F.eighths(total)} pages · ${H.scenes.length} scenes</span></div>
        <div class="dk-card"><small>Shoot days</small><b>${d.days.length || H.days}</b><span>${d.days.length ? 'on the schedule' : 'estimated, at about 4 pages a day'}</span></div>
        <div class="dk-card"><small>Locations</small><b>${H.locs.length}</b><span>${H.once.length ? `${H.once.length} used for one short scene` : 'none wasted'}</span></div>
        <div class="dk-card"><small>Night · outside</small><b>${pct(H.nights.length, H.scenes.length)}% · ${pct(H.exts.length, H.scenes.length)}%</b><span>${H.nights.length} night, ${H.exts.length} exterior scenes</span></div>
        <div class="dk-card"><small>Speaking roles</small><b>${H.chars.length}</b><span>${H.extras ? `about ${H.extras} extras` : 'no extras in the breakdown'}</span></div></div>
      <section class="fsec"><div class="dk-h"><h3>The shape of the film</h3><span class="hc-key"><i style="background:#c9ccd8"></i>Inside, day <i style="background:#5a6fd8"></i>Inside, night <i style="background:#e7b416"></i>Outside, day <i style="background:#3c8a57"></i>Outside, night · taller = more talk</span></div>${strip}</section>
      <div class="dk-two"><section class="fsec"><h3>Things worth a look <small class="fhint">${H.notes.length}</small></h3>
          <div class="seg">${[['all', 'All'], ['story', `Story ${cnt('story')}`], ['cost', `Cost ${cnt('cost')}`], ['write', `Writing ${cnt('write')}`]].map(([k, l]) => `<button data-hf="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <ul class="hc-notes">${shown.map(n => `<li class="${n.lvl}"><i>${n.lvl === 'cost' ? '💰' : n.lvl === 'story' ? '◆' : '✎'}</i><span>${esc(n.text)}</span></li>`).join('') || '<li class="good"><span>Nothing here. Nicely done.</span></li>'}</ul>
          <p class="fhint">These are prompts, not rules. Plenty of great films break every one of them on purpose.</p></section>
        <section class="fsec"><h3>Who speaks, and when</h3><p class="fhint">Each dot is a scene where the character talks; bigger dots, more words.</p>${matrix}
          ${H.pricey.length ? `<h4>Most expensive for their length</h4><ol class="hc-pricey">${H.pricey.map(p => `<li><b>${esc(p.s.num)}</b> ${esc(p.s.head)}<small>${pg(p.s.eighths)}</small></li>`).join('')}</ol>` : ''}</section></div></div>`;
    el.onclick = e => { const b = e.target.closest('[data-hf]'); if (b) { filter = b.dataset.hf; F.refresh(); } };
  } });
  F.setStage('health', 'story');
})();
