'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = backend.indexOf('function getAdvancedReportingData(');
const end = backend.indexOf('\nfunction ', start + 10);
assert.ok(start >= 0 && end > start, 'Advanced reporting function must exist');
const source = backend.slice(start, end);

assert.match(source, /eligiblePaidBills=scopedBills\.filter\([\s\S]*?state\?\.status==='PAID'&&!state\.requiresReview/,
  'Conversion funnel must use clean, reconciled paid bills only');
assert.match(source, /eligibleVerifiedPayments=verifiedPayments\.filter\([\s\S]*?state\?\.status==='PAID'&&!state\.requiresReview/,
  'Recent payment activity must exclude bills that still require reconciliation');
assert.match(source, /eligiblePaidBills\.forEach\(b=>\{paymentVerifiedRegistrationIds/,
  'Payment-verified registration count must use the canonical eligible set');
assert.match(source, /payments:eligibleVerifiedPayments\.filter/,
  'Last-30-day payment count must use the canonical eligible set');

const now = new Date().toISOString();
const sheets = {
  MASTER_TAHUN_AJARAN: [{ tahunAjaranId: 'y1', name: '2027/2028' }],
  MASTER_GELOMBANG: [{ gelombangId: 'w1', tahunAjaranId: 'y1', name: 'Gelombang 1' }],
  MASTER_JENJANG: [{ jenjangId: 'j1', name: 'SMP' }],
  REGISTRATIONS: [
    { registrationId: 'r-clean', tahunAjaranId: 'y1', candidateId: 'c1', gelombangId: 'w1', jenjangId: 'j1', status: 'VERIFIED', createdAt: now, submittedAt: now, verifiedAt: now },
    { registrationId: 'r-review', tahunAjaranId: 'y1', candidateId: 'c2', gelombangId: 'w1', jenjangId: 'j1', status: 'VERIFIED', createdAt: now, submittedAt: now, verifiedAt: now }
  ],
  CANDIDATES: [{ candidateId: 'c1', gender: 'L' }, { candidateId: 'c2', gender: 'P' }],
  BILLS: [
    { billId: 'b-clean', registrationId: 'r-clean', status: 'PAID', amount: 100, paymentTypeId: 'form' },
    { billId: 'b-review', registrationId: 'r-review', status: 'PAID', amount: 200, paymentTypeId: 'form' }
  ],
  PAYMENTS: [
    { paymentId: 'p-clean', billId: 'b-clean', registrationId: 'r-clean', amount: 100, status: 'VERIFIED', createdAt: now, submittedAt: now },
    { paymentId: 'p-review-1', billId: 'b-review', registrationId: 'r-review', amount: 200, status: 'VERIFIED', createdAt: now, submittedAt: now },
    { paymentId: 'p-review-2', billId: 'b-review', registrationId: 'r-review', amount: 200, status: 'VERIFIED', createdAt: now, submittedAt: now }
  ],
  SELECTION_PARTICIPANTS: [],
  SELECTION_RESULTS: [],
  REREGISTRATIONS: []
};

const context = {
  PSB_REPORT_ROLES: ['ADMIN_PSB'],
  PSB_SHEETS: Object.fromEntries(Object.keys(sheets).map(key => [key, key])),
  requireRole_: () => ({ userId: 'admin', role: 'ADMIN_PSB' }),
  getDatabaseSpreadsheet_: () => ({ getSheetByName: name => name }),
  getConfig_: () => '2027/2028',
  sheetRowsByFields_: name => sheets[name] || [],
  sheetRowsMatchingValuesByFields_: (name, key, wanted) =>
    (sheets[name] || []).filter(row => wanted.map(String).includes(String(row[key] || ''))),
  normalizeReportGender_: value => String(value || '').trim().toUpperCase(),
  reportGroupName_: (level, gender) => level + ' · ' + (String(gender).toUpperCase() === 'L' ? 'Putra' : 'Putri'),
  reconcilePaymentLedger_: () => ({
    summary: {
      billAmount: 300, paidAmount: 300, pendingAmount: 0, rejectedAmount: 0,
      paidBills: 2, pendingBills: 0, rejectedPayments: 0, orphanPayments: 0,
      registrationMismatchPayments: 0, amountMismatchPayments: 0,
      duplicateVerifiedBills: 1, paidWithoutVerifiedBills: 0,
      verifiedBillStatusMismatch: 0, requiresReviewBills: 1
    },
    byBill: {
      'b-clean': { status: 'PAID', requiresReview: false },
      'b-review': { status: 'PAID', requiresReview: true }
    },
    verifiedPayments: [
      sheets.PAYMENTS[0], sheets.PAYMENTS[1], sheets.PAYMENTS[2]
    ]
  }),
  Utilities: {
    formatDate: () => '2026-11'
  },
  Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
  writeAudit_: () => {}
};
vm.createContext(context);
vm.runInContext(source, context);
const result = context.getAdvancedReportingData('session-token', {});

assert.equal(result.success, true);
assert.equal(result.funnel.registrations, 2);
assert.equal(result.funnel.verified, 2);
assert.equal(result.funnel.paymentVerified, 1,
  'A PAID bill with duplicate verified proofs must not advance the conversion funnel');
assert.equal(result.conversion.paymentRate, 50);
assert.equal(result.last30.payments, 1,
  'Recent verified-payment activity must exclude the unresolved duplicate bill');
assert.equal(result.finance.paidBills, 2,
  'Finance totals continue to show both paid bills while reconciliation warnings remain visible');
assert.equal(result.finance.reconciliationRequired, 1);
assert.equal(result.finance.duplicateVerifiedBills, 1);

console.log('Advanced reporting clean payment eligibility and reconciliation metrics: OK');
