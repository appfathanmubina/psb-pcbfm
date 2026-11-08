'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');

function section(source, start, end, label) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, label + ' start exists');
  const b = source.indexOf(end, a + start.length);
  assert.ok(b > a, label + ' boundary exists');
  return source.slice(a, b);
}

const helper = section(backend, 'function dispatchPaymentSubmissionNotifications_(', '\nfunction submitPayment(', 'Payment submission notification dispatcher');
assert.match(helper, /findRowById_\([\s\S]*?'paymentId'/);
assert.match(helper, /PAYMENT_SUBMISSION:\s*'\+String\(payment\.paymentId\)/);
assert.match(helper, /notifyUsersByRolesOnce_\(\['SUPERADMIN','ADMIN_PSB','KEUANGAN'\]/);
assert.match(helper, /createNotificationOnce_\(String\(registrationFound\.registration\.userId\)/);
assert.match(helper, /actorRole[\s\S]*?WALI/);

const submit = section(backend, 'function submitPayment(sessionToken,payload){', '\nfunction verifyPayment(sessionToken,payload){', 'Payment submission');
assert.match(submit, /let billId='';[\s\S]*?let bills=null;/,
  'Catch recovery must retain bill and sheet references outside the try block');
assert.match(submit, /const existingPayment=existingRows\.find/);
assert.match(submit, /existingPayment\.registrationId[\s\S]*?br\.object\.registrationId/);
assert.match(submit, /lock\.releaseLock\(\);\s*lockAcquired=false;\s*try\s*\{\s*dispatchPaymentSubmissionNotifications_\(existingPaymentId,actor\.role\)/,
  'Duplicate retry must release the lock before recovering notification delivery');
assert.match(submit, /dispatchPaymentSubmissionNotifications_\(paymentId,actor\.role\)/,
  'Normal submission must use event-keyed notification recovery');
assert.match(submit, /finally\s*\{\s*if\(lockAcquired\)\{try\{lock\.releaseLock\(\);lockAcquired=false;/,
  'Partial-commit recovery must release any reacquired lock before notification delivery');
assert.match(submit, /dispatchPaymentSubmissionNotifications_\(savedPayment\?\.paymentId,actor\.role\)/,
  'Persisted payment catch path must attempt notification recovery');
assert.match(submit, /PAYMENT_SUBMISSION:\s*|dispatchPaymentSubmissionNotifications_/);

console.log('Payment submission notification recovery safeguards: OK');
