/* Save a board as a picture (PNG) or a PDF, for people who don't use Notera.
   The two helper libraries load only when someone asks for an export. */
(function () {
  const N = window.N;
  const LIBS = { img: 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js', pdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js' };
  const loaded = {};
  const load = src => loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('offline')); }; document.head.append(s); }));
  const name = () => (N.B().title || 'board').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'board';
  async function capture() {
    const b = N.B(), rs = b.cards.filter(c => !c.col).map(c => N.wrect(c.id)).filter(Boolean);
    if (!rs.length) throw new Error('empty');
    const pad = 48, x0 = Math.min(...rs.map(r => r.x)) - pad, y0 = Math.min(...rs.map(r => r.y)) - pad;
    const w = Math.ceil(Math.max(...rs.map(r => r.x + r.w)) - x0 + pad), h = Math.ceil(Math.max(...rs.map(r => r.y + r.h)) - y0 + pad);
    await load(LIBS.img);
    const ratio = Math.max(.5, Math.min(2, 12000 / Math.max(w, h)));
    N.S.sel.clear(); N.refreshSel(); N.world.classList.add('exporting');
    try {
      const bg = getComputedStyle(N.canvas).backgroundColor;
      const url = await window.htmlToImage.toPng(N.world, { width: w, height: h, pixelRatio: ratio, backgroundColor: bg, cacheBust: true,
        style: { transform: `translate(${-x0}px,${-y0}px) scale(1)`, transformOrigin: '0 0' } });
      return { url, w, h };
    } finally { N.world.classList.remove('exporting'); }
  }
  const save = (href, file) => { const a = document.createElement('a'); a.href = href; a.download = file; document.body.append(a); a.click(); a.remove(); };
  async function png() {
    try { N.status('Making picture…'); const { url } = await capture(); save(url, name() + '.png'); N.toast('Picture saved'); }
    catch (e) { N.toast(e.message === 'empty' ? 'This board is empty' : e.message === 'offline' ? 'Saving as a picture needs internet the first time' : 'The picture couldn’t be made'); }
    N.settled();
  }
  async function pdf() {
    try {
      N.status('Making PDF…'); const { url, w, h } = await capture(); await load(LIBS.pdf);
      const { jsPDF } = window.jspdf, pt = .75, doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'pt', format: [w * pt, h * pt] });
      doc.addImage(url, 'PNG', 0, 0, w * pt, h * pt, undefined, 'FAST'); doc.save(name() + '.pdf'); N.toast('PDF saved');
    } catch (e) { N.toast(e.message === 'empty' ? 'This board is empty' : e.message === 'offline' ? 'Saving as PDF needs internet the first time' : 'The PDF couldn’t be made'); }
    N.settled();
  }
  // Save any part of the page (a call sheet, a shot list) as a picture or PDF, or send the picture
  N.saveNode = async (node, fname, kind, style) => {
    try {
      N.status(kind === 'pdf' ? 'Making PDF…' : 'Making picture…'); await load(LIBS.img);
      const w = node.scrollWidth, h = node.scrollHeight;
      const url = await window.htmlToImage.toPng(node, { width: w, height: h, pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, style: style || undefined });
      if (kind === 'pdf') { await load(LIBS.pdf); const { jsPDF } = window.jspdf, pt = .75, doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'pt', format: [w * pt, h * pt] }); doc.addImage(url, 'PNG', 0, 0, w * pt, h * pt, undefined, 'FAST'); doc.save(fname + '.pdf'); N.toast('PDF saved'); }
      else if (kind === 'share') {
        const blob = await (await fetch(url)).blob(), file = new File([blob], fname + '.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: fname }); } catch (e) {} }
        else { save(url, fname + '.png'); N.toast('Picture saved. Attach it in WhatsApp or email to send it.'); }
      } else { save(url, fname + '.png'); N.toast('Picture saved'); }
    } catch (e) { N.toast(e.message === 'offline' ? 'Saving needs internet the first time' : 'That couldn’t be saved'); }
    N.settled();
  };
  N.loadLib = name => load(LIBS[name]);
  N.hooks.shareExtras = N.hooks.shareExtras || [];
  N.hooks.shareExtras.push({ label: 'Save as picture', run: png }, { label: 'Save as PDF', run: pdf });
})();
