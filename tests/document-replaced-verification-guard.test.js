'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');

function section(text, start, end, label) {
  const a = text.indexOf(start);
  assert.notEqual(a, -1, label + ' start must exist');
  const b = text.indexOf(end, a + start.length);
  assert.ok(b > a, label + ' boundary must exist');
  return text.slice(a, b);
}

const verify = section(
  source,
  'function verifyDocument(sessionToken, payload) {',
  '\nfunction finalizeVerification',
  'Document verification'
);

const lockIndex = verify.indexOf('lock.waitLock(10000)');
const lookupIndex = verify.indexOf("findRowById_(sheet,'documentId',documentId)");
const replacedGuardIndex = verify.indexOf("String(found.object.status||'').toUpperCase()==='REPLACED'");
const firstWriteIndex = verify.indexOf("sheet.getRange(found.rowNumber,statusIdx+1).setValue(status)");

assert.ok(lockIndex >= 0, 'document verification must acquire ScriptLock');
assert.ok(lookupIndex > lockIndex, 'document must be re-read after acquiring ScriptLock');
assert.ok(replacedGuardIndex > lookupIndex, 'REPLACED status must be checked after fresh document lookup');
assert.ok(firstWriteIndex > replacedGuardIndex, 'REPLACED guard must run before any document status write');
assert.match(verify, /Dokumen ini sudah digantikan oleh unggahan terbaru dan tidak dapat diverifikasi/,
  'replaced documents must return a clear non-retryable response');

const audit = section(
  source,
  'function writeAudit_(userId, action, module, recordId, oldValue, newValue, description) {',
  '\nfunction getAuditLogPageData',
  'Audit writer'
);
assert.match(audit, /try\s*\{[\s\S]*?sheet\.appendRow/);
assert.match(audit, /catch\s*\(e\)\s*\{[\s\S]*?console\.error\('AUDIT_LOG_WRITE_FAILED'\)/,
  'audit logging failures must be contained and must not escape into the primary transaction');
assert.doesNotMatch(audit, /throw\s+e/);

console.log('Replaced-document verification and non-blocking audit safeguards passed.');
