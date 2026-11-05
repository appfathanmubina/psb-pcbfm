'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getReportingPageData(');
const end = code.indexOf('\nfunction ', start + 10);
assert.notEqual(start, -1, 'Reporting page backend exists');
assert.ok(end > start, 'Reporting page backend boundary exists');
const page = code.slice(start, end);

assert.match(page, /requireRole_\(sessionToken, PSB_REPORT_ROLES\)/,
  'Reporting role gate must remain at the start of the endpoint');
assert.match(page, /billSummaryByRegistration/,
  'Bills must be aggregated once by registration');
assert.match(page, /latestPaymentByRegistration/,
  'Latest payments must be indexed once by registration');
assert.match(page, /invalidPaymentTimestampByRegistration/,
  'Invalid payment timestamps must retain the legacy sort fallback');
assert.doesNotMatch(page, /billList\.filter|billList\.some/,
  'Per-registration bill scans must be removed');
assert.doesNotMatch(page, /paymentMap\[String\(r\.registrationId\)\]\|\|\[\]\)\.slice\(\)\.sort/,
  'Per-registration payment sorting must be removed from row construction');

const calls = [];
const sheets = {
  REGISTRATIONS: [
    { registrationId: 'r1', registrationNumber: '001', candidateId: 'c1', tahunAjaranId: 'y1', gelombangId: 'w1', jenjangId: 'j1', status: 'VERIFIED', createdAt: '2026-10-01' },
    { registrationId: 'r2', registrationNumber: '002', candidateId: 'c2', tahunAjaranId: 'y1', gelombangId: 'w1', jenjangId: 'j1', status: 'SUBMITTED', createdAt: '2026-10-02' },
    { registrationId: 'r3', registrationNumber: '003', candidateId: 'c3', tahunAjaranId: 'y1', gelombangId: 'w1', jenjangId: 'j1', status: 'COMPLETED', createdAt: '2026-10-03' },
    { registrationId: 'old', registrationNumber: '004', candidateId: 'c4', tahunAjaranId: 'y0', gelombangId: 'w1', jenjangId: 'j1', status: 'VERIFIED' }
  ],
  CANDIDATES: [
    { candidateId: 'c1', fullName: 'Calon Satu', gender: 'L' },
    { candidateId: 'c2', fullName: 'Calon Dua', gender: 'P' },
    { candidateId: 'c3', fullName: 'Calon Tiga', gender: 'L' },
    { candidateId: 'c4', fullName: 'Calon Lama', gender: 'L' }
  ],
  BILLS: [
    { registrationId: 'r1', status: 'PAID', amount: 100 },
    { registrationId: 'r1', status: 'paid', amount: '200' },
    { registrationId: 'r1', status: 'UNPAID', amount: 50 },
    { registrationId: 'r2', status: 'UNPAID', amount: 75 }
  ],
  PAYMENTS: [
    { registrationId: 'r1', status: 'OLD', createdAt: '2026-10-01T10:00:00Z' },
    { registrationId: 'r1', status: 'LATEST_FIRST', createdAt: '2026-10-02T10:00:00Z' },
    { registrationId: 'r1', status: 'LATEST_TIE', createdAt: '2026-10-02T10:00:00Z' },
    { registrationId: 'r2', status: 'REJECTED', createdAt: '2026-10-03T10:00:00Z' },
    { registrationId: 'r3', status: 'INVALID_FIRST', createdAt: 'not-a-date' },
    { registrationId: 'r3', status: 'VALID_LATER', createdAt: '2026-10-04T10:00:00Z' }
  ],
  SELECTION_PARTICIPANTS: [],
  SELECTION_RESULTS: [
    { registrationId: 'r1', status: 'PASSED', announcementDate: '2026-11-01' },
    { registrationId: 'r2', status: 'NOT_PASSED' },
    { registrationId: 'r3', status: 'PASSED' }
  ],
  REREGISTRATIONS: [
    { registrationId: 'r3', status: 'COMPLETED' }
  ],
  MASTER_TAHUN_AJARAN: [
    { tahunAjaranId: 'y1', name: '2027/2028' },
    { tahunAjaranId: 'y0', name: '2026/2027' }
  ],
  MASTER_GELOMBANG: [
    { gelombangId: 'w1', tahunAjaranId: 'y1', name: 'Gelombang 1' }
  ],
  MASTER_JENJANG: [
    { jenjangId: 'j1', name: 'SMP', isActive: true }
  ]
};

const context = {
  PSB_REPORT_ROLES: ['ADMIN_PSB'],
  PSB_SHEETS: Object.fromEntries(Object.keys(sheets).map(key => [key, key])),
  requireRole_: () => { calls.push('role'); return { role: 'ADMIN_PSB' }; },
  getDatabaseSpreadsheet_: () => {
    calls.push('database');
    return { getSheetByName: name => name };
  },
  getConfig_: () => '2027/2028',
  sheetRows_: name => sheets[name] || [],
  normalizeReportGender_: value => String(value || '').trim().toUpperCase(),
  reportGenderName_: value => String(value || '').toUpperCase() === 'L' ? 'Laki-laki' : 'Perempuan',
  reportGroupName_: (level, gender) => level + ' · ' + (String(gender).toUpperCase() === 'L' ? 'Putra' : 'Putri')
};
vm.createContext(context);
vm.runInContext(page, context);
const result = context.getReportingPageData('session-token', {});

assert.deepEqual(calls.slice(0, 2), ['role', 'database'],
  'Authorization must happen before database access');
assert.equal(result.success, true);
assert.equal(result.rows.length, 3, 'Only active academic-year registrations should be reported');
assert.deepEqual(result.summary, { total: 3, paid: 1, passed: 2, completed: 1 });
assert.equal(result.rows[0].candidateName, 'Calon Satu');
assert.equal(result.rows[0].paidAmount, 300, 'Paid bill amounts must be summed with numeric coercion');
assert.equal(result.rows[0].paymentStatus, 'PAID', 'Any PAID bill must take precedence over payment status');
assert.equal(result.rows[1].paymentStatus, 'REJECTED', 'Latest payment status must be used when no bill is paid');
assert.equal(result.rows[2].paymentStatus,
  sheets.PAYMENTS.filter(x => x.registrationId === 'r3').slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0].status,
  'Invalid timestamp groups must preserve the exact legacy sort selection');
assert.equal(result.rows[0].selectionStatus, 'PASSED');
assert.equal(result.rows[2].reregistrationStatus, 'COMPLETED');
assert.deepEqual(Object.keys(result.filters), ['tahunAjaranId', 'gelombangId', 'jenjangId', 'gender', 'status']);
assert.ok(Array.isArray(result.options.tahunAjaran));
assert.ok(Array.isArray(result.options.statuses));

const filtered = context.getReportingPageData('session-token', { gender: 'L' });
assert.deepEqual(filtered.rows.map(x => x.registrationId), ['r1', 'r3'],
  'Existing gender filter semantics must remain unchanged');

console.log('PSB reporting payment aggregation and compatibility safeguards: OK');
