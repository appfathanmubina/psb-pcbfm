'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');

function functionSource(name) {
  const start = code.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Required backend function exists: ' + name);
  const next = code.indexOf('\nfunction ', start + 10);
  return code.slice(start, next < 0 ? code.length : next);
}

const currentDocs = functionSource('getCurrentDocuments_');
assert.match(currentDocs, /sheetRowsMatchingValues_\(sheet,\s*'registrationId',\s*\[registrationId\]\)/,
  'Current documents must be read only for the requested registration');
assert.match(currentDocs, /filter\(document => String\(document\.status \|\| ''\)\.toUpperCase\(\) !== 'REPLACED'\)/,
  'REPLACED documents must remain excluded');
assert.match(currentDocs, /sort\(\(a,b\)=>String\(b\.uploadedAt\|\|''\)\.localeCompare\(String\(a\.uploadedAt\|\|''\)\)\)/,
  'Current documents must remain sorted newest first');

const batchLookup = functionSource('findRegistrationBatch_');
assert.match(batchLookup, /findFirstIndexedRow_\(\s*ss\.getSheetByName\(PSB_SHEETS\.REGISTRATIONS\)/,
  'Registration detail must use the indexed registration lookup');
for (const sheetName of ['CANDIDATES','GUARDIANS','ADDRESSES','SCHOOLS']) {
  assert.match(batchLookup, new RegExp('findFirstIndexedRow_\\(\\s*ss\\.getSheetByName\\(PSB_SHEETS\\.' + sheetName + '\\)'));
}
assert.doesNotMatch(batchLookup, /readTable\(/,
  'Registration detail must not load full related tables');
assert.match(batchLookup, /if \(!fallback\) fallback = found/,
  'Duplicate related rows must preserve the first-row fallback');
assert.match(batchLookup, /preferPrimary && primaryIdx >= 0/,
  'Guardian, address, and school selection must preserve primary-row preference');

const verification = functionSource('getVerificationDetail');
assert.match(verification, /requireRole_\(sessionToken, PSB_VERIFICATION_ROLES\)/,
  'Verification detail must retain its role gate');
assert.ok(verification.indexOf('requireRole_(') < verification.indexOf('findRegistrationBatch_('),
  'Verification role authorization must happen before loading registration detail');
assert.match(verification, /getCurrentDocuments_\(String\(registrationId \|\| ''\)\)/,
  'Verification detail must load only current documents for the requested registration');
assert.match(verification, /getActiveMasterItems_\('MASTER_DOKUMEN'\)/,
  'Verification checklist must continue using active document types');

const options = functionSource('getDocumentOptions');
assert.match(options, /findRegistrationBatch_\(getDatabaseSpreadsheet_\(\), String\(registrationId \|\| ''\)\)/,
  'Document options must reuse the batch registration lookup');
assert.match(options, /canAccessRegistration_\(actor, found\.registration\)/,
  'Document options must continue enforcing registration ownership');
assert.ok(options.indexOf('canAccessRegistration_(') < options.indexOf('getCurrentDocuments_('),
  'Document ownership must be checked before returning document records');

console.log('PSB current document and verification detail performance safeguards: OK');
