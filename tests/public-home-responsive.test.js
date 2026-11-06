'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('frontend/styles.css', 'utf8');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const app = fs.readFileSync('frontend/app.js', 'utf8');

assert.match(css, /@media\s*\(min-width:\s*900px\)/,
  'Desktop landing page rules must be isolated to wide viewports');
assert.match(css, /\.public-shell\s*\{[^}]*max-width:\s*1240px/s,
  'Public landing page must expand to a professional desktop content width');
assert.match(css, /\.public-shell\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
  'Desktop public shell must use a vertical flex layout so sections cannot sit side by side');
assert.match(css, /\.public-gallery,\s*\.public-video\s*\{[^}]*width:\s*100%;[^}]*flex:\s*0\s*0\s*auto;/s,
  'Gallery and video must each occupy a full-width vertical row');
assert.match(css, /@media\s*\(min-width:\s*900px\)\s*and\s*\(max-width:\s*1100px\)/,
  'Desktop layout must also adapt to narrower laptop screens');
assert.match(html, /styles\.css\?v=32\.22\.0/,
  'HTML must request the updated responsive stylesheet');
const serviceWorker = fs.readFileSync('frontend/sw.js', 'utf8');
const appVersion = html.match(/app\\.js\\?v=([0-9.]+)/)?.[1];
assert.ok(appVersion, 'HTML must declare its current app shell version');
assert.ok(serviceWorker.includes('psb-pwa-shell-v' + appVersion.split('.').join('-')),
  'Service worker cache must match the current PWA app shell version');
assert.match(app, /function renderPublicHome\(/,
  'Existing public home renderer must remain in place');

console.log('PSB desktop public landing responsive safeguards: OK');
