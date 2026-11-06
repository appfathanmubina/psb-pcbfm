'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');

function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Missing function: ' + name);
  const next = source.indexOf('\\nfunction ', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

const save = functionSource('saveIncident');
assert.match(save, /withScriptLock_\\(10000,\\s*function\\(\\)/,
  'Incident creation/update must serialize the read-check-write sequence');
assert.match(save, /findRowById_\\(sheet,'incidentId',existingId\\)/,
  'Incident updates must re-read the target row while holding ScriptLock');
assert.match(save, /sheet\\.appendRow\\(vals\\)/,
  'Incident creation must retain its existing append behavior');
assert.match(save, /setValues\\(\\[vals\\]\\)/,
  'Incident update must keep its single-row batch write');

const close = functionSource('closeIncident');
assert.match(close, /withScriptLock_\\(10000,\\s*function\\(\\)/,
  'Incident closure must serialize the read-modify-write sequence');
assert.match(close, /const current=sheet\\.getRange\\(found\\.rowNumber,1,1,headers\\.length\\)\\.getValues\\(\\)\\[0\\]/,
  'Incident closure must preserve columns not managed by the closure action');
assert.match(close, /sheet\\.getRange\\(found\\.rowNumber,1,1,headers\\.length\\)\\.setValues\\(\\[values\\]\\)/,
  'Incident closure must write the updated row in one batch');
assert.doesNotMatch(close, /headers\\.forEach\\([\\s\\S]*?setValue\\(/,
  'Incident closure must not issue one Spreadsheet write per updated field');

console.log('Incident mutation ScriptLock and batch-write safeguards passed.');
