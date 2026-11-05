'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getMonitoringPageData(sessionToken){');
const end = code.indexOf('\nfunction ', start + 10);
assert.notEqual(start, -1, 'Monitoring page backend exists');
assert.ok(end > start, 'Monitoring page function boundary exists');
const page = code.slice(start, end);

assert.match(page, /requireRole_\(sessionToken,PSB_MONITORING_ROLES\)/,
  'Monitoring role gate must remain');
assert.ok(page.indexOf('requireRole_(') < page.indexOf('getDatabaseSpreadsheet_('),
  'Authorization must happen before database access');

const childSheets = [
  'DOCUMENTS', 'BILLS', 'PAYMENTS', 'SELECTION_PARTICIPANTS',
  'SELECTION_RESULTS', 'REREGISTRATIONS'
];
for (const sheet of childSheets) {
  const escaped = sheet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reads = page.match(new RegExp('sheetRows_\\(ss\\.getSheetByName\\(PSB_SHEETS\\.' + escaped + '\\)\\)', 'g')) || [];
  assert.equal(reads.length, 1, sheet + ' must be read exactly once and reused');
}
assert.match(page, /allChildRows\.DOCUMENTS\.filter/,
  'Active documents must be derived from the shared full-table read');
assert.match(page, /allChildRows\.BILLS\.filter/,
  'Active bills must be derived from the shared full-table read');
assert.match(page, /allChildRows\.PAYMENTS\.filter/,
  'Active payments must be derived from the shared full-table read');
assert.match(page, /allChildRows\.SELECTION_PARTICIPANTS\.filter/,
  'Active participants must be derived from the shared full-table read');
assert.match(page, /allChildRows\.SELECTION_RESULTS\.filter/,
  'Active results must be derived from the shared full-table read');
assert.match(page, /allChildRows\.REREGISTRATIONS\.filter/,
  'Active reregistrations must be derived from the shared full-table read');

assert.match(page, /paymentsByBill\[k\]\.push\(x\)/,
  'Payment rows must be grouped by bill once');
assert.match(page, /latestPaymentByBill\[k\]=x/,
  'Latest payment per bill must be indexed once');
assert.match(page, /verificationsByPayment\[k\]\.push\(x\)/,
  'Verification rows must be grouped by payment once');
assert.match(page, /const ps=paymentsByBill\[String\(b\.billId\)\]\|\|\[\]/,
  'Bill reconciliation must use the payment index');
assert.match(page, /const vs=verificationsByPayment\[String\(p\.paymentId\)\]\|\|\[\]/,
  'Duplicate verification detection must use the verification index');
assert.match(page, /const p=latestPaymentByBill\[String\(b\.billId\|\|''\)\]\|\|null/,
  'Payment queue must use precomputed latest payment');
assert.match(page, /const scheduleIds=\{\}/,
  'Schedule membership index must be built once');
assert.match(page, /if\(!scheduleIds\[String\(p\.scheduleId\)\]\)/,
  'Participant schedule checks must use the schedule index');
assert.match(page, /allChildRows\[sheet\]/,
  'Orphan checks must still inspect all child rows, not only active-year rows');
assert.match(page, /writeAudit_\(actor\.userId,'MONITORING_VIEW'/,
  'Monitoring audit event must remain');
assert.match(page, /PSB_INCIDENT_ROLES/,
  'Incident permission calculation must remain');
assert.doesNotMatch(page, /payments\.filter\(x=>String\(x\.billId\)/,
  'Payment queue must not filter all payments per bill');
assert.doesNotMatch(page, /verifications\.filter\(v=>String\(v\.paymentId\)/,
  'Reconciliation must not filter all verifications per payment');
assert.doesNotMatch(page, /schedules\.some\(/,
  'Participant schedule validation must not scan schedules per participant');

console.log('PSB monitoring page batch-read, indexing, and authorization safeguards: OK');
