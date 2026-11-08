'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const sync = backend.slice(
  backend.indexOf('function syncReregistrationAfterPayment_('),
  backend.indexOf('\n\n// =====================================================\n// STAGE 6 - VERIFIKASI', backend.indexOf('function syncReregistrationAfterPayment_('))
);
assert.ok(sync.length > 0, 'Daftar Ulang payment synchronization function must exist');

const registrationWrite = sync.indexOf("setRegistrationStatus_(reg.registration,'COMPLETED'");
const registrationConfirm = sync.indexOf("reg=findRegistration_(id);", registrationWrite);
const reregWrite = sync.indexOf("setValue(targetStatus)", registrationConfirm);
const reregConfirm = sync.indexOf("findRowById_(rrSheet,'registrationId',id)", reregWrite);

assert.ok(registrationWrite >= 0, 'Completed registration status must be persisted');
assert.ok(registrationConfirm > registrationWrite, 'Registration status must be re-read after update');
assert.ok(reregWrite > registrationConfirm, 'Reregistration must not be marked complete before registration is confirmed');
assert.ok(reregConfirm > reregWrite, 'Reregistration status write must be verified by a fresh read');
assert.match(sync, /if\(!reg\)return fail_\(/,
  'Missing registration data must stop verification instead of silently succeeding');
assert.match(sync, /if\(!moved\?\.success\)return moved\|\|fail_/,
  'A failed registration status transition must propagate to payment verification');
assert.match(sync, /status belum tersimpan sebagai COMPLETED/,
  'A registration write that did not persist must be retryable');
assert.match(sync, /if\(!confirmedRereg\|\|String\(confirmedRereg\.object\.status\|\|''\)\.toUpperCase\(\)!==targetStatus\)/,
  'Reregistration status must be confirmed after writing');
assert.match(sync, /if\(!docsReady\)return \{success:true,completed:false/,
  'Payment-only completion must remain PAYMENT_VERIFIED while required documents are incomplete');
assert.match(sync, /if\(!rrFound\)return fail_\(/,
  'A missing re-registration record must block payment finalization with an actionable error');
assert.match(sync, /if\(!payment\|\|String\(payment\.status\|\|''\)\.toUpperCase\(\)!=='PAID'\)return fail_\(/,
  'A missing or unpaid re-registration bill must not be treated as a successful synchronization');

const verifyStart = backend.indexOf('function verifyPayment(sessionToken,payload){');
const verifyEnd = backend.indexOf('\nfunction getSelectionPageData(sessionToken, registrationId)', verifyStart);
const verify = backend.slice(verifyStart, verifyEnd);
assert.ok(verify.indexOf('syncReregistrationAfterPayment_(') < verify.indexOf("sheet.getRange(found.rowNumber,paymentStatusIdx+1).setValue(status)"),
  'Payment must remain unfinalized until linked registration records synchronize');

const selectorStart = backend.indexOf('function findReregistrationBillPayment_(registrationId) {');
const selectorEnd = backend.indexOf('\\nfunction finalizeReregistration(', selectorStart);
assert.ok(selectorStart >= 0 && selectorEnd > selectorStart,
  'A shared active re-registration bill selector must exist');
const selector = backend.slice(selectorStart, selectorEnd);
assert.ok(selector.includes('MASTER_JENIS_PEMBAYARAN'),
  'Re-registration bill selection must resolve payment type IDs from the complete master list');
assert.ok(selector.includes("toUpperCase()!=='CANCELLED'"),
  'Cancelled historical re-registration bills must be excluded');
assert.ok(selector.includes("toUpperCase()==='PAID'"),
  'A paid non-cancelled replacement bill must take precedence over an older cancelled bill');
assert.equal((backend.match(/findReregistrationBillPayment_\\(id\\)/g)||[]).length, 2,
  'Both finalization and payment synchronization must use the shared safe bill selector');

console.log('Payment verification and re-registration recovery safeguards: OK');
