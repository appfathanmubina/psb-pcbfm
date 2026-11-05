'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('frontend/app.js', 'utf8');
const bundle = fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8');
const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');

for (const [name, source] of [['frontend', app], ['Apps Script bundle', bundle]]) {
  const nik = source.indexOf('<label>NIK</label>');
  const nisn = source.indexOf('<label>NISN</label>');
  const birthPlace = source.indexOf('<label>Tempat Lahir *</label>');
  assert.ok(nik >= 0 && nisn > nik && birthPlace > nisn, name + ': NISN must appear immediately after NIK');
  assert.match(source, /id="rf_nisn" inputmode="numeric" maxlength="10"/, name + ': NISN input must accept 10 numeric digits');
  assert.match(source, /nisn:g\('rf_nisn'\)/, name + ': NISN must be included in the registration payload');
  assert.match(source, /!\/\^\\d\{10\}\$\//, name + ': client must validate optional 10-digit NISN');
  assert.doesNotMatch(source, /<label>Jenis Sekolah<\/label>/, name + ': Jenis Sekolah must be removed from the form');
  assert.doesNotMatch(source, /schoolType:g\('rf_schoolType'\)/, name + ': removed school type must not be sent from the form');
  assert.match(source, /NISN: \$\{esc\(c\.nisn\|\|'-'\)\}/, name + ': registration detail must show NISN');
}

assert.match(backend, /nisn: digits_\(payload\.candidate\?\.nisn\)/, 'backend must persist NISN');
assert.match(backend, /if \(c\.nisn && digits_\(c\.nisn\)\.length !== 10\)/, 'backend must validate optional NISN');
assert.match(backend, /function ensureCandidateNisnColumn_\(sheet\)/, 'backend must support existing candidate sheets');
assert.match(backend, /ensureCandidateNisnColumn_\(candidateSheet\)/, 'candidate sheet migration must run before save');
assert.match(backend, /schoolType: clean_\(existing\?\.school\?\.schoolType \|\| ''\)/, 'legacy school type data must be preserved on edits');

console.log('Registration NISN field and school type removal safeguards: OK');
