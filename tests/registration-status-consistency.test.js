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
assert.match(paidIds, /status\s*\|\|\s*''\)\.toUpperCase\(\)\s*===\s*'CANCELLED'\)\s*return/);
assert.match(paidIds, /status\s*\|\|\s*''\)\.toUpperCase\(\)\s*===\s*'PAID'/);
assert.match(paidIds, /verifiedPayments\[String\(x\.billId\s*\|\|\s*''\)\]/);

// Admin lists and the Wali home must select the newest active bill, newest
// payment attempt, and newest non-replaced document using the same timestamps.
const statusMap = section('getRegistrationPaymentDocumentStatusMap_');
assert.match(statusMap, /status\s*\|\|\s*''\)\.toUpperCase\(\)!==\s*'CANCELLED'/);
assert.match(statusMap, /createdAt\|\|\s*''\)\.localeCompare/);
assert.match(statusMap, /billByReg\[id\]\)\s*billByReg\[id\]=x/);
assert.match(statusMap, /status\s*\|\|\s*''\)\.toUpperCase\(\)!=='REPLACED'/);
assert.match(statusMap, /uploadedAt\|\|\s*''\)\.localeCompare/);

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
