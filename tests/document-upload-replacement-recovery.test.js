'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = backend.indexOf('function uploadDocument(sessionToken, payload) {');
const end = backend.indexOf('\nfunction canAccessRegistration_', start);
assert.notEqual(start, -1, 'document upload handler must exist');
assert.notEqual(end, -1, 'document upload handler boundary must exist');
const upload = backend.slice(start, end);

const helperStart = backend.indexOf('function replaceCurrentDocumentStatuses_(sheet, rowNumbers, statusColumn) {');
const helperEnd = backend.indexOf('\nfunction uploadDocument(sessionToken, payload) {', helperStart);
assert.notEqual(helperStart, -1, 'batched replacement helper must exist');
assert.notEqual(helperEnd, -1, 'batched replacement helper boundary must exist');
const helper = backend.slice(helperStart, helperEnd);

assert.match(helper, /range\.setValues\(values\)/,
  'previous document statuses must be updated with one batched range write');
assert.match(helper, /SpreadsheetApp\.flush\(\)/,
  'replacement writes must be flushed before readback');
assert.match(helper, /const verified = range\.getValues\(\)/,
  'replacement status writes must be verified by reading the sheet back');
assert.match(helper, /targets\.forEach\(row => \{ values\[row - firstRow\]\[0\] = 'REPLACED'; \}\)/,
  'only targeted previous document rows may be changed');
assert.doesNotMatch(upload, /getRange\(old\.rowNumber,\s*statusIdx\s*\+\s*1\)\.setValue\('REPLACED'\)/,
  'replacement must not perform one setValue call per previous document');

const priorRowsIndex = upload.indexOf("oldDocumentRowNumbers = oldDocuments.map(old => old.rowNumber)");
const appendIndex = upload.indexOf('sheet.appendRow(recordRow)');
assert.ok(priorRowsIndex >= 0 && appendIndex > priorRowsIndex,
  'prior document row IDs must be retained before the append operation can fail ambiguously');
assert.match(upload, /pendingDocumentId = documentId/,
  'a stable document ID must be retained before attempting the database append');
const recoveryIndex = upload.indexOf("findRowById_(pendingDocumentSheet, 'documentId', pendingDocumentId)");
const cleanupIndex = upload.indexOf('if (uploadedFile) {');
assert.ok(recoveryIndex >= 0 && cleanupIndex > recoveryIndex,
  'ambiguous append outcomes must be reconciled from Sheets before Drive cleanup');
assert.match(upload, /if \(committed\) \{[\s\S]*?documentRowWritten = true;[\s\S]*?savedDocument = committed\.object/,
  'a document found after an ambiguous append must be treated as committed');
assert.match(upload, /replaceCurrentDocumentStatuses_\(\s*pendingDocumentSheet, oldDocumentRowNumbers, pendingStatusColumn\)/,
  'recovery must retry the previous-document replacement reconciliation');
assert.match(upload, /if \(documentRowWritten\) \{\s*(?:invalidateOperationalReadCaches_\(\);\s*)?return \{/,
  'a committed upload must invalidate stale read caches and must not be reported as failed or retried as a duplicate');

console.log('Document upload replacement and ambiguous-commit recovery safeguards passed.');
