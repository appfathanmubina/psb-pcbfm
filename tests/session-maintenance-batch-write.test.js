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

for (const name of ['revokeOtherSessionsForUser_', 'cleanupPSBSessions_']) {
  const body = functionSource(name);
  assert.match(body, /statusValues\s*=\s*rows\.map\(row\s*=>\s*\[row\[6\]\]\)/,
    name + ' must preserve existing session states in a batch buffer');
  assert.match(body, /statusValues\[[^\]]+\]\[0\]\s*=\s*['"](?:REVOKED|EXPIRED|IDLE_TIMEOUT)['"]/,
    name + ' must update statuses in memory before writing');
  assert.match(body, /getRange\(2,7,statusValues\.length,1\)\.setValues\(statusValues\)/,
    name + ' must batch-write the session status column');
  assert.doesNotMatch(body, /getRange\([^\n]*\)\.setValue\(/,
    name + ' must not perform per-row status writes');
}

console.log('Session maintenance batch-write safeguards passed.');
