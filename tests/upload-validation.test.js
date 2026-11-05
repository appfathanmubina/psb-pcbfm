'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('apps-script/Code.gs', 'utf8');

const helperStart = source.indexOf('function decodeAndValidateUpload_(');
assert.notEqual(helperStart, -1, 'upload validation helper must exist');
const helperEnd = source.indexOf('\nfunction ', helperStart + 1);
const helper = source.slice(helperStart, helperEnd < 0 ? source.length : helperEnd);
assert.match(helper, /encoded\.length > Math\.ceil\(limit \/ 3\) \* 4/);
assert.match(helper, /const chunkSize = 32768/);
assert.match(helper, /Utilities\.base64Decode\(encoded\.slice\(offset, offset \+ chunkSize\)\)/);
assert.match(helper, /PSB_UPLOAD_BASE64_DECODE_FAILED/);
assert.match(helper, /application\/pdf/);
assert.match(helper, /image\/jpeg/);
assert.match(helper, /image\/png/);
assert.match(helper, /image\/webp/);
assert.match(helper, /signatures\[mimeType\]\(bytes\)/);
assert.ok(helper.indexOf('encoded.length >') < helper.indexOf('Utilities.base64Decode'));

assert.match(source, /decodeAndValidateUpload_\(base64,mimeType,5\*1024\*1024\)/);
// Chat attachment upload handling was retired with the PSB Chat module.
assert.match(source, /const configuredMaxSizeMb = Number\(type\.maxSizeMb\)/);
assert.match(source, /const maxSizeMb = Number\.isFinite\(configuredMaxSizeMb\)/);
assert.match(source, /decodeAndValidateUpload_\(base64, mimeType, maxBytes\)/);
assert.doesNotMatch(source, /Math\.min\(configuredMaxSizeMb/);
const frontend = fs.readFileSync('frontend/app.js', 'utf8');
assert.match(frontend, /const max=getDocumentMaxSizeMb\(type\);if\(file\.size>max\*1024\*1024\)/);
assert.match(frontend, /function getDocumentMaxSizeMb\(type\)/);
assert.ok(frontend.includes('Maks. ${esc(getDocumentMaxSizeMb(x))} MB'));
assert.ok(frontend.includes('Maksimum ${esc(maxSizeMb)} MB'));
assert.equal((source.match(/Utilities\.base64Decode\(/g) || []).length, 1,
  'raw Base64 decoding should be centralized in the bounded validation helper');

// Independent signature fixtures for the formats accepted by the server.
const fixtures = [
  ['application/pdf', Buffer.from('%PDF-1.7')],
  ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
  ['image/png', Buffer.from([137,80,78,71,13,10,26,10])],
  ['image/webp', Buffer.from('RIFF0000WEBP')]
];
function signatureMatches(mime, bytes) {
  const b = [...bytes];
  if (mime === 'application/pdf') return b.length >= 5 && String.fromCharCode(...b.slice(0,5)) === '%PDF-';
  if (mime === 'image/jpeg') return b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (mime === 'image/png') return [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v);
  if (mime === 'image/webp') return b.length >= 12 && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP';
  return false;
}
for (const [mime, bytes] of fixtures) assert.equal(signatureMatches(mime, bytes), true, mime);
assert.equal(signatureMatches('image/png', Buffer.from('%PDF-1.7')), false);
assert.equal(signatureMatches('application/pdf', Buffer.from('not a pdf')), false);

console.log('Upload validation safeguards passed.');
