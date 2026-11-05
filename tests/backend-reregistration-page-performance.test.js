'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getReregistrationPageData(sessionToken) {');
const end = code.indexOf('\nfunction openReregistration(', start);
assert.notEqual(start, -1, 'Reregistration page backend exists');
assert.ok(end > start, 'Reregistration page function boundary exists');
const page = code.slice(start, end);

assert.match(page, /requireRole_\(sessionToken, PSB_REREGISTRATION_VIEW_ROLES\)/,
  'Reregistration view role gate must remain');
assert.ok(page.indexOf('requireRole_(') < page.indexOf('getDatabaseSpreadsheet_('),
  'Authorization must happen before reading registration data');
assert.match(page, /String\(r\.userId\) === String\(actor\.userId\)/,
  'Wali must remain restricted to their own registrations');
assert.match(page, /const readTable = sheet =>/,
  'Page must use a request-local one-range table reader');
assert.match(page, /sheet\.getRange\(1,1,sheet\.getLastRow\(\),sheet\.getLastColumn\(\)\)\.getValues\(\)/,
  'Each loaded table must use one range read');
assert.equal((page.match(/readTable\(ss\.getSheetByName\(/g) || []).length, 5,
  'Selection results, candidates, documents, bills, and payments must each be read once');
assert.match(page, /const regTable = readTable\(regSheet\)/,
  'Registrations must be read once');
assert.match(page, /const rrTable = readTable\(rrSheet\)/,
  'Reregistrations must be read once');
assert.match(page, /const firstBy = \(rows, key\)/,
  'ID indexes must preserve first matching rows');
assert.match(page, /if \(id && !Object\.prototype\.hasOwnProperty\.call\(map,id\)\) map\[id\] = row/,
  'Duplicate IDs must preserve first-row lookup behavior');
assert.match(page, /firstRegistrationById\[id\]/,
  'Candidate lookup must use the first matching registration, as findRegistration_ did');
assert.match(page, /const opened = eligible\.filter\(x => !!x\.rr\)/,
  'Document and payment work must be limited to already-opened reregistrations');
assert.match(page, /String\(row\[documentStatusIdx\] \|\| ''\)\.toUpperCase\(\) === 'REPLACED'/,
  'Replaced documents must remain excluded');
assert.match(page, /String\(b\.uploadedAt\|\|''\)\.localeCompare\(String\(a\.uploadedAt\|\|''\)\)/,
  'Current documents must remain newest-first');
assert.match(page, /requiredDocs = getActiveMasterItems_\('MASTER_DOKUMEN'\)\.filter\(x => x\.required\)/,
  'Only active required document types must be used');
assert.match(page, /paymentTypeRows = getActiveMasterItems_\('MASTER_JENIS_PEMBAYARAN'\)/,
  'Active payment types must be loaded once and reused');
assert.match(page, /paymentsByRegistrationAndBill\[id\]\[String\(payment\.billId\)\] = payment/,
  'Payment lookup must preserve last-row-wins behavior per registration and bill');
assert.match(page, /bills\.find\(b => \/daftar\\s\*ulang\/i/,
  'The first Daftar Ulang bill must remain the selected bill');
assert.match(page, /readyToComplete:ready/,
  'Readiness response must remain present');
assert.match(page, /canManage:hasRoleDirect_\(actor,PSB_REREGISTRATION_ADMIN_ROLES\)/,
  'Management permission response must remain');
assert.doesNotMatch(page, /findRegistration_\(|findRowById_\(|getCurrentDocuments_\(|buildPaymentData_\(/,
  'The page must not call per-registration helpers that reread sheets');
assert.doesNotMatch(page, /ensureReregistration_\(|setRegistrationStatus_\(|createNotification_\(|appendRow\(|setValue\(/,
  'The page-data GET must remain read-only');

console.log('PSB reregistration page batch-read and ownership safeguards: OK');
