'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getPaymentPageData(');
const end = code.indexOf('\nfunction getPaymentsForRegistration(', start);
assert.notEqual(start, -1, 'Payment page backend exists');
assert.ok(end > start, 'Payment page backend boundary exists');

const page = code.slice(start, end);
assert.doesNotMatch(page, /findRegistration_\(/,
  'Payment page must not reread registration-related sheets for the selected registration');
assert.match(page, /registrationsById\[selected\]/,
  'Selected registration must come from the already-read registration rows');
assert.match(page, /canAccessRegistration_\(actor,selectedRegistration\)/,
  'Registration ownership/access must still be checked');
assert.match(page, /if \(isWali\) items = items\.filter\(x=>String\(x\.userId\)===String\(actor\.userId\)\)/,
  'Wali registration ownership filter must remain unchanged');
assert.match(page, /candidates: sheetMapById_\(/,
  'Candidate data must be preloaded once for registration enrichment');
assert.match(page, /years: sheetMapById_\(/,
  'Academic-year data must be preloaded once');
assert.match(page, /waves: sheetMapById_\(/,
  'Admission-wave data must be preloaded once');
assert.match(page, /levels: sheetMapById_\(/,
  'Education-level data must be preloaded once');
assert.equal((page.match(/getActiveMasterItems_\('MASTER_JENIS_PEMBAYARAN'\)/g) || []).length, 1,
  'Payment types must be loaded once per payment-page request');
assert.match(page, /buildPaymentData_\(selected,paymentTypes\)/,
  'Loaded payment types must be reused by payment-data construction');

const buildStart = code.indexOf('function buildPaymentData_(');
const buildEnd = code.indexOf('\nfunction ', buildStart + 10);
assert.ok(buildStart >= 0 && buildEnd > buildStart, 'Payment data helper exists');
const build = code.slice(buildStart, buildEnd);
assert.match(build, /paymentTypes \|\| getActiveMasterItems_\('MASTER_JENIS_PEMBAYARAN'\)/,
  'Other callers must retain the default payment-type lookup');

console.log('PSB payment page performance and ownership safeguards: OK');
