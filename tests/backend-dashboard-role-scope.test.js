'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getDashboardPageData(sessionToken) {');
const end = code.indexOf('\nfunction findParticipantRegistration_', start);
assert.notEqual(start, -1, 'Dashboard backend exists');
assert.ok(end > start, 'Dashboard backend boundary exists');
const page = code.slice(start, end);

assert.match(page, /requireRole_\(sessionToken, PSB_DASHBOARD_ROLES\)/,
  'Dashboard authorization must remain before cache/database access');
assert.match(page, /PSB_DASHBOARD_V5_/,
  'Dashboard cache namespace must be bumped for the sanitized response');
assert.match(page, /const verificationItems = canVerification \?/,
  'Verification queue must be built only for authorized roles');
assert.match(page, /const paymentItems = canPayments \?/,
  'Payment queue must be built only for authorized roles');
assert.match(page, /const selectionItems = canSelection \?/,
  'Selection queue must be built only for authorized roles');
assert.match(page, /const publishItems = canAnnouncement \?/,
  'Announcement queue must be built only for authorized roles');
assert.match(page, /const reregItems = canReregistration \?/,
  'Reregistration queue must be built only for authorized roles');
assert.match(page, /activeScheduleItems/,
  'Schedule cards must be collected with the active schedule count');
assert.doesNotMatch(page, /const isWali|const yearMap/,
  'Unused Dashboard variables must be removed');

const roles = {
  SUPERADMIN: ['SUPERADMIN'],
  ADMIN_PSB: ['ADMIN_PSB'],
  VERIFIKATOR: ['VERIFIKATOR'],
  SELEKSI: ['SELEKSI'],
  KEUANGAN: ['KEUANGAN']
};
const fixtures = {
  REGISTRATIONS: [
    { registrationId: 'r1', registrationNumber: '001', candidateId: 'c1', tahunAjaranId: 'y1', status: 'SUBMITTED', createdAt: '2026-11-01' },
    { registrationId: 'r2', registrationNumber: '002', candidateId: 'c2', tahunAjaranId: 'y1', status: 'VERIFIED', createdAt: '2026-11-02' }
  ],
  CANDIDATES: [{ candidateId: 'c1', fullName: 'Calon Satu' }, { candidateId: 'c2', fullName: 'Calon Dua' }],
  USERS: [{ status: 'ACTIVE' }],
  BILLS: [{ billId: 'b1', registrationId: 'r1', status: 'PAYMENT_REVIEW', amount: 100, updatedAt: '2026-11-03' }],
  PAYMENTS: [{ paymentId: 'p1', billId: 'b1', registrationId: 'r1', amount: 100, status: 'SUBMITTED', createdAt: '2026-11-03' }],
  SELECTION_PARTICIPANTS: [{ participantId: 'p1', registrationId: 'r2', status: 'SCHEDULED', scheduleId: 's1' }],
  SELECTION_RESULTS: [{ resultId: 'z1', registrationId: 'r2', status: 'PASSED' }],
  REREGISTRATIONS: [{ reregistrationId: 'rr1', registrationId: 'r2', status: 'PENDING' }],
  SELECTION_SCHEDULE: [{ scheduleId: 's1', name: 'Tes', isActive: 'TRUE', selectionDate: '2026-11-05', location: 'Kampus' }],
  MASTER_TAHUN_AJARAN: [{ tahunAjaranId: 'y1', name: '2027/2028' }],
  MASTER_JENJANG: [],
  MASTER_GELOMBANG: []
};
const context = {
  PSB_DASHBOARD_ROLES: Object.keys(roles),
  PSB_REPORT_ROLES: ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'],
  PSB_VERIFICATION_ROLES: ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'],
  PSB_PAYMENT_MANAGE_ROLES: ['SUPERADMIN','ADMIN_PSB','KEUANGAN'],
  PSB_ANNOUNCEMENT_ADMIN_ROLES: ['SUPERADMIN','ADMIN_PSB','SELEKSI'],
  PSB_REREGISTRATION_ADMIN_ROLES: ['SUPERADMIN','ADMIN_PSB','KEUANGAN'],
  PSB_MONITORING_ROLES: ['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'],
  PSB_INCIDENT_ROLES: ['SUPERADMIN','ADMIN_PSB'],
  PSB_SHEETS: Object.fromEntries(Object.keys(fixtures).map(k => [k, k])),
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
  sha256Hex_: value => String(value),
  requireRole_: (token, allowed) => {
    assert.deepEqual(Array.from(allowed), Object.keys(roles), 'Dashboard role allowlist remains unchanged');
    return { role: token };
  },
  getDatabaseSpreadsheet_: () => ({ getSheetByName: name => name }),
  getConfig_: () => '2027/2028',
  sheetRows_: name => fixtures[name] || [],
  sheetRowsProjectedAll_: (name, fields) => (fixtures[name] || []).map(row => Object.fromEntries((fields || Object.keys(row)).map(key => [key, row[key]]))),
  sheetRowsMatchingValues_: (name, field, values) => {
    const wanted = new Set((values || []).map(value => String(value || '')));
    return (fixtures[name] || []).filter(row => wanted.has(String(row[field] || ''))).map(row => Object.assign({}, row));
  },
  Utilities: { formatDate: () => '2026-11-05' },
  Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
  statusLabel_: value => value,
  findParticipantRegistration_: participant => participant && participant.registrationId ? participant.registrationId : '',
  sortCountMap_: obj => Object.keys(obj || {}).map(name => ({ name, count: Number(obj[name] || 0) })).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name))
};
const selectionAdminRolesDeclaration = code.match(/^const PSB_SELECTION_ADMIN_ROLES = \[[^\n]+\];$/m);
assert.ok(selectionAdminRolesDeclaration,
  'Production backend must declare the selection admin role allowlist used by Dashboard');
