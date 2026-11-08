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
  'Payment verification must require an explicit successful re-registration synchronization result');assert.ok(
  verify.indexOf('const confirmedBill=findRowById_') <
  verify.indexOf('sheet.getRange(found.rowNumber,paymentStatusIdx+1).setValue(status)'),
  'PAYMENTS.status must be committed only after the linked bill is confirmed'
);
assert.match(verify, /const verified=findRowById_\(sheet,'paymentId',paymentId\)/,
  'The final payment status must still be re-read and confirmed');
assert.match(verify, /if\(status==='REJECTED'&&currentBillStatus==='PAID'\)/,
  'A repeated rejection must detect a bill that has already become PAID');
assert.match(verify, /newerVerifiedPayment=sheetRowsMatchingValues_\(sheet,'billId',\[String\(found\.object\.billId\|\|''\)\]\)/,
  'A paid bill must be associated with a different verified payment before preserving it');
assert.match(verify, /if\(!preservePaidBill\)bills\.getRange\(br\.rowNumber,billStatusIdx\+1\)\.setValue\(targetBillStatus\)/,
  'A rejection retry must never write UNPAID over a bill preserved as PAID');
assert.match(verify, /expectedBillStatus=preservePaidBill\?'PAID':targetBillStatus/,
  'The bill read-back must confirm PAID when a newer payment has been verified');

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
assert.match(render, /isWali&&st!=='PAID'&&\(!p\|\|p\.status==='REJECTED'\)/,
  'The Wali must be able to upload again after rejection');

console.log('Payment verification and rejection recovery safeguards: OK');
