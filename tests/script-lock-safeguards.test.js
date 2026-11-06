'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');

function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Missing function: ' + name);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

for (const [name, timeout] of [
  ['registerWali', 15000],
  ['changePassword', 20000],
  ['adminResetUserPassword', 20000],
  ['createManualUser', 10000],
  ['setActiveAcademicYear', 10000],
  ['saveMasterItem', 10000],
  ['verifyPayment', 10000],
  ['openReregistration', 10000],
  ['finalizeReregistration', 10000],
  ['verifyDocument', 10000],
  ['finalizeVerification', 10000],
  ['saveRegistration', 10000],
  ['submitRegistration', 10000]
]) {
  const body = functionSource(name);
  assert.match(body, new RegExp('try \\{ (?:lock|guard)\\.waitLock\\(' + timeout + '\\); \\} catch \\(lockError\\) \\{ return fail_\\('),
    name + ' must handle ScriptLock contention without leaking an uncaught timeout');
}

assert.match(functionSource('withScriptLock_'), /try \{ lock\.waitLock\(timeoutMs \|\| 10000\); \} catch \(lockError\) \{ return fail_\(/,
  'Shared ScriptLock helper must convert lock timeout into a safe API failure');
assert.match(functionSource('registerLoginFailure_'), /catch \(lockError\) \{ return \{ attempts: max, locked: true, contention: true \}; \}/,
  'Login failure counter must fail closed when its atomic lock is unavailable');
assert.match(functionSource('clearLoginFailure_'), /catch \(lockError\) \{ return false; \}/,
  'Login success must not fail just because the failure-counter lock is contended');

const activate = functionSource('setActiveAcademicYear');
assert.match(activate, /setValues\(activeValues\)/,
  'Academic-year activation must batch-write active flags');
assert.match(activate, /setValues\(updatedValues\)/,
  'Academic-year activation must batch-write timestamps');
assert.doesNotMatch(activate, /rows\.forEach\([\s\S]*?getRange\([^\n]*\.setValue\(/,
  'Academic-year activation must not perform one Spreadsheet write per row while holding the global lock');

console.log('ScriptLock timeout and batch-write safeguards passed.');

function assertNotificationAfterLockRelease(name, notificationPattern) {
  const body = functionSource(name);
  const release = Math.max(body.lastIndexOf('finally { lock.releaseLock(); }'), body.lastIndexOf('}finally{lock.releaseLock()}'));
  const notification = body.search(notificationPattern);
  assert.notEqual(release, -1, name + ' must explicitly release its ScriptLock');
  assert.ok(notification > release, name + ' must deliver notifications only after releasing ScriptLock');
}

for (const [name, pattern] of [
  ['verifyPayment', /notifyUsersByRoles_|notifyRegistrationOwner_|createNotification_/],
  ['addSelectionParticipantsBulk', /notifyRegistrationOwner_/],
  ['publishAnnouncement', /createNotification_/],
  ['openReregistration', /createNotification_/],
  ['finalizeReregistration', /createNotification_/],
  ['submitRegistration', /notifyUsersByRoles_|notifyRegistrationOwner_/]
]) {
  assertNotificationAfterLockRelease(name, pattern);
}

assert.match(functionSource('createBill'), /const result=withScriptLock_\([\s\S]*?\);\s*if\(result\?\.success[\s\S]*?notifyRegistrationOwner_/,
  'Manual bill notification must be delivered after the withScriptLock callback completes');
assert.match(functionSource('getPaymentPageData'), /ensureFormBillForRegistration_\(selected,paymentTypes,actor\.userId,true\)/,
  'Automatic bill creation from payment page must suppress notification inside the lock');
assert.match(functionSource('getPaymentPageData'), /if\(autoBillResult\?\.success && autoBillResult\.created\)[\s\S]*?notifyRegistrationOwner_/,
  'Automatic bill notification must run after the lock callback completes');
assert.match(functionSource('verifyPayment'), /syncReregistrationAfterPayment_\(String\(br\.object\.registrationId\),actor\.userId,true\)/,
  'Payment verification must defer reregistration-completion notification');
assert.match(functionSource('syncReregistrationAfterPayment_'), /if\(!deferNotification\)[\s\S]*?createNotification_/,
  'Reregistration sync helper must preserve direct notification behavior for non-locked callers');

console.log('ScriptLock notification fanout safeguards passed.');

