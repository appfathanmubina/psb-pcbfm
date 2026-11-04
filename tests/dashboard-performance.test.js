'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('frontend/app.js', 'utf8');
const index = fs.readFileSync('apps-script/Index.html', 'utf8');
const code = fs.readFileSync('apps-script/Code.gs', 'utf8');

const backendStart = code.indexOf('function getDashboardPageData(');
const backendEnd = code.indexOf('\nfunction findParticipantRegistration_', backendStart);
assert.notEqual(backendStart, -1, 'Dashboard backend exists');
assert.ok(backendEnd > backendStart, 'Dashboard backend boundary exists');
const dashboard = code.slice(backendStart, backendEnd);
assert.match(dashboard, /const periodRegMap = \{\}/,
  'Dashboard must index active registrations by ID once');
assert.match(dashboard, /const latestPaymentByBill = \{\}/,
  'Dashboard must index latest payment per bill once');
assert.match(dashboard, /periodRegMap\[String\(b\.registrationId/,
  'Payment tasks must use the registration index');
assert.doesNotMatch(dashboard, /periodRegs\.find\(/,
  'Dashboard task mapping must not rescan registrations for each item');
assert.doesNotMatch(dashboard, /periodPayments\.filter\(/,
  'Dashboard must not rescan and sort payments for each bill');

for (const [source, label] of [[app, 'PWA'], [index, 'Apps Script']]) {
  const start = source.indexOf('async function renderHome(');
  const end = source.indexOf('\nfunction waliFlowAction', start);
  assert.notEqual(start, -1, label + ' dashboard renderer exists');
  assert.ok(end > start, label + ' dashboard renderer boundary exists');
  const home = source.slice(start, end);
  assert.doesNotMatch(home, /RELEASE_STAGE|APP_VERSION|30\.14/,
    label + ' dashboard must not show internal production/version labels');
  assert.match(source, /function scheduleWarmNavigationData\(/,
    label + ' must schedule noncritical menu prefetch');
  assert.match(source, /requestIdleCallback/,
    label + ' menu prefetch must use browser idle time');
  assert.match(source, /state\.page!=='home'\|\|!state\.token|state\.page!=='home' \|\| !state\.token/,
    label + ' menu prefetch must stop when the user navigates away');
}

console.log('PSB dashboard performance and final UI safeguards: OK');
