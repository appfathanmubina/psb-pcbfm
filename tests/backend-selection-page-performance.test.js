'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function getSelectionPageData(sessionToken, registrationId) {');
const end = code.indexOf('\nfunction createSelectionSchedule(', start);
assert.notEqual(start, -1, 'Selection page backend exists');
assert.ok(end > start, 'Selection page function boundary exists');
const page = code.slice(start, end);

assert.match(page, /requireRole_\(sessionToken, PSB_SELECTION_VIEW_ROLES\)/,
  'Selection view role gate must remain');
assert.ok(page.indexOf('requireRole_(') < page.indexOf('getDatabaseSpreadsheet_('),
  'Authorization must happen before database access');
assert.match(page, /const registrationRows = sheetRows_\(regSheet\)/,
  'Registrations must be read once');
assert.match(page, /registrationById\[key\] = r/,
  'A complete first-match registration lookup index must be built');
assert.match(page, /const candidateMap = sheetMapById_\(ss\.getSheetByName\(PSB_SHEETS\.CANDIDATES\), 'candidateId'\)/,
  'Candidate map must be loaded once');
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
assert.match(page, /results\\.filter\\(x => regMap\\[String\\(x\\.registrationId\\)\\] && String\\(x\\.announcementDate \\|\\| ''\\)\\.trim\\(\\) !== ''\\)/,
  'Wali results must be limited to owned registrations and official publication');
assert.match(page, /const foundRegistration = registrationById\[selectedId\] \|\| null/,
  'Detail lookup must use the shared registration index');
assert.match(page, /canAccessRegistration_\(actor,foundRegistration\)/,
  'Detail ownership authorization must remain');
assert.match(page, /scores: isWali \\? \\[\\] : \\(participant \\? \\(scoresByParticipant\\[String\\(participant\\.participantId\\)\\] \\|\\| \\[\\]\\) : \\[\\]\\)/,
  'Detail response must hide all scores from Wali and use the participant index for staff');
assert.match(page, /result: isWali && !resultIsPublished \\? null : selectedResult/,
  'Detail response must hide unpublished results from Wali while preserving staff detail');
assert.doesNotMatch(page, /findRegistration_\(/,
  'Selection page must not reread registration-related sheets through findRegistration_');
assert.doesNotMatch(page, /participantItems\.some\(/,
  'Wali score filtering must not scan participants for every score');
assert.doesNotMatch(page, /scores\.filter\(x => String\(x\.participantId\) === String\(participant\.participantId\)\)/,
  'Detail score filtering must use the participant index');
assert.match(page, /selectionDate\|\|''\)\.localeCompare/,
  'Schedule ordering by selection date must remain');
assert.ok(code.includes("String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))"),
  'Registration enrichment must retain updatedAt ordering');

console.log('PSB selection page batch-read, indexing, and authorization safeguards: OK');
