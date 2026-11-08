'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
function section(start, end, label) {
  const a = backend.indexOf(start);
  assert.notEqual(a, -1, label + ' start must exist');
  const b = backend.indexOf(end, a + start.length);
  assert.ok(b > a, label + ' boundary must exist');
  return backend.slice(a, b);
}

const helperStart = backend.indexOf('function appendBillRecordWithRecovery_(sheet, headers, record) {');
const helperEnd = backend.indexOf('\nfunction ensureFormBillForRegistration_', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Bill persistence recovery helper must exist');
const helperSource = backend.slice(helperStart, helperEnd);

const headers = ['billId','registrationId','paymentTypeId','amount','dueDate','status','createdAt','updatedAt'];
const rows = [];
let appendMode = 'normal';
let flushCount = 0;
const sheet = {
  appendRow(values) {
    if (appendMode === 'fail-before-commit') throw new Error('simulated append failure before commit');
    rows.push(values.slice());
    if (appendMode === 'commit-then-throw') {
      appendMode = 'normal';
      throw new Error('simulated lost response after Sheets commit');
    }
  }
};
function findRowById_(target, field, value) {
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
  console: { error() {} }
};
vm.runInNewContext(helperSource, sandbox, { timeout: 1000 });
const persist = sandbox.appendBillRecordWithRecovery_;
const record = {
  billId: 'BIL-AMBIGUOUS-1', registrationId: 'REG-1', paymentTypeId: 'TYPE-1',
  amount: 125000, dueDate: '', status: 'UNPAID', createdAt: new Date(), updatedAt: new Date()
};

appendMode = 'commit-then-throw';
const recovered = persist(sheet, headers, record);
assert.equal(rows.length, 1, 'An append that committed before throwing must not create a second bill');
assert.equal(recovered.object.billId, record.billId, 'Recovery must return the committed bill by stable ID');
assert.equal(recovered.object.status, 'UNPAID', 'Recovery must return the persisted bill state');

const retry = persist(sheet, headers, record);
assert.equal(rows.length, 1, 'A repeated persistence call with the same bill ID must not append a duplicate row');
assert.equal(retry.object.billId, record.billId, 'A repeated call must return the original committed bill');

const normalRecord = { ...record, billId: 'BIL-NORMAL-2' };
const normal = persist(sheet, headers, normalRecord);
assert.equal(normal.object.billId, normalRecord.billId, 'A normal append must return its readback record');
assert.ok(flushCount >= 1, 'Successful append path must flush before readback');

appendMode = 'fail-before-commit';
const absentRecord = { ...record, billId: 'BIL-NOT-COMMITTED' };
assert.throws(() => persist(sheet, headers, absentRecord), /simulated append failure before commit/,
  'If append did not commit and readback finds no row, the original error must propagate');
assert.equal(findRowById_(sheet, 'billId', absentRecord.billId), null,
  'A failed append without a committed row must not be reported as success');

const autoBill = section(
  'function ensureFormBillForRegistration_(',
  '\nfunction getPaymentPageData(', 'Automatic form bill'
);
const manualBill = section(
  'function createBill(sessionToken,payload){',
  '\nfunction dispatchPaymentSubmissionNotifications_', 'Manual bill'
);
const reregBill = section(
  'function ensureReregistrationBill_(',
  '\nfunction findReregistrationBillPayment_', 'Re-registration bill'
);
for (const [name, source] of [['automatic form bill', autoBill], ['manual bill', manualBill], ['re-registration bill', reregBill]]) {
  assert.match(source, /appendBillRecordWithRecovery_\(/,
    name + ' must use the shared ambiguous-commit recovery helper');
}

console.log('Bill append ambiguous-commit recovery safeguards passed.');