const ledgerHelperStart = code.indexOf('function paymentAmountMatchesBill_(');
const ledgerHelperEnd = code.indexOf('\nfunction preferredPaymentForBill_(', ledgerHelperStart);
assert.ok(ledgerHelperStart >= 0 && ledgerHelperEnd > ledgerHelperStart,
  'Dashboard test must load the canonical payment ledger helpers');
const ledgerHelpers = code.slice(ledgerHelperStart, ledgerHelperEnd);
vm.createContext(context);
vm.runInContext(selectionAdminRolesDeclaration[0] + '\n' + ledgerHelpers + '\n' + page, context);

function response(role) {
  return JSON.parse(JSON.stringify(context.getDashboardPageData(role)));
}
const allowed = {
  SUPERADMIN: ['verification','payments','selection','announcements','reregistration','schedules'],
  ADMIN_PSB: ['verification','payments','selection','announcements','reregistration','schedules'],
  VERIFIKATOR: ['verification'],
  SELEKSI: ['selection','announcements','schedules'],
  KEUANGAN: ['payments','reregistration']
};
for (const role of Object.keys(roles)) {
  const data = response(role);
  assert.equal(data.success, true, role + ' dashboard succeeds');
  const queues = {
    verification: data.operational.verification,
    payments: data.operational.payments,
    selection: data.operational.selection,
    announcements: data.operational.announcements,
    reregistration: data.operational.reregistration,
    schedules: data.operational.schedules
  };
  for (const [key, queue] of Object.entries(queues)) {
    const canSee = allowed[role].includes(key);
    if (key === 'schedules') {
      assert.equal(queue.today.length + queue.tomorrow.length > 0, canSee,
        role + ' schedule details must match selection permission');
    } else {
      assert.equal(queue.count > 0, canSee,
        role + ' ' + key + ' queue count must match permission');
      assert.equal(queue.items.length > 0, canSee,
        role + ' ' + key + ' queue items must match permission');
    }
  }
  assert.equal(data.operational.activeSchedules > 0, allowed[role].includes('schedules'),
    role + ' active schedule count must match selection permission');
  assert.equal(data.operational.activeUsers > 0, role !== 'NONE',
    role + ' active-user count remains limited to monitoring roles');
}
const verifikator = response('VERIFIKATOR');
assert.equal(verifikator.permissions.canPayments, false);
assert.deepEqual(verifikator.operational.payments.items, []);
assert.deepEqual(verifikator.operational.announcements.items, []);
const selection = response('SELEKSI');
assert.deepEqual(selection.operational.payments.items, []);
assert.deepEqual(selection.operational.reregistration.items, []);
const finance = response('KEUANGAN');
assert.deepEqual(finance.operational.selection.items, []);
assert.deepEqual(finance.operational.schedules.today, []);

console.log('PSB dashboard role-scoped operational queue safeguards: OK');
