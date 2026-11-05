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
assert.match(currentDocs, /getRange\(1,1,lastRow,lastColumn\)\.getValues\(\)/,
  'Current documents must be read in one range request');
assert.match(currentDocs, /headers\.indexOf\('registrationId'\)/,
  'Document filtering must use the registrationId column');
assert.match(currentDocs, /String\(row\[regIdx\] \|\| ''\) !== String\(registrationId\)/,
  'Raw rows must be filtered to the requested registration before conversion');
assert.match(currentDocs, /statusIdx >= 0 && String\(row\[statusIdx\] \|\| ''\)\.toUpperCase\(\) === 'REPLACED'/,
  'REPLACED documents must remain excluded');
assert.match(currentDocs, /documents\.push\(rowObject_\(headers,row,i\+1\)\)/,
  'Only matching current document rows should be converted to objects');
assert.match(currentDocs, /String\(b\.uploadedAt\|\|''\)\.localeCompare\(String\(a\.uploadedAt\|\|''\)\)/,
  'Current documents must remain sorted newest first');

const batchLookup = functionSource('findRegistrationBatch_');
assert.equal((batchLookup.match(/readTable\(ss\.getSheetByName\(/g) || []).length, 5,
  'Registration detail must batch-read each related table exactly once');
assert.doesNotMatch(batchLookup, /findRowById_|findFirstBy_/,
  'Batch lookup must not invoke helpers that reread the same sheets');
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
