'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = backend.indexOf('function openReregistration(sessionToken, registrationId) {');
const end = backend.indexOf('\n\nfunction ensureReregistration_(', start);
assert.ok(start >= 0 && end > start, 'openReregistration function must exist');
const open = backend.slice(start, end);

const lock = open.indexOf('lock.waitLock(');
assert.ok(lock >= 0, 'Opening re-registration must acquire ScriptLock');
for (const token of [
  "findRegistration_(id)",
  "findRowById_(ss.getSheetByName(PSB_SHEETS.SELECTION_RESULTS),'registrationId',id)",
  "findRowById_(rrSheet,'registrationId',id)"
]) {
  assert.ok(open.indexOf(token) > lock, token + ' must be read after acquiring ScriptLock');
}
assert.ok(open.indexOf("result.object.status||''") > lock &&
  open.indexOf("result.object.announcementDate||''") > lock,
  'Published PASS result and announcement marker must be revalidated under lock');
assert.match(open, /!\['PASSED','SELECTION','REREGISTRATION','PAYMENT_VERIFIED','COMPLETED'\]\.includes\(currentStatus\)/,
  'Only valid selection and re-registration workflow states may open or repair re-registration');
assert.match(open, /\['PAYMENT_VERIFIED','COMPLETED'\]\.includes\(currentStatus\) && !current/,
  'Advanced registration states with missing re-registration records must stop instead of creating an inconsistent pending record');
assert.ok(open.indexOf('ensureReregistration_(id,actor.userId,true)') > lock,
  'Bill and re-registration creation must occur inside the same lock');
assert.match(open, /const confirmed=findRegistration_\(id\)/,
  'The transition to REREGISTRATION must be confirmed by a fresh read');
assert.match(open, /finally \{ lock\.releaseLock\(\); \}/,
  'Opening re-registration must always release ScriptLock');

console.log('Re-registration opening transaction safeguards: OK');
