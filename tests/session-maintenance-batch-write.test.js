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

const revoke = functionSource('revokeOtherSessionsForUser_');
assert.match(revoke, /statusValues\s*=\s*rows\.map\(row\s*=>\s*\[row\[6\]\]\)/);
assert.match(revoke, /statusValues\[i\]\[0\]='REVOKED'/);
assert.match(revoke, /getRange\(2,7,statusValues\.length,1\)\.setValues\(statusValues\)/);
assert.doesNotMatch(revoke, /getRange\([^\n]*\)\.setValue\(/);

const cleanup = functionSource('cleanupPSBSessions_');
assert.match(cleanup, /statusValues\s*=\s*rows\.map\(row\s*=>\s*\[row\[6\]\]\)/);
assert.match(cleanup, /statusValues\[i\]\[0\]=next/);
assert.match(cleanup, /getRange\(2,7,statusValues\.length,1\)\.setValues\(statusValues\)/);
assert.doesNotMatch(cleanup, /getRange\([^\n]*\)\.setValue\(/);

console.log('Session maintenance batch-write safeguards passed.');
