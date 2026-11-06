'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const appsSource = fs.readFileSync('apps-script/Index.html', 'utf8') + '\n' + fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8');
const pwaSource = fs.readFileSync('frontend/app.js', 'utf8');

const onlyInAppsScript = ['installStaticBrandIcons', 'renderPublicVideo'];
const onlyInPwa = ['closeNotificationPopup', 'decodeUploadImage', 'getSupportedDocumentMimeTypes', 'goPublicVideo', 'openNotificationPopup', 'prepareUploadFile', 'refreshNotificationPopup', 'refreshPublicConfig', 'renderPublicVideoSection', 'toggleNotificationPopup', 'updatePublicVideo', 'uploadMimeAllowed'];
const intentionallyDifferentBodies = [
  'appLogoMarkup', 'applyAppIcon', 'boot', 'buildRoleNav', 'configAssetSources', 'initializeAfterLogin', 'renderLogin',
  'getDocumentMaxSizeMb', 'hydrateSplashLogo', 'movePublicVideo', 'openDocumentUpload',
  'playPublicVideo', 'renderApp', 'renderPublicHome', 'renderApplicants', 'renderRegistrationList', 'renderVerificationList', 'renderWaliVerificationStatus', 'statusLabel', 'submitDocumentUpload', 'submitLogin', 'submitPaymentUpload'
];

function extractFunctionBodies(source) {
  const functions = new Map();
  const declaration = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = declaration.exec(source))) {
    const name = match[1], start = match.index;
    const open = source.indexOf('{', declaration.lastIndex);
    if (open < 0) continue;
    let depth = 0, quote = '', escaped = false, lineComment = false, blockComment = false, regex = false, regexClass = false, regexEscaped = false, end = -1;
    for (let i = open; i < source.length; i++) {
      const char = source[i], next = source[i + 1];
      if (lineComment) { if (char === String.fromCharCode(10)) lineComment = false; continue; }
      if (blockComment) { if (char === '*' && next === '/') { blockComment = false; i++; } continue; }
      if (regex) {
        if (regexEscaped) { regexEscaped = false; continue; }
        if (char === String.fromCharCode(92)) { regexEscaped = true; continue; }
        if (char === '[') regexClass = true;
        else if (char === ']') regexClass = false;
        else if (char === '/' && !regexClass) regex = false;
        continue;
      }
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (char === String.fromCharCode(92)) { escaped = true; continue; }
        if (char === quote) quote = '';
        continue;
      }
      if (char === '/' && next === '/') { lineComment = true; i++; continue; }
      if (char === '/' && next === '*') { blockComment = true; i++; continue; }
      if (char === '/') {
        const previous = source.slice(0, i).trimEnd().slice(-1);
        if (!previous || '=(:,[!&|?{};'.includes(previous)) { regex = true; regexClass = false; regexEscaped = false; continue; }
      }
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

for (const [label, source] of [['Apps Script', appsSource], ['PWA', pwaSource]]) {
  assert.ok(source.includes('placeholder="Masukkan username, nomor HP, atau email"'),
    label + ' login must use a neutral production placeholder');
  assert.ok(!/placeholder="[^"]*Superadmin/i.test(source),
    label + ' login must not suggest a built-in Superadmin username');
  const homeStart = source.indexOf('async function renderHome(');
  const homeEnd = source.indexOf('\nfunction waliFlowAction', homeStart);
  assert.ok(homeEnd > homeStart, label + ' dashboard renderer boundary exists');
  assert.doesNotMatch(source.slice(homeStart, homeEnd), /RELEASE_STAGE|APP_VERSION|30\\.14/,
    label + ' dashboard must not show internal production/version labels');
  assert.ok(!/Stage\s*\d+/.test(source.slice(source.indexOf('function renderMore'), source.indexOf('function hasAnyRole'))),
    label + ' user-facing More menu must not expose internal stage numbers');
  assert.ok(!source.includes('<span class="pill"></span>'),
    label + ' must not render empty metadata badges');
}

console.log('UI function parity safeguards: OK (' + apps.size + ' Apps Script, ' + pwa.size +
  ' PWA functions; ' + intentionallyDifferentBodies.length + ' reviewed intentional differences)');
