/* After the shoot: a post-production tracker (tasks by department, cut versions, a delivery checklist)
   and a festival tracker (deadlines, fees, submissions and results). */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const ST = [['todo', 'Not started'], ['doing', 'In progress'], ['review', 'In review'], ['done', 'Done']];
  const NEXT = { todo: 'doing', doing: 'review', review: 'done', done: 'todo' };
  const DEPTS = {
    'Edit': ['Sync sound and picture', 'Assembly cut', 'Rough cut', 'Fine cut', 'Picture lock'],
    'Sound': ['Dialogue edit', 'Sound effects and atmos', 'ADR (re-recorded lines)', 'Final mix'],
    'Music': ['Choose or compose the score', 'Clear music licences'],
    'Colour': ['Colour grade', 'Final colour check on a good screen'],
    'VFX and titles': ['Visual effects shots', 'Opening titles', 'End credits'],
    'Subtitles': ['English subtitles (SRT)', 'Other languages']
  };
  const DELIVER = ['Master file (ProRes 422 HQ)', 'Screener (H.264 MP4)', 'Stereo mix', 'Music and effects mix (no dialogue)', 'Subtitle files (SRT)', 'Poster', 'Production stills', 'Trailer', 'Synopsis and director’s statement', 'Cast and crew list'];
  const FST = [['plan', 'Planning'], ['submitted', 'Submitted'], ['selected', 'Selected'], ['awarded', 'Won an award'], ['declined', 'Not selected']];
  let view = 'post';
  const daysTo = s => s ? Math.round((new Date(s + 'T23:59:00') - new Date()) / 864e5) : null;
  const dueChip = s => { const n = daysTo(s); if (n == null) return ''; return `<span class="due${n < 0 ? ' late' : n <= 7 ? ' soon' : ''}">${n < 0 ? `${-n} day${n === -1 ? '' : 's'} late` : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`}</span>`; };
  const blankPost = () => ({ tasks: Object.entries(DEPTS).flatMap(([dept, ts]) => ts.map(title => ({ id: F.uid(), dept, title, who: '', due: '', st: 'todo' }))), versions: [], deliver: DELIVER.map(title => ({ id: F.uid(), title, done: false })) });

  const tab = { id: 'post', label: 'Post-production', order: 48, render(el, d) {
    el.innerHTML = `<div class="fwrap wide pst">${view === 'post' ? post(d) : fest(d)}</div>`;
    el.onclick = e => {
      const t = e.target;
      if (t.closest('#psStart')) return F.change(dd => { dd.post = blankPost(); });
      const st = t.closest('[data-pst]'); if (st) return F.change(dd => { const x = dd.post.tasks.find(y => y.id === st.dataset.pst); x.st = NEXT[x.st || 'todo']; });
      const add = t.closest('[data-padd]'); if (add) return F.ask('New task', 'What needs doing?').then(v => v && F.change(dd => dd.post.tasks.push({ id: F.uid(), dept: add.dataset.padd, title: v, who: '', due: '', st: 'todo' })));
      if (t.closest('#psDept')) return F.ask('New department', 'For example: Animation').then(v => v && F.change(dd => dd.post.tasks.push({ id: F.uid(), dept: v, title: 'First task', who: '', due: '', st: 'todo' })));
      const del = t.closest('[data-pdel]'); if (del) return F.change(dd => { dd.post.tasks = dd.post.tasks.filter(x => x.id !== del.dataset.pdel); });
      if (t.closest('#psVer')) return F.change(dd => { const n = dd.post.versions.length + 1; dd.post.versions.unshift({ id: F.uid(), name: `Cut ${n}`, date: N.todayStr(0), note: '', link: '' }); });
      const vd = t.closest('[data-vdel]'); if (vd) return F.change(dd => { dd.post.versions = dd.post.versions.filter(x => x.id !== vd.dataset.vdel); });
      const dl = t.closest('[data-dadd]'); if (dl) return F.ask('Add to the delivery list', 'For example: DCP for cinemas').then(v => v && F.change(dd => dd.post.deliver.push({ id: F.uid(), title: v, done: false })));
      if (t.closest('#fsAdd')) return F.change(dd => { dd.fests = dd.fests || []; dd.fests.push({ id: F.uid(), name: '', cat: '', deadline: '', fee: '', link: '', st: 'plan', notes: '' }); }), setTimeout(() => { const ins = document.querySelectorAll('.fws .fs-t [data-k=name]'); for (const i of ins) if (!i.value) { i.focus(); break; } }, 0);
      const fd = t.closest('[data-fdel]'); if (fd) return F.change(dd => { dd.fests = dd.fests.filter(x => x.id !== fd.dataset.fdel); });
    };
    el.onchange = e => {
      const t = e.target, row = t.closest('[data-row]'); if (!row) { if (t.id === 'fsCur') F.change(dd => { dd.festCur = t.value; }); return; }
      const [kind, id] = row.dataset.row.split(':'), k = t.dataset.k, v = t.type === 'checkbox' ? t.checked : t.value.trim();
      F.change(dd => { const list = kind === 'task' ? dd.post.tasks : kind === 'ver' ? dd.post.versions : kind === 'del' ? dd.post.deliver : dd.fests; const x = list.find(y => y.id === id); if (x) x[k] = v; }, !['due', 'deadline', 'st', 'done', 'fee'].includes(k));
    };
  } };
  F.tabs.push({ ...tab, render(el, d) { view = 'post'; tab.render(el, d); } });
  F.tabs.push({ id: 'fest', label: 'Festivals', order: 49, render(el, d) { view = 'fest'; tab.render(el, d); } });

  function post(d) {
    if (!d.post) return `<div class="empty-row big">Track the edit, sound, music, colour, effects and subtitles until the film is delivered.</div><div class="row" style="justify-content:center"><button class="pri" id="psStart">Start the post-production plan</button></div>`;
    const P = d.post, done = P.tasks.filter(x => x.st === 'done').length, pct = P.tasks.length ? Math.round(done / P.tasks.length * 100) : 0;
    const people = d.people.map(p => p.name || p.role).filter(Boolean);
    const depts = [...new Set(P.tasks.map(x => x.dept))];
    return `<datalist id="psPeople">${people.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
      <div class="ps-prog"><div><b>${pct}%</b><small>${done} of ${P.tasks.length} tasks done</small></div><i style="--p:${pct}%"></i></div>
      ${depts.map(dp => { const ts = P.tasks.filter(x => x.dept === dp), dn = ts.filter(x => x.st === 'done').length;
        return `<section class="fsec"><h3>${esc(dp)}<small class="mut"> ${dn}/${ts.length}</small></h3><ul class="ps-list">${ts.map(x => `<li data-row="task:${esc(x.id)}" class="${x.st === 'done' ? 'done' : ''}">
          <button class="pchip ps-${x.st || 'todo'}" data-pst="${esc(x.id)}" title="Tap to move it on">${(ST.find(s => s[0] === (x.st || 'todo')) || ST[0])[1]}</button>
          <input data-k="title" value="${esc(x.title)}" class="grow" aria-label="Task"><input data-k="who" value="${esc(x.who || '')}" placeholder="Who" list="psPeople" aria-label="Who"><input type="date" data-k="due" value="${esc(x.due || '')}" aria-label="Due date">${x.st !== 'done' ? dueChip(x.due) : ''}<button class="ib xs" data-pdel="${esc(x.id)}" aria-label="Remove task">✕</button></li>`).join('')}</ul>
          <button class="add" data-padd="${esc(dp)}">+ Add task</button></section>`; }).join('')}
      <button class="add" id="psDept">+ Add department</button>
      <section class="fsec"><h3>Cut versions</h3><p class="fhint">Keep track of each version of the edit and what changed. Paste a link to where it’s uploaded.</p>
        <ul class="ps-list">${P.versions.map(v => `<li data-row="ver:${esc(v.id)}"><input data-k="name" value="${esc(v.name)}" class="w-name" aria-label="Version"><input type="date" data-k="date" value="${esc(v.date || '')}" aria-label="Date"><input data-k="note" value="${esc(v.note || '')}" placeholder="What changed" class="grow" aria-label="What changed"><input data-k="link" value="${esc(v.link || '')}" placeholder="Link" aria-label="Link">${v.link && /^https?:/.test(v.link) ? `<a class="ib xs" href="${esc(v.link)}" target="_blank" rel="noopener">Open</a>` : ''}<button class="ib xs" data-vdel="${esc(v.id)}" aria-label="Remove version">✕</button></li>`).join('') || '<li class="empty-row">No versions yet</li>'}</ul>
        <button class="add" id="psVer">+ Add a cut</button></section>
      <section class="fsec"><h3>Delivery checklist<small class="mut"> ${P.deliver.filter(x => x.done).length}/${P.deliver.length}</small></h3><p class="fhint">What festivals, distributors and clients usually ask for.</p>
        <ul class="ps-dl">${P.deliver.map(x => `<li data-row="del:${esc(x.id)}"><label><input type="checkbox" data-k="done"${x.done ? ' checked' : ''}><span>${esc(x.title)}</span></label></li>`).join('')}</ul>
        <button class="add" data-dadd>+ Add item</button></section>`;
  }

  function fest(d) {
    const fs = (d.fests || []).slice().sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')), cur = d.festCur || '$';
    const next = fs.find(x => x.st === 'plan' && x.deadline && daysTo(x.deadline) >= 0);
    const fee = st => fs.filter(x => st.includes(x.st)).reduce((n, x) => n + (parseFloat(String(x.fee).replace(/[^0-9.]/g, '')) || 0), 0);
    const counts = Object.fromEntries(FST.map(([k]) => [k, fs.filter(x => x.st === k).length]));
    return `<div class="ps-sum"><div class="${next ? 'big' : ''}"><small>Next deadline</small><b>${next ? esc(next.name || 'Untitled festival') : '—'}</b>${next ? `<span>${F.fmtDate(next.deadline)} · ${(n => n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days')(daysTo(next.deadline))}</span>` : ''}</div>
        <div><small>Submitted</small><b>${counts.submitted + counts.selected + counts.awarded + counts.declined}</b></div><div><small>Selected</small><b>${counts.selected + counts.awarded}</b></div>
        <div><small>Fees paid</small><b>${esc(cur)} ${fee(['submitted', 'selected', 'awarded', 'declined']).toLocaleString()}</b><span>${esc(cur)} ${fee(['plan']).toLocaleString()} still to pay</span></div></div>
      <div class="bg-set" style="margin:-4px 0 12px"><label>Currency<select id="fsCur">${['$', '€', '£', '₦', 'GH₵', 'KSh', 'R', 'CA$'].map(c => `<option${c === cur ? ' selected' : ''}>${c}</option>`).join('')}</select></label></div>
      <section class="fsec"><h3>Festivals</h3><p class="fhint">Most festivals take submissions on FilmFreeway. Paste the page link so it’s one tap away.</p>
        <div class="fs-wrap"><table class="ftable fs-t"><thead><tr><th>Festival</th><th>Category</th><th>Deadline</th><th class="n">Fee</th><th>Status</th><th>Link and notes</th><th></th></tr></thead><tbody>
        ${fs.map(x => `<tr data-row="fest:${esc(x.id)}" class="fs-${x.st}"><td><input data-k="name" value="${esc(x.name)}" placeholder="Festival name" aria-label="Festival"></td><td><input data-k="cat" value="${esc(x.cat || '')}" placeholder="Short film" aria-label="Category"></td>
          <td><input type="date" data-k="deadline" value="${esc(x.deadline || '')}" aria-label="Deadline">${x.st === 'plan' ? dueChip(x.deadline) : ''}</td><td class="n"><input data-k="fee" value="${esc(x.fee || '')}" inputmode="decimal" placeholder="0" aria-label="Fee"></td>
          <td><select data-k="st" aria-label="Status">${FST.map(([k, l]) => `<option value="${k}"${k === x.st ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
          <td><div class="fs-ln"><input data-k="link" value="${esc(x.link || '')}" placeholder="Link" aria-label="Link">${x.link && /^https?:/.test(x.link) ? `<a class="ib xs" href="${esc(x.link)}" target="_blank" rel="noopener">Open</a>` : ''}</div><input data-k="notes" value="${esc(x.notes || '')}" placeholder="Notes" aria-label="Notes"></td>
          <td class="act"><button class="ib xs" data-fdel="${esc(x.id)}" aria-label="Remove festival">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-row">No festivals yet</td></tr>'}</tbody></table></div>
        <button class="add" id="fsAdd">+ Add festival</button></section>`;
  }
})();
