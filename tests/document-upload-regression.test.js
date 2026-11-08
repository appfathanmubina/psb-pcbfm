'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const client = fs.readFileSync('frontend/app.js', 'utf8');

assert.match(backend, /const chunkSize = 32768/,
  'Document Base64 decoding must use bounded chunks');
assert.match(backend, /Utilities\.base64Decode\(encoded\.slice\(offset, offset \+ chunkSize\)\)/,
  'Each Base64 chunk must be decoded independently');
assert.match(backend, /PSB_UPLOAD_BASE64_DECODE_FAILED/,
  'Decode failures must be logged with a dedicated stage marker');
assert.match(backend, /buildDocumentUploadFileName_\(found\.candidate\?\.fullName/,
  'Stored filenames must be generated from the candidate name');
assert.match(backend, /type\.name \|\| 'Dokumen'/,
  'Stored filenames must include the document type');
assert.match(backend, /extensionMatch = original\.match/,
  'The original file extension must be preserved');
assert.match(backend, /replace\(\/\\s\+\/g, '_'\)/,
  'Spaces in generated filenames must become underscores');
assert.match(client, /server\('uploadDocument'/,
  'The existing upload API flow must remain in use');
assert.match(client, /fileSize:prepared\.fileSize,base64/,
  'The client must send the processed file size with the matching Base64 payload');

console.log('Document upload decode and filename safeguards: OK');
