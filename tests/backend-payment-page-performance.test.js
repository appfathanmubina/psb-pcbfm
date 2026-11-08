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
assert.match(queue, /const billFields = query/,
  'Queue must select the smallest bill projection needed for the active global filters');
assert.match(queue, /sheetRowsByFields_\(billSheet, billFields\)/,
  'Queue must use the conditional narrow bill projection');
assert.match(queue, /: \['billId','registrationId','status','amount','createdAt'\]/,
  'Unfiltered queue requests must include bill identity, registration and amount for ledger reconciliation');
assert.match(queue, /sheetRowsByFields_\(ss\.getSheetByName\(PSB_SHEETS\.REGISTRATIONS\)/,
  'Global search must index registration number and candidate ID without loading full registration rows');
assert.match(queue, /sheetRowsByFields_\(ss\.getSheetByName\(PSB_SHEETS\.CANDIDATES\)/,
  'Global search must index candidate names using a narrow projection');
assert.match(queue, /sheetRowsMatchingValuesByFields_\(ss\.getSheetByName\(PSB_SHEETS\.PAYMENTS\),'billId'/,
  'Global status filtering must reconcile all payment attempts against the exact bill IDs');
assert.match(queue, /\.filter\(item=>[\s\S]*statusFilter[\s\S]*query/,
  'Status and search filters must be applied before pagination');
assert.match(queue, /const pageItems = indexed\.slice/,
  'Pagination must operate on the globally filtered result set');
assert.match(queue, /sheetRowsAtRowNumbers_\(billSheet,pageBillRefs\.map\(x=>x\.rowNumber\)\)/,
  'Queue must fetch full bill rows only for the requested page');
assert.doesNotMatch(queue, /sheetRowsByFields_\(billSheet,\s*\['billId','registrationId','paymentTypeId','amount','dueDate','status','createdAt'\]\)/,
  'Queue must not project every bill field across the full sheet');
assert.match(queue, /pageSize = 50/,
  'Queue must return a bounded page size');
assert.match(queue, /sheetRowsMatchingValuesByFields_\(/,
  'Queue must batch-load only related registration, payment, candidate, and verification rows');
assert.doesNotMatch(queue, /findRegistration_\(/,
  'Queue must not perform per-row registration lookups');
assert.match(queue, /queueStatus/,
  'Queue must provide a normalized status for table filtering');


console.log('PSB payment page performance and ownership safeguards: OK');

// Staff queue authorization, bounded pagination, and batch-enrichment assertions are covered above.

const frontend = fs.readFileSync('frontend/app.js', 'utf8');
assert.match(frontend, /server\('getPaymentQueue',state\.token,state\.paymentQueuePage,filters\)/,
  'Frontend must send global search and status filters to the backend');
assert.match(frontend, /paymentQueueFilters:\{search:'',status:''\}/,
  'Queue filters must persist in frontend state across pagination');
assert.ok(frontend.includes("value=\"\u0024{esc(filters.search||'')}\""),
  'Search text must be restored when the queue page is re-rendered');
assert.match(frontend, /state\.paymentQueueSearchTimer=setTimeout/,
  'Search input must debounce global backend requests');
