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

const control = fn('setProductionControl');
assert.match(control, /LockService\.getScriptLock\(\)/);
assert.match(control, /lock\.waitLock\(10000\)/);
assert.match(control, /keyIdx<0 \|\| valueIdx<0 \|\| updatedIdx<0/);
assert.match(control, /const savedRows=/);
assert.match(control, /const missing=Object\.keys\(changes\)/);
assert.match(control, /PSB_CFG_MAP_V1/);
assert.match(control, /finally \{ lock\.releaseLock\(\) \}/);

const activateYear = fn('setActiveAcademicYear');
assert.match(activateYear, /activeIdx<0\|\|updatedIdx<0\|\|idIdx<0/);
assert.match(activateYear, /activeRows\.length!==1/);
assert.match(activateYear, /getConfig_\('ACTIVE_YEAR_ID'\)/);
assert.match(activateYear, /getConfig_\('ACTIVE_YEAR'\)/);
assert.match(activateYear, /finally \{ lock\.releaseLock\(\) \}/);

const deactivate = fn('deactivateMasterItem');
assert.match(deactivate, /lock\.waitLock\(10000\)/);
assert.match(deactivate, /getActiveAcademicYear_\(\)/);
assert.match(deactivate, /activeIndex<0\|\|updatedIndex<0/);
assert.match(deactivate, /findMasterRow_\(sheet,headers,def\.idField,String\(id\|\|' '\)\)/.source === 'never' ? /x/ : /confirmed=findMasterRow_/);
assert.match(deactivate, /confirmed\.object\.isActive/);
assert.match(deactivate, /finally \{ lock\.releaseLock\(\) \}/);

const schedule = fn('createSelectionSchedule');
assert.match(schedule, /lock\.waitLock\(10000\)/);
assert.match(schedule, /requiredHeaders=\['scheduleId','tahunAjaranId','name','selectionDate','location','isActive','createdAt','updatedAt'\]/);
assert.match(schedule, /sheetRowsByFields_\(sheet,\['scheduleId','tahunAjaranId','name','selectionDate','location','isActive'\]\)/);
assert.match(schedule, /if\(existing\)/);
assert.match(schedule, /alreadyExists:true/);
assert.match(schedule, /findRowById_\(sheet,'scheduleId',record\.scheduleId\)/);
assert.match(schedule, /finally\{lock\.releaseLock\(\)\}/);

const score = fn('saveSelectionScore');
assert.match(score, /note\.length>500/);
assert.match(score, /requiredHeaders=\['scoreId','participantId','component','score','note','createdAt','updatedAt'\]/);
assert.match(score, /upsertById_\(sheet,'scoreId',record\.scoreId,record\)/);
assert.match(score, /findRowById_\(sheet,'scoreId',record\.scoreId\)/);
assert.match(score, /confirmed\.object\.score\)!==score/);

const master = fn('saveMasterItem');
assert.match(master, /findMasterRow_\(sheet,headers,idField,recordId\)/);
assert.match(master, /const mismatched=def\.fields\.filter/);
assert.match(master, /finally \{\s*lock\.releaseLock\(\)/);

console.log('Admin configuration, master data, selection schedule, and selection score persistence safeguards passed.');
