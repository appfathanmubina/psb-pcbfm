'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = backend.indexOf('function submitPayment(sessionToken,payload){');
const end = backend.indexOf('\nfunction verifyPayment(sessionToken,payload){', start);
assert.notEqual(start, -1, 'payment proof upload backend must exist');
assert.notEqual(end, -1, 'payment proof upload boundary must exist');
const upload = backend.slice(start, end);

const tryIndex = upload.indexOf('try {');
const waitLocks = [...upload.matchAll(/lock\.waitLock\(20000\)/g)].map(match => match.index);
assert.ok(tryIndex >= 0, 'payment upload lock acquisition must be guarded');
assert.equal(waitLocks.length, 2, 'payment folder preparation and payment commit must use separate lock windows');
assert.ok(waitLocks.every(index => index > tryIndex), 'payment upload lock timeouts must be caught by the handler');
assert.match(upload, /lockAcquired\s*=\s*true/, 'payment upload must track lock ownership');
assert.match(upload, /lock\.releaseLock\(\);\s*lockAcquired=false;\s*\n\s*stage='CREATE_DRIVE_FILE'/,
  'Drive file creation must not hold the global ScriptLock');
assert.match(upload, /stage='RECHECK_DUPLICATE_PAYMENT'/,
  'payment upload must recheck duplicate submissions before commit');
assert.match(upload, /if\(paymentRowWritten\)\s*\{\s*return\s*\{/,
  'a committed payment row must never be reported as failed and retried');
assert.match(upload, /if\(uploadedFile\)\s*\{\s*try\{uploadedFile\.setTrashed\(true\)/,
  'uncommitted Drive files must be cleaned up after failed commits');
assert.match(upload, /PSB_PAYMENT_UPLOAD_FAILED stage=/,
  'payment upload failures must log a safe processing stage');
assert.match(upload, /LOCK_PAYMENT_PREPARE\|\|stage==='LOCK_PAYMENT_COMMIT'/,
  'lock contention must return a retryable message');
assert.match(upload, /5\*1024\*1024/,
  'the existing 5 MB payment proof limit must remain unchanged');
assert.ok(upload.includes(String.raw`mimeType!=='application/pdf'`),
  'PDF proof uploads must remain supported');
assert.ok(upload.includes(String.raw`/^image\/(jpeg|png|webp)$/i`),
  'JPG, PNG, and WEBP proof uploads must remain supported');

console.log('Payment proof upload resilience safeguards passed.');
