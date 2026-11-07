'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Required backend function exists: ' + name);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}
assert.doesNotMatch(source, /function\s+getPublicGallery\s*\(/, 'Google Drive public gallery backend must be removed');
assert.doesNotMatch(source, /PSB_PUBLIC_GALLERY_(?:FILE_IDS|FOLDER_ID)|drive\.google\.com\/thumbnail/i, 'No Google Drive gallery configuration or thumbnail URLs may remain');
const documentUpload = functionSource('uploadDocument');
assert.match(documentUpload, /canAccessRegistration_\(actor,\s*found\.registration\)/);
assert.match(documentUpload, /getRegistrationDocumentFolder_\(found\.registration\)/);
assert.match(documentUpload, /folder\.createFile\(blob\)/);
assert.match(documentUpload, /const fileId\s*=\s*file\.getId\(\)/);
assert.match(documentUpload, /record\.fileId\s*=\s*fileId/);
const documentRead = functionSource('getDocumentOptions');
assert.match(documentRead, /canAccessRegistration_\(actor,\s*found\.registration\)/);
assert.ok(documentRead.indexOf('canAccessRegistration_') < documentRead.indexOf('getCurrentDocuments_'));
const documentPage = functionSource('getDocumentPageData');
assert.match(documentPage, /if\s*\(isWali\)\s*\{\s*items\s*=\s*sheetRowsMatchingValues_\(registrationSheet,\s*'userId',\s*\[actor\.userId\]\)/,
  'Wali document page reads must be scoped to the authenticated user at the sheet query');
const paymentUpload = functionSource('submitPayment');
assert.match(paymentUpload, /canAccessRegistration_\(actor,found\.registration\)/);
assert.match(paymentUpload, /getOrCreateFolderInParent_\(yearFolder,'Bukti Pembayaran'\)/);
assert.match(paymentUpload, /regFolder\.createFile\(/);
assert.doesNotMatch(source, /DriveApp\.Access\.ANYONE_WITH_LINK|DriveApp\.Access\.ANYONE/);
console.log('Drive private document safeguards passed; Google Drive gallery backend is absent.');
