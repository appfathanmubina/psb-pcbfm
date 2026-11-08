'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const helperStart = backend.indexOf('function createNotificationOnce_(');
const helperEnd = backend.indexOf('\nfunction notifyUsersByRolesOnce_(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Event-keyed notification helper must exist');
const helperSource = backend.slice(helperStart, helperEnd);

const headers = ['notificationId','userId','title','message','type','isRead','createdAt','readAt'];
const storedRows = [];
const sheet = {
  getLastColumn() { return headers.length; },
  getRange(row) {
    return { getValues() { return row === 1 ? [headers] : []; } };
  },
  appendRow(values) { storedRows.push(values.slice()); }
};
function asObject(values) {
  return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
}
function findRowById_(targetSheet, field, value) {
  const index = headers.indexOf(field);
  const rowIndex = storedRows.findIndex(row => String(row[index]) === String(value));
  return rowIndex < 0 ? null : { rowNumber: rowIndex + 2, object: asObject(storedRows[rowIndex]) };
}
function sheetRowsMatchingValues_(targetSheet, field, values) {
  return storedRows
    .map((row, rowIndex) => Object.assign({ rowNumber: rowIndex + 2 }, asObject(row)))
    .filter(row => values.map(String).includes(String(row[field])));
}
let generatedId = 0;
const sandbox = {
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PSB_SHEETS: { NOTIFICATIONS: 'NOTIFICATIONS' },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest(algorithm, value) { return Array.from(crypto.createHash(algorithm).update(value, 'utf8').digest()); }
  },
  getDatabaseSpreadsheet_: () => ({ getSheetByName: () => sheet }),
  findRowById_,
  sheetRowsMatchingValues_,
  generateId_: prefix => prefix + (++generatedId),
  clean_: value => String(value == null ? '' : value)
};
vm.runInNewContext(helperSource, sandbox, { timeout: 1000 });

const send = sandbox.createNotificationOnce_;
const first = send('wali-1', 'Pembayaran Ditolak', 'Catatan: dokumen belum jelas', 'WARNING', 'PAYMENT_VERIFICATION:PAY-1:REJECTED');
const retry = send('wali-1', 'Pembayaran Ditolak', 'Catatan: dokumen belum jelas', 'WARNING', 'PAYMENT_VERIFICATION:PAY-1:REJECTED');
assert.equal(storedRows.length, 1, 'A retry of the same event and recipient must not append a duplicate');
assert.equal(retry.notificationId, first.notificationId, 'A retry must resolve the deterministic notification ID');

const nextIdenticalEvent = send('wali-1', 'Pembayaran Ditolak', 'Catatan: dokumen belum jelas', 'WARNING', 'PAYMENT_VERIFICATION:PAY-2:REJECTED');
assert.equal(storedRows.length, 2, 'A new event with identical content must create a new notification');
assert.notEqual(nextIdenticalEvent.notificationId, first.notificationId, 'Different event identities must have different notification IDs');

send('wali-2', 'Pembayaran Ditolak', 'Catatan: dokumen belum jelas', 'WARNING', 'PAYMENT_VERIFICATION:PAY-1:REJECTED');
assert.equal(storedRows.length, 3, 'The same event must still create one notification per recipient');

send('wali-1', 'Legacy message', 'Legacy body', 'INFO');
send('wali-1', 'Legacy message', 'Legacy body', 'INFO');
assert.equal(storedRows.length, 4, 'Legacy callers without an event key retain content-based fallback deduplication');

assert.ok(backend.includes("eventKey:'PAYMENT_VERIFICATION:'+paymentId+':'+status"),
  'Payment verification notifications must use the persisted payment ID and decision as event identity');
assert.ok(backend.includes("notificationEventKey='REGISTRATION_VERIFICATION:'+registrationId+':'+decision+':'+String(confirmed?.registration?.updatedAt||'')"),
  'Registration verification notifications must distinguish later decision cycles by persisted update timestamp');
assert.ok(backend.includes("eventKey:'REREGISTRATION_COMPLETED:'+id"),
  'Re-registration completion notifications must share one stable event identity across recovery paths');
assert.ok(backend.includes("eventKey:'SELECTION_ANNOUNCEMENT:'+registrationId"),
  'Announcement notifications must use a stable announcement event identity');
console.log('Event-keyed notification idempotency and transaction event identity: OK');
