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

const verify = section(
  backend,
  'function verifyPayment(sessionToken,payload){',
  '\nfunction ',
  'Payment verification'
);

assert.match(verify, /if\(!reregistrationNotification\|\|reregistrationNotification\.success!==true\)/,
  'Payment verification must require an explicit successful re-registration synchronization result');
assert.ok(verify.indexOf("otherVerifiedPayment=sheetRowsMatchingValues_") < verify.indexOf("const verSheet="),
  'A second payment for an already-paid bill must be rejected before verification history writes');
assert.match(verify, /\['VERIFIED','PAYMENT_VERIFIED'\]\.includes\(String\(reg\.registration\.status\|\|''\)\.toUpperCase\(\)\)/,
  'A retry must repair registration metadata even when the status transition already committed');
assert.ok(
  verify.indexOf('const confirmedBill=findRowById_') <
  verify.indexOf('sheet.getRange(found.rowNumber,paymentStatusIdx+1).setValue(status)'),
  'PAYMENTS.status must be committed only after the linked bill is confirmed'
);
assert.match(verify, /const verified=findRowById_\(sheet,'paymentId',paymentId\)/,
  'The final payment status must still be re-read and confirmed');
assert.match(verify, /otherBillPayments=sheetRowsMatchingValues_\(sheet,'billId',\[String\(found\.object\.billId\|\|''\)\]\)/,
  'A rejection retry must re-read all payments for the linked bill under ScriptLock');
assert.match(verify, /newerVerifiedPayment=otherBillPayments\.find/,
  'A newer verified payment must preserve the PAID bill state');
assert.match(verify, /newerSubmittedPayment=otherBillPayments\.find/,
  'A newer submitted payment must preserve or repair PAYMENT_REVIEW');
assert.match(verify, /expectedBillStatus='PAYMENT_REVIEW'/,
  'A pending newer proof must prevent a rejection retry from downgrading the bill to UNPAID');
assert.match(verify, /if\(currentBillStatus!==expectedBillStatus\)bills\.getRange/,
  'The linked bill must be repaired only to the state supported by other active payments');
assert.match(verify, /if\(String\(br\.object\.status\|\|''\)\.toUpperCase\(\)==='CANCELLED'\)/,
  'A cancelled bill must block verification before any verification history is written');

assert.match(verify, /notificationPayload=\{registrationId:String\(regFound\.registration\.registrationId\),userId:String\(regFound\.registration\.userId\|\|''\)/,
  'A same-decision payment retry must rebuild the owner notification from the persisted registration');
assert.doesNotMatch(verify, /if\(!wasAlreadyFinalized\)notificationPayload=/,
  'An already-finalized payment must not skip notification recovery');
assert.match(verify, /note:String\(confirmedHistory\.note\|\|''\)/,
  'A retry must use the durable verification-history note rather than changed retry input');
assert.match(verify, /createNotificationOnce_\(p\.userId,'Pembayaran '/,
  'Payment owner notification recovery must be idempotent');
assert.match(verify, /notifyUsersByRolesOnce_\(\['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'\]/,
  'Formulir verification queue notifications must be idempotent on retry');
assert.ok(verify.indexOf("status||'').toUpperCase()==='CANCELLED'") < verify.indexOf('const verSheet='),
  'Cancelled-bill guard must run before verification history writes');

const queue = section(
  backend,
  'function getPaymentQueue(sessionToken, page, filters) {',
  '\nfunction ',
  'Payment queue'
);
assert.match(queue, /paymentLedgerForQueue\.byBill/);
assert.match(queue, /reconcilePaymentLedger_\(activeBillRefs,paymentsForStatus\)/,
  'Queue status must be derived from all bill-linked payments and their registration/amount matches');

const submit = section(
  backend,
  'function submitPayment(sessionToken,payload){',
  '\nfunction verifyPayment(sessionToken,payload){',
  'Payment submission'
);
assert.match(submit, /\['SUBMITTED','VERIFIED'\]\.indexOf\(String\(r\.status\|\|''\)\.toUpperCase\(\)\)>=0/,
  'Rejected payment records must not block a new upload for the same bill');

const render = section(
  frontend,
  'function renderPaymentContent(){',
  '\nfunction openPaymentUpload(billId)',
  'Payment renderer'
);
assert.ok(render.includes("p?.status==='REJECTED'&&p?.verificationNote"),
  'The Wali must see the rejection reason');
assert.match(render, /p\?\.status==='SUBMITTED'\?'PAYMENT_REVIEW'/,
  'A submitted payment must remain in review even if the bill write already says PAID');
assert.match(render, /isWali&&!b\.reconciliationRequired&&p\?\.status!=='SUBMITTED'&&st!=='PAID'/,
  'The Wali must not be able to upload a duplicate proof while verification is pending');
assert.match(render, /isWali&&!b\.reconciliationRequired&&p\?\.status!=='SUBMITTED'&&st!=='PAID'&&\(!p\|\|p\.status==='REJECTED'\)/,
  'The Wali must be able to upload again after rejection without allowing duplicate uploads while pending');

console.log('Payment verification and rejection recovery safeguards: OK');
