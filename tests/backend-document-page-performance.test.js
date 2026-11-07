'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const queueStart = code.indexOf('function getVerificationQueue(');
const queueEnd = code.indexOf('\nfunction getVerificationDetail(', queueStart);
assert.notEqual(queueStart, -1, 'Verification queue backend exists');
assert.ok(queueEnd > queueStart, 'Verification queue backend boundary exists');
const queue = code.slice(queueStart, queueEnd);
assert.match(queue, /sheetRowsByFields_\(sheet,\s*\[/,
  'Queue must project filter and sort fields before loading complete rows');
assert.match(queue, /let selected = projected\.filter\(/,
  'Queue status/payment eligibility filtering must happen on projected rows before candidate-name search');
assert.match(queue, /sheetRowsAtRowNumbers_\(sheet,\s*rowNumbers\)/,
  'Only the capped matching queue rows should be converted to complete objects');
assert.match(queue, /registrationNumber.*registrationId|registrationId.*registrationNumber/s,
  'Search must continue checking registration number and ID');
assert.match(queue, /pageSize = Math\.min\(100, Math\.max\(1/,
  'Queue page size must remain bounded');
assert.match(queue, /selected\.slice\(\(page - 1\) \* pageSize, page \* pageSize\)\.map\(item => item\.rowNumber\)/,
  'Queue must select only the requested page before full-row reads and enrichment');
assert.match(queue, /candidate\.fullName, candidate\.name/,
  'Queue search must include candidate names without loading full registration rows');
assert.match(queue, /enrichRegistrationList_\(limitedItems\)/,
  'Only capped queue records should be enriched');

const docStart = code.indexOf('function getDocumentPageData(');
const docEnd = code.indexOf('\n\nfunction uploadDocument(', docStart);
assert.notEqual(docStart, -1, 'Document page backend exists');
assert.ok(docEnd > docStart, 'Document page backend boundary exists');
const doc = code.slice(docStart, docEnd);
assert.doesNotMatch(doc, /findRegistration_\(/,
  'Document page must reuse the selected registration instead of rereading all registration-related sheets');
assert.match(doc, /sheetRowsMatchingValues_\(registrationSheet,\s*'userId',\s*\[actor\.userId\]\)/,
  'Wali registrations must be scoped to the authenticated owner at the sheet read');
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
