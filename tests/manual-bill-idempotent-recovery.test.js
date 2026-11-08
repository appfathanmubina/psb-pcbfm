'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = backend.indexOf('function createBill(sessionToken,payload){');
const end = backend.indexOf('\n\nfunction submitPayment(sessionToken,payload){', start);
assert.ok(start >= 0 && end > start, 'Manual bill creation function must exist');
const source = backend.slice(start, end);
const helperStart = backend.indexOf('function appendBillRecordWithRecovery_(sheet, headers, record) {');
const helperEnd = backend.indexOf('\nfunction ensureFormBillForRegistration_', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Bill persistence recovery helper must exist');
const helperSource = backend.slice(helperStart, helperEnd);

const headers = ['billId','registrationId','paymentTypeId','amount','dueDate','status','createdAt','updatedAt'];
const rows = [];
let throwAfterAppend = true;
const sheet = {
  getLastRow() { return rows.length + 1; },
  getLastColumn() { return headers.length; },
  getRange(row, column, numRows, numColumns) {
    return {
      getValues() {
        if (row === 1) return [headers];
        if (numRows === 1) return [rows[row - 2].slice(column - 1, column - 1 + numColumns)];
        return rows.slice(row - 2, row - 2 + numRows).map(values => [values[column - 1]]);
      }
    };
  },
  appendRow(values) {
    rows.push(values.slice());
    if (throwAfterAppend) {
      throwAfterAppend = false;
      throw new Error('simulated lost response after bill row commit');
    }
  }
};
function objectFrom(values, rowNumber) {
  return Object.assign({ _rowNumber: rowNumber }, Object.fromEntries(headers.map((h, i) => [h, values[i]])));
}
function sheetRowsMatchingValues_(target, key, wanted) {
  const index = headers.indexOf(key);
  return rows.map((values, i) => objectFrom(values, i + 2))
    .filter(record => wanted.map(String).includes(String(record[key] == null ? '' : record[key])));
}
function findRowById_(target, key, value) {
  const index = headers.indexOf(key);
  const rowIndex = rows.findIndex(record => String(record[index]) === String(value));
  return rowIndex < 0 ? null : { rowNumber: rowIndex + 2, object: objectFrom(rows[rowIndex], rowIndex + 2) };
}
let id = 0;
const notifications = new Map();
const notificationCalls = [];
const sandbox = {
  SpreadsheetApp: { flush() {} },
  PSB_SHEETS: { BILLS: 'BILLS' },
  requireRole_: () => ({ userId: 'admin-1' }),
  assertOperationalMutation_: () => {},
  fail_: message => ({ success: false, message }),
  findRegistration_: registrationId => ({ registration: { registrationId, userId: 'wali-1' } }),
  findMasterItemById_: () => ({ isActive: true, name: 'Formulir' }),
  withScriptLock_: (timeout, callback) => callback(),
  getDatabaseSpreadsheet_: () => ({ getSheetByName: () => sheet }),
  sheetRowsMatchingValues_,
  findRowById_,
  generateId_: prefix => prefix + (++id),
  writeAudit_: () => { throw new Error('simulated audit outage after bill commit'); },
  createNotificationOnce_: (userId, title, message, type, eventKey) => {
    notificationCalls.push({ userId, eventKey });
    if (!notifications.has(userId + '|' + eventKey)) notifications.set(userId + '|' + eventKey, { userId, eventKey });
    return notifications.get(userId + '|' + eventKey);
  },
  Utilities: { formatDate: date => date.toISOString().slice(0, 10) },
  Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
  console: { error() {} }
};
vm.runInNewContext(helperSource + '\n' + source, sandbox, { timeout: 1000 });
const createBill = sandbox.createBill;
const payload = { registrationId: 'REG-1', paymentTypeId: 'TYPE-FORM', amount: 250000, dueDate: '2027-01-15' };

const first = createBill('session', payload);
assert.equal(first.success, true, 'Initial manual bill creation must succeed despite a non-blocking audit outage');
assert.equal(rows.length, 1, 'Initial request must persist exactly one bill');
assert.ok(first.bill.billId, 'Successful response must contain the persisted bill ID');

const retry = createBill('session', payload);
assert.equal(retry.success, true, 'Retry after a lost client response must return idempotent success');
assert.equal(retry.alreadyExists, true, 'Retry must identify the existing matching bill');
assert.equal(retry.bill.billId, first.bill.billId, 'Retry must return the original bill');
assert.equal(rows.length, 1, 'Retry must not append a duplicate bill');

const conflictingAmount = createBill('session', { ...payload, amount: 300000 });
assert.equal(conflictingAmount.success, false, 'A duplicate bill with a different amount must be rejected');
assert.equal(rows.length, 1, 'Conflicting retry must not mutate or append a bill');

const conflictingDueDate = createBill('session', { ...payload, dueDate: '2027-01-20' });
assert.equal(conflictingDueDate.success, false, 'A duplicate bill with a different due date must be rejected');
assert.equal(rows.length, 1, 'Due-date conflict must not mutate or append a bill');

assert.equal(notificationCalls.length, 2, 'Both initial creation and retry must attempt notification recovery');
assert.equal(notificationCalls[0].eventKey, 'MANUAL_BILL_CREATED:' + first.bill.billId);
assert.equal(notificationCalls[1].eventKey, notificationCalls[0].eventKey,
  'Notification recovery must reuse the same bill-scoped event key');
assert.equal(notifications.size, 1, 'Bill notification retry must resolve to one idempotent notification');

console.log('Manual bill idempotent retry, conflict validation, persistence readback, and notification recovery: OK');
