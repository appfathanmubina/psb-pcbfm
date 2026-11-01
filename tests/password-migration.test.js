'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
const setup = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');

function appScriptStylePbkdf2(password, salt, iterations) {
  const key = Buffer.from(password, 'utf8');
  const saltBlock = Buffer.concat([Buffer.from(salt, 'utf8'), Buffer.from([0, 0, 0, 1])]);
  let u = crypto.createHmac('sha256', key).update(saltBlock).digest();
  const output = Buffer.from(u);
  for (let i = 1; i < iterations; i++) {
    u = crypto.createHmac('sha256', key).update(u).digest();
    for (let j = 0; j < output.length; j++) output[j] ^= u[j];
  }
  return output.toString('hex');
}

// Cross-check the byte/iteration construction used by the Apps Script helper
// against Node's independently implemented PBKDF2-HMAC-SHA256.
for (const iterations of [1, 2, 100]) {
  const expected = crypto.pbkdf2Sync('password', 'salt', iterations, 32, 'sha256').toString('hex');
  assert.equal(appScriptStylePbkdf2('password', 'salt', iterations), expected);
}

assert.match(source, /const PSB_PASSWORD_HASH_SCHEME_ = 'pbkdf2_sha256'/);
assert.match(source, /const PSB_PASSWORD_HASH_ITERATIONS_ = 60000/);
assert.match(source, /Utilities\.computeHmacSha256Signature\(block, keyBytes\)/);
assert.match(source, /function verifyPasswordForUser_\(/);
assert.match(source, /const legacy = sha256Hex_\(String\(password\) \+ salt\)/);
assert.match(source, /function migrateLegacyPasswordAfterLogin_\(/);
assert.match(source, /findUserById_\(verifiedUser\.userId, true\)/);
assert.match(source, /passwordCheck\.needsUpgrade && !migrateLegacyPasswordAfterLogin_\(user, password\)/);
assert.match(source, /verifyPasswordForUser_\(String\(currentPassword \|\| ''\), result\.user\)/);
assert.match(setup, /hashPassword_\(secret, salt\)/);

console.log('Password migration checks passed.');

assert.match(source, /const lock = LockService\.getScriptLock\(\);[\s\S]*?function changePassword/);
assert.match(source, /function adminResetUserPassword[\s\S]*?const lock = LockService\.getScriptLock\(\)/);
