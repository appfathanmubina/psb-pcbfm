'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const code = fs.readFileSync('apps-script/Code.gs', 'utf8');

function section(start, end, label) {
  const a = code.indexOf(start);
  assert.notEqual(a, -1, label + ' start exists');
  const b = code.indexOf(end, a + start.length);
  assert.ok(b > a, label + ' boundary exists');
  return code.slice(a, b);
}

const dispatcher = section(
  'function dispatchRegistrationSubmissionNotifications_(',
  '\nfunction submitRegistration(',
  'Registration submission notification dispatcher'
);
assert.match(dispatcher, /found\.registration\.status[\s\S]*?!==\s*'SUBMITTED'/);
assert.match(dispatcher, /REGISTRATION_SUBMISSION:/, 'Event identity must be stable per registration');
assert.match(dispatcher, /notifyUsersByRolesOnce_\([\s\S]*?\['SUPERADMIN','ADMIN_PSB','KEUANGAN'\]/);
assert.match(dispatcher, /createNotificationOnce_\([\s\S]*?found\.registration\.userId/);
assert.match(dispatcher, /staffNotificationError[\s\S]*?ownerNotificationError/,
  'Staff and Wali delivery failures must be isolated so one channel does not block the other');

const submit = section(
  'function submitRegistration(sessionToken, registrationId) {',
  '\n\nfunction validateRegistrationPayload_',
  'submitRegistration'
);
assert.match(submit, /latestStatus==='SUBMITTED'[\s\S]*?ensureFormBillForRegistration_[\s\S]*?shouldRecoverNotification=true/,
  'Already-submitted retry must ensure the bill and schedule notification recovery');
assert.match(submit, /statusIdx<0\)return fail_/,
  'Submission must not claim success when the registration status column is missing');
assert.match(submit, /sheet\.getRange\(row,statusIdx\+1\)\.setValue\('SUBMITTED'\)[\s\S]*?findRegistration_[\s\S]*?status\|\|''\)\.toUpperCase\(\)!=='SUBMITTED'/,
  'Persisted status must be read back before success');
assert.match(submit, /catch\(auditError\)[\s\S]*?Registration submission audit failed after confirmed save/,
  'Audit failure after confirmed registration commit must not turn success into failure');
assert.match(submit, /finally\s*\{\s*lock\.releaseLock\(\);\s*\}[\s\S]*?dispatchRegistrationSubmissionNotifications_\(registrationId\)/,
  'Notification recovery must run after ScriptLock release');
assert.match(submit, /shouldRecoverNotification=true[\s\S]*?dispatchRegistrationSubmissionNotifications_/,
  'Both new submissions and retry path must dispatch idempotently');

console.log('Registration submission notification recovery safeguards: OK');
