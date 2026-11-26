// Packs the web app for speed: every script into js/itan.min.js and every stylesheet into css/itan.min.css,
// minified, so a phone on slow data downloads two small files instead of fifty.
// The list and order of files is in scripts/web-files.json. Run `npm run build:web` after changing app files,
// or open dev.html to use the unpacked files while working.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), esbuild = require('esbuild');
const root = path.join(__dirname, '..'), list = JSON.parse(fs.readFileSync(path.join(__dirname, 'web-files.json'), 'utf8'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const js = esbuild.transformSync(list.js.map(f => `/* ${f} */\n${read(f)}\n;`).join('\n'), { loader: 'js', minify: true, target: 'esnext', legalComments: 'none' }).code;
const css = esbuild.transformSync(list.css.map(read).join('\n'), { loader: 'css', minify: true, target: 'esnext' }).code;
const hash = crypto.createHash('sha1').update(js + css).digest('hex').slice(0, 8);
fs.writeFileSync(path.join(root, 'js/itan.min.js'), js);
fs.writeFileSync(path.join(root, 'css/itan.min.css'), css);
const swap = (html, tag, body) => html.replace(new RegExp(`<!--build:${tag}-->[\\s\\S]*?<!--/build-->`), `<!--build:${tag}-->${body}<!--/build-->`);
let html = read('index.html');
const dev = swap(swap(html, 'css', list.css.map(f => `<link rel="stylesheet" href="${f}">`).join('\n')), 'js', '\n' + list.js.map(f => `<script src="${f}"></script>`).join('\n') + '\n');
html = swap(swap(html, 'css', `<link rel="stylesheet" href="css/itan.min.css?v=${hash}">`), 'js', `<script src="js/itan.min.js?v=${hash}"></script>`);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'dev.html'), dev.replace("navigator.serviceWorker.register('sw.js')", "false&&navigator.serviceWorker.register('sw.js')"));
let sw = read('sw.js');
sw = sw.replace(/const VERSION = '[^']+';/, `const VERSION = 'itan-${hash}';`).replace(/const FILES = \[[^\]]*\];/, `const FILES = ['./', 'index.html', 'css/itan.min.css?v=${hash}', 'js/config.js', 'js/itan.min.js?v=${hash}', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];`);
fs.writeFileSync(path.join(root, 'sw.js'), sw);
console.log(`Packed ${list.js.length} scripts (${(js.length / 1024).toFixed(0)} KB) and ${list.css.length} stylesheets (${(css.length / 1024).toFixed(0)} KB), version ${hash}`);
