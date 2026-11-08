'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const frontend = fs.readFileSync('frontend/app.js', 'utf8');

function section(source, start, end, label) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, label + ' start exists');
  const b = source.indexOf(end, a + start.length);
  assert.ok(b > a, label + ' boundary exists');
  return source.slice(a, b);
}

const submit = section(
  backend,
  'function submitPayment(sessionToken,payload){',
  '\nfunction verifyPayment(sessionToken,payload){',
  'Payment submission'
);
assert.match(submit, /paymentRowWritten\s*=\s*true/);
assert.match(submit, /if\(paymentRowWritten\)\s*\{[\s\S]*?findRowById_\(bills,'billId',billId\)/,
  'A persisted payment row must trigger a fresh bill lookup during recovery');
assert.match(submit, /if\(!lockAcquired\)\{lock\.waitLock\(10000\);lockAcquired=true;\}/,
  'Bill status recovery must be protected by the existing ScriptLock');
assert.match(submit, /latestBill\.object\.status\|\|''\)\.toUpperCase\(\)!=='PAID'/,
  'Recovery must never downgrade a bill already marked paid');
assert.match(submit, /setValue\('PAYMENT_REVIEW'\)[\s\S]*?BILL_STATUS_RECOVERY_NOT_CONFIRMED/,
  'Recovery must write and verify PAYMENT_REVIEW');
assert.match(submit, /PSB_PAYMENT_BILL_STATUS_RECOVERY_FAILED/,
  'Recovery failure must be logged without losing the committed payment response');

const dashboard = section(
  backend,
  'function getDashboardPageData(sessionToken) {',
  '\nfunction findParticipantRegistration_',
  'Dashboard'
);
assert.match(dashboard, /reconcilePaymentLedger_\(periodBills,periodPayments\)/);
assert.match(dashboard, /state\.status==='WAITING'/,
  'Dashboard payment summary must count a persisted SUBMITTED payment as awaiting review even when bill status is PAID');
assert.match(dashboard, /state\?\.status==='WAITING'\|\|state\?\.requiresReview/,
  'Dashboard verification queue must include submitted and inconsistent bill/payment states');

const render = section(frontend, 'function renderPaymentContent(){', '\nfunction openPaymentUpload(billId)', 'Payment renderer');
assert.match(render, /displayStatus=p\?\.status==='SUBMITTED'\?'PAYMENT_REVIEW':b\.reconciliationRequired\?'RECONCILIATION_REQUIRED'/,
  'Wali payment UI must display a submitted proof as awaiting verification before showing a bill-level reconciliation warning');
assert.match(render, /isWali&&p\?\.status!=='SUBMITTED'&&st!=='PAID'&&\(!p\|\|p\.status==='REJECTED'\)/,
  'Wali must not be offered another upload while a proof is submitted or verified');

console.log('Payment partial-commit recovery safeguards: OK');
