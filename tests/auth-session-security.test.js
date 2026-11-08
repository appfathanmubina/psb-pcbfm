'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
function fn(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Required function exists: ' + name);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}
const auth = source.match(/const PSB_AUTH = \{[\s\S]*?\};/);
assert.ok(auth, 'Authentication policy constants exist');
assert.match(auth[0], /MAX_ATTEMPTS:\s*5/);
assert.match(auth[0], /LOCK_MINUTES:\s*10/);
assert.match(auth[0], /SESSION_TTL_MINUTES:\s*480/);
assert.match(auth[0], /SESSION_IDLE_MINUTES:\s*30/);
const login = fn('login');
assert.match(login, /getLoginLock_\(key\)/);
assert.match(login, /registerLoginFailure_\(key\)/);
assert.match(login, /clearLoginFailure_\(key\)/);
assert.match(login, /AUTH_LOGIN_FAILED/);
const lock = fn('getLoginLock_');
assert.match(lock, /PSB_LOGIN_LOCK_V2_/);
assert.match(lock, /remainingMinutes/);
const failure = fn('registerLoginFailure_');
assert.match(failure, /LockService\.getScriptLock\(\)/);
assert.match(failure, /guard\.waitLock\(5000\)/);
assert.match(failure, /finally\s*\{\s*guard\.releaseLock\(\)/);
assert.match(failure, /current >= max/);
const clear = fn('clearLoginFailure_');
assert.match(clear, /LockService\.getScriptLock\(\)/);
assert.match(clear, /PSB_LOGIN_FAIL_V2_/);
assert.match(clear, /PSB_LOGIN_LOCK_V2_/);
const session = fn('getSessionUser_');
assert.match(session, /token\.length < 32 \|\| token\.length > 256/);
assert.match(session, /INVALID_EXPIRY/);
assert.match(session, /INVALID_ACTIVITY/);
assert.match(session, /Number\.isFinite\(expiresAt\.getTime\(\)\)/);
assert.match(session, /Number\.isFinite\(lastActivity\.getTime\(\)\)/);
assert.match(session, /IDLE_TIMEOUT/);
assert.match(session, /ACCOUNT_INACTIVE/);
const create = fn('createSession_');
assert.match(create, /SESSION_TTL_MINUTES/);
assert.match(create, /appendRow\(\[sessionId, userId, tokenHash, now, expires, now, 'ACTIVE'\]\)/);
const logout = fn('logout');
assert.match(logout, /invalidateSession_\(result\.sessionRow, 'LOGOUT'\)/);
const sessionIndex = fn('getSessionUser_');
assert.match(sessionIndex, /PSB_SESSION_ROW_V1_/,
  'Session lookup must use a cached row-number index');
assert.match(sessionIndex, /getRange\(cachedRowNumber,\s*1,\s*1,\s*7\)/,
  'Session cache hits must read only the indexed session row');
assert.match(sessionIndex, /constantTimeEqual_\(String\(cachedRow\[2\]/,
  'A cached session row must be checked against the requested token hash');
assert.match(sessionIndex, /getRange\(2,\s*3,\s*lastRow\s*-\s*1,\s*1\)/,
  'A cache miss must scan only the token-hash column');
assert.match(sessionIndex, /getRange\(rowNumber,\s*1,\s*1,\s*7\)/,
  'A full session row may be read only after a matching token hash is found');
assert.match(sessionIndex, />=\s*2\s*\*\s*60000/,
  'Session activity writes must be throttled to at most once per two minutes');
assert.match(sessionIndex, /findUserById_\(String\(row\[1\]\),\s*true\)/,
  'Session validation must continue checking the latest user row');
const userById = fn('findUserById_');
assert.match(userById, /PSB_USER_ROW_ID_V1_/,
  'User ID lookup must use a row-number index');
assert.match(userById, /getRange\(cachedRowNumber,\s*1,\s*1,\s*15\)/,
  'User ID cache hits must read fresh user data from one row');
assert.match(userById, /String\(row\[0\]\s*\|\|\s*''\)\s*===\s*value/,
  'Cached user row must be checked against the requested user ID');
const userByLogin = fn('findUser_');
assert.match(userByLogin, /PSB_USER_ROW_LOGIN_V1_/,
  'Login identifier lookup must use a row-number index');
assert.match(userByLogin, /getRange\(cachedRowNumber,\s*1,\s*1,\s*15\)/,
  'Login cache hits must read fresh user data from one row');
const createSeed = fn('createSession_');
assert.match(createSeed, /PSB_SESSION_ROW_V1_/,
  'New sessions must seed their row index immediately');

const loginLookup = fn('findUser_');
assert.match(loginLookup, /try\s*\{\s*cachedRowNumber = Number\(cache\.get\(cacheKey\)/,
  'Login user lookup must fall back to USERS when the optional row-index cache is unavailable');
assert.match(loginLookup, /getRange\(2,\s*3,\s*lastRow\s*-\s*1,\s*4\)/,
  'Login user lookup must scan only the four identity columns on cache miss');
assert.match(loginLookup, /getRange\(rowNumber,\s*1,\s*1,\s*15\)/,
  'Login user lookup must fetch the full account row only after an identity match');
const userIdLookup = fn('findUserById_');
assert.match(userIdLookup, /try\s*\{\s*cachedRowNumber = Number\(cache\.get\(cacheKey\)/,
  'Session user lookup must fall back to USERS when the optional row-index cache is unavailable');
const sessionCacheRead = session.match(/try\s*\{\s*cachedRowNumber = Number\(cache\.get\(sessionCacheKey\)/);
assert.ok(sessionCacheRead, 'Session validation must treat the row-index cache as optional');
const clearFailures = fn('clearLoginFailure_');
assert.match(clearFailures, /return true/);
const loginSessionOrder = login.indexOf('createSession_(user.userId)');
assert.ok(loginSessionOrder >= 0 && login.indexOf('clearLoginFailure_(key)') > loginSessionOrder,
  'A successful session must be created before best-effort failure-counter cleanup');
const failureContention = fn('registerLoginFailure_');
assert.match(failureContention, /PSB_LOGIN_LOCK_V2_[\s\S]*Date\.now\(\) \+ 60000/,
  'Login failure counter lock contention must create a short fail-closed lock marker');
const migration = fn('upgradePasswordHashAfterLogin_');
assert.ok(migration.indexOf('hashPassword_(') < migration.indexOf('lock.waitLock(20000)'),
  'Legacy/weak hash upgrade must derive PBKDF2 before taking the global lock');
assert.match(migration.slice(migration.indexOf('lock.waitLock(20000)')),
  /findUserById_\(verifiedUser\.userId, true\)[\s\S]*?passwordHash !== verifiedUser\.passwordHash[\s\S]*?return false/,
  'Password upgrade must recheck current credentials under lock');
assert.match(migration, /confirmed\.passwordHash !== hash/,
  'Password upgrade must confirm the persisted PBKDF2 hash');
assert.doesNotMatch(source, /migratePbkdf2PasswordToLegacySha256AfterLogin_/,
  'No PBKDF2-to-SHA downgrade path may remain');
const passwordChange = fn('changePassword');
const passwordLockAt = passwordChange.indexOf('lock.waitLock(20000)');
assert.ok(passwordChange.indexOf('verifyPasswordForUser_(') < passwordLockAt,
  'Current password verification must happen before taking the global lock');
assert.ok(passwordChange.indexOf('hashPassword_(') < passwordLockAt,
  'New SHA-256 hash must be derived before taking the global lock');
assert.doesNotMatch(passwordChange.slice(passwordLockAt), /verifyPasswordForUser_|hashPassword_/,
  'Password change critical section must not perform password hashing');
assert.match(passwordChange.slice(passwordLockAt),
  /String\(current\.status\)\.toUpperCase\(\) !== 'ACTIVE'/,
  'Password change must recheck active account status under lock');

const cleanup = fn('cleanupPSBSessions_');
assert.match(cleanup, /EXPIRED/);
assert.match(cleanup, /IDLE_TIMEOUT/);
console.log('Authentication, login throttling, and session safeguards passed.');
