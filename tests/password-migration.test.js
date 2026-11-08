'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');

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

// Reference vectors prove the intended legacy and PBKDF2 formats are distinct.
for (const [password, salt] of [
  ['password', 'salt'],
  ['PSB-2027', '0123456789abcdef0123456789abcdef'],
  ['pässwörd🔐', 'salt-unik-123']
]) {
  assert.match(legacy(password, salt), /^[a-f0-9]{64}$/);
  assert.match(pbkdf2(password, salt, 60000), /^[a-f0-9]{64}$/);
  assert.notEqual(legacy(password, salt), pbkdf2(password, salt, 60000));
}

assert.match(source, /const PSB_PASSWORD_HASH_SCHEME_ = 'pbkdf2_sha256'/);
assert.match(source, /const PSB_PASSWORD_HASH_ITERATIONS_ = 60000/);
assert.match(source, /const PSB_PASSWORD_HASH_MIN_ITERATIONS_ = 10000/);
assert.match(source, /const PSB_PASSWORD_HASH_MAX_ITERATIONS_ = 250000/);

const hash = section('hashPassword_');
assert.match(hash, /pbkdf2Sha256Hex_\(String\(password\), String\(salt\), iterations\)/);
assert.match(hash, /PSB_PASSWORD_HASH_SCHEME_ \+ '\$' \+ iterations \+ '\$' \+ derived/);
assert.doesNotMatch(hash, /sha256Hex_/,
  'New passwords must never use the legacy single-round SHA-256 format');

const pbkdf2Helper = section('pbkdf2Sha256Hex_');
assert.match(pbkdf2Helper, /hmacSha256Prepared_\(innerState,outerState,firstBlock\)/);
assert.match(pbkdf2Helper, /sha256Compress_/);
assert.doesNotMatch(pbkdf2Helper, /Utilities\.computeHmacSha256Signature/,
  'PBKDF2 must avoid a Utilities service call on each iteration');
assert.match(pbkdf2Helper, /for\(let iteration=1;iteration<iterations;iteration\+\+\)/);

// Execute the production derivation with UTF-8 byte conversion and compare it
// to Node's PBKDF2 implementation, including Unicode and long HMAC keys.
const cryptoSource = source.slice(
  source.indexOf('const PSB_SHA256_INITIAL_ ='),
  source.indexOf('\nfunction upgradePasswordHashAfterLogin_')
);
const cryptoContext = {
  Utilities: {
    newBlob(value) {
      return {getBytes: () => Array.from(Buffer.from(String(value), 'utf8'))};
    }
  }
};
vm.runInNewContext(cryptoSource + '\nglobalThis.derivePasswordHash = pbkdf2Sha256Hex_;', cryptoContext);
for (const [password, salt, iterations] of [
  ['password', 'salt', 1],
  ['password', 'salt', 2],
  ['PSB-2027', '0123456789abcdef0123456789abcdef', 60000],
  ['pässwörd🔐', 'salt-unik-123', 60000],
  ['x'.repeat(100), 'long-key-salt', 17]
]) {
  const expected = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  assert.equal(cryptoContext.derivePasswordHash(password, salt, iterations), expected,
    'V8 PBKDF2 output must match standard PBKDF2-HMAC-SHA256');
}

const verify = section('verifyPasswordForUser_');
assert.match(verify, /pbkdf2Sha256Hex_\(/, 'PBKDF2 hashes must be verified');
assert.match(verify, /needsUpgrade: valid && iterations < PSB_PASSWORD_HASH_ITERATIONS_/,
  'Only valid PBKDF2 hashes below the current work factor may be upgraded');
assert.match(verify, /const legacy = sha256Hex_\(String\(password\) \+ salt\)/);
assert.match(verify, /return \{ valid: valid, needsUpgrade: valid \}/,
  'Valid legacy SHA-256 accounts must be upgraded after successful login');

const upgrade = section('upgradePasswordHashAfterLogin_');
assert.match(upgrade, /hashPassword_\(String\(password\), salt\)/);
assert.match(upgrade, /current\.passwordHash !== verifiedUser\.passwordHash/);
assert.match(upgrade, /current\.passwordSalt !== verifiedUser\.passwordSalt/);
assert.match(upgrade, /sheet\.getRange\(current\.rowNumber, 7, 1, 2\)\.setValues\(\[\[hash, salt\]\]\)/);
assert.match(upgrade, /confirmed\.passwordHash !== hash/);
assert.match(upgrade, /confirmed\.passwordSalt !== salt/);
assert.match(source, /upgradePasswordHashAfterLogin_\(user, password\)/);
assert.doesNotMatch(source, /migratePbkdf2PasswordToLegacySha256AfterLogin_/,
  'The insecure PBKDF2-to-SHA downgrade path must be removed');

const login = section('login');
assert.match(login, /passwordHashUpgrade/);
assert.match(login, /upgradePasswordHashAfterLogin_\(user, password\)/);
assert.match(login, /verifyPasswordForUser_\(password,refreshedUser\)\.valid/,
  'Login must re-read and verify the current hash before issuing a session');

for (const name of ['registerWali', 'changePassword', 'adminResetUserPassword', 'createManualUser']) {
  assert.match(section(name), /hashPassword_\(/, name + ' uses PBKDF2 for new passwords');
}
assert.match(section('configureInitialSuperadmin_', setup), /hashPassword_\(secret, salt\)/);

// Expensive password derivation must remain outside the global ScriptLock.
for (const name of ['registerWali', 'createManualUser', 'adminResetUserPassword', 'changePassword']) {
  const body = section(name);
  assert.ok(body.indexOf('hashPassword_(') < body.indexOf('LockService.getScriptLock()'),
    name + ' derives PBKDF2 before acquiring ScriptLock');
}
assert.ok(upgrade.indexOf('hashPassword_(') < upgrade.indexOf('lock.waitLock(20000)'),
  'Legacy hash upgrade must derive PBKDF2 before acquiring ScriptLock');

console.log('PBKDF2 password hashing, legacy SHA-256 compatibility, safe hash upgrades, and lock-scope safeguards passed.');
