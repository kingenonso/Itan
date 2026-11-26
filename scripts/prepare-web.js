// Copies the web app into dist/ so the desktop app can bundle it.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of ['index.html', 'manifest.json', 'css', 'js', 'icons']) fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
console.log('Web app copied to dist/');
