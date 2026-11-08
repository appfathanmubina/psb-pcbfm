'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');

function fn(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Required function exists: ' + name);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}

const manual = fn('createManualUser');
assert.match(manual, /normalizePhone_\(phone\)/,
  'Manual user creation must normalize submitted phone numbers');
assert.match(manual, /!\/\^62\\d\{8,13\}\$\/\.test\(normalizePhone_\(phone\)\)/,
  'Manual user phone validation must use the same canonical Indonesian format as Wali registration');
assert.match(manual, /email\.length > 254/,
  'Manual user email validation must enforce a bounded length');
assert.match(manual, /sheetRowsByFields_\(sheet, \['phone','phoneNormalized','email','emailNormalized'\]\)/,
  'Duplicate detection must read both legacy and normalized identity columns');
assert.match(manual, /existingPhone=String\(r\.phoneNormalized\|\|''\)\.trim\(\) \|\| \(r\.phone\?normalizePhone_\(r\.phone\):''\)/,
  'A legacy raw phone must be normalized before duplicate comparison');
assert.match(manual, /existingEmail=String\(r\.emailNormalized\|\|''\)\.trim\(\)\.toLowerCase\(\) \|\| String\(r\.email\|\|''\)\.trim\(\)\.toLowerCase\(\)/,
  'A legacy raw email must be normalized before duplicate comparison');

const wali = fn('registerWali');
assert.match(wali, /existingPhone = String\(r\.phoneNormalized \|\| ''\)\.trim\(\) \|\| \(r\.phone \? normalizePhone_\(r\.phone\) : ''\)/,
  'Manual and self-service account creation must preserve the same legacy duplicate rule');

console.log('Manual user legacy identity and duplicate safeguards: OK');
