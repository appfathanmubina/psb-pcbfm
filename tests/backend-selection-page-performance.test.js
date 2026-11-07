'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getSelectionPageData(sessionToken, registrationId) {');
const end = code.indexOf('\nfunction createSelectionSchedule(', start);
assert.notEqual(start, -1, 'Selection page backend exists');
assert.ok(end > start, 'Selection page function boundary exists');
const page = code.slice(start, end);

const viewDeclaration = code.match(/^const PSB_SELECTION_VIEW_ROLES = \[([^\]]+)\];$/m);
assert.ok(viewDeclaration, 'Backend must declare the role allowlist used by getSelectionPageData');
const viewRoles = viewDeclaration[1].split(',').map(value => value.trim().replace(/^['"]|['"]$/g, ''));
assert.deepEqual(viewRoles, ['WALI', 'SUPERADMIN', 'ADMIN_PSB', 'SELEKSI', 'VERIFIKATOR'],
  'Tes page view roles must include Wali and the supported operational roles');
const announcementDeclaration = code.match(/^const PSB_ANNOUNCEMENT_VIEW_ROLES = \[([^\]]+)\];$/m);
assert.ok(announcementDeclaration, 'Announcement view-role allowlist must exist');
const announcementRoles = announcementDeclaration[1].split(',').map(value => value.trim().replace(/^['"]|['"]$/g, ''));
assert.deepEqual(viewRoles, announcementRoles,
  'Tes and Pengumuman must support the same view roles');

assert.match(page, /requireRole_\(sessionToken, PSB_SELECTION_VIEW_ROLES\)/,
  'Selection view role gate must remain');
assert.ok(page.indexOf('requireRole_(') < page.indexOf('getDatabaseSpreadsheet_('),
  'Authorization must happen before database access');
assert.match(page, /const registrationRows = isWali\s*\?\s*sheetRowsMatchingValues_\(regSheet, 'userId', \[actor\.userId\]\)\s*:\s*sheetRowsByFields_\(regSheet,/,
  'Wali registrations must be owner-filtered and staff registration reads must be column-scoped');
assert.match(page, /registrationById\[key\] = r/,
  'A complete first-match registration lookup index must be built');
assert.match(page, /const candidateRows = isWali\s*\?\s*sheetRowsMatchingValues_\(candidateSheet, 'candidateId', candidateIds\)\s*:\s*sheetRowsByFields_\(candidateSheet,/,
  'Wali candidate reads must be restricted to owned registrations and staff candidate reads must be column-scoped');
assert.match(page, /const candidateMap = \{\}/,
  'Candidate lookup map must be built once from the preloaded candidate rows');
assert.match(page, /enrichRegistrationList_\(registrationItems, enrichmentMaps\)\.slice\(0, 300\)/,
  'Registration enrichment must reuse preloaded maps and preserve the 300-item cap');
assert.match(page, /years: sheetMapById_/,
  'Academic year enrichment map must be preloaded');
assert.match(page, /waves: sheetMapById_/,
  'Wave enrichment map must be preloaded');
assert.match(page, /levels: sheetMapById_/,
  'Level enrichment map must be preloaded');
assert.match(page, /if \(isWali\) registrationItems = registrationItems\.filter\(x => String\(x\.userId\) === String\(actor\.userId\)\)/,
  'Wali registrations must remain restricted to the signed-in owner');
assert.match(page, /const participantsByRegistration = \{\}/,
  'Participants must be indexed by registration');
assert.match(page, /const scoresByParticipant = \{\}/,
  'Scores must be indexed by participant');
assert.match(page, /const resultsByRegistration = \{\}/,
  'Results must be indexed by registration');
assert.match(page, /const visibleScores = isWali \? \[\] : scores;/,
  'Wali must not receive raw score records; staff may retain the indexed score collection');
assert.match(page, /results\.filter\(x => regMap\[String\(x\.registrationId\)\] && String\(x\.announcementDate \|\| ''\)\.trim\(\) !== ''\)/,
  'Wali results must be limited to owned registrations and official publication');
assert.match(page, /const foundRegistration = registrationById\[selectedId\] \|\| \(!isWali \? null : findRegistration_\(selectedId\)\?\.registration\) \|\| null/,
  'Detail lookup must use the shared index, with the owner-checked Wali fallback for records outside the visible list');
assert.match(page, /canAccessRegistration_\(actor,foundRegistration\)/,
  'Detail ownership authorization must remain');
assert.match(page, /scores: isWali \? \[\] : \(participant \? \(scoresByParticipant\[String\(participant\.participantId\)\] \|\| \[\]\) : \[\]\)/,
  'Detail response must hide all scores from Wali and use the participant index for staff');
assert.match(page, /result: isWali && !resultIsPublished \? null : selectedResult/,
  'Detail response must hide unpublished results from Wali while preserving staff detail');
assert.match(page, /registrationById\[selectedId\] \|\| \(!isWali \? null : findRegistration_\(selectedId\)\?\.registration\)/,
  'Only Wali detail outside the visible registration index may use the ownership-checked fallback lookup');
assert.doesNotMatch(page, /participantItems\.some\(/,
  'Wali score filtering must not scan participants for every score');
assert.doesNotMatch(page, /scores\.filter\(x => String\(x\.participantId\) === String\(participant\.participantId\)\)/,
  'Detail score filtering must use the participant index');
assert.match(page, /selectionDate\|\|''\)\.localeCompare/,
  'Schedule ordering by selection date must remain');
assert.ok(code.includes("String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))"),
  'Registration enrichment must retain updatedAt ordering');

console.log('PSB selection page batch-read, indexing, and authorization safeguards: OK');
