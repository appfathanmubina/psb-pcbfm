'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getAcademicYearLifecycleData(sessionToken) {');
const end = code.indexOf('\nfunction ', start + 10);
assert.notEqual(start, -1, 'Academic year lifecycle backend exists');
assert.ok(end > start, 'Academic year lifecycle function boundary exists');
const page = code.slice(start, end);

assert.match(page, /requireRole_\(sessionToken, PSB_MASTER_ACCESS_ROLES\)/,
  'Lifecycle role gate must remain');
assert.ok(page.indexOf('requireRole_(') < page.indexOf('getDatabaseSpreadsheet_('),
  'Authorization must happen before database access');
const expected = [
  ['MASTER_TAHUN_AJARAN', ['tahunAjaranId', 'name', 'isActive']],
  ['MASTER_GELOMBANG', ['tahunAjaranId']],
  ['REGISTRATIONS', ['tahunAjaranId', 'registrationId']],
  ['BILLS', ['registrationId']],
  ['SELECTION_SCHEDULE', ['tahunAjaranId']]
];
for (const [sheet, fields] of expected) {
  const call = page.match(new RegExp('sheetRowsByFields_\\(ss\\.getSheetByName\\(PSB_SHEETS\\.' + sheet + '\\), \\[([^\\]]+)\\]\\)'));
  assert.ok(call, sheet + ' must use a narrow column projection');
  for (const field of fields) {
    assert.ok(call[1].includes("'" + field + "'"), sheet + ' projection must include ' + field);
  }
}
assert.doesNotMatch(page, /sheetRows_\(/,
  'Lifecycle page must not read complete rows and unused columns');
assert.match(page, /registrationYearById/,
  'Bill totals must still resolve through registration IDs');
assert.match(page, /Object\.prototype\.hasOwnProperty\.call\(registrationYearById, registrationId\)/,
  'Duplicate registration IDs must preserve first-match behavior');
assert.match(page, /registrationCountByYear\[id\] \|\| 0/,
  'Registration counts must remain grouped by academic year');
assert.match(page, /waveCountByYear\[id\] \|\| 0/,
  'Wave counts must remain grouped by academic year');
assert.match(page, /scheduleCountByYear\[id\] \|\| 0/,
  'Schedule counts must remain grouped by academic year');
assert.match(page, /billCountByYear\[id\] \|\| 0/,
  'Bill counts must remain grouped by academic year');

console.log('PSB academic year lifecycle projection and aggregation safeguards: OK');
