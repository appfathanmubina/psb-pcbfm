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

const login = fn('login');
const loginLock = login.indexOf('sessionLock.waitLock(10000)');
const latestUser = login.indexOf('findUserById_(user.userId,true)', loginLock);
const sessionCreate = login.indexOf('createSession_(user.userId)', loginLock);
const lockRelease = login.indexOf('sessionLock.releaseLock()', loginLock);
assert.ok(loginLock >= 0 && latestUser > loginLock && sessionCreate > latestUser && lockRelease > sessionCreate,
  'Login must re-read current credentials and create the session inside the same lock');
assert.match(login.slice(loginLock, lockRelease), /currentUser\.passwordHash!==user\.passwordHash/);
assert.match(login.slice(loginLock, lockRelease), /currentUser\.passwordSalt!==user\.passwordSalt/);
assert.match(login.slice(loginLock, lockRelease), /String\(currentUser\.status\)\.toUpperCase\(\)!=='ACTIVE'/);
assert.doesNotMatch(login.slice(loginLock, lockRelease), /registerLoginFailure_\(/,
  'Login failure counter must not attempt a nested acquisition of ScriptLock');
assert.match(login, /refreshedUser=findUserById_\(user\.userId,true\)[\s\S]*?verifyPasswordForUser_\(password,refreshedUser\)/,
  'PBKDF2 migration must refresh and re-verify the account before session creation');

const touch = fn('getSessionUser_');
const touchLock = touch.indexOf('touchLock.waitLock(5000)');
const latestSession = touch.indexOf('const latestRow=sheet.getRange(found.rowNumber,1,1,7).getValues()[0]', touchLock);
assert.ok(touchLock >= 0 && latestSession > touchLock,
  'Throttled session activity updates must re-read the session under ScriptLock');
assert.match(touch.slice(touchLock), /constantTimeEqual_\(String\(latestRow\[2\]/,
  'Session touch must verify the indexed row still contains the same token hash');
assert.match(touch.slice(touchLock), /String\(latestRow\[6\]\|\|''\)\.toUpperCase\(\)!=='ACTIVE'/,
  'Session touch must not update a revoked or expired session');
assert.match(touch.slice(touchLock), /latestActivity\.getTime\(\)\)\>idleMinutes\*60000/,
  'Session touch must re-check idle timeout against the latest activity');

const invalidate = fn('invalidateSession_');
assert.match(invalidate, /lock\.waitLock\(5000\)/,
  'Logout and invalidation must serialize with session cleanup and password resets');
assert.match(invalidate, /const current=sheet\.getRange\(found\.rowNumber,1,1,7\)\.getValues\(\)\[0\]/,
  'Invalidation must re-read the current session row before changing status');
assert.match(invalidate, /current\[6\]\|\|''\)\.toUpperCase\(\)!=='ACTIVE'[\s\S]*?return true/,
  'An already terminal session must not be overwritten or reactivated');
assert.match(invalidate, /PSB_SESSION_ROW_V1_/,
  'Invalidation must clear the actual session row-index cache');

const logout = fn('logout');
assert.match(logout, /if\(!invalidateSession_\(result\.sessionRow, 'LOGOUT'\)\)/,
  'Logout must report a transient revocation failure instead of claiming success');

for (const name of ['revokeOtherSessionsForUser_', 'cleanupPSBSessions_']) {
  assert.match(fn(name), /PSB_SESSION_ROW_V1_/,
    name + ' must clear the actual session row-index cache');
}
assert.match(fn('runSecurityMaintenance'), /lock\.waitLock\(10000\)[\s\S]*?cleanupPSBSessions_/,
  'Session cleanup must run under the same global lock');
assert.match(fn('changePassword'), /lock\.waitLock\(20000\)[\s\S]*?revokeOtherSessionsForUser_/,
  'Password changes must serialize credential changes and session revocation');
assert.match(fn('adminResetUserPassword'), /lock\.waitLock\(20000\)[\s\S]*?revokeOtherSessionsForUser_/,
  'Admin password resets must serialize credential changes and session revocation');

console.log('Authentication and session concurrency recovery safeguards: OK');
