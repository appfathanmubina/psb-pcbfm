'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const priorityStart = backend.indexOf('function paymentStatusPriority_(');
const priorityEnd = backend.indexOf('\nfunction buildPaymentData_(', priorityStart);
assert.ok(priorityStart >= 0 && priorityEnd > priorityStart, 'Payment state helpers must exist');
const sandbox = {};
vm.runInNewContext(backend.slice(priorityStart, priorityEnd), sandbox);

assert.equal(sandbox.paymentQueueStatus_('PAID', [{status:'SUBMITTED'}]), 'WAITING',
  'Partial verification failure must stay in the waiting queue despite a PAID bill write');
assert.equal(sandbox.paymentQueueStatus_('PAID', [{status:'VERIFIED'}]), 'PAID',
  'A confirmed payment must remain PAID');
assert.equal(sandbox.paymentQueueStatus_('PAID', [{status:'REJECTED'}]), 'REJECTED',
  'A rejected payment must not be presented as paid solely from the bill status');
assert.equal(sandbox.paymentQueueStatus_('UNPAID', [{status:'SUBMITTED'}]), 'WAITING',
  'A submitted payment must remain waiting');
assert.equal(sandbox.paymentQueueStatus_('UNPAID', [{status:'VERIFIED'},{status:'SUBMITTED'}]), 'PAID',
  'A verified payment remains authoritative when another stale pending row exists');
assert.equal(sandbox.preferredPaymentForBill_({status:'REJECTED'},{status:'SUBMITTED'}).status, 'SUBMITTED',
  'Wali payment detail must surface a pending proof instead of a prior rejected proof');

const verifyStart = backend.indexOf('function verifyPayment(sessionToken,payload){');
const verifyEnd = backend.indexOf('\nfunction getSelectionPageData', verifyStart);
const verify = backend.slice(verifyStart, verifyEnd);
const duplicateGuard = verify.indexOf('otherVerifiedPayment=sheetRowsMatchingValues_');
const historyWrite = verify.indexOf('const verSheet=');
assert.ok(duplicateGuard >= 0 && duplicateGuard < historyWrite,
  'Duplicate VERIFIED guard must run before any verification history write');
assert.ok(verify.includes(".find(x=>String(x.paymentId||'')!==paymentId&&String(x.status||'').toUpperCase()==='VERIFIED')"),
  'Duplicate guard must exclude the same payment ID so retries remain idempotent');

const historyAppend = verify.indexOf('verSheet.appendRow(vh.map(h=>rec[h]))');
const historyCatch = verify.indexOf('catch(historyWriteError)', historyAppend);
const historyFlush = verify.indexOf('SpreadsheetApp.flush()', historyCatch);
const historyReadback = verify.indexOf("sheetRowsMatchingValues_(verSheet,'paymentId',[paymentId])", historyFlush);
assert.ok(historyAppend >= 0 && historyCatch > historyAppend,
  'Ambiguous verification-history append errors must be caught for recovery');
assert.ok(historyFlush > historyCatch && historyReadback > historyFlush,
  'Verification history must be flushed before reading back the possibly committed row');
assert.match(verify, /if\(!confirmedHistory\)return fail_/,
  'Payment decision must not proceed unless its verification history is confirmed');

const registrationStart = backend.indexOf('function setRegistrationStatus_(');
const registrationEnd = backend.indexOf('\n// =====================================================\n// STAGE 5', registrationStart);
const registration = backend.slice(registrationStart, registrationEnd);
assert.match(registration, /SpreadsheetApp\.flush\(\)/,
  'Registration status and metadata writes must be flushed before readback');
assert.match(registration, /confirmed\.object\.updatedAt/,
  'Registration updatedAt must be confirmed on readback');
assert.match(verify, /\['VERIFIED','PAYMENT_VERIFIED'\]\.includes/,
  'Retry must re-enter registration synchronization to repair a partially written timestamp');

console.log('Payment verification state consistency and partial-failure recovery: OK');
