'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const frontend = fs.readFileSync('frontend/app.js', 'utf8');

function section(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, 'Missing section: ' + start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(b > a, 'Missing section end: ' + end);
  return source.slice(a, b);
}

const endpoint = section(
  backend,
  'function getSelectionPageData(sessionToken, registrationId) {',
  '\nfunction createSelectionSchedule('
);
assert.match(endpoint, /const visibleScores = isWali \? \[\] : scores;/,
  'WALI must never receive raw selection scores in the page response');
assert.match(endpoint, /const visibleResults = isWali\s*\?\s*results\.filter\(x => regMap\[String\(x\.registrationId\)\] && String\(x\.announcementDate \|\| ''\)\.trim\(\) !== ''\)/,
  'WALI may only receive selection results after official publication');
assert.match(endpoint, /scores: isWali \? \[\] : \(participant \? \(scoresByParticipant\[String\(participant\.participantId\)\] \|\| \[\]\) : \[\]\)/,
  'WALI detail response must not include score breakdown');
assert.match(endpoint, /result: isWali && !resultIsPublished \? null : selectedResult/,
  'WALI detail response must hide unpublished outcomes');

const detailUi = section(frontend, 'function renderSelectionDetail(data,targetEl){', '\nasync function saveSelectionScoreUI(');
assert.match(detailUi, /const scoreSection=isWali\?'':/,
  'WALI selection detail UI must not render score breakdown');
assert.match(detailUi, /const publicResult=!isWali\|\|\(res&&String\(res\.announcementDate\|\|''\)\.trim\(\)\)\?res:null/,
  'WALI detail UI must only render officially published outcome');
assert.match(detailUi, /Keterangan Hasil:/,
  'WALI should receive only the published outcome label');
assert.match(detailUi, /Nilai Seleksi/,
  'Staff score section remains available for permitted staff');

const waliList = section(frontend, 'function renderSelectionWali(data){', '\nasync function openSelectionDetailUI(');
assert.match(waliList, /data\.results/,
  'WALI list must continue to display backend-filtered official results');

console.log('WALI selection score and unpublished-result privacy safeguards passed.');
