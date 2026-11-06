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

// Reference vectors cover ASCII and UTF-8 passwords.
for (const [password, salt] of [
  ['password', 'salt'],
  ['PSB-2027', '0123456789abcdef0123456789abcdef'],
  ['pässwörd🔐', 'salt-unik-123']
]) {
  const expected = pbkdf2(password, salt, 60000);
  assert.match(expected, /^[a-f0-9]{64}$/);
  assert.notEqual(expected, legacy(password, salt));
}

assert.match(source, /const PSB_PASSWORD_HASH_SCHEME_ = 'pbkdf2_sha256'/);
assert.match(source, /const PSB_PASSWORD_HASH_ITERATIONS_ = 60000/);
assert.match(section('hashPassword_'), /pbkdf2Sha256Hex_/);
assert.match(section('hashPassword_'), /PSB_PASSWORD_HASH_SCHEME_/);
assert.match(section('pbkdf2Sha256Hex_'), /Utilities\.computeHmacSha256Signature/);
assert.match(section('pbkdf2Sha256Hex_'), /saltBytes\.concat\(\[0, 0, 0, 1\]\)/);

const verify = section('verifyPasswordForUser_');
assert.match(verify, /pbkdf2Sha256Hex_\(/);
assert.match(verify, /needsUpgrade: valid && iterations !== PSB_PASSWORD_HASH_ITERATIONS_/);
assert.match(verify, /const legacy = sha256Hex_\(String\(password\) \+ salt\)/);
assert.match(verify, /return \{ valid: valid, needsUpgrade: valid \}/);
assert.match(verify, /constantTimeEqual_/);

const migration = section('migrateLegacyPasswordToPbkdf2AfterLogin_');
assert.match(migration, /hashPassword_\(String\(password\), salt\)/);
assert.match(migration, /current\.passwordHash !== verifiedUser\.passwordHash/);
assert.match(migration, /current\.passwordSalt !== verifiedUser\.passwordSalt/);
assert.match(source, /migrateLegacyPasswordToPbkdf2AfterLogin_\(user, password\)/);
assert.doesNotMatch(source, /migratePbkdf2PasswordToLegacySha256AfterLogin_/);

for (const name of ['registerWali', 'changePassword', 'adminResetUserPassword', 'createManualUser']) {
  assert.match(section(name), /hashPassword_\(/, name + ' uses the shared PBKDF2 helper');
}
assert.match(section('configureInitialSuperadmin_', setup), /hashPassword_\(secret, salt\)/);

// Do not hold the global ScriptLock while computing the expensive PBKDF2 hash.
for (const name of ['registerWali', 'createManualUser', 'adminResetUserPassword', 'changePassword']) {
  const body = section(name);
  assert.ok(body.indexOf('hashPassword_(') < body.indexOf('LockService.getScriptLock()'),
    name + ' derives the hash before acquiring ScriptLock');
}

console.log('PBKDF2 password hashing, legacy compatibility, migration, and lock-scope safeguards passed.');
