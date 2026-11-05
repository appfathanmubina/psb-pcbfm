'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
const setup = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');
const bridge = fs.readFileSync('frontend/api-bridge.js', 'utf8');

function legacySha256(password, salt) {
  return crypto.createHash('sha256').update(String(password) + String(salt), 'utf8').digest('hex');
}

// Confirm the original PSB format and UTF-8 handling.
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
assert.match(bridge, /const LOGIN_TIMEOUT_MS = 60000/);
assert.match(bridge, /item\.functionName === 'login' \? LOGIN_TIMEOUT_MS :\s*item\.functionName === 'uploadDocument' \? UPLOAD_TIMEOUT_MS : TIMEOUT_MS/);

// New account, password change, admin reset, and manual user creation use the shared helper.
for (const functionName of ['registerWali', 'changePassword', 'adminResetUserPassword', 'createManualUser']) {
  const start = source.indexOf('function ' + functionName + '(');
  assert.notEqual(start, -1, functionName + ' exists');
  const end = source.indexOf('\nfunction ', start + 1);
  const block = source.slice(start, end < 0 ? source.length : end);
  assert.match(block, /hashPassword_\(/, functionName + ' uses shared hashPassword_');
}

for (const functionName of ['changePassword', 'adminResetUserPassword']) {
  const start = source.indexOf('function ' + functionName + '(');
  const end = source.indexOf('\nfunction ', start + 1);
  assert.match(source.slice(start, end), /const lock = LockService\.getScriptLock\(\)/);
}

console.log('Legacy SHA-256 password checks passed.');
