'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getPaymentPageData(');
const end = code.indexOf('\nfunction getPaymentQueue(', start);
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

const queueStart = code.indexOf('function getPaymentQueue(');
const queueEnd = code.indexOf('\nfunction getPaymentsForRegistration(', queueStart);
assert.notEqual(queueStart, -1, 'Staff payment queue backend exists');
assert.ok(queueEnd > queueStart, 'Staff payment queue backend boundary exists');
const queue = code.slice(queueStart, queueEnd);
assert.match(queue, /requireRole_\(sessionToken, PSB_PAYMENT_MANAGE_ROLES\)/,
  'Only payment-managing staff roles may read the global payment queue');
assert.match(queue, /sheetRowsByFields_\(billSheet/,
  'Queue must project only required bill columns');
assert.match(queue, /pageSize = 50/,
  'Queue must return a bounded page size');
assert.match(queue, /sheetRowsMatchingValuesByFields_\(/,
  'Queue must batch-load only related registration, payment, candidate, and verification rows');
assert.doesNotMatch(queue, /findRegistration_\(/,
  'Queue must not perform per-row registration lookups');
assert.match(queue, /queueStatus/,
  'Queue must provide a normalized status for table filtering');


console.log('PSB payment page performance and ownership safeguards: OK');
