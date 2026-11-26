/* Budgeting: departments with line items (quantity × rate × days), planned against actual spend,
   a contingency on top, and a summary page to save as a PDF or picture for investors and producers. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const CUR = [['₦', 'Naira (₦)'], ['$', 'US dollar ($)'], ['£', 'Pound (£)'], ['€', 'Euro (€)'], ['GH₵', 'Cedi (GH₵)'], ['KSh', 'Kenyan shilling (KSh)'], ['R', 'Rand (R)'], ['CA$', 'Canadian dollar (CA$)']];
  const DEPTS = ['Cast', 'Crew', 'Camera and lenses', 'Lighting and grip', 'Sound', 'Locations and permits', 'Art and props', 'Wardrobe, hair and makeup', 'Transport', 'Catering', 'Post-production', 'Marketing and festivals'];
  let open = null;
  const blank = () => ({ cur: '₦', cont: 10, depts: DEPTS.map(name => ({ id: F.uid(), name, items: [] })) });
  const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
  const line = it => num(it.qty || 1) * num(it.rate) * num(it.units || 1);
  const deptPlan = dp => dp.items.reduce((n, it) => n + line(it), 0);
  const deptActual = dp => dp.items.reduce((n, it) => n + num(it.actual), 0);
  F.budgetTotals = b => { const plan = b.depts.reduce((n, x) => n + deptPlan(x), 0), act = b.depts.reduce((n, x) => n + deptActual(x), 0), cont = plan * num(b.cont) / 100; return { plan, act, cont, total: plan + cont }; };
  const money = (b, v) => b.cur + ' ' + Math.round(v).toLocaleString();

  F.tabs.push({ id: 'budget', label: 'Budget', order: 45, render(el, d) {
    if (!d.budget) { el.innerHTML = `<div class="fwrap"><div class="empty-row big">Plan what the film will cost, department by department, then track what you actually spend.</div><div class="row" style="justify-content:center"><button class="pri" id="bgStart">Start the budget</button></div></div>`;
      el.onclick = e => { if (e.target.closest('#bgStart')) F.change(dd => { dd.budget = blank(); }); }; return; }
    const b = d.budget, T = F.budgetTotals(b), days = d.days.length;
    const over = T.act > T.total && T.act > 0;
    const row = (dp, it) => `<tr data-it="${esc(it.id)}" data-dp="${esc(dp.id)}"><td><input data-k="desc" value="${esc(it.desc || '')}" placeholder="What it’s for" aria-label="Item"></td>
      <td class="n" data-l="Qty"><input data-k="qty" value="${esc(it.qty ?? 1)}" inputmode="decimal" aria-label="Quantity"></td><td class="n" data-l="Rate"><input data-k="rate" value="${esc(it.rate || '')}" inputmode="decimal" placeholder="0" aria-label="Rate"></td>
      <td class="n" data-l="Days"><input data-k="units" value="${esc(it.units ?? 1)}" inputmode="decimal" aria-label="Days or units"></td><td class="n tot" data-l="Planned">${Math.round(line(it)).toLocaleString()}</td>
      <td class="n" data-l="Actual"><input data-k="actual" value="${esc(it.actual || '')}" inputmode="decimal" placeholder="—" aria-label="Actually spent"></td><td class="act"><button class="ib" data-delit aria-label="Remove item">✕</button></td></tr>`;
    el.innerHTML = `<div class="fwrap wide bg">
      <div class="bg-top"><div class="bg-sum"><div><small>Planned</small><b>${money(b, T.plan)}</b></div><div><small>Contingency ${esc(b.cont)}%</small><b>${money(b, T.cont)}</b></div><div class="big"><small>Total budget</small><b>${money(b, T.total)}</b></div><div class="${over ? 'over' : ''}"><small>Spent so far</small><b>${money(b, T.act)}</b>${T.total ? `<i style="--p:${Math.min(100, T.act / T.total * 100)}%"></i>` : ''}</div></div>
        <div class="bg-set"><label>Currency<select id="bgCur">${CUR.map(([v, l]) => `<option value="${esc(v)}"${v === b.cur ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label>Contingency %<input id="bgCont" value="${esc(b.cont)}" inputmode="decimal" class="w4"></label>
          <button class="ib" id="bgFill" title="Add a line for each cast and crew member, using the number of shoot days">Add cast and crew</button><button class="ib" data-bgsave="pdf">Save summary as PDF</button></div></div>
      ${b.depts.map(dp => { const p = deptPlan(dp), a = deptActual(dp), isOpen = open === dp.id || dp.items.length && open === null;
        return `<section class="fsec bg-dept${isOpen ? ' is-open' : ''}" data-dept="${esc(dp.id)}"><header><button class="bg-name" data-toggle aria-expanded="${isOpen}"><span>${esc(dp.name)}</span><small>${dp.items.length} item${dp.items.length === 1 ? '' : 's'}</small></button>
          <span class="bg-amt">${money(b, p)}${a ? `<small class="${a > p ? 'over' : ''}">spent ${money(b, a)}</small>` : ''}</span></header>
          ${isOpen ? `<table class="ftable bg-t"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Days or units</th><th class="n">Planned</th><th class="n">Actual</th><th></th></tr></thead><tbody>${dp.items.map(it => row(dp, it)).join('')}</tbody></table>
          <div class="row"><button class="add" data-addit>+ Add item</button><button class="ib xs" data-rendept>Rename</button><button class="ib xs" data-deldept>Remove department</button></div>` : ''}</section>`; }).join('')}
      <button class="add" id="bgAddDept">+ Add department</button>
      <div class="sheet bg-sheet" id="bgSheet" aria-hidden="true"><header><div><small>Budget summary</small><h2>${esc(d.title)}</h2><p>${days ? days + ' shoot day' + (days === 1 ? '' : 's') + ' · ' : ''}${new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><div class="callbox"><small>Total</small><b>${money(b, T.total)}</b></div></header>
        <table class="ftable"><thead><tr><th>Department</th><th class="n">Planned</th><th class="n">Actual</th><th class="n">Share</th></tr></thead><tbody>${b.depts.filter(x => x.items.length).map(dp => `<tr><td>${esc(dp.name)}</td><td class="n">${money(b, deptPlan(dp))}</td><td class="n">${deptActual(dp) ? money(b, deptActual(dp)) : '—'}</td><td class="n">${T.plan ? Math.round(deptPlan(dp) / T.plan * 100) : 0}%</td></tr>`).join('')}
          <tr><td>Contingency (${esc(b.cont)}%)</td><td class="n">${money(b, T.cont)}</td><td></td><td></td></tr><tr class="sum"><td>Total</td><td class="n">${money(b, T.total)}</td><td class="n">${money(b, T.act)}</td><td></td></tr></tbody></table></div>
    </div>`;
    el.onchange = e => {
      const t = e.target;
      if (t.id === 'bgCur') return F.change(dd => { dd.budget.cur = t.value; });
      if (t.id === 'bgCont') return F.change(dd => { dd.budget.cont = num(t.value); });
      const tr = t.closest('[data-it]'); if (!tr) return;
      F.change(dd => { const it = dd.budget.depts.find(x => x.id === tr.dataset.dp).items.find(x => x.id === tr.dataset.it); const k = t.dataset.k; it[k] = k === 'desc' ? t.value.trim() : t.value.trim() === '' ? '' : num(t.value); });
    };
    el.onclick = async e => {
      const t = e.target, sec = t.closest('[data-dept]'), id = sec && sec.dataset.dept;
      if (t.closest('[data-toggle]')) { open = open === id || (open === null && sec.classList.contains('is-open')) ? '' : id; return F.refresh(); }
      if (t.closest('[data-addit]')) { open = id; F.change(dd => dd.budget.depts.find(x => x.id === id).items.push({ id: F.uid(), desc: '', qty: 1, rate: '', units: 1, actual: '' })); setTimeout(() => { const ins = document.querySelectorAll(`.fws [data-dept="${CSS.escape(id)}"] [data-k="desc"]`); ins.length && ins[ins.length - 1].focus(); }, 0); return; }
      if (t.closest('[data-delit]')) { const tr = t.closest('[data-it]'); return F.change(dd => { const dp = dd.budget.depts.find(x => x.id === tr.dataset.dp); dp.items = dp.items.filter(x => x.id !== tr.dataset.it); }); }
      if (t.closest('[data-rendept]')) { const dp = b.depts.find(x => x.id === id); const n = await F.ask('Rename department', 'Department name', dp.name); if (n) F.change(dd => { dd.budget.depts.find(x => x.id === id).name = n; }); return; }
      if (t.closest('[data-deldept]')) { const dp = b.depts.find(x => x.id === id); const go = () => F.change(dd => { dd.budget.depts = dd.budget.depts.filter(x => x.id !== id); }); return dp.items.length ? N.confirmBox(`Remove ${dp.name} and its ${dp.items.length} item${dp.items.length === 1 ? '' : 's'}?`, 'Remove').then(ok => ok && go()) : go(); }
      if (t.closest('#bgAddDept')) { const n = await F.ask('New department', 'For example: Drone, Stunts, Insurance'); if (n) { const nid = F.uid(); open = nid; F.change(dd => dd.budget.depts.push({ id: nid, name: n, items: [] })); } return; }
      if (t.closest('#bgFill')) {
        const units = Math.max(1, days); let added = 0;
        F.change(dd => { const bb = dd.budget, find = n => bb.depts.find(x => x.name === n) || (bb.depts.push({ id: F.uid(), name: n, items: [] }), bb.depts[bb.depts.length - 1]);
          dd.people.forEach(p => { const dp = find(p.kind === 'cast' ? 'Cast' : 'Crew'); const desc = p.kind === 'cast' ? `${p.role || 'Cast'}${p.name ? ' – ' + p.name : ''}` : `${p.role || 'Crew'}${p.name ? ' – ' + p.name : ''}`;
            if (dp.items.some(it => it.pid === p.id)) return; dp.items.push({ id: F.uid(), pid: p.id, desc, qty: 1, rate: '', units, actual: '' }); added++; });
        });
        open = null; F.refresh();
        return N.toast(added ? `Added ${added} line${added === 1 ? '' : 's'}. Fill in each person’s daily rate.` : 'Everyone on the People tab is already in the budget');
      }
      const sv = t.closest('[data-bgsave]'); if (sv) { N.saveNode(el.querySelector('#bgSheet'), (d.title || 'Film') + ' budget', sv.dataset.bgsave, { position: 'static', left: 'auto', top: 'auto', boxShadow: 'none', borderRadius: '0' }); }
    };
  } });
})();
