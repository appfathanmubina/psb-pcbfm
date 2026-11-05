'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
const setup = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');

function body(name, input = source) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(input);
  assert.ok(m, name + ' exists');
  const open = input.indexOf('{', m.index);
  let depth = 0, quote = '', escaped = false;
  for (let i=open;i<input.length;i++) {
    const ch=input[i];
    if (quote) { if(escaped) escaped=false; else if(ch==='\\\\') escaped=true; else if(ch===quote) quote=''; continue; }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++; else if(ch==='}'&&--depth===0)return input.slice(m.index,i+1);
  }
  throw new Error('Unclosed function '+name);
}
const legacy=(p,s)=>crypto.createHash('sha256').update(String(p)+String(s),'utf8').digest('hex');
const pbkdf=(p,s,i)=>crypto.pbkdf2Sync(String(p),String(s),i,32,'sha256').toString('hex');
for(const [p,s] of [['password','salt'],['PSB-2027','0123456789abcdef0123456789abcdef'],['pässwörd🔐','salt-unik-123']]){
  assert.match(pbkdf(p,s,60000),/^[a-f0-9]{64}$/);
  assert.notEqual(pbkdf(p,s,60000),legacy(p,s));
}
assert.match(source,/const PSB_PASSWORD_HASH_SCHEME_ = 'pbkdf2_sha256'/);
assert.match(source,/const PSB_PASSWORD_HASH_ITERATIONS_ = 60000/);
assert.match(body('hashPassword_'),/pbkdf2Sha256Hex_/);
assert.ok(body('hashPassword_').includes("return PSB_PASSWORD_HASH_SCHEME_ + '
assert.match(body('pbkdf2Sha256Hex_'),/Utilities\.computeHmacSha256Signature/);
assert.match(body('pbkdf2Sha256Hex_'),/saltBytes\.concat\(\[0, 0, 0, 1\]\)/);
assert.match(body('verifyPasswordForUser_'),/needsUpgrade: valid && iterations !== PSB_PASSWORD_HASH_ITERATIONS_/);
assert.match(body('verifyPasswordForUser_'),/needsUpgrade: valid/);
const migration=body('migrateLegacyPasswordToPbkdf2AfterLogin_');
assert.match(migration,/hashPassword_\(String\(password\), salt\)/);
assert.match(migration,/current\.passwordHash !== verifiedUser\.passwordHash/);
assert.match(migration,/current\.passwordSalt !== verifiedUser\.passwordSalt/);
assert.doesNotMatch(migration,/sha256Hex_\(String\(password\) \+ String\(salt\)\)/);
assert.match(source,/migrateLegacyPasswordToPbkdf2AfterLogin_\(user, password\)/);
assert.doesNotMatch(source,/migratePbkdf2PasswordToLegacySha256AfterLogin_/);
for(const n of ['registerWali','changePassword','adminResetUserPassword','createManualUser'])assert.match(body(n),/hashPassword_\(/,n);
assert.match(body('configureInitialSuperadmin_',setup),/hashPassword_\(secret, salt\)/);
for(const n of ['registerWali','createManualUser','adminResetUserPassword','changePassword'])assert.ok(body(n).indexOf('hashPassword_(')<body(n).indexOf('LockService.getScriptLock()'),n+' hashes before lock');
console.log('PBKDF2 password hashing, legacy compatibility, migration, and lock-scope safeguards passed.');
 + iterations + '
assert.match(body('pbkdf2Sha256Hex_'),/Utilities\.computeHmacSha256Signature/);
assert.match(body('pbkdf2Sha256Hex_'),/saltBytes\.concat\(\[0, 0, 0, 1\]\)/);
assert.match(body('verifyPasswordForUser_'),/needsUpgrade: valid && iterations !== PSB_PASSWORD_HASH_ITERATIONS_/);
assert.match(body('verifyPasswordForUser_'),/needsUpgrade: valid/);
const migration=body('migrateLegacyPasswordToPbkdf2AfterLogin_');
assert.match(migration,/hashPassword_\(String\(password\), salt\)/);
assert.match(migration,/current\.passwordHash !== verifiedUser\.passwordHash/);
assert.match(migration,/current\.passwordSalt !== verifiedUser\.passwordSalt/);
assert.doesNotMatch(migration,/sha256Hex_\(String\(password\) \+ String\(salt\)\)/);
assert.match(source,/migrateLegacyPasswordToPbkdf2AfterLogin_\(user, password\)/);
assert.doesNotMatch(source,/migratePbkdf2PasswordToLegacySha256AfterLogin_/);
for(const n of ['registerWali','changePassword','adminResetUserPassword','createManualUser'])assert.match(body(n),/hashPassword_\(/,n);
assert.match(body('configureInitialSuperadmin_',setup),/hashPassword_\(secret, salt\)/);
for(const n of ['registerWali','createManualUser','adminResetUserPassword','changePassword'])assert.ok(body(n).indexOf('hashPassword_(')<body(n).indexOf('LockService.getScriptLock()'),n+' hashes before lock');
console.log('PBKDF2 password hashing, legacy compatibility, migration, and lock-scope safeguards passed.');
 + derivedKey;"));
assert.match(body('pbkdf2Sha256Hex_'),/Utilities\.computeHmacSha256Signature/);
assert.match(body('pbkdf2Sha256Hex_'),/saltBytes\.concat\(\[0, 0, 0, 1\]\)/);
assert.match(body('verifyPasswordForUser_'),/needsUpgrade: valid && iterations !== PSB_PASSWORD_HASH_ITERATIONS_/);
assert.match(body('verifyPasswordForUser_'),/needsUpgrade: valid/);
const migration=body('migrateLegacyPasswordToPbkdf2AfterLogin_');
assert.match(migration,/hashPassword_\(String\(password\), salt\)/);
assert.match(migration,/current\.passwordHash !== verifiedUser\.passwordHash/);
assert.match(migration,/current\.passwordSalt !== verifiedUser\.passwordSalt/);
assert.doesNotMatch(migration,/sha256Hex_\(String\(password\) \+ String\(salt\)\)/);
assert.match(source,/migrateLegacyPasswordToPbkdf2AfterLogin_\(user, password\)/);
assert.doesNotMatch(source,/migratePbkdf2PasswordToLegacySha256AfterLogin_/);
for(const n of ['registerWali','changePassword','adminResetUserPassword','createManualUser'])assert.match(body(n),/hashPassword_\(/,n);
assert.match(body('configureInitialSuperadmin_',setup),/hashPassword_\(secret, salt\)/);
for(const n of ['registerWali','createManualUser','adminResetUserPassword','changePassword'])assert.ok(body(n).indexOf('hashPassword_(')<body(n).indexOf('LockService.getScriptLock()'),n+' hashes before lock');
console.log('PBKDF2 password hashing, legacy compatibility, migration, and lock-scope safeguards passed.');
