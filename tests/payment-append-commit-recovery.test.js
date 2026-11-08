'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const helperStart = backend.indexOf('function appendPaymentRecordWithRecovery_(sheet, headers, record) {');
const helperEnd = backend.indexOf('\nfunction submitPayment(sessionToken,payload){', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Payment persistence recovery helper must exist');
const helperSource = backend.slice(helperStart, helperEnd);

const headers = ['paymentId','billId','registrationId','amount','proofFileId','proofFileUrl','status'];
const rows = [];
let appendMode = 'normal';
let readbackFailure = false;
let enableReadbackFailureAfterCommit = false;
let flushCount = 0;
const sheet = {
  appendRow(values) {
    if (appendMode === 'fail-before-commit') throw new Error('simulated payment append failure before commit');
    rows.push(values.slice());
    if (appendMode === 'commit-then-throw') {
      appendMode = 'normal';
      if (enableReadbackFailureAfterCommit) readbackFailure = true;
      throw new Error('simulated lost response after payment Sheets commit');
    }
  }
};
function findRowById_(target, field, value) {
  if (readbackFailure) throw new Error('simulated Sheets readback outage');
  const index = headers.indexOf(field);
  const rowIndex = rows.findIndex(row => String(row[index]) === String(value));
  if (rowIndex < 0) return null;
  return {
    rowNumber: rowIndex + 2,
    object: Object.assign({}, ...headers.map((header, i) => ({ [header]: rows[rowIndex][i] })))
  };
}
const sandbox = {
  SpreadsheetApp: { flush() { flushCount++; } },
  findRowById_,
  safeSheetRow_: row => row,
  console: { error() {} },
  Error
};
vm.runInNewContext(helperSource, sandbox, { timeout: 1000 });
const persist = sandbox.appendPaymentRecordWithRecovery_;
const record = {
  paymentId: 'PAY-AMBIGUOUS-1', billId: 'BIL-1', registrationId: 'REG-1',
  amount: 125000, proofFileId: 'DRIVE-FILE-1', proofFileUrl: 'https://drive.example/file',
  status: 'SUBMITTED'
};

appendMode = 'commit-then-throw';
const recovered = persist(sheet, headers, record);
assert.equal(rows.length, 1, 'A payment append that committed before throwing must not create a duplicate');
assert.equal(recovered.object.paymentId, record.paymentId, 'Recovery must return the persisted payment by stable ID');
assert.equal(recovered.object.proofFileId, record.proofFileId, 'Recovered payment must retain the uploaded proof file reference');

const retry = persist(sheet, headers, record);
assert.equal(rows.length, 1, 'Retry with the same payment ID must return the existing row without appending');
assert.equal(retry.object.paymentId, record.paymentId, 'Idempotent retry must return the original payment');

appendMode = 'fail-before-commit';
const absentRecord = { ...record, paymentId: 'PAY-NOT-COMMITTED' };
assert.throws(() => persist(sheet, headers, absentRecord), /simulated payment append failure before commit/,
  'If append failed before commit and readback confirms no row, the original error must propagate');
assert.equal(findRowById_(sheet, 'paymentId', absentRecord.paymentId), null,
  'A confirmed uncommitted payment must not be reported as saved');

appendMode = 'commit-then-throw';
const uncertainRecord = { ...record, paymentId: 'PAY-READBACK-UNCERTAIN' };
enableReadbackFailureAfterCommit = true;
assert.throws(
  () => persist(sheet, headers, uncertainRecord),
  error => error && error.paymentPersistenceUncertain === true && error.paymentId === uncertainRecord.paymentId,
  'If the append may have committed but readback is unavailable, the helper must mark persistence as uncertain'
);
assert.equal(rows.length, 2, 'An uncertain readback must not attempt another append or remove the committed row');
assert.ok(flushCount >= 2, 'Successful and ambiguous append paths must flush before readback');

const submit = backend.slice(
  backend.indexOf('function submitPayment(sessionToken,payload){'),
  backend.indexOf('\nfunction verifyPayment(sessionToken,payload){', backend.indexOf('function submitPayment(sessionToken,payload){'))
);
const uncertainBranch = submit.indexOf('if(e&&e.paymentPersistenceUncertain)');
const cleanupBranch = submit.indexOf('if(uploadedFile)');
assert.ok(uncertainBranch >= 0 && cleanupBranch > uncertainBranch,
  'Uncertain persistence handling must run before Drive cleanup');
assert.match(submit, /uploadedFile=null;[\s\S]*?Jangan unggah ulang dahulu/,
  'The upload handler must preserve the proof and tell the user not to submit a duplicate while persistence is uncertain');

console.log('Payment append ambiguous-commit recovery safeguards passed.');
