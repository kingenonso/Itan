/* Local storage adapter: everything is saved in the browser's IndexedDB on this device.
   Board data lives in the "docs" store (one record per board or card); pictures and videos
   live in the "media" store as raw files, so there is no size cap beyond the device's free space.
   Any future cloud adapter must offer the same methods. */
(function () {
  const DB_NAME = 'boards-app', DB_VER = 1;
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs');
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode), s = t.objectStore(store);
      let out, done = Promise.resolve(fn(s)).then(v => out = v);
      t.oncomplete = () => done.then(() => res(out));
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('aborted'));
    });
  };
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const chan = 'BroadcastChannel' in window ? new BroadcastChannel('boards-app') : null;
  const listeners = [];
  if (chan) chan.onmessage = e => { const m = e.data; if (m && m.type === 'docs') listeners.forEach(f => f(m.changes)); };
  const urls = new Map();
  const newId = () => 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  window.LocalStore = {
    mode: 'local',
    async loadAll() {
      const m = new Map();
      await tx('docs', 'readonly', s => {
        const kr = s.getAllKeys(), vr = s.getAll();
        return Promise.all([req(kr), req(vr)]).then(([keys, vals]) => keys.forEach((k, i) => m.set(k, vals[i])));
      });
      return m;
    },
    async put(key, value) {
      await tx('docs', 'readwrite', s => { s.put(value, key); });
      if (chan) chan.postMessage({ type: 'docs', changes: [[key, value]] });
    },
    async del(key) {
      await tx('docs', 'readwrite', s => { s.delete(key); });
      if (chan) chan.postMessage({ type: 'docs', changes: [[key, null]] });
    },
    onChange(fn) { listeners.push(fn); },
    async putMedia(blob) {
      const id = newId();
      await tx('media', 'readwrite', s => { s.put(blob, id); });
      return id;
    },
    async getMedia(id) { return tx('media', 'readonly', s => req(s.get(id))); },
    async mediaUrl(id) {
      if (urls.has(id)) return urls.get(id);
      const b = await this.getMedia(id);
      const u = b ? URL.createObjectURL(b) : '';
      urls.set(id, u);
      return u;
    },
    cachedUrl(id) { return urls.get(id); },
    async listMedia() {
      const out = [];
      await tx('media', 'readonly', s => {
        const kr = s.getAllKeys(), vr = s.getAll();
        return Promise.all([req(kr), req(vr)]).then(([keys, vals]) => keys.forEach((k, i) => out.push({ id: k, size: vals[i] ? vals[i].size : 0 })));
      });
      return out;
    },
    async deleteMedia(id) {
      await tx('media', 'readwrite', s => { s.delete(id); });
      if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    },
    async usage() {
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : {};
      const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      return { used: est.usage || 0, available: est.quota || 0, persisted };
    },
    async keepSafe() {
      return navigator.storage && navigator.storage.persist ? navigator.storage.persist() : false;
    }
  };
})();
