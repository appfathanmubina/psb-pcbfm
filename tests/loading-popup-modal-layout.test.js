'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');

const appFiles = [
  'frontend/app.js',
  'frontend/psb-fm-apps-script.js'
];

for (const file of appFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(!source.includes('Persentase menunjukkan tahapan proses, bukan durasi server yang terukur'), file + ': obsolete loading explanation must be removed');
  assert.ok(!source.includes('psbProcessFoot'), file + ': loading popup footer element must be removed');
  assert.ok(source.includes('id="psbProcessPercent"'), file + ': progress percentage must remain');
  assert.ok(source.includes('id="psbProcessBar"'), file + ': progress bar must remain');
  assert.ok(source.includes('processBegin(') && source.includes('processEnd('), file + ': loading lifecycle must remain');
}

const desktopRule = /body\.desktop-device \.modal-backdrop:not\(\.alert-modal\)\s*\{[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s;
const modalSizing = /body\.desktop-device \.modal-backdrop:not\(\.alert-modal\)\s*>\s*\.modal\s*\{[^}]*width:\s*min\(680px,\s*calc\(100vw - 64px\)\);[^}]*max-height:\s*min\(88vh,\s*900px\);[^}]*border-radius:\s*22px;/s;

const pwaCss = fs.readFileSync('frontend/styles.css', 'utf8');
const appsScriptHtml = fs.readFileSync('apps-script/Index.html', 'utf8');
assert.match(pwaCss, desktopRule, 'PWA desktop modal backdrop must center dialogs');
assert.match(pwaCss, modalSizing, 'PWA desktop dialogs must have proportional sizing');
assert.match(appsScriptHtml, desktopRule, 'Apps Script desktop modal backdrop must center dialogs');
assert.match(appsScriptHtml, modalSizing, 'Apps Script desktop dialogs must have proportional sizing');
assert.match(pwaCss, /\.modal-backdrop\{[^}]*align-items:flex-end/, 'mobile bottom-sheet default must remain unchanged');
assert.match(appsScriptHtml, /\.modal-backdrop\{[^}]*align-items:flex-end/, 'Apps Script mobile bottom-sheet default must remain unchanged');

const index = fs.readFileSync('frontend/index.html', 'utf8');
const sw = fs.readFileSync('frontend/sw.js', 'utf8');
assert.ok(index.includes('styles.css?v=32.23.0'), 'PWA stylesheet URL must use the new cache version');
assert.ok(sw.includes('styles.css?v=32.23.0'), 'service worker must precache the updated stylesheet URL');
console.log('Loading popup copy and desktop modal layout safeguards passed.');
