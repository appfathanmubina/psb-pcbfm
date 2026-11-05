'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const bridge = fs.readFileSync('frontend/api-bridge.js', 'utf8');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const serviceWorker = fs.readFileSync('frontend/sw.js', 'utf8');

const start = backend.indexOf('function uploadDocument(sessionToken, payload) {');
const end = backend.indexOf('\nfunction canAccessRegistration_', start);
assert.notEqual(start, -1, 'document upload backend must exist');
assert.notEqual(end, -1, 'document upload backend boundary must exist');
const upload = backend.slice(start, end);
const tryIndex = upload.indexOf('try {');
const waitLocks = [...upload.matchAll(/lock\.waitLock\(20000\)/g)].map(match => match.index);
assert.ok(tryIndex >= 0, 'upload lock acquisition must be inside guarded error handling');
assert.equal(waitLocks.length, 2, 'folder preparation and document commit must use separate lock windows');
assert.ok(waitLocks.every(index => index > tryIndex), 'lock timeouts must be caught by the upload handler');
assert.match(upload, /lockAcquired\s*=\s*true/, 'upload must track whether it owns the ScriptLock');
assert.match(upload, /const folder = getRegistrationDocumentFolder_\(found\.registration\);\s*lock\.releaseLock\(\);\s*lockAcquired\s*=\s*false;\s*\n\s*stage\s*=\s*'CREATE_DRIVE_FILE';\s*const blob\s*=\s*Utilities\.newBlob/,
  'Drive file creation must not hold the global ScriptLock');
assert.match(upload, /finally\s*\{\s*if\s*\(lockAcquired\)\s*\{\s*try\s*\{\s*lock\.releaseLock\(\)/,
  'upload must release the ScriptLock only when acquired');
assert.match(upload, /if\s*\(uploadedFile\)\s*\{\s*try\s*\{\s*uploadedFile\.setTrashed\(true\)/,
  'uncommitted Drive files must be cleaned up after a failed upload');
assert.match(upload, /if\s*\(documentRowWritten\)\s*\{\s*return\s*\{/,
  'a committed document must not be reported as a failed upload and retried as a duplicate');
assert.match(upload, /PSB_DOCUMENT_UPLOAD_FAILED stage=/,
  'upload errors must log a safe processing stage for diagnosis');
assert.match(upload, /Server sedang memproses permintaan lain/,
  'lock contention must return a clear retryable message');

assert.match(bridge, /const UPLOAD_TIMEOUT_MS = 120000/,
  'document upload must have a bounded timeout suitable for Drive processing');
assert.match(bridge, /item\.functionName === 'uploadDocument' \? UPLOAD_TIMEOUT_MS/,
  'the extended timeout must apply only to document upload RPCs');
assert.match(bridge, /MAX_PAYLOAD_CHARS = 20 \* 1024 \* 1024/,
  'the existing bounded request payload limit must remain in place');
assert.match(html, /api-bridge\.js\?v=32\.14\.0/,
  'PWA must load the updated upload transport');
assert.match(serviceWorker, /api-bridge\.js\?v=32\.14\.0/,
  'service worker must precache the updated upload transport');
assert.match(serviceWorker, /psb-pwa-shell-v32-26-0/,
  'PWA shell cache must be versioned for the upload transport change');

console.log('Document upload resilience safeguards passed.');
