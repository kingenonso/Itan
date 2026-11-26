/* Review notes on videos: play a cut, pause anywhere, and pin a note to that exact moment.
   Notes show as marks on the timeline, can be ticked off, and export as markers for DaVinci Resolve (EDL)
   or as a plain list to paste into a chat. */
(function () {
  const N = window.N, F = N.film, esc = N.esc;
  const RATES = [['23.976', 23.976], ['24', 24], ['25', 25], ['29.97', 29.97], ['30', 30], ['50', 50], ['59.94', 59.94], ['60', 60]];
  const nominal = fps => Math.round(fps);
  const tc = (sec, fps, startH = 0) => { const nf = nominal(fps), fr = Math.round(sec * fps); const total = fr + startH * 3600 * nf;
    const f = total % nf, s = Math.floor(total / nf) % 60, m = Math.floor(total / nf / 60) % 60, h = Math.floor(total / nf / 3600); return [h, m, s, f].map(x => String(x).padStart(2, '0')).join(':'); };
  const short = sec => { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; };
  N.hooks.videoExtra = c => { const n = (c.notes || []).length, open = (c.notes || []).filter(x => !x.done).length;
    return `<button class="add rvbtn" data-review>${n ? `Review notes · ${open} open of ${n}` : 'Review: add notes at moments'}${F.approvalLabel ? esc(F.approvalLabel(c)) : ''}</button>`; };
  N.world.addEventListener('click', e => { const b = e.target.closest('[data-review]'); if (!b) return; const c = N.find(b.closest('.card').dataset.id); if (c) open(c); });

  let rv = null;
  async function open(c) {
    const url = await N.Store.mediaUrl(c.media); if (!url) return N.toast('This video isn’t on this device');
    if (c.approval && F.syncApproval) { await F.syncApproval(c.id, true); c = N.find(c.id) || c; }
    const d = F.data(); let fps = c.fps || (d && d.fps) || 24;
    const el = document.createElement('div'); el.className = 'fws rvw'; document.body.append(el); document.body.classList.add('filming');
    rv = { c, el };
    el.innerHTML = `<header class="fhead"><div class="ftitle"><b>Review · ${esc(c.text || 'Video')}</b></div><span class="spacer"></span>
        <label class="fpsl">Frame rate<select id="rvFps">${RATES.map(([l, v]) => `<option value="${v}"${v === fps ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        ${F.approval ? `<button class="ib" id="rvApprove">${c.approval ? 'Approval link' + esc(F.approvalLabel(c)) : 'Get approval link'}</button>` : ''}<button class="ib" id="rvExport">Export notes</button><button class="ib" id="rvClose">Done</button></header>
      <div class="rv"><div class="rv-player"><video id="rvV" src="${esc(url)}" playsinline preload="auto"></video>
        <div class="rv-bar"><button class="ib" id="rvPlay" aria-label="Play">▶</button><div class="rv-track" id="rvTrack"><i id="rvFill"></i><div id="rvMarks"></div></div><span id="rvTC">00:00:00:00</span></div>
        <div class="rv-add"><button class="pri" id="rvAdd">Add note here</button><span class="fhint">Space plays and pauses · N adds a note · arrow keys step one frame</span></div></div>
        <aside class="rv-notes"><h3>Notes</h3><ol id="rvList"></ol></aside></div>`;
    const v = el.querySelector('#rvV'), list = el.querySelector('#rvList');
    const notes = () => (c.notes || []).slice().sort((a, b) => a.t - b.t);
    const draw = () => {
      const dur = v.duration || 1;
      el.querySelector('#rvMarks').innerHTML = notes().map(n => `<button class="mk${n.done ? ' done' : ''}" style="left:${(n.t / dur * 100).toFixed(2)}%" data-seek="${n.t}" title="${esc(short(n.t) + ' · ' + n.text)}"></button>`).join('');
      list.innerHTML = notes().map(n => `<li class="${n.done ? 'done' : ''}" data-nid="${esc(n.id)}"><button class="tcb" data-seek="${n.t}">${tc(n.t, fps)}</button>
        <div class="ntext" contenteditable="${N.P.canWrite ? 'plaintext-only' : 'false'}" data-ph="Write the note">${esc(n.text)}</div>
        <div class="nact"><label class="nchk"><input type="checkbox" data-done${n.done ? ' checked' : ''}${N.P.canWrite ? '' : ' disabled'}> Fixed</label>${N.P.canWrite ? '<button class="ib xs" data-ndel aria-label="Delete note">✕</button>' : ''}</div></li>`).join('') || '<li class="empty-row">Pause at any moment and press Add note here.</li>';
    };
    const tick = () => { if (!rv) return; el.querySelector('#rvTC').textContent = tc(v.currentTime, fps); el.querySelector('#rvFill').style.width = (v.currentTime / (v.duration || 1) * 100) + '%'; el.querySelector('#rvPlay').textContent = v.paused ? '▶' : '❚❚'; rv.raf = requestAnimationFrame(tick); };
    v.addEventListener('loadedmetadata', draw); tick(); draw();
    const seek = t => { v.currentTime = Math.max(0, Math.min(v.duration || t, +t)); };
    el.querySelector('#rvTrack').addEventListener('pointerdown', e => { if (e.target.closest('.mk')) return; const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width * (v.duration || 0)); });
    const add = () => { if (!N.P.canWrite) return; v.pause(); const n = { id: N.uid(), t: +v.currentTime.toFixed(3), text: '', done: false }; N.snap(); c.notes = [...(c.notes || []), n]; N.touch(); draw();
      const t = list.querySelector(`[data-nid="${n.id}"] .ntext`); if (t) { t.focus(); t.scrollIntoView({ block: 'nearest' }); } };
    el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('#rvClose')) return close();
      if (t.closest('#rvPlay')) return v.paused ? v.play() : v.pause();
      if (t.closest('#rvAdd')) return add();
      const s = t.closest('[data-seek]'); if (s) { v.pause(); seek(s.dataset.seek); return; }
      if (t.closest('[data-ndel]')) { const id = t.closest('[data-nid]').dataset.nid; N.snap(); c.notes = c.notes.filter(x => x.id !== id); N.touch(); draw(); }
      if (t.closest('#rvExport')) exportNotes(c, fps);
      if (t.closest('#rvApprove')) { close(); F.approval(c.id); }
    });
    el.addEventListener('change', e => {
      if (e.target.matches('[data-done]')) { const id = e.target.closest('[data-nid]').dataset.nid; N.snap(); const n = c.notes.find(x => x.id === id); n.done = e.target.checked; N.touch(); draw(); }
      if (e.target.id === 'rvFps') { fps = +e.target.value; N.snap(); c.fps = fps; N.touch(); draw(); }
    });
    let typing = false;
    el.addEventListener('focusin', e => { if (e.target.matches('.ntext')) { typing = true; rv.editSnapped = false; } });
    el.addEventListener('input', e => { if (!e.target.matches('.ntext')) return; const id = e.target.closest('[data-nid]').dataset.nid; if (!rv.editSnapped) { N.snap(); rv.editSnapped = true; } const n = c.notes.find(x => x.id === id); if (n) { n.text = e.target.innerText.trim(); N.touch(); } });
    el.addEventListener('focusout', e => { if (e.target.matches('.ntext')) { typing = false; setTimeout(draw, 0); } });
    rv.key = e => {
      if (!rv) return; if (typing || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { if (e.key === 'Escape') document.activeElement.blur(); return; }
      if (e.key === ' ') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
      else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'm') { e.preventDefault(); add(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); v.pause(); seek(v.currentTime + (e.key === 'ArrowRight' ? 1 : -1) / fps * (e.shiftKey ? fps : 1)); }
      else if (e.key === 'Escape') close();
      e.stopPropagation();
    };
    document.addEventListener('keydown', rv.key, true);
  }
  function close() { if (!rv) return; cancelAnimationFrame(rv.raf); document.removeEventListener('keydown', rv.key, true); rv.el.remove(); rv = null; document.body.classList.remove('filming'); N.render(); }

  function exportNotes(c, fps) {
    const ns = (c.notes || []).slice().sort((a, b) => a.t - b.t).filter(n => n.text);
    if (!ns.length) return N.toast('Write some notes first');
    const name = (c.text || 'Review').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 50) || 'Review';
    const m = N.modal(`<h2>Export review notes</h2><p>${ns.length} note${ns.length === 1 ? '' : 's'} at ${fps} frames per second.</p>
      <p><b>Markers for DaVinci Resolve</b><br>An EDL file of timeline markers. In Resolve, import it with the “Timeline Markers from EDL” option onto the timeline you exported this video from. Open notes come in blue and fixed ones in green.</p>
      <label class="pinf" style="align-items:center;gap:10px">Timeline starts at<input id="exStart" value="01:00:00:00" style="font-size:15px;letter-spacing:0;max-width:160px"></label>
      <div class="row"><button class="pri" id="exEdl">Download markers (.edl)</button><button id="exTxt">Copy as text</button><button data-close>Close</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    m.querySelector('#exEdl').onclick = () => {
      const st = (m.querySelector('#exStart').value.match(/^(\d{1,2})/) || [0, 1])[1];
      const lines = [`TITLE: ${name}`, 'FCM: NON-DROP FRAME', ''];
      ns.forEach((n, i) => { const a = tc(n.t, fps, +st), b = tc(n.t + 1 / fps, fps, +st);
        lines.push(`${String(i + 1).padStart(3, '0')}  001      V     C        ${a} ${b} ${a} ${b}  `, ` |C:${n.done ? 'ResolveColorGreen' : 'ResolveColorBlue'} |M:${n.text.replace(/[\r\n|]+/g, ' ')} |D:1`, ''); });
      const blob = new Blob([lines.join('\r\n')], { type: 'text/plain' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name + ' markers.edl'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      N.closeOv(); N.toast('Markers saved');
    };
    m.querySelector('#exTxt').onclick = async () => {
      const txt = `${c.text || 'Review'}\n` + ns.map(n => `${n.done ? '✓' : '•'} ${tc(n.t, fps)}  ${n.text}`).join('\n');
      try { await navigator.clipboard.writeText(txt); N.toast('Notes copied. Paste them into WhatsApp or an email.'); } catch (e) { N.toast('Copying isn’t allowed here'); }
      N.closeOv();
    };
  }
  F.timecode = tc;
})();
