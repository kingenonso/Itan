/* Brand deals: product placement and sponsors, a real source of money for a film.
   Each deal keeps the brand, the contact, what they pay and when, what they get (seen in a scene, a mention, the logo
   in the credits, social posts), and the scenes they appear in. Their products go onto the Props list for those
   scenes, the agreement is prepared in Clearances, and a sponsor report with proof stills is one tap away. */
(function () {
  const N = window.N, F = N.film, esc = N.esc, num = F.num;
  const ST = [['talk', 'Talking'], ['agreed', 'Agreed'], ['signed', 'Contract signed'], ['shot', 'Shot'], ['done', 'Delivered and paid'], ['no', 'Fell through']];
  const W = fn => F.change(dd => fn(F.deskW(dd, 'brands', () => ({ deals: [] }))));
  const cur = d => (d.budget && d.budget.cur) || '₦';
  const money = (d, v) => `${cur(d)}${Math.round(num(v)).toLocaleString()}`;
  F.brandMoney = d => { const ds = (F.desk(d, 'brands', {}).deals || []).filter(x => !['talk', 'no'].includes(x.st)); return { agreed: ds.reduce((n, x) => n + num(x.value), 0), paid: ds.reduce((n, x) => n + num(x.paid), 0), count: ds.length }; };
  const gotList = x => String(x.gets || '').split('\n').map(s => s.trim()).filter(Boolean);

  F.desks.push({ id: 'brands', group: 'Production', label: 'Brand deals', who: 'Producer, sponsorship', icon: '🤝',
    status(d) { const m = F.brandMoney(d); return { ready: m.agreed ? Math.min(1, m.paid / m.agreed) : null, note: m.count ? `${money(d, m.agreed)} agreed · ${money(d, m.paid)} paid` : 'No deals yet' }; },
    alerts(d) {
      const ds = F.desk(d, 'brands', {}).deals || [], out = [], today = N.todayStr(0);
      ds.filter(x => x.due && x.due < today && num(x.paid) < num(x.value) && !['talk', 'no'].includes(x.st)).forEach(x => out.push({ lvl: 'warn', text: `${x.brand}: ${money(d, num(x.value) - num(x.paid))} was due on ${new Date(x.due + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}` }));
      const soon = F.nextDays(d, 3).flatMap(x => F.dayScenes(d, x));
      ds.filter(x => x.st === 'agreed' && (x.scenes || []).some(id => soon.some(s => s.id === id))).forEach(x => out.push({ lvl: 'bad', text: `${x.brand} is in scenes this week but the contract isn’t signed` }));
      return out;
    },
    render(el, d) {
      const B = F.desk(d, 'brands', {}), deals = B.deals || [], ui = this.ui = this.ui || {}, m = F.brandMoney(d);
      if (!ui.id || !deals.find(x => x.id === ui.id)) ui.id = deals[0] && deals[0].id;
      const x = deals.find(y => y.id === ui.id), scenes = F.sortScenes(d), props = (F.desk(d, 'props', {}).items || []);
      const inProps = x && props.some(p => p.brand === x.id), leg = x ? ((F.desk(d, 'legal', {}).st || {})['brand:' + x.id] || {}).s : '';
      el.innerHTML = `<header class="dk-top"><div><h2>Brand deals</h2><p>Product placement and sponsors: what each brand pays, what they get, which scenes they’re in, and proof that you delivered.</p></div></header>
        <div class="dk-cards"><div class="dk-card"><small>Agreed</small><b>${money(d, m.agreed)}</b><span>${m.count} deal${m.count === 1 ? '' : 's'}${deals.filter(y => y.st === 'talk').length ? ` · ${money(d, deals.filter(y => y.st === 'talk').reduce((n, y) => n + num(y.value), 0))} still in talks` : ''}</span></div><div class="dk-card"><small>Paid so far</small><b>${money(d, m.paid)}</b><span>${m.agreed ? Math.round(m.paid / m.agreed * 100) + '%' : '—'}</span><i class="dk-bar"><em style="width:${m.agreed ? Math.min(100, m.paid / m.agreed * 100) : 0}%"></em></i></div>${d.budget && F.budgetTotals ? `<div class="dk-card"><small>Covers of the budget</small><b>${F.budgetTotals(d.budget).total ? Math.round(m.agreed / F.budgetTotals(d.budget).total * 100) : 0}%</b><span>of ${money(d, F.budgetTotals(d.budget).total)}</span></div>` : ''}</div>
        <div class="dk-scenes">${deals.map(y => `<button data-bd="${esc(y.id)}" class="${y.id === ui.id ? 'on' : ''}${y.st === 'done' ? ' done' : ''}">${esc(y.brand || 'New brand')}</button>`).join('')}<button class="add" data-bdadd>+ Brand</button></div>
        ${x ? `<div class="dk-two"><section class="fsec"><div class="dk-h"><input class="loc-name" data-bk="brand" value="${esc(x.brand || '')}" placeholder="Brand name" aria-label="Brand name"><select data-bk="st">${ST.map(([k, l]) => `<option value="${k}"${(x.st || 'talk') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="dk-grid2"><label>Contact person<input data-bk="contact" value="${esc(x.contact || '')}"></label><label>Phone or email<input data-bk="phone" value="${esc(x.phone || '')}"></label>
              <label>Deal value (${esc(cur(d))})<input data-bk="value" value="${esc(x.value || '')}" inputmode="decimal"></label><label>Paid so far<input data-bk="paid" value="${esc(x.paid || '')}" inputmode="decimal"></label>
              <label>Next payment due<input type="date" data-bk="due" value="${esc(x.due || '')}"></label><label>Product to show<input data-bk="product" value="${esc(x.product || '')}" placeholder="Malt drink, phone, bank app"></label></div>
            <label class="dk-lab">What they get (one per line)<textarea data-bk="gets" rows="4" placeholder="Product seen in scene 4 for at least 5 seconds\nCharacter says the brand name once\nLogo in the end credits\n2 Instagram posts with the cast">${esc(x.gets || '')}</textarea></label>
            ${gotList(x).length ? `<ul class="dk-check">${gotList(x).map((g, i) => `<li class="${(x.done || {})[i] ? 'done' : ''}"><label><input type="checkbox" data-bgot="${i}"${(x.done || {})[i] ? ' checked' : ''}><span><b>${esc(g)}</b></span></label></li>`).join('')}</ul>` : ''}
            <div class="row">${F.openDesk ? `<button class="ib${leg === 'signed' ? '' : ' pri'}" data-bcontract>${leg === 'signed' ? 'Contract signed ✓' : '✍ Prepare the contract'}</button>` : ''}<button class="ib" data-breport>Sponsor report (PDF)</button><button class="ib xs" data-bdel>Remove</button></div></section>
          <section class="fsec"><h3>Scenes they appear in</h3><div class="loc-places">${scenes.map(s => `<label><input type="checkbox" data-bsc="${esc(s.id)}"${(x.scenes || []).includes(s.id) ? ' checked' : ''}>${esc(s.num)} ${esc(s.loc || '')}</label>`).join('') || '<span class="fhint">Scenes appear once the script is broken down.</span>'}</div>
            ${(x.scenes || []).length ? `<p class="fhint">${inProps ? 'On the Props list for these scenes.' : ''} ${(x.scenes || []).map(id => { const s = d.scenes.find(y => y.id === id); const ds = s ? F.daysOfScene(d, s).map(y => y.date).filter(Boolean) : []; return s ? `Scene ${esc(s.num)}${ds.length ? ' on ' + ds.map(z => new Date(z + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })).join(', ') : ''}` : ''; }).filter(Boolean).join(' · ')}</p>
              ${!inProps ? `<button class="ib" data-bprop>Add ${esc(x.product || x.brand || 'the product')} to Props for these scenes</button>` : ''}` : ''}
            <h3 style="margin-top:14px">Proof stills</h3><p class="fhint">Frames or set photos that show the brand, for the sponsor report.</p>
            <div class="dk-refs">${(x.proof || []).map((p, i) => `<figure><img data-media="${esc(p)}" alt=""><button class="ib xs" data-bpdel="${i}" aria-label="Remove">✕</button></figure>`).join('')}<button class="dk-addph" data-bproof>+ Stills</button></div></section></div>`
          : '<div class="empty-row big">Add the brands you’re talking to: a drink in a scene, a phone the lead uses, a bank’s logo in the credits. Track what they pay and prove you delivered.</div>'}`;
      F.mediaImgs(el);
      const setX = fn => W(B2 => { const y = (B2.deals || []).find(z => z.id === ui.id); if (y) fn(y, B2); });
      el.onclick = async e => { const t = e.target;
        const b = t.closest('[data-bd]'); if (b) { ui.id = b.dataset.bd; return F.refresh(); }
        if (t.closest('[data-bdadd]')) { const n = await F.ask('New brand', 'For example: Maltina'); if (n) { const id = F.uid(); ui.id = id; W(B2 => (B2.deals = B2.deals || []).push({ id, brand: n, st: 'talk', scenes: [] })); } return; }
        if (!x) return;
        if (t.closest('[data-bdel]')) { if (await N.confirmBox(`Remove ${x.brand}?`, 'Remove')) W(B2 => { B2.deals = B2.deals.filter(y => y.id !== x.id); }); return; }
        if (t.closest('[data-bproof]')) { const ids = await F.pickImages(); if (ids.length) setX(y => { y.proof = [...(y.proof || []), ...ids]; }); return; }
        const pd = t.closest('[data-bpdel]'); if (pd) return setX(y => { y.proof.splice(+pd.dataset.bpdel, 1); });
        if (t.closest('[data-bprop]')) { F.change(dd => { const P = F.deskW(dd, 'props', () => ({ items: [] })); P.items = P.items || []; P.items.push({ id: F.uid(), name: `${x.product || x.brand} (${x.brand})`, status: 'need', src: 'Borrow', brand: x.id, scenes: [...(x.scenes || [])], who: x.contact || '' }); }); N.toast('Added to Props'); return; }
        if (t.closest('[data-bcontract]')) { const row = F.clearanceRows(d).find(r => r.k === 'brand:' + x.id); if (row && F.signDoc) F.signDoc(row); else { if (x.st === 'talk') setX(y => { y.st = 'agreed'; }); setTimeout(() => { const r2 = F.clearanceRows(F.data()).find(r => r.k === 'brand:' + x.id); if (r2 && F.signDoc) F.signDoc(r2); }, 50); } return; }
        if (t.closest('[data-breport]')) return report(d, x);
      };
      el.onchange = e => { const t = e.target;
        if (t.dataset.bk) return setX(y => { y[t.dataset.bk] = t.type === 'date' ? t.value : t.value.trim(); });
        if (t.dataset.bsc) return setX((y, B2) => { y.scenes = (y.scenes || []).filter(id => id !== t.dataset.bsc); if (t.checked) y.scenes.push(t.dataset.bsc); const p = (F.deskW(F.data(), 'props', () => ({ items: [] })).items || []).find(z => z.brand === y.id); if (p) p.scenes = [...y.scenes]; });
        if (t.dataset.bgot !== undefined) return setX(y => { y.done = y.done || {}; y.done[t.dataset.bgot] = t.checked; });
      };
    } });

  // a report the sponsor can keep: what was promised, what was delivered, where, with stills
  async function report(d, x) {
    const host = document.createElement('div'); host.className = 'sheet dk-book'; host.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px';
    const sc = (x.scenes || []).map(id => d.scenes.find(s => s.id === id)).filter(Boolean);
    host.innerHTML = `<h1>${esc(x.brand)} in “${esc(d.title)}”</h1><p>Sponsor report · ${esc(new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
      <h2>What was agreed</h2><table class="ftable"><tbody>${gotList(x).map((g, i) => `<tr><td>${(x.done || {})[i] ? '✓' : '○'}</td><td>${esc(g)}</td><td>${(x.done || {})[i] ? 'Delivered' : 'To come'}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</tbody></table>
      ${sc.length ? `<h2>Scenes</h2><table class="ftable"><tbody>${sc.map(s => { const ds = F.daysOfScene(d, s).map(y => y.date).filter(Boolean); return `<tr><td><b>${esc(s.num)}</b></td><td>${esc(F.sceneLabel(s))}</td><td>${esc(s.summary || '')}</td><td>${ds.map(z => esc(new Date(z + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' }))).join(', ')}</td></tr>`; }).join('')}</tbody></table>` : ''}
      ${(x.proof || []).length ? `<h2>Stills</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${x.proof.map(p => `<img data-media="${esc(p)}" style="width:100%;border-radius:6px">`).join('')}</div>` : ''}`;
    document.body.append(host);
    await Promise.all([...host.querySelectorAll('img[data-media]')].map(async im => { const b = await N.Store.getMedia(im.dataset.media).catch(() => null); if (b) im.src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); else im.remove(); }));
    try { await N.saveNode(host, `${x.brand} sponsor report`, 'pdf', { position: 'static', left: '0', top: '0' }); } finally { host.remove(); }
  }
  F.deskTabs();
})();
