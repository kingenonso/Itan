/* Shot list from the script: Itàn suggests a director's starting coverage for each scene.
   A master or establishing wide, following shots for movement, dialogue coverage that fits who's talking
   (singles, over-the-shoulders, close-ups), reaction close-ups on emotional moments, and inserts of key props.
   It works offline; Gemini (with your own free key) can suggest instead. You choose what to keep,
   and each shot arrives as a Shot card with its lines already marked on the lined script. */
(function () {
  const N = window.N, F = N.film, esc = N.esc, S = N.S;
  const MOVE_RX = /\b(runs?|running|walks?|walking|enters?|exits?|drives?|driving|arrives?|chases?|follows?|crosses|rushes|races|climbs|dances|storms (?:in|out)|pulls away)\b/i;
  const EMO_RX = /\b(tears?|cries|crying|sobs?|eyes (?:are )?wet|smiles?|grins?|stares?|freezes|trembl\w*|gasps?|shocked|breaks down|laughs?|whispers?)\b/i;
  const LOOK_RX = /\b(reads?|looks at|stares at|watches|checks|opens)\b/i;
  const SKIP_CAPS = new Set(['INT', 'EXT', 'DAY', 'NIGHT', 'CONT', 'CONTINUED', 'CUT', 'FADE', 'POV', 'V.O', 'O.S', 'THE', 'A', 'I']);
  const cleanName = n => String(n || '').replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
  const cap = s => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

  // read one scene: who speaks, in which blocks, and what happens in the action
  function read(sc) {
    const blocks = [], action = []; let cur = null;
    sc.lines.forEach((l, k) => {
      if (l.t === 'char') { const offscreen = /\((V\.?O|O\.?S|O\.?C)\.?\)/i.test(l.x); cur = { name: cleanName(l.x), from: k, to: k, off: offscreen, n: 0 }; blocks.push(cur); }
      else if ((l.t === 'dial' || l.t === 'paren') && cur) { cur.to = k; if (l.t === 'dial') cur.n++; }
      else { cur = null; if (l.t === 'action' && (l.x || '').trim()) action.push({ k, x: l.x }); }
    });
    const on = blocks.filter(b => !b.off), speakers = [];
    on.forEach(b => { let s = speakers.find(x => x.name === b.name); if (!s) { s = { name: b.name, lines: 0, from: b.from, to: b.to }; speakers.push(s); } s.lines += b.n; s.to = b.to; });
    speakers.sort((a, b) => b.lines - a.lines);
    return { blocks: on, speakers, action };
  }

  function suggest(d, sc) {
    const out = [], R = read(sc), n = sc.lines.length; if (!n) return out;
    const first = sc.lines.findIndex(l => (l.x || '').trim()), last = n - 1 - [...sc.lines].reverse().findIndex(l => (l.x || '').trim());
    const ext = /\bEXT\b/i.test(sc.head.x), loc = cap((sc.head.x.replace(/^(INT|EXT|INT\.?\/EXT|I\/E)[.\s]+/i, '').split(/\s+-\s+/)[0] || 'the location').trim());
    const add = (size, lens, move, angle, text, from, to, why) => out.push({ size, lens, move, angle, text, from: sc.lines[Math.max(0, from)].id, to: sc.lines[Math.min(n - 1, to)].id, why });
    const dialogue = R.blocks.length;
    // 1. the master (or establishing shot outside)
    if (ext || !dialogue) add('Wide', ext ? '18mm' : '20mm', ext ? 'Crane' : 'Static', ext ? 'High' : 'Eye level', ext ? `Establish ${loc}` : `Master: the whole scene in ${loc}`, first, last, ext ? 'Outside scenes open on a wide that shows where we are.' : 'A master wide covers the whole scene, so nothing is ever missing in the edit.');
    if (ext && dialogue) add('Wide', '24mm', 'Static', 'Eye level', 'Master: the whole scene', first, last, 'A master wide that runs the whole scene.');
    if (!ext && dialogue) add('Wide', '24mm', 'Static', 'Eye level', `Master: the whole scene in ${loc}`, first, last, 'A master wide covers the whole scene, so nothing is ever missing in the edit.');
    // 2. movement
    const mv = R.action.find(a => MOVE_RX.test(a.x));
    if (mv) { const who = (mv.x.match(/\b([A-Z][A-Z'-]{2,})\b/) || [])[1]; const verb = mv.x.match(MOVE_RX)[1].toLowerCase();
      add('Full', '28mm', 'Gimbal', 'Eye level', `Follow ${who ? cap(who) : 'them'} as they ${verb.replace(/s$/, '')}`, mv.k, mv.k, 'Movement in the action is easier to feel with the camera moving too.'); }
    // 3. dialogue coverage, shaped by who talks
    const sp = R.speakers, span = s => [s.from, s.to];
    if (sp.length === 1) {
      add('Medium', '35mm', 'Static', 'Eye level', `${cap(sp[0].name)} speaks`, ...span(sp[0]), 'One speaker: a medium for the lines…');
      add('Close-up', '85mm', 'Push in', 'Eye level', `${cap(sp[0].name)}, close`, ...span(sp[0]), '…and a close-up for the moment that matters.');
    } else if (sp.length === 2) {
      const [a, b] = sp, both = [Math.min(a.from, b.from), Math.max(a.to, b.to)];
      if (a.lines + b.lines >= 4) {
        add('Over the shoulder', '50mm', 'Static', 'Eye level', `Over ${cap(b.name)}’s shoulder onto ${cap(a.name)}`, ...both, 'Two people talking: over-the-shoulders both ways let the edit cut between them.');
        add('Over the shoulder', '50mm', 'Static', 'Eye level', `Over ${cap(a.name)}’s shoulder onto ${cap(b.name)}`, ...both, 'The reverse.');
      } else add('Medium', '35mm', 'Static', 'Eye level', `Two-shot: ${cap(a.name)} and ${cap(b.name)}`, ...both, 'A short exchange plays well in one two-shot.');
      add('Close-up', '85mm', 'Static', 'Eye level', `${cap(a.name)}, close`, ...span(a), 'Close-ups for the strongest lines and reactions.');
      add('Close-up', '85mm', 'Static', 'Eye level', `${cap(b.name)}, close`, ...span(b), 'The matching close-up.');
    } else if (sp.length > 2) {
      const all = [Math.min(...sp.map(s => s.from)), Math.max(...sp.map(s => s.to))];
      add('Full', '28mm', 'Static', 'Eye level', `Group: ${sp.slice(0, 4).map(s => cap(s.name)).join(', ')}`, ...all, 'A group shot keeps everyone in the room.');
      sp.slice(0, 3).forEach(s => add('Medium', '50mm', 'Static', 'Eye level', `${cap(s.name)} speaks`, ...span(s), 'Singles on the main speakers.'));
      sp.slice(0, 2).forEach(s => add('Close-up', '85mm', 'Static', 'Eye level', `${cap(s.name)}, close`, ...span(s), 'Close-ups on the two biggest parts.'));
    }
    // 4. emotional beats in the action
    R.action.filter(a => EMO_RX.test(a.x)).slice(0, 2).forEach(a => {
      const who = (a.x.match(/\b([A-Z][a-z]+|[A-Z]{3,})\b/) || [])[1];
      add('Extreme close-up', '100mm', 'Push in', 'Eye level', `Reaction: ${a.x.length > 60 ? a.x.slice(0, 57) + '…' : a.x}`, a.k, a.k, `An emotional moment (“${a.x.match(EMO_RX)[0]}”) needs to be close.`);
    });
    // 5. inserts of key props: from the breakdown, and things written in CAPITALS in the action
    const props = new Set();
    const s0 = d.scenes.find(x => String(x.num) === String(sc.num)); ((s0 && s0.tags && s0.tags.props) || []).forEach(p => props.add(p.toLowerCase()));
    const names = new Set(R.speakers.map(s => s.name));
    const big = new Set(['vehicles', 'extras', 'effects'].flatMap(k => ((s0 && s0.tags && s0.tags[k]) || []).map(x => x.toLowerCase()))); // too big for an insert
    R.action.forEach(a => (a.x.match(/\b[A-Z][A-Z'-]{2,}(?:\s+[A-Z][A-Z'-]{2,})?\b/g) || []).forEach(w => { if (!SKIP_CAPS.has(w) && !names.has(w) && !d.people.some(p => cleanName(p.role) === w)) props.add(w.toLowerCase()); }));
    big.forEach(x => props.delete(x));
    [...props].slice(0, 3).forEach(p => { const at = R.action.find(a => a.x.toLowerCase().includes(p)); if (!at) return;
      add('Insert', '50mm macro', 'Static', LOOK_RX.test(at.x) ? 'POV' : 'High', `Insert: the ${p}`, at.k, at.k, 'Close detail of a prop the story depends on.'); });
    return out.slice(0, 10);
  }
  F.suggestShots = suggest;

  /* ---------- Gemini (optional, the user's own key) ---------- */
  async function gemini(d, scenes) {
    const key = await N.Store.getKV('geminiKey').catch(() => ''), model = (await N.Store.getKV('geminiModel').catch(() => '')) || 'gemini-2.5-flash';
    if (!key) throw new Error('nokey');
    const res = new Map();
    for (const sc of scenes) {
      const text = [sc.head.x, ...sc.lines.map(l => l.t === 'char' ? '\n' + l.x : l.t === 'paren' ? '(' + l.x.replace(/^\(|\)$/g, '') + ')' : (l.t === 'action' ? '\n' : '') + l.x)].join('\n');
      N.status(`Asking Gemini about scene ${sc.num}…`);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `You are an experienced film director planning coverage. Suggest a practical shot list (4 to 9 shots) for this scene for an indie crew with one camera. For each shot give the shot size, a lens in mm, camera movement, angle, a one-line description, and the first and last lines of the script it covers, copied exactly.\n\n${text.slice(0, 12000)}` }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { shots: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
            size: { type: 'STRING', enum: ['Wide', 'Full', 'Medium', 'Medium close-up', 'Close-up', 'Extreme close-up', 'Over the shoulder', 'Insert', 'Aerial'] }, lens: { type: 'STRING' },
            move: { type: 'STRING', enum: ['Static', 'Pan', 'Tilt', 'Push in', 'Pull out', 'Tracking', 'Handheld', 'Gimbal', 'Crane', 'Zoom'] }, angle: { type: 'STRING', enum: ['Eye level', 'High', 'Low', 'Overhead', 'Dutch', 'POV'] },
            description: { type: 'STRING' }, why: { type: 'STRING' }, firstLine: { type: 'STRING' }, lastLine: { type: 'STRING' } }, required: ['size', 'description'] } } }, required: ['shots'] } } }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(r.status === 429 ? 'Gemini’s free limit is used up for now.' : (j.error && j.error.message) || 'Gemini error'); }
      const j = await r.json(), txt = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
      let data; try { data = JSON.parse(txt); } catch (e) { continue; }
      const find = q => { q = String(q || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 40); if (!q) return -1; return sc.lines.findIndex(l => (l.x || '').toLowerCase().replace(/\s+/g, ' ').includes(q)); };
      res.set(sc, (data.shots || []).slice(0, 10).map(s => { let a = find(s.firstLine), b = find(s.lastLine); if (a < 0) a = 0; if (b < a) b = sc.lines.length - 1;
        return { size: s.size, lens: s.lens || '', move: s.move || 'Static', angle: s.angle || 'Eye level', text: String(s.description || '').slice(0, 140), why: String(s.why || '').slice(0, 200), from: sc.lines[a].id, to: sc.lines[Math.max(a, Math.min(b, sc.lines.length - 1))].id }; }));
    }
    N.settled(); return res;
  }

  /* ---------- choose and create ---------- */
  async function open(only) {
    const d = F.data(); if (!d) return;
    if (!(d.screenplay || []).some(l => l.t === 'scene')) return N.toast('Write or open your script on the Script tab first. Suggestions come from the scenes.');
    const all = F.scriptScenes(d), has = num => F.allShots().some(x => String(x.c.scene) === String(num));
    let pick = only ? all.filter(s => String(s.num) === String(only)) : all.filter(s => !has(s.num)), withShots = !!only;
    if (!pick.length) { pick = all; withShots = true; }
    let sug = new Map(pick.map(sc => [sc, suggest(d, sc)])), src = 'Itàn';
    const render = () => {
      const total = [...sug.values()].reduce((n, l) => n + l.length, 0);
      return `<h2>Suggested shots</h2><p>${src === 'Itàn' ? 'A starting point from how directors usually cover scenes like these.' : 'Suggested by Gemini.'} Untick anything you don’t want; you can change every shot afterwards.</p>
        <div class="sl-list">${[...sug].map(([sc, list]) => { const used = F.allShots().filter(x => String(x.c.scene) === String(sc.num)).length;
          return `<section><h4><b>${esc(sc.num)}</b> ${esc(sc.head.x)}${used ? `<small>${used} shot${used === 1 ? '' : 's'} already; these are added after them</small>` : ''}</h4>
          ${list.map((s, i) => `<label class="sl-row"><input type="checkbox" data-k="${esc(sc.num)}|${i}"${F.allShots().some(x => String(x.c.scene) === String(sc.num) && x.c.size === s.size) ? '' : ' checked'}><span class="sl-size">${esc(s.size)}</span><span class="sl-spec">${esc([s.lens, s.move, s.angle].filter(Boolean).join(' · '))}</span><span class="sl-text">${esc(s.text)}${s.why ? `<small>${esc(s.why)}</small>` : ''}</span></label>`).join('') || '<p class="fhint">Nothing to suggest for this scene.</p>'}</section>`; }).join('')}</div>
        <div class="row"><button class="pri" id="slAdd">Add shots</button><button id="slAi" title="Uses your own free Gemini key">Ask Gemini instead</button><button data-close>Cancel</button></div>`;
    };
    const m = N.modal(render()); m.classList.add('wide');
    const count = () => { const n = m.querySelectorAll('[data-k]:checked').length; m.querySelector('#slAdd').textContent = `Add ${n} shot${n === 1 ? '' : 's'}`; };
    const wire = () => {
      m.querySelector('[data-close]').onclick = N.closeOv; count();
      m.onchange = count;
      m.querySelector('#slAi').onclick = async () => {
        try { const g = await gemini(d, [...sug.keys()]); g.forEach((list, sc) => { if (list.length) sug.set(sc, list); }); src = 'Gemini'; m.innerHTML = render(); wire(); }
        catch (e) { N.settled(); if (e.message === 'nokey') { N.closeOv(); N.toast('Add your free Gemini key first: Breakdown tab → ⚙ next to “Check with Gemini”.'); } else N.toast(e.message === 'Failed to fetch' ? 'Couldn’t reach Gemini. Check your internet.' : e.message); }
      };
      m.querySelector('#slAdd').onclick = () => { const chosen = [...m.querySelectorAll('[data-k]:checked')].map(x => x.dataset.k.split('|')); N.closeOv(); create(d, chosen.map(([num, i]) => ({ sc: [...sug.keys()].find(s => String(s.num) === num), s: sug.get([...sug.keys()].find(s => String(s.num) === num))[+i] })), withShots); };
    };
    wire();
  }

  // shot cards go into a column per scene on the film's shot list board
  function create(d, items) {
    if (!items.length) return;
    const root = F.root(), inFilm = id => { let g = 0; while (id && g++ < 50) { if (id === root.id) return true; id = (S.boards[id] || {}).parent; } return false; };
    const filmBoards = Object.values(S.boards).filter(b => inFilm(b.id));
    let board = filmBoards.find(b => /shot list/i.test(b.title || '')) || (F.allShots()[0] && S.boards[F.allShots()[0].b.id]);
    N.snap();
    if (!board) { const id = 'b' + N.uid(); S.boards[id] = N.normalize({ id, title: 'Shot list', parent: root.id, cards: [], links: [], created: Date.now() }); board = S.boards[id]; S.boards[root.id].cards.push(N.newCard('board', 40, 600, { board: id })); }
    const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const byScene = new Map(); items.forEach(it => { const k = String(it.sc.num); if (!byScene.has(k)) byScene.set(k, []); byScene.get(k).push(it); });
    let made = 0;
    byScene.forEach((list, num) => {
      const sc = list[0].sc;
      let col = board.cards.find(c => c.type === 'column' && new RegExp('^scene\\s+' + num + '\\b', 'i').test(c.text || ''));
      if (!col) { const right = board.cards.filter(c => !c.col).reduce((x, c) => Math.max(x, (+c.x || 0) + (+c.w || 0)), 0);
        col = N.newCard('column', right ? right + 20 : 40, 200, { text: `Scene ${num} · ${sc.head.x.toLowerCase().replace(/\b\w/g, m => m.toUpperCase())}`, w: 300, items: [] }); board.cards.push(col); }
      const used = new Set(F.allShots().filter(x => String(x.c.scene) === num).map(x => x.c.letter));
      list.forEach(({ s }) => { let i = 0; while (used.has(LET[i]) && i < 25) i++; const letter = LET[i]; used.add(letter);
        const c = N.newCard('shot', 0, 0, { scene: num, letter, size: s.size, lens: s.lens, move: s.move, angle: s.angle, text: s.text, status: 'todo', col: col.id, cover: { from: s.from, to: s.to } });
        board.cards.push(c); col.items.push(c.id); made++; });
    });
    N.touch(); N.render();
    N.toast(`${made} shot${made === 1 ? '' : 's'} added to “${board.title}”. Their lines are marked on the lined script.`);
    if (F.isOpen()) F.refresh();
  }

  // buttons: on the Shots tab, and on any scene without shots in the lined script
  N.hooks.ready.push(() => {
    const t = F.tabs.find(x => x.id === 'shots');
    if (t && !t._sl) { t._sl = true; const base = t.render;
      t.render = function (el, d) { base.call(this, el, d); if (!N.P.canWrite || !(d.screenplay || []).some(l => l.t === 'scene')) return;
        const act = el.querySelector('.sl-act'), btn = '<button class="ib sl-go" id="slOpen">✦ Suggest shots from the script</button>';
        if (act) act.insertAdjacentHTML('beforeend', btn); else el.querySelector('.fwrap, div').insertAdjacentHTML('afterbegin', `<div class="row sl-row0">${btn}</div>`);
        el.querySelector('#slOpen').onclick = () => open(); }; }
    const l = F.tabs.find(x => x.id === 'lined');
    if (l && !l._sl) { l._sl = true; const base = l.render;
      l.render = function (el, d) { base.call(this, el, d); if (!N.P.canWrite) return;
        el.querySelectorAll('.ls-scene').forEach(sec => { const chips = sec.querySelector('.ls-chips'); if (!chips || chips.querySelector('.ls-chip')) return; const num = (sec.querySelector('.ls-head').textContent.match(/^(\w+)\./) || [])[1];
          if (num) { chips.insertAdjacentHTML('beforeend', `<button class="ib xs sl-scene" data-slscene="${esc(num)}">✦ Suggest shots</button>`); } });
        el.addEventListener('click', e => { const b = e.target.closest('[data-slscene]'); if (b) { e.stopPropagation(); open(b.dataset.slscene); } }, true); }; }
  });
  F.openShotSuggest = open;
})();
