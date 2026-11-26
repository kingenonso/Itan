/* Script writing: a screenplay editor that formats as you type.
   Enter moves to the element that usually comes next; Tab changes the current element's kind.
   The script feeds the breakdown with one click, and saves as a proper screenplay PDF or a Fountain file. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const KINDS = [['scene', 'Scene heading'], ['action', 'Action'], ['char', 'Character'], ['paren', 'Parenthetical'], ['dial', 'Dialogue'], ['trans', 'Transition']];
  const NEXT = { scene: 'action', action: 'action', char: 'dial', paren: 'dial', dial: 'char', trans: 'scene' };
  const TAB = { action: 'char', char: 'trans', trans: 'scene', scene: 'action', dial: 'paren', paren: 'dial' };
  const PH = { scene: 'INT. LOCATION - DAY', action: 'What we see and hear', char: 'CHARACTER', paren: '(quietly)', dial: 'What they say', trans: 'CUT TO:' };
  let focusId = null, snapped = false;

  // turn screenplay elements into Fountain text (used for the breakdown and for saving)
  F.screenplayText = (lines) => lines.map(l => {
    const x = (l.x || '').trim();
    if (l.t === 'scene') return '\n' + x.toUpperCase();
    if (l.t === 'char') return '\n' + x.toUpperCase();
    if (l.t === 'paren') return x.startsWith('(') ? x : '(' + x + ')';
    if (l.t === 'dial') return x;
    if (l.t === 'trans') return '\n> ' + x.toUpperCase();
    return '\n' + x;
  }).join('\n').trim() + '\n';
  // turn plain script text into screenplay elements (for scripts brought in from elsewhere)
  F.toScreenplay = text => {
    const out = [], lines = text.replace(/\r/g, '').split('\n'); let prev = '';
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim(); if (!t) { prev = ''; continue; }
      const next = (lines[i + 1] || '').trim();
      let k = 'action';
      if (/^(INT|EXT|INT\.?\/EXT|I\/E|EST)[.\s]/i.test(t) || /^\.[A-Za-z]/.test(t)) k = 'scene';
      else if (/^>/.test(t) || (t === t.toUpperCase() && /TO:$/.test(t))) k = 'trans';
      else if (/^\(.*\)$/.test(t) && (prev === 'char' || prev === 'dial')) k = 'paren';
      else if ((prev === 'char' || prev === 'paren' || prev === 'dial') && prev !== '') k = 'dial';
      else if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.length < 38 && next) k = 'char';
      out.push({ id: F.uid(), t: k, x: t.replace(/^[.>]\s*/, '').replace(/^@/, '') }); prev = k;
    }
    return out;
  };
  const pages = lines => { let rows = 0; lines.forEach(l => { const w = l.t === 'dial' ? 35 : l.t === 'paren' ? 25 : 60; rows += Math.max(1, Math.ceil((l.x || '').length / w)) + (['scene', 'action', 'char', 'trans'].includes(l.t) ? 1 : 0); }); return Math.max(1, Math.round(rows / 54 * 10) / 10); };

  F.tabs.push({ id: 'script', label: 'Script', order: 5, render(el, d) {
    d.screenplay = d.screenplay || [];
    const lineHTML = l => `<div class="sp-l sp-${l.t}" data-lid="${esc(l.id)}" contenteditable="${N.P.canWrite ? 'plaintext-only' : 'false'}" spellcheck="true" data-ph="${esc(PH[l.t])}">${esc(l.x)}</div>`;
    const sp = d.screenplay;
    el.innerHTML = `<div class="sp-wrap">
      <div class="sp-bar"><div class="seg sp-kinds">${KINDS.map(([k, l]) => `<button data-kind="${k}" title="${l}">${l}</button>`).join('')}</div>
        <span class="sp-meta">${sp.length ? `About ${pages(sp)} page${pages(sp) === 1 ? '' : 's'}` : ''}</span>
        <div class="sp-act">${!sp.length && d.script ? '<button class="ib" id="spFromImport">Edit the imported script here</button>' : ''}<label class="filebtn">Open a script<input type="file" id="spOpen" accept=".txt,.fountain,.spmd,.fdx,.pdf" hidden></label>
        <button class="ib" id="spFountain">Save as Fountain</button><button class="ib" id="spPdf">Save as PDF</button><button class="pri" id="spToBd">Update breakdown</button></div></div>
      <p class="fhint sp-help">Enter starts the next element · Tab changes the kind (Action → Character → Transition → Scene heading; Dialogue ↔ Parenthetical) · type INT. or EXT. to start a scene</p>
      <div class="sp-page" id="spPage">${sp.map(l => lineHTML(l)).join('')}</div>
      ${sp.length ? '' : `<div class="empty-row">Start writing: <button class="pri" id="spStart">New scene</button></div>`}</div>`;
    const page = el.querySelector('#spPage');
    const line = id => d.screenplay.find(x => x.id === id);
    const mark = () => { const l = line(focusId); el.querySelectorAll('[data-kind]').forEach(b => b.classList.toggle('on', !!l && b.dataset.kind === l.t)); };
    const focusLine = (id, atEnd = true) => { const n = document.querySelector('.fws #spPage') && document.querySelector('.fws #spPage').querySelector(`[data-lid="${CSS.escape(id)}"]`); if (!n) return; n.focus(); const r = document.createRange(); r.selectNodeContents(n); r.collapse(!atEnd); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    const begin = () => { if (!snapped) { N.snap(); snapped = true; } };
    const save = () => { N.touch(); };
    const setKind = (id, k) => { const l = line(id); if (!l) return; begin(); l.t = k; save(); const n = document.querySelector(`.fws [data-lid="${CSS.escape(id)}"]`); if (!n) return; n.className = `sp-l sp-${k}`; n.dataset.ph = PH[k]; mark(); };
    const meta = () => { const m = el.querySelector('.sp-meta'); if (m) m.textContent = `About ${pages(d.screenplay)} page${pages(d.screenplay) === 1 ? '' : 's'}`; };
    // add the next element straight into the page (no full redraw, so fast typing isn't lost)
    const insertAfter = (id, k, text = '') => { begin(); const i = d.screenplay.findIndex(x => x.id === id); const nl = { id: F.uid(), t: k, x: text }; d.screenplay.splice(i + 1, 0, nl); save();
      const n = page.querySelector(`[data-lid="${CSS.escape(id)}"]`); n.innerText = d.screenplay[i].x; n.insertAdjacentHTML('afterend', lineHTML(nl)); focusId = nl.id; focusLine(nl.id, false); meta(); };
    page.addEventListener('focusin', e => { const n = e.target.closest('[data-lid]'); if (n) { focusId = n.dataset.lid; snapped = false; mark(); } });
    page.addEventListener('input', e => {
      const n = e.target.closest('[data-lid]'); if (!n) return; const l = line(n.dataset.lid); if (!l) return; begin();
      l.x = n.innerText.replace(/\n/g, ' ');
      if (l.t === 'action' && /^(INT|EXT|INT\/EXT|I\/E|EST)[.\s]/i.test(l.x)) setKind(l.id, 'scene');
      save();
    });
    page.addEventListener('keydown', e => {
      const n = e.target.closest('[data-lid]'); if (!n) return; const l = line(n.dataset.lid); if (!l) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); const sel = getSelection(), off = sel.rangeCount ? sel.getRangeAt(0).startOffset : l.x.length;
        if (!l.x.trim() && l.t !== 'action') return setKind(l.id, l.t === 'dial' || l.t === 'paren' ? 'action' : 'action');
        const tail = off < l.x.length ? l.x.slice(off) : ''; if (tail) { l.x = l.x.slice(0, off); }
        if (l.t === 'scene' || l.t === 'char' || l.t === 'trans') l.x = l.x.toUpperCase();
        insertAfter(l.id, NEXT[l.t], tail);
      } else if (e.key === 'Tab') { e.preventDefault(); setKind(l.id, e.shiftKey ? (Object.keys(TAB).find(k => TAB[k] === l.t) || 'action') : TAB[l.t]); }
      else if (e.key === 'Backspace' && !n.innerText.length && d.screenplay.length > 1) {
        e.preventDefault(); begin(); const i = d.screenplay.findIndex(x => x.id === l.id); d.screenplay.splice(i, 1); save();
        const prev = d.screenplay[Math.max(0, i - 1)]; n.remove(); focusId = prev.id; focusLine(prev.id); meta();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const sib = e.key === 'ArrowUp' ? n.previousElementSibling : n.nextElementSibling; const r = getSelection().getRangeAt(0).getBoundingClientRect(), nr = n.getBoundingClientRect();
        if (sib && (e.key === 'ArrowUp' ? r.top - nr.top < 8 : nr.bottom - r.bottom < 8)) { e.preventDefault(); focusLine(sib.dataset.lid, e.key === 'ArrowUp'); }
      }
    });
    page.addEventListener('focusout', e => { const n = e.target.closest('[data-lid]'); if (!n) return; const l = line(n.dataset.lid); if (l && ['scene', 'char', 'trans'].includes(l.t) && l.x !== l.x.toUpperCase()) { l.x = l.x.toUpperCase(); n.innerText = l.x; save(); } if (l && l.t === 'paren' && l.x.trim() && !/^\(.*\)$/.test(l.x.trim())) { l.x = '(' + l.x.trim().replace(/^\(|\)$/g, '') + ')'; n.innerText = l.x; save(); } });
    el.onclick = async e => {
      const t = e.target;
      const k = t.closest('[data-kind]'); if (k) { if (focusId) { setKind(focusId, k.dataset.kind); focusLine(focusId); } return; }
      if (t.closest('#spStart')) { N.snap(); d.screenplay.push({ id: F.uid(), t: 'scene', x: '' }); N.touch(); focusId = d.screenplay[0].id; F.refresh(); focusLine(focusId); }
      if (t.closest('#spFromImport')) { N.snap(); d.screenplay = F.toScreenplay(d.script); N.touch(); F.refresh(); }
      if (t.closest('#spToBd')) { if (!d.screenplay.some(l => l.t === 'scene' && l.x.trim())) return N.toast('Add at least one scene heading first'); F.applyScript(F.screenplayText(d.screenplay)); }
      if (t.closest('#spFountain')) { const txt = `Title: ${d.title}\n\n` + F.screenplayText(d.screenplay); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = (d.title || 'Script') + '.fountain'; document.body.append(a); a.click(); a.remove(); N.toast('Script saved as Fountain. Final Draft, WriterDuet, Highland and others open it.'); }
      if (t.closest('#spPdf')) pdf(d);
    };
    el.onchange = async e => {
      if (e.target.id !== 'spOpen') return; const f = e.target.files[0]; if (!f) return;
      try { const txt = await F.readScriptFile(f); const go = () => { N.snap(); d.screenplay = F.toScreenplay(txt); d.script = txt.length < 400000 ? txt : d.script; N.touch(); F.refresh(); };
        if (d.screenplay.length) N.confirmBox('Replace the script in the editor with this file?', 'Replace').then(ok => ok && go()); else go(); }
      catch (err) { N.toast('That script couldn’t be read'); }
    };
    mark();
  } });

  // A properly formatted screenplay PDF: US Letter, Courier 12, standard margins, page numbers
  async function pdf(d) {
    if (!d.screenplay.length) return N.toast('Write something first');
    try { N.status('Making PDF…'); await N.loadLib('pdf'); } catch (e) { N.settled(); return N.toast('Saving as PDF needs internet the first time'); }
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'in', format: 'letter' }); doc.setFont('courier', 'normal'); doc.setFontSize(12);
    const LH = 1 / 6, TOP = 1, BOTTOM = 10, M = { scene: [1.5, 6], action: [1.5, 6], char: [3.7, 2.8], paren: [3.1, 2.4], dial: [2.5, 3.5], trans: [6, 1.5] };
    // title page
    doc.text(String(d.title || 'Untitled').toUpperCase(), 4.25, 4, { align: 'center' }); doc.text('Written in Notera', 4.25, 4.5, { align: 'center' });
    let page = 1, y = TOP; doc.addPage();
    const newPage = () => { doc.addPage(); page++; y = TOP; doc.text(page + '.', 7.5, 0.5, { align: 'right' }); };
    d.screenplay.forEach((l, i) => {
      const [x, w] = M[l.t] || M.action; let text = (l.x || '').trim(); if (!text) return;
      if (['scene', 'char', 'trans'].includes(l.t)) text = text.toUpperCase();
      if (l.t === 'paren' && !text.startsWith('(')) text = '(' + text + ')';
      const before = ['scene', 'action', 'char', 'trans'].includes(l.t) && i > 0 ? LH : 0;
      const rows = doc.splitTextToSize(text, w);
      if (y + before + rows.length * LH > BOTTOM || (l.t === 'scene' && y + before + 3 * LH > BOTTOM) || (l.t === 'char' && y + before + 2 * LH > BOTTOM)) newPage(); else y += before;
      rows.forEach(r => { if (y > BOTTOM) newPage(); if (l.t === 'trans') doc.text(r, 7.5, y, { align: 'right' }); else doc.text(r, x, y); y += LH; });
    });
    doc.save((d.title || 'Script') + '.pdf'); N.settled(); N.toast('Script saved as PDF');
  }
})();
