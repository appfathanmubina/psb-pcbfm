'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const queueStart = code.indexOf('function getVerificationQueue(');
const queueEnd = code.indexOf('\nfunction getVerificationDetail(', queueStart);
assert.notEqual(queueStart, -1, 'Verification queue backend exists');
assert.ok(queueEnd > queueStart, 'Verification queue backend boundary exists');
const queue = code.slice(queueStart, queueEnd);
assert.match(queue, /allowed\.indexOf\(String\(status\)\)\s*<\s*0/,
  'Queue status filtering must happen on raw rows');
assert.match(queue, /rowObject_\(headers, row, i \+ 2\)/,
  'Only matching queue rows should be converted to objects');
assert.doesNotMatch(queue, /rows\.map\(\(r,i\)=>rowObject_/,
  'Queue must not allocate objects for every registration before filtering');
assert.match(queue, /registrationNumber.*registrationId|registrationId.*registrationNumber/s,
  'Search must continue checking registration number and ID');
assert.match(queue, /enrichRegistrationList_\(items\)\.slice\(0,200\)/,
  'Queue enrichment, ordering, and 200-row response cap must remain');

const docStart = code.indexOf('function getDocumentPageData(');
const docEnd = code.indexOf('\n\nfunction uploadDocument(', docStart);
assert.notEqual(docStart, -1, 'Document page backend exists');
assert.ok(docEnd > docStart, 'Document page backend boundary exists');
const doc = code.slice(docStart, docEnd);
assert.doesNotMatch(doc, /findRegistration_\(/,
  'Document page must reuse the selected registration instead of rereading all registration-related sheets');
assert.match(doc, /String\(x\.userId\) === String\(actor\.userId\)/,
  'Wali registration ownership restriction must remain enforced');
assert.match(doc, /canAccessRegistration_\(actor, registration\)/,
  'Selected registration access must be checked before returning documents');
assert.match(doc, /registrationsById\[selected\]/,
  'Selected registration must come from the already-read registration rows');
assert.match(doc, /candidatesForDetail\[candidateId\]/,
  'Candidate detail must use the preloaded candidate index');
assert.match(doc, /getCurrentDocuments_\(selected\)/,
  'Current document retrieval must remain scoped to the selected registration');
assert.match(doc, /getActiveMasterItems_\('MASTER_DOKUMEN'\)/,
  'Only active document types must be used for the checklist');

const enrichStart = code.indexOf('function enrichRegistrationList_(');
const enrichEnd = code.indexOf('\nfunction getActiveMasterItems_(', enrichStart);
assert.ok(enrichStart >= 0 && enrichEnd > enrichStart, 'Registration enrichment helper exists');
assert.match(code.slice(enrichStart, enrichEnd), /preloadedMaps/,
  'Registration enrichment must accept request-local maps without changing default callers');

console.log('PSB document and verification queue performance safeguards: OK');
