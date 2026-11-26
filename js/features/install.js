/* Get the app: shows the right way to install Itàn on this device.
   Chrome, Edge and Android get a one-tap Install. iPhone, iPad and Mac Safari get short steps.
   Windows and Mac can also download the desktop app. Hidden once Itàn is running as an app. */
(function () {
  const N = window.N, esc = N.esc;
  const RELEASES = 'https://github.com/kingenonso/Itan/releases/latest';
  const ua = navigator.userAgent, plat = navigator.platform || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (plat === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua), isMac = !isIOS && /Mac/.test(plat + ua), isWin = /Win/.test(plat + ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Edg\//.test(ua);
  const isFirefox = /Firefox|FxiOS/.test(ua);
  const desktopApp = !!window.__TAURI__;
  const standalone = () => desktopApp || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let prompt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; render(); });
  addEventListener('appinstalled', () => { prompt = null; render(); N.toast('Itàn is installed. Open it from your home screen, dock or Start menu.'); });

  const btn = document.createElement('button');
  btn.className = 'ib getapp'; btn.id = 'bGet'; btn.title = 'Install Itàn on this device';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/></svg><span class="hide-s">Get the app</span>';
  const right = N.$('#bToday').parentElement; right.insertBefore(btn, right.firstChild);
  function render() { btn.hidden = standalone(); }
  render();

  const step = (n, t) => `<li><b>${n}</b><span>${t}</span></li>`;
  const shareIcon = '<svg class="inl" viewBox="0 0 24 24"><path d="M12 15V4M8 7.5L12 3.5l4 4"/><path d="M6 11v8.5h12V11"/></svg>';
  function how() {
    if (isIOS) {
      if (!isSafari) return { title: 'Open Itàn in Safari', body: `<p>On iPhone and iPad, apps like Itàn are added from Safari. Copy this page’s address, open it in Safari, then tap Get the app again.</p>` };
      return { title: 'Add Itàn to your Home Screen', body: `<ol class="steps">${step(1, `Tap the Share button ${shareIcon} in Safari’s toolbar.`)}${step(2, 'Scroll down and tap <b>Add to Home Screen</b>.')}${step(3, 'Tap <b>Add</b>. Open Itàn from its new icon from now on.')}</ol>
        <p class="fine">Use the Home Screen icon, not the Safari tab: iPhone keeps the two separately, and Safari can clear a website’s saved data if you don’t visit it for a week. Boards you already made in Safari can be moved with Share → Download everything, then Open a board file in the app.</p>` };
    }
    if (prompt) return { title: 'Install Itàn', body: `<p>Itàn installs as its own app with an icon on your ${isAndroid ? 'home screen' : isMac ? 'Dock and Launchpad' : 'Start menu and taskbar'}. It opens in its own window and works without internet.</p>`, install: true };
    if (isMac && isSafari) return { title: 'Add Itàn to your Dock', body: `<ol class="steps">${step(1, 'In Safari’s menu bar, choose <b>File</b>.')}${step(2, 'Choose <b>Add to Dock</b>, then <b>Add</b>.')}</ol><p class="fine">Needs macOS Sonoma or newer. You can also download the Mac app below.</p>`, desk: true };
    if (isFirefox && !isAndroid) return { title: 'Install Itàn', body: `<p>Firefox on computers can’t install web apps. Open this page in Chrome or Edge to install it, or download the desktop app below.</p>`, desk: true };
    if (isAndroid) return { title: 'Install Itàn', body: `<ol class="steps">${step(1, 'Tap your browser’s menu (⋮).')}${step(2, 'Tap <b>Install app</b> or <b>Add to Home screen</b>.')}</ol>` };
    return { title: 'Install Itàn', body: `<ol class="steps">${step(1, 'In the address bar, click the install icon (a screen with a down arrow), or open the browser menu.')}${step(2, 'Choose <b>Install Itàn</b>.')}</ol>`, desk: true };
  }
  btn.addEventListener('click', () => {
    const h = how(), desk = h.desk || ((isWin || isMac) && !isIOS);
    const m = N.modal(`<h2>${esc(h.title)}</h2>${h.body}
      ${desk ? `<div class="dl"><b>Or download the desktop app</b><span>Installers for Windows and Mac. They’re free, but not yet signed by Apple or Microsoft, so your computer will ask you to confirm the first time you open one.</span><a class="pri" href="${RELEASES}" target="_blank" rel="noopener">Download for ${isMac ? 'Mac' : isWin ? 'Windows' : 'Windows or Mac'}</a></div>` : ''}
      <div class="row">${h.install ? '<button class="pri" id="gInstall">Install</button>' : ''}<button data-close>${h.install ? 'Not now' : 'Close'}</button></div>`);
    m.querySelector('[data-close]').onclick = N.closeOv;
    const ib = m.querySelector('#gInstall');
    if (ib) ib.onclick = async () => { N.closeOv(); prompt.prompt(); const r = await prompt.userChoice.catch(() => ({})); if (r.outcome !== 'accepted') N.toast('You can install Itàn any time from Get the app'); prompt = null; render(); };
  });
  matchMedia('(display-mode: standalone)').addEventListener && matchMedia('(display-mode: standalone)').addEventListener('change', render);

  // In the desktop app, open web links in the person's normal browser
  if (desktopApp) document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="http"]'); if (!a) return;
    const op = window.__TAURI__.opener; if (!op) return;
    e.preventDefault(); op.openUrl(a.href).catch(() => {});
  }, true);
  N.install = { how, isIOS, isAndroid, isMac, isWin, desktopApp };
})();
