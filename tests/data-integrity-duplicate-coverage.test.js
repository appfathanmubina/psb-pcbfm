'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = backend.indexOf('function getDataIntegrityReport(sessionToken) {');
const end = backend.indexOf('\nfunction createProductionBackup(sessionToken)', start);
assert.ok(start >= 0 && end > start, 'Data integrity report function must exist');
const report = backend.slice(start, end);

const requiredIdentifiers = [
  "['CONFIG','key']", "['USERS','userId']", "['SESSIONS','sessionId']",
  "['AUDIT_LOG','auditId']", "['NOTIFICATIONS','notificationId']",
  "['MASTER_TAHUN_AJARAN','tahunAjaranId']", "['MASTER_GELOMBANG','gelombangId']",
  "['MASTER_JENJANG','jenjangId']", "['MASTER_KELAS','kelasId']",
  "['MASTER_DOKUMEN','documentTypeId']", "['MASTER_JENIS_PEMBAYARAN','paymentTypeId']",
  "['REGISTRATIONS','registrationId']", "['CANDIDATES','candidateId']",
  "['GUARDIANS','guardianId']", "['ADDRESSES','addressId']", "['SCHOOLS','schoolId']",
  "['DOCUMENTS','documentId']", "['BILLS','billId']", "['PAYMENTS','paymentId']",
  "['PAYMENT_VERIFICATIONS','verificationId']", "['SELECTION_SCHEDULE','scheduleId']",
  "['SELECTION_PARTICIPANTS','participantId']", "['SELECTION_SCORES','scoreId']",
  "['SELECTION_RESULTS','resultId']", "['REREGISTRATIONS','reregistrationId']",
  "['INCIDENTS','incidentId']", "['MIGRATION_LOG','migrationId']"
];
for (const spec of requiredIdentifiers) {
  assert.ok(report.includes(spec), 'Primary identifier check missing: ' + spec);
}
assert.match(report, /if\(!exists\(sheet\)\)[\s\S]*?pemeriksaan duplikasi dilewati/,
  'Missing sheets must be reported as warnings instead of appearing duplicate-free');
assert.match(report, /unique_registration_number/,
  'Registration numbers must be unique');
for (const key of [
  'unique_active_bill_type',
  'unique_active_payment_per_bill',
  'unique_payment_verification',
  'unique_current_document_type',
  'unique_selection_participant',
  'unique_selection_score_component',
  'unique_selection_result',
  'unique_reregistration'
]) {
  assert.ok(report.includes(key), 'Business-key integrity check missing: ' + key);
}
assert.match(report, /duplicateSummary','Total kelompok duplikasi identifier\/relasi/,
  'Duplicate summary must cover both primary identifiers and business relationships');

console.log('Data integrity duplicate coverage safeguards: OK');
