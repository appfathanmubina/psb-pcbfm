'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const pwaCss = fs.readFileSync('frontend/styles.css', 'utf8');
const appsScriptHtml = fs.readFileSync('apps-script/Index.html', 'utf8');
const pwaIndex = fs.readFileSync('frontend/index.html', 'utf8');
const serviceWorker = fs.readFileSync('frontend/sw.js', 'utf8');

for (const [label, source] of [['PWA stylesheet', pwaCss], ['Apps Script stylesheet', appsScriptHtml]]) {
  assert.match(source, /\.session-check-notice\.is-loading\s*\{[^}]*background\s*:\s*#800080\s*;?/i,
    label + ' must render the account/session checking notice with the primary purple background');
  assert.match(source, /\.session-check-notice\.is-loading\s*\{[^}]*color\s*:\s*#fff\s*;?/i,
    label + ' must keep loading notice text readable on purple');
  assert.match(source, /\.session-check-notice\.is-loading\s+\.session-check-spinner\s*\{[^}]*border-top-color\s*:\s*#fff\s*;?/i,
    label + ' must keep the loading spinner visible on purple');
}

assert.match(pwaCss, /\.loading\s*\{\s*background\s*:\s*#800080\s*!important\s*;?\s*\}\s*$/i,
  'PWA full-screen login/account checking overlay must stay purple after later CSS overrides');
assert.match(appsScriptHtml, /\.loading\s*\{\s*background\s*:\s*#800080\s*!important\s*;?\s*\}<\/style>/i,
  'Apps Script full-screen login/account checking overlay must stay purple after later CSS overrides');

assert.match(pwaIndex, /styles\.css\?v=32\.29\.0/,
  'PWA HTML must request the refreshed stylesheet version');
assert.match(pwaIndex, /sw\.js\?v=32\.49\.0/,
  'PWA HTML must request the refreshed service worker version');
assert.match(serviceWorker, /psb-pwa-shell-v32-49-0/,
  'Service worker cache namespace must be refreshed with the stylesheet change');
assert.match(serviceWorker, /styles\.css\?v=32\.29\.0/,
  'Service worker precache must request the refreshed stylesheet version');

console.log('Session check purple background safeguards: OK');
