/* Script breakdown: bring in a script (paste, .txt, .fountain, Final Draft .fdx or PDF), split it into scenes,
   find the characters, and tag what each scene needs by selecting words in the script. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const CATS = [['cast', 'Cast'], ['extras', 'Extras'], ['props', 'Props'], ['wardrobe', 'Wardrobe'], ['makeup', 'Hair and makeup'], ['vehicles', 'Vehicles'], ['effects', 'Effects']];
  F.CATS = CATS;
  let sel = null;

  /* ---------- reading scripts ---------- */
  const HEAD = /^\s*(?:(\d+[A-Z]?)[.)]?\s+)?(INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\s*\/\s*E|INT|EXT|EST)[.\s]\s*(.+?)\s*(?:\1)?\s*$/i;
  const TRANS = /(TO:|^FADE (IN|OUT)|^CUT TO|^DISSOLVE|^THE END)/;
  function parse(text) {
    const lines = text.replace(/\r/g, '').replace(/\t/g, '    ').split('\n'), scenes = [], chars = [];
    let cur = null, n = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], t = line.trim();
      let m = null, forced = /^\.[A-Za-z0-9]/.test(t) && !/^\.\./.test(t);
      if (forced) m = [t, null, '', t.slice(1)]; else if (t === t.toUpperCase() || /^(INT|EXT|I\/E|EST)[.\s]/.test(t)) m = t.match(HEAD);
      if (m) {
        let rest = m[3] || '', num = m[1] || null;
        const fn = rest.match(/\s*#([\w.-]+)#\s*$/); if (fn) { num = fn[1]; rest = rest.slice(0, fn.index); }
        rest = rest.replace(/\s+\d+[A-Z]?\s*$/, (x) => { if (!num) num = x.trim(); return ''; });
        const parts = rest.split(/\s+[-–—]+\s+/); let dn = parts.length > 1 ? parts.pop().trim().toUpperCase() : '';
        let ie = (m[2] || '').toUpperCase().replace(/[.\s]/g, ''); ie = /INT\/EXT|EXT\/INT|I\/E/.test(ie) ? 'INT/EXT' : ie === 'EXT' ? 'EXT' : ie === 'EST' ? 'EXT' : 'INT';
        cur = { id: F.uid(), num: num || String(++n), ie, loc: parts.join(' - ').trim().replace(/\.$/, ''), dn, lines: [], cast: [], tags: {} };
        if (num && /^\d+$/.test(num)) n = +num;
        scenes.push(cur); continue;
      }
      if (!cur) continue;
      cur.lines.push(line);
      // character cue: short all-caps line followed by dialogue
      const next = (lines[i + 1] || '').trim();
      const forcedChar = /^@/.test(t);
      if (t && next && (forcedChar || (t === t.toUpperCase() && /[A-Z]/.test(t) && t.length <= 38 && t.split(/\s+/).length <= 5 && !TRANS.test(t) && !/^[(\[]/.test(t) && !/[!?]$/.test(t)))) {
        const name = t.replace(/^@/, '').replace(/\s*\(.*?\)\s*/g, '').replace(/\^$/, '').replace(/[:.]$/, '').trim();
        if (name && name.length > 1 && !/^(INT|EXT|ANGLE|CLOSE|WIDE|POV|INSERT|BACK TO|LATER|CONTINUOUS|MONTAGE|SUPER|TITLE)/.test(name)) {
          if (!cur.cast.includes(name)) cur.cast.push(name);
          if (!chars.includes(name)) chars.push(name);
        }
      }
    }
    scenes.forEach(s => {
      const body = s.lines.join('\n').replace(/^\n+|\s+$/g, '');
      s.text = body; delete s.lines;
      s.pages = Math.max(1, Math.round((body.split('\n').length + 2) / 56 * 8));
      const act = body.split('\n').map(x => x.trim()).find(x => x && x !== x.toUpperCase());
      s.summary = act ? act.slice(0, 160) : '';
    });
    return { scenes, chars };
  }
  function fromFDX(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml'), out = [];
    doc.querySelectorAll('Content > Paragraph').forEach(p => {
      const type = p.getAttribute('Type') || '', txt = [...p.querySelectorAll('Text')].map(t => t.textContent).join('');
      if (type === 'Scene Heading') { const num = p.getAttribute('Number'); out.push('', (num ? num + ' ' : '') + txt.toUpperCase(), ''); }
      else if (type === 'Character') out.push('', txt.toUpperCase());
      else if (type === 'Dialogue' || type === 'Parenthetical') out.push(txt);
      else out.push('', txt);
    });
    return out.join('\n');
  }
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  async function fromPDF(file) {
    if (!window.pdfjsLib) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = PDFJS; s.onload = res; s.onerror = () => rej(new Error('offline')); document.head.append(s); });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS.replace('pdf.min.js', 'pdf.worker.min.js');
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p), tc = await page.getTextContent(), rows = new Map();
      tc.items.forEach(it => { const y = Math.round(it.transform[5]); const r = rows.get(y) || []; r.push(it); rows.set(y, r); });
      const ys = [...rows.keys()].sort((a, b) => b - a); let last = null;
      for (const y of ys) {
        const txt = rows.get(y).sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join('').replace(/\s+/g, ' ').trim();
        if (last !== null && last - y > 18) out.push('');
        if (/^\d+\.?$/.test(txt) && (y > 700 || y < 60)) { last = y; continue; } // page numbers
        out.push(txt); last = y;
      }
      out.push('');
    }
    return out.join('\n');
  }

  function apply(text) {
    const { scenes, chars } = parse(text);
    if (!scenes.length) return N.toast('No scenes found. Scene headings should start with INT. or EXT.');
    sel = null;
    F.change(d => {
      // keep tags and schedule for scenes with the same number
      const old = new Map(d.scenes.map(s => [String(s.num), s]));
      chars.forEach(name => { if (!d.people.some(p => p.kind === 'cast' && (p.role || '').toUpperCase() === name)) d.people.push({ id: F.uid(), kind: 'cast', num: String(Math.max(0, ...d.people.filter(p => p.kind === 'cast').map(p => +p.num || 0)) + 1), role: name, name: '', phone: '' }); });
      const idOf = name => (d.people.find(p => p.kind === 'cast' && (p.role || '').toUpperCase() === name) || {}).id;
      d.scenes = scenes.map(s => { const o = old.get(String(s.num)); const castIds = s.cast.map(idOf).filter(Boolean);
        return { id: o ? o.id : s.id, num: s.num, ie: s.ie, loc: s.loc, dn: s.dn, pages: s.pages, summary: s.summary, text: s.text, cast: [...new Set([...(o ? o.cast : []), ...castIds])], tags: o ? o.tags : {}, notes: o ? o.notes || '' : '' }; });
      const ids = new Set(d.scenes.map(s => s.id)); d.days.forEach(day => day.sceneIds = day.sceneIds.filter(id => ids.has(id)));
      d.script = text.length < 400000 ? text : d.script;
    });
    N.toast(`Found ${scenes.length} scene${scenes.length === 1 ? '' : 's'} and ${chars.length} character${chars.length === 1 ? '' : 's'}`);
  }
  function importer() {
    const m = N.modal(`<h2>Bring in your script</h2><p>Paste it below, or open a file: plain text, Fountain, Final Draft (.fdx) or PDF. Scene headings must start with INT. or EXT. Tags you’ve already added stay with scenes that keep their number.</p>
      <textarea id="scIn" spellcheck="false" placeholder="INT. KITCHEN - NIGHT&#10;&#10;Ada stirs a pot. Her phone buzzes.&#10;&#10;ADA&#10;Not now."></textarea>
      <div class="row"><button class="pri" id="scGo">Break it down</button><label class="filebtn">Open a file<input type="file" id="scFile" accept=".txt,.fountain,.spmd,.fdx,.pdf,text/plain,application/pdf" hidden></label><button data-close>Cancel</button></div>`);
    m.classList.add('wide');
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#scGo').onclick = () => { const t = m.querySelector('#scIn').value; if (!t.trim()) return; N.closeOv(); apply(t); };
    m.querySelector('#scFile').onchange = async e => {
      const f = e.target.files[0]; if (!f) return; N.status('Reading script…');
      try { const t = /\.pdf$/i.test(f.name) ? await fromPDF(f) : /\.fdx$/i.test(f.name) ? fromFDX(await f.text()) : await f.text(); m.querySelector('#scIn').value = t; }
      catch (err) { N.toast(err.message === 'offline' ? 'Reading PDFs needs internet the first time' : 'That file couldn’t be read'); }
      N.settled();
    };
  }
  F.parseScript = parse;

  /* ---------- the Breakdown tab ---------- */
  const parsePages = v => { v = String(v).trim(); const m = v.match(/^(\d+)?\s*(?:(\d)\/8)?$/); if (!m) return null; return (+(m[1] || 0)) * 8 + (+(m[2] || 0)); };
  function highlight(text, s, d) {
    const words = [];
    F.castOf(d, s).forEach(p => p.role && words.push([p.role, 'cast']));
    CATS.slice(1).forEach(([k]) => (s.tags[k] || []).forEach(w => words.push([w, k])));
    let h = esc(text);
    words.sort((a, b) => b[0].length - a[0].length).forEach(([w, k]) => { if (w.length < 2) return; const re = new RegExp('(' + esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'); h = h.replace(re, `<mark class="tg-${k}">$1</mark>`); });
    return h;
  }
  F.tabs.push({ id: 'breakdown', label: 'Breakdown', order: 10, render(el, d) {
    const list = F.sortScenes(d);
    if (!sel || !d.scenes.find(s => s.id === sel)) sel = list[0] && list[0].id;
    const s = d.scenes.find(x => x.id === sel);
    const tagRow = ([k, label]) => {
      const items = k === 'cast' ? F.castOf(d, s).map(p => [p.id, `${p.num ? p.num + '. ' : ''}${p.role || p.name || 'Cast'}`]) : (s.tags[k] || []).map(w => [w, w]);
      return `<div class="tagrow"><span class="tl tg-${k}">${label}</span><div class="chips">${items.map(([v, t]) => `<span class="chip tg-${k}">${esc(t)}<button data-untag="${k}" data-v="${esc(v)}" aria-label="Remove ${esc(t)}">✕</button></span>`).join('')}
        ${k === 'cast' ? `<select data-addcast aria-label="Add cast"><option value="">+ Add</option>${d.people.filter(p => p.kind === 'cast' && !(s.cast || []).includes(p.id)).map(p => `<option value="${esc(p.id)}">${esc((p.num ? p.num + '. ' : '') + (p.role || p.name))}</option>`).join('')}<option value="__new">New character…</option></select>` : `<input data-addtag="${k}" placeholder="+ Add" aria-label="Add ${label}">`}</div></div>`;
    };
    el.innerHTML = `<div class="bd">
      <aside class="bd-list"><div class="bd-tools"><button class="pri" id="bdImport">${d.scenes.length ? 'Update script' : 'Paste or open script'}</button><button class="ib" id="bdAdd" title="Add a scene by hand">+ Scene</button></div>
        <div class="bd-total">${list.length} scene${list.length === 1 ? '' : 's'} · ${F.eighths(list.reduce((n, x) => n + (x.pages || 0), 0))} pages</div>
        <ol class="scenes">${list.map(x => `<li><button data-scene="${esc(x.id)}" class="strip ${F.stripClass(x)}${x.id === sel ? ' on' : ''}"><b>${esc(x.num)}</b><span>${esc(x.ie)} · ${esc(x.loc || 'Location')}</span><em>${esc(x.dn || '')}</em><small>${F.eighths(x.pages)}</small></button></li>`).join('') || '<li class="empty-row">Paste your script, or add scenes by hand.</li>'}</ol></aside>
      <section class="bd-detail">${s ? `
        <div class="bd-head"><label>Scene<input data-f="num" value="${esc(s.num)}" class="w4"></label>
          <label>Inside or outside<select data-f="ie">${['INT', 'EXT', 'INT/EXT'].map(v => `<option${v === s.ie ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="grow">Location<input data-f="loc" value="${esc(s.loc)}"></label>
          <label>Time of day<input data-f="dn" value="${esc(s.dn)}" list="dnList" class="w8"></label>
          <label>Pages<input data-f="pages" value="${esc(F.eighths(s.pages))}" class="w5" title="Whole pages and eighths, like 1 3/8"></label></div>
        <datalist id="dnList"><option>DAY</option><option>NIGHT</option><option>MORNING</option><option>EVENING</option><option>DUSK</option><option>DAWN</option><option>CONTINUOUS</option></datalist>
        <label class="blk">What happens<textarea data-f="summary" rows="2">${esc(s.summary || '')}</textarea></label>
        <div class="tags">${CATS.map(tagRow).join('')}</div>
        <label class="blk">Notes for this scene<textarea data-f="notes" rows="2">${esc(s.notes || '')}</textarea></label>
        ${s.text ? `<h4>Script <span class="fhint">Select words to tag them</span></h4><div class="stext" id="bdText">${highlight(s.text, s, d)}</div>` : ''}
        <div class="row" style="padding-left:0"><button class="ib danger" id="bdDel">Delete scene</button></div>` : '<div class="empty-row big">Your scenes will appear here.</div>'}</section></div>
      <div class="tagpop" id="tagpop" hidden>${CATS.map(([k, l]) => `<button data-tagas="${k}" class="tg-${k}">${l}</button>`).join('')}</div>`;
    el.onclick = e => {
      const t = e.target;
      if (t.closest('#bdImport')) return importer();
      if (t.closest('#bdAdd')) { const nn = String(Math.max(0, ...d.scenes.map(x => parseInt(x.num) || 0)) + 1); return F.change(dd => { const ns = { id: F.uid(), num: nn, ie: 'INT', loc: '', dn: 'DAY', pages: 8, summary: '', text: '', cast: [], tags: {}, notes: '' }; dd.scenes.push(ns); sel = ns.id; }); }
      const sb = t.closest('[data-scene]'); if (sb) { sel = sb.dataset.scene; return F.refresh(); }
      const un = t.closest('[data-untag]'); if (un) return F.change(dd => { const sc = dd.scenes.find(x => x.id === sel); if (un.dataset.untag === 'cast') sc.cast = sc.cast.filter(id => id !== un.dataset.v); else sc.tags[un.dataset.untag] = (sc.tags[un.dataset.untag] || []).filter(w => w !== un.dataset.v); });
      const ta = t.closest('[data-tagas]'); if (ta) { const w = (window.getSelection().toString() || '').trim().replace(/\s+/g, ' '); hidePop(); if (w) addTag(ta.dataset.tagas, w); return; }
      if (t.closest('#bdDel')) return N.confirmBox(`Delete scene ${s.num}? It’s also removed from the schedule.`, 'Delete').then(ok => ok && F.change(dd => { dd.scenes = dd.scenes.filter(x => x.id !== sel); dd.days.forEach(day => day.sceneIds = day.sceneIds.filter(id => id !== sel)); sel = null; }));
    };
    el.onchange = e => {
      const t = e.target;
      if (t.dataset.f) { F.change(dd => { const sc = dd.scenes.find(x => x.id === sel); const k = t.dataset.f; if (k === 'pages') { const v = parsePages(t.value); if (v != null) sc.pages = v; } else sc[k] = k === 'dn' || k === 'loc' ? t.value.trim().toUpperCase() : t.value.trim(); }, !['num', 'ie', 'loc', 'dn', 'pages'].includes(t.dataset.f)); return; }
      if (t.matches('[data-addcast]')) { const v = t.value; t.value = ''; if (!v) return; if (v === '__new') { return F.ask('New character', 'Name as it appears in the script').then(name => name && addTag('cast', name.toUpperCase())); } return F.change(dd => { const sc = dd.scenes.find(x => x.id === sel); sc.cast = [...new Set([...(sc.cast || []), v])]; }); }
    };
    el.onkeydown = e => { if (e.key === 'Enter' && e.target.matches('[data-addtag]')) { e.preventDefault(); const v = e.target.value.trim(); if (v) addTag(e.target.dataset.addtag, v); } };
    const txt = el.querySelector('#bdText'), pop = el.querySelector('#tagpop');
    const hidePop = () => { pop.hidden = true; };
    if (txt) txt.addEventListener('mouseup', showPop), txt.addEventListener('touchend', () => setTimeout(showPop, 250));
    function showPop() { const s2 = window.getSelection(); if (!s2 || s2.isCollapsed || !txt.contains(s2.anchorNode)) return hidePop(); const r = s2.getRangeAt(0).getBoundingClientRect(), host = el.getBoundingClientRect();
      pop.hidden = false; pop.style.left = Math.max(8, Math.min(r.left - host.left, host.width - pop.offsetWidth - 8)) + 'px'; pop.style.top = (r.bottom - host.top + el.scrollTop + 8) + 'px'; }
    pop.addEventListener('mousedown', e => e.preventDefault());
  } });
  function addTag(k, w) {
    F.change(d => {
      const sc = d.scenes.find(x => x.id === sel) || F.sortScenes(d)[0]; if (!sc) return;
      if (k === 'cast') {
        const name = w.toUpperCase(); let p = d.people.find(x => x.kind === 'cast' && (x.role || '').toUpperCase() === name);
        if (!p) { p = { id: F.uid(), kind: 'cast', num: String(Math.max(0, ...d.people.filter(x => x.kind === 'cast').map(x => +x.num || 0)) + 1), role: name, name: '', phone: '' }; d.people.push(p); }
        sc.cast = [...new Set([...(sc.cast || []), p.id])];
      } else { sc.tags[k] = [...new Set([...(sc.tags[k] || []), w])]; }
    });
  }
})();
