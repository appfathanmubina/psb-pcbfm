'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');

function section(name, source = code) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Function exists: ' + name);
  const end = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, end < 0 ? source.length : end);
}

// One canonical rule for payment eligibility: cancelled bills must never
// authorize document upload or move a registration into the verification queue.
const paidIds = section('getFormPaymentVerifiedRegistrationIds_');
assert.match(paidIds, /reconcilePaymentLedger_\(bills,payments\)/);
assert.match(code, /status\|\|''\)\.toUpperCase\(\)!=='CANCELLED'/,
  'Cancelled bills must be excluded by the canonical ledger before document eligibility is granted');
assert.match(paidIds, /reconcilePaymentLedger_\(bills,payments\)/);
assert.match(paidIds, /state\?\.status==='PAID'&&!state\.requiresReview/);
assert.doesNotMatch(paidIds, /String\(x\.status\|\|''\)\.toUpperCase\(\)\s*===\s*'PAID'\s*\|\|/,
  'A PAID bill flag without a matched verified payment must not authorize document uploads');

// Admin lists and the Wali home must select the newest active bill, newest
// payment attempt, and newest non-replaced document using the same timestamps.
const statusMap = section('getRegistrationPaymentDocumentStatusMap_');
assert.match(statusMap, /String\(x\.status\|\|''\)\.toUpperCase\(\)==='CANCELLED'\)return/,
  'cancelled bills must be excluded before payment status aggregation');
assert.match(statusMap, /const stamp=String\(x\.createdAt\|\|''\);/);
assert.match(statusMap, /stamp\.localeCompare\(billStampByReg\[id\]\)>0/);
assert.match(statusMap, /if\(!billByReg\[id\]\|\|stamp\.localeCompare\(billStampByReg\[id\]\)>0\)\{billByReg\[id\]=x/);
assert.match(statusMap, /String\(x\.status\|\|''\)\.toUpperCase\(\)==='REPLACED'\)return/,
  'replaced documents must be excluded from the latest required-document aggregation');
assert.match(statusMap, /const key=id\+'\|'\+typeId,stamp=String\(x\.uploadedAt\|\|''\);/);
assert.match(statusMap, /stamp\.localeCompare\(docStamp\[key\]\)>0/);

const wali = section('getWaliHomeData');
assert.match(wali, /status\|\|''\)\.toUpperCase\(\)!=='CANCELLED'/);
assert.match(wali, /createdAt\|\|''\)\.localeCompare/);
assert.match(wali, /if\(billId&&!Object\.prototype\.hasOwnProperty\.call\(paymentByBill,billId\)\)\s*paymentByBill\[billId\]=x/);
assert.match(wali, /status\|\|''\)\.toUpperCase\(\)!=='REPLACED'/);
assert.match(wali, /uploadedAt\|\|''\)\.localeCompare/);
assert.match(wali, /paymentStatusLabel/);
assert.match(wali, /documentsStatus|statusLabel:requiredDocumentTypes/);
assert.doesNotMatch(wali, /const formPaid\s*=\s*String\(reg\.status\)/,
  'Legacy registration status alone must not grant payment eligibility');

const finalize = section('finalizeVerification');
assert.match(finalize, /x\.required===true\|\|String\(x\.required\)\.toUpperCase\(\)==='TRUE'/,
  'Required document configuration must support boolean and string TRUE values');

console.log('Registration payment/document status consistency safeguards passed.');
