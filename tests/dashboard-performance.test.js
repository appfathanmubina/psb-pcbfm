'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('frontend/app.js', 'utf8');
const index = fs.readFileSync('apps-script/Index.html', 'utf8');
const code = fs.readFileSync('apps-script/Code.gs', 'utf8');

function functionSource(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Required function exists: ' + name);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}
function asyncFunctionSource(source, name) {
  const start = source.indexOf('async function ' + name + '(');
  assert.notEqual(start, -1, 'Required async function exists: ' + name);
  const next = source.indexOf('\n(?:async )?function ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}

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
  const home = asyncFunctionSource(source, 'renderHome');
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
