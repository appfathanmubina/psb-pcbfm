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

const amountGuard = open.indexOf('reregistrationAmount=Number(reregistrationType.amount)');
assert.ok(amountGuard > lock,
  'Re-registration fee must be validated inside the transaction lock');
assert.match(open, /!Number\.isFinite\(reregistrationAmount\)\|\|reregistrationAmount<=0/,
  'Opening re-registration must reject missing, non-finite, zero, or negative fee amounts');
assert.match(open, /Nominal tagihan Daftar Ulang belum valid/,
  'Invalid fee configuration must return an actionable administrator message');

const helperStart = backend.indexOf('function ensureReregistration_(registrationId, actorUserId, createBill) {');
const helperEnd = backend.indexOf('\nfunction ensureReregistrationBill_(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'ensureReregistration helper must exist');
const ensure = backend.slice(helperStart, helperEnd);
assert.match(ensure, /ensureReregistrationBill_\(found, actorUserId \|\| 'SYSTEM'\)/,
  'The idempotent re-registration helper must delegate bill creation to the guarded bill helper');

const billStart = backend.indexOf('function ensureReregistrationBill_(found, actorUserId) {');
const billEnd = backend.indexOf('\nfunction finalizeReregistration(', billStart);
assert.ok(billStart >= 0 && billEnd > billStart, 're-registration bill helper must exist');
const billHelper = backend.slice(billStart, billEnd);
assert.match(billHelper, /const amount = Number\(type\.amount\)/,
  'Bill creation must normalize the configured amount');
assert.match(billHelper, /!Number\.isFinite\(amount\) \|\| amount <= 0/,
  'Bill creation must never persist zero, negative, or non-finite amounts');
assert.match(billHelper, /amount:amount/,
  'The validated amount must be the value persisted to BILLS');
assert.ok(billHelper.indexOf('if (existing) return existing;') < billHelper.indexOf('if (!Number.isFinite(amount) || amount <= 0) return null;'),
  'Existing valid bills must remain usable even if the master amount is later misconfigured');

console.log('Re-registration opening transaction safeguards: OK');
