'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const appsSource = fs.readFileSync('apps-script/Index.html', 'utf8');
const pwaSource = fs.readFileSync('frontend/app.js', 'utf8');

const onlyInAppsScript = ['installStaticBrandIcons', 'renderPublicVideo'];
const onlyInPwa = ['goPublicVideo', 'refreshPublicConfig', 'renderPublicVideoSection', 'updatePublicVideo'];
const intentionallyDifferentBodies = [
  'appLogoMarkup', 'applyAppIcon', 'boot', 'configAssetSources',
  'hydrateSplashLogo', 'movePublicVideo', 'openChatForRegistration',
  'playPublicVideo', 'renderPublicHome', 'renderWaliHomeFlow', 'server', 'submitLogin'
];

function extractFunctionBodies(source) {
  const functions = new Map();
  const declaration = /(?:async\\s+)?function\\s+([A-Za-z_$][\\w$]*)\\s*\\(/g;
  let match;
  while ((match = declaration.exec(source))) {
    const name = match[1], start = match.index;
    const open = source.indexOf('{', declaration.lastIndex);
    if (open < 0) continue;
    let depth = 0, quote = '', escaped = false, lineComment = false, blockComment = false, end = -1;
    for (let i = open; i < source.length; i++) {
      const char = source[i], next = source[i + 1];
      if (lineComment) { if (char === String.fromCharCode(10)) lineComment = false; continue; }
      if (blockComment) { if (char === '*' && next === '/') { blockComment = false; i++; } continue; }
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (char === String.fromCharCode(92)) { escaped = true; continue; }
        if (char === quote) quote = '';
        continue;
      }
      if (char === '/' && next === '/') { lineComment = true; i++; continue; }
      if (char === '/' && next === '*') { blockComment = true; i++; continue; }
      if (char === "'" || char === '"' || char.charCodeAt(0) === 96) { quote = char; continue; }
      if (char === '{') depth++;
      if (char === '}' && --depth === 0) { end = i + 1; break; }
    }
    assert.notEqual(end, -1, 'Unbalanced function body: ' + name);
    functions.set(name, source.slice(start, end));
  }
  return functions;
}
const apps = extractFunctionBodies(appsSource), pwa = extractFunctionBodies(pwaSource);
const sort = values => [...values].sort();
assert.deepEqual(sort([...apps.keys()].filter(n => !pwa.has(n))), sort(onlyInAppsScript),
  'Unexpected Apps Script-only functions; review the parity allowlist');
assert.deepEqual(sort([...pwa.keys()].filter(n => !apps.has(n))), sort(onlyInPwa),
  'Unexpected PWA-only functions; review the parity allowlist');
const common = [...apps.keys()].filter(n => pwa.has(n));
assert.deepEqual(sort(common.filter(n => apps.get(n) !== pwa.get(n))), sort(intentionallyDifferentBodies),
  'Unexpected same-name function drift; review both implementations before updating the allowlist');
for (const name of intentionallyDifferentBodies) {
  assert.ok(apps.has(name) && pwa.has(name), 'Allowlisted function must exist in both: ' + name);
}
console.log('UI function parity safeguards: OK (' + apps.size + ' Apps Script, ' + pwa.size +
  ' PWA functions; ' + intentionallyDifferentBodies.length + ' reviewed intentional differences)');
