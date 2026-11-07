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

assert.match(verify, /if\(!verSheet\)return fail_\(/,
  'Verification must stop when the history sheet is missing');
assert.match(verify, /requiredVerificationHeaders=\['verificationId','paymentId','status','verifiedBy','verifiedAt','note'\]/,
  'All required history columns must be checked before writes');
assert.match(verify, /const conflicting=verificationRows\.find/,
  'A conflicting prior decision must block a second decision');
assert.match(verify, /if\(!verificationRows\.length\)[\s\S]*?verSheet\.appendRow[\s\S]*?verificationRows=sheetRowsMatchingValues_/,
  'A new history row must be re-read and confirmed; retries must reuse existing rows');
assert.ok(
  verify.indexOf('bills.getRange(br.rowNumber,billStatusIdx+1).setValue(targetBillStatus)') <
  verify.indexOf('const confirmedBill=findRowById_'),
  'The linked bill must be re-read after its status write'
);
assert.ok(verify.includes("if(!confirmedBill||String(confirmedBill.object.status||'').toUpperCase()!==targetBillStatus){"),
  'A bill status write that did not persist must stop finalization');
assert.match(verify, /if\(reregistrationNotification\?\.success===false\)return reregistrationNotification/,
  'A failed re-registration synchronization must propagate to the caller');
assert.ok(
  verify.indexOf('const confirmedBill=findRowById_') <
  verify.indexOf('sheet.getRange(found.rowNumber,paymentStatusIdx+1).setValue(status)'),
  'PAYMENTS.status must be committed only after the linked bill is confirmed'
);
assert.match(verify, /const verified=findRowById_\(sheet,'paymentId',paymentId\)/,
  'The final payment status must still be re-read and confirmed');

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
