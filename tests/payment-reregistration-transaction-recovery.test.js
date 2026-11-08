'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');

function section(start, end, label) {
  const a = backend.indexOf(start);
  assert.notEqual(a, -1, label + ' start exists');
  const b = backend.indexOf(end, a + start.length);
  assert.ok(b > a, label + ' boundary exists');
  return backend.slice(a, b);
}

const submitPayment = section(
  'function submitPayment(sessionToken,payload){',
  '\nfunction verifyPayment(sessionToken,payload){',
  'Payment upload'
);
const recheck = submitPayment.indexOf("stage='RECHECK_DUPLICATE_PAYMENT'");
const latestBill = submitPayment.indexOf("const latestBill=findRowById_(bills,'billId',billId)", recheck);
const duplicateCheck = submitPayment.indexOf("const latestRows=sheetRowsMatchingValues_(paymentSheet,'billId',[billId])", recheck);
const writePayment = submitPayment.indexOf("stage='WRITE_PAYMENT_RECORD'", recheck);
assert.ok(latestBill > recheck && duplicateCheck > latestBill && writePayment > duplicateCheck,
  'Payment upload must re-read the bill under the commit lock before writing the payment');
assert.match(submitPayment, /latestBillStatus==='PAID'/,
  'A bill paid during Drive upload must reject the late payment submission');
assert.match(submitPayment, /latestBillStatus==='CANCELLED'/,
  'A bill cancelled during Drive upload must reject the late payment submission');
assert.match(submitPayment, /amount:latestBillAmount/,
  'Payment amount must use the current bill amount, not the stale pre-upload snapshot');
assert.match(submitPayment, /bills\.getRange\(latestBill\.rowNumber,billStatusIdx\+1\)/,
  'Payment review state must update the re-read bill row');

const finalize = section(
  'function finalizeReregistration(sessionToken, registrationId) {',
  '\nfunction syncReregistrationAfterPayment_(',
  'Reregistration finalization'
);
assert.match(finalize, /const completedAtMissing=!rrFound\.object\.completedAt/);
assert.match(finalize, /if\(!rrCompleted\|\|completedAtMissing\)/,
  'A retry must repair a completed status whose timestamp was not committed');
assert.match(finalize, /if\(completedAtMissing\)rrSheet\.getRange\(rrFound\.rowNumber,completedIdx\+1\)\.setValue\(now\)/,
  'The missing completion timestamp must be written even when status is already COMPLETED');
assert.match(finalize, /rrReadback\.object\.completedAt/,
  'Completion status and timestamp must both be confirmed after repair');

const submitRegistration = section(
  'function submitRegistration(sessionToken, registrationId) {',
  '\nfunction ',
  'Registration submission'
);
assert.match(submitRegistration, /initialStatus!=='SUBMITTED'/,
  'An already-submitted registration must bypass the editable-only initial validation gate');
assert.match(submitRegistration, /if\(latestStatus==='SUBMITTED'\)[\s\S]*?alreadySubmitted:true/,
  'A repeated submit request must return idempotent success after confirming its form bill');
assert.ok(
  submitRegistration.indexOf('if(latestStatus===\'SUBMITTED\')') <
  submitRegistration.indexOf("sheet.getRange(row,statusIdx+1).setValue('SUBMITTED')"),
  'The idempotent retry path must not rewrite the registration status or resubmit notifications'
);

const verifyPayment = section(
  'function verifyPayment(sessionToken,payload){',
  '\nfunction getSelectionPageData(sessionToken, registrationId)',
  'Payment verification'
);
assert.match(verifyPayment, /if\(!reregistrationNotification\|\|reregistrationNotification\.success!==true\)/,
  'Daftar Ulang payment verification must stop unless synchronization returns explicit success');

console.log('Payment concurrency and partial-commit recovery safeguards: OK');
