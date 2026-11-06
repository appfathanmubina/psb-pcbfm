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
