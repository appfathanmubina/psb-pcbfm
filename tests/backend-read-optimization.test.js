'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getAnnouncementPageData(');
const end = code.indexOf('\nfunction publishAnnouncement(', start);
assert.notEqual(start, -1, 'Announcement page backend exists');
assert.ok(end > start, 'Announcement page backend boundary exists');

const fn = code.slice(start, end);
assert.match(fn, /sheetRowsMatchingValues_\(registrationSheet,\s*'registrationId',\s*resultRegistrationIds\)/,
  'Registrations must be scoped to announcement registration IDs');
assert.match(fn, /sheetRowsMatchingValues_\(candidateSheet,\s*'candidateId',\s*candidateIds\)/,
  'Candidates must be scoped to candidates referenced by announcements');
assert.match(fn, /registrationsById\[String\(r\.registrationId/,
  'Announcement rows must use the registration index');
assert.match(fn, /candidatesById\[String\(reg\.candidateId/,
  'Candidate names must use the candidate index');
assert.doesNotMatch(fn, /findRegistration_\(/,
  'Announcement rendering must not perform repeated registration lookups');
assert.match(fn, /hasRoleDirect_\(actor,\['WALI'\]\)/,
  'Wali visibility restriction must remain enforced');
assert.match(fn, /activeYearId && String\(reg\.tahunAjaranId\)/,
  'Active academic-year filtering must remain enforced');
assert.match(fn, /announcementDate\|\|''\)\.trim\(\)!==''/,
  'Wali must only see published announcements');

console.log('PSB backend batch-read optimization safeguards: OK');
