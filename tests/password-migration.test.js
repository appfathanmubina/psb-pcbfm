'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
const setup = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');

function legacySha256(password, salt) {
  return crypto.createHash('sha256').update(String(password) + String(salt), 'utf8').digest('hex');
}

// Confirm the original PSB format and UTF-8 handling against Node SHA-256.
for (const [password, salt] of [
  ['password', 'salt'],
  ['PSB-2027', '0123456789abcdef0123456789abcdef'],
  ['pässwörd🔐', 'salt-unik-123']
]) {
  const expected = crypto.createHash('sha256').update(password + salt, 'utf8').digest('hex');
  assert.equal(legacySha256(password, salt), expected);
}

assert.match(source, /function hashPassword_\(password, salt\)\s*\{\s*return sha256Hex_\(String\(password\) \+ String\(salt\)\);/);
assert.match(source, /function sha256Hex_\(value\)/);
assert.match(source, /function verifyPasswordForUser_\(/);
assert.match(source, /const legacy = sha256Hex_\(String\(password\) \+ salt\)/);
assert.match(source, /needsUpgrade: false/);
assert.match(source, /function migratePbkdf2PasswordToLegacySha256AfterLogin_\(/);
assert.match(source, /migratePbkdf2PasswordToLegacySha256AfterLogin_\(user, password\)/);
assert.match(source, /pbkdf2Sha256Hex_\(String\(password\), salt, iterations\)/);
assert.match(setup, /hashPassword_\(secret, salt\)/);

// New account, change-password, and admin-reset paths must use the shared
// hashPassword_ helper, which now writes the original SHA-256 format.
for (const functionName of ['registerWali', 'changePassword', 'adminResetUserPassword', 'createManualUser']) {
  const start = source.indexOf('function ' + functionName + '(');
  assert.notEqual(start, -1, functionName + ' exists');
  const end = source.indexOf('\nfunction ', start + 1);
  const block = source.slice(start, end < 0 ? source.length : end);
  assert.match(block, /hashPassword_\(/, functionName + ' uses shared hashPassword_');
}

const changeStart = source.indexOf('function changePassword(');
const changeEnd = source.indexOf('\nfunction ', changeStart + 1);
assert.match(source.slice(changeStart, changeEnd), /const lock = LockService\.getScriptLock\(\)/);
const resetStart = source.indexOf('function adminResetUserPassword(');
const resetEnd = source.indexOf('\nfunction ', resetStart + 1);
assert.match(source.slice(resetStart, resetEnd), /const lock = LockService\.getScriptLock\(\)/);

console.log('Legacy SHA-256 password checks passed.');
