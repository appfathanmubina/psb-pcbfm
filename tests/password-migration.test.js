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
assert.match(source, /const currentPasswordValue = String\(currentPassword \|\| ''\)/);
assert.match(source, /verifyPasswordForUser_\(currentPasswordValue, result\.user\)/);
assert.match(setup, /hashPassword_\(secret, salt\)/);

console.log('Password migration checks passed.');

const changeStart = source.indexOf('function changePassword(');
const changeEnd = source.indexOf('\nfunction ', changeStart + 1);
const changeBlock = source.slice(changeStart, changeEnd < 0 ? source.length : changeEnd);
assert.match(changeBlock, /const lock = LockService\.getScriptLock\(\)/);
const resetStart = source.indexOf('function adminResetUserPassword(');
const resetEnd = source.indexOf('\nfunction ', resetStart + 1);
const resetBlock = source.slice(resetStart, resetEnd < 0 ? source.length : resetEnd);
assert.match(resetBlock, /const lock = LockService\.getScriptLock\(\)/);
