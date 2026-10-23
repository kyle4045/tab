// Gives index.html a new version: its <meta name="tab-version"> and the ?v= on
// Tab's own files. Phones then fetch the new files instead of an old saved copy,
// and a Tab already open (a home-screen app can stay open for days) offers to
// update. Run before each push that changes the site:  node dev/bump-version.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../index.html', import.meta.url);
const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const version = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;

let html = readFileSync(file, 'utf8');
const meta = /(<meta name="tab-version" content=")[^"]*(")/;
if (!meta.test(html)) throw new Error('index.html has no <meta name="tab-version">');
html = html
  .replace(meta, `$1${version}$2`)
  .replace(/((?:href|src)="(?:app\.css|config\.js|calc\.js|i18n\.js|store\.js|app\.js))(?:\?v=[^"]*)?"/g, `$1?v=${version}"`);
writeFileSync(file, html);
console.log('index.html is now version ' + version);
