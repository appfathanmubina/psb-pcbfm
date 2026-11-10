'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const pwaCss = fs.readFileSync('frontend/styles.css', 'utf8');
const pwaIndex = fs.readFileSync('frontend/index.html', 'utf8');
const appsScriptHtml = fs.readFileSync('apps-script/Index.html', 'utf8');

for (const [source, label] of [[pwaCss, 'PWA'], [appsScriptHtml, 'Apps Script']]) {
  assert.match(source, /html,body\s*\{[^}]*overscroll-behavior-y\s*:\s*none\s*;/s,
    label + ' root scrolling must suppress browser pull-to-refresh');
  assert.match(source, /body\s*\{[^}]*overflow-y\s*:\s*auto/s,
    label + ' must retain normal vertical page scrolling');
}
assert.match(pwaIndex, /styles\\.css\\?v=32\\.30\\.0/,
  'PWA stylesheet cache version must change so the fix reaches clients');
console.log('Mobile pull-to-refresh prevention and normal scrolling safeguards passed.');
