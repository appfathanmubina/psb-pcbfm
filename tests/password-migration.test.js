'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
const setup = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');

function section(name, input = source) {
  const start = input.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' exists');
  const end = input.indexOf('\nfunction ', start + 1);
  return input.slice(start, end < 0 ? input.length : end);
}

const legacy = (password, salt) =>
  crypto.createHash('sha256').update(String(password) + String(salt), 'utf8').digest('hex');
const pbkdf2 = (password, salt, iterations) =>
  crypto.pbkdf2Sync(String(password), String(salt), iterations, 32, 'sha256').toString('hex');

// SHA-256 legacy reference vectors (the canonical PSB password format).
for (const [password, salt] of [
  ['password', 'salt'],
  ['PSB-2027', '0123456789abcdef0123456789abcdef'],
  ['pässwörd🔐', 'salt-unik-123']
]) {
  const expected = legacy(password, salt);
  assert.match(expected, /^[a-f0-9]{64}$/);
  assert.notEqual(expected, pbkdf2(password, salt, 60000));
}

assert.match(source, /const PSB_PASSWORD_HASH_SCHEME_ = 'pbkdf2_sha256'/);
assert.match(section('hashPassword_'), /sha256Hex_\(String\(password\) \+ String\(salt\)\)/);
assert.doesNotMatch(section('hashPassword_'), /pbkdf2Sha256Hex_/);
assert.match(section('pbkdf2Sha256Hex_'), /Utilities\.computeHmacSha256Signature/);
assert.match(section('pbkdf2Sha256Hex_'), /saltBytes\.concat\(\[0, 0, 0, 1\]\)/);

const verify = section('verifyPasswordForUser_');
assert.match(verify, /pbkdf2Sha256Hex_\(/, 'Existing PBKDF2 hashes remain verifiable');
assert.match(verify, /const legacy = sha256Hex_\(String\(password\) \+ salt\)/);
assert.match(verify, /constantTimeEqual_/);
assert.match(verify, /return \{ valid: valid, needsUpgrade: valid \}/,
  'Valid PBKDF2 hashes are eligible for migration back to SHA');
assert.match(verify, /return \{ valid: constantTimeEqual_\(legacy, stored\.toLowerCase\(\)\), needsUpgrade: false \}/,
  'SHA hashes authenticate directly without migration');

const migration = section('migratePbkdf2PasswordToLegacySha256AfterLogin_');
assert.match(migration, /hashPassword_\(String\(password\), salt\)/);
assert.match(migration, /current\.passwordHash !== verifiedUser\.passwordHash/);
assert.match(migration, /current\.passwordSalt !== verifiedUser\.passwordSalt/);
assert.match(source, /migratePbkdf2PasswordToLegacySha256AfterLogin_\(user, password\)/);
assert.doesNotMatch(source, /migrateLegacyPasswordToPbkdf2AfterLogin_/);
assert.match(section('login'), /Login tetap dilanjutkan/);
assert.doesNotMatch(section('login'), /migration_failed/);

for (const name of ['registerWali', 'changePassword', 'adminResetUserPassword', 'createManualUser']) {
  assert.match(section(name), /hashPassword_\(/, name + ' uses the canonical SHA-256 helper');
}
assert.match(section('configureInitialSuperadmin_', setup), /hashPassword_\(secret, salt\)/);

// Password hashing remains outside the global lock in mutation flows.
for (const name of ['registerWali', 'createManualUser', 'adminResetUserPassword', 'changePassword']) {
  const body = section(name);
  assert.ok(body.indexOf('hashPassword_(') < body.indexOf('LockService.getScriptLock()'),
    name + ' derives the hash before acquiring ScriptLock');
}

console.log('SHA-256 canonical password hashing, PBKDF2 compatibility migration, and lock-scope safeguards passed.');
