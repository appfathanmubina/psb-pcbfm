'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const dashboard = code.slice(code.indexOf('function getDashboardPageData('), code.indexOf('\nfunction findParticipantRegistration_'));
const wali = code.slice(code.indexOf('function getWaliHomeData('), code.indexOf('\nfunction statusLabel_'));
const helper = code.slice(code.indexOf('function sheetRowsProjected_('), code.indexOf('\nfunction buildPaymentData_'));

assert.match(dashboard, /sheetRowsProjectedAll_\([^\n]+\['status'\]\)/,
  'Dashboard user summary must read only status');
assert.match(dashboard, /\['scheduleId','isActive','selectionDate','name','location'\]/,
  'Dashboard schedule summary must use its narrow projection');
assert.match(dashboard, /\['jenjangId','name'\]/);
assert.match(dashboard, /\['gelombangId','name'\]/);
assert.match(dashboard, /\['registrationId','candidateId','registrationNumber','status','updatedAt','createdAt','jenjangId','gelombangId'\]/,
  'Dashboard registration projection must retain all summary/task fields');
assert.doesNotMatch(dashboard, /sheetRows_\(/,
  'Dashboard must not fall back to whole-row sheet reads');

assert.match(wali, /requireRole_\(sessionToken, \['WALI'\]\)/,
  'Wali ownership authorization must remain first');
assert.match(wali, /\['registrationId','status','createdAt','paymentTypeId','billId','amount'\]/);
assert.match(wali, /\['registrationId','status','uploadedAt','documentTypeId'\]/);
assert.match(wali, /getActiveMasterItems_\('MASTER_DOKUMEN', \['documentTypeId','required'\]\)/);
assert.match(wali, /getActiveMasterItems_\('MASTER_JENIS_PEMBAYARAN', \['paymentTypeId','name'\]\)/);
assert.doesNotMatch(wali, /regDocuments\.filter\([\s\S]{0,180}\.sort\(/,
  'Wali document groups must reuse the single global ordering');

const context = {
  Utilities: { formatDate: value => value instanceof Date ? value.toISOString() : value },
  getConfig_: () => 'Asia/Jakarta'
};
context.rowObject_ = function(headers, row, rowNumber) {
  const out = {rowNumber};
  headers.forEach((header,index) => { out[header] = row[index] instanceof Date ? row[index].toISOString() : row[index]; });
  return out;
};
vm.createContext(context);
vm.runInContext(helper, context);

const headers = ['ownerId','name','privateNotes','status','createdAt'];
const values = [
  headers,
  ['wali-1','Anak A','rahasia A','ACTIVE','2026-11-01'],
  ['wali-2','Anak B','rahasia B','ACTIVE','2026-11-02'],
  ['wali-1','Anak C','rahasia C','REVISION','2026-11-03'],
  ['wali-1','Anak D','rahasia D','SUBMITTED','2026-11-04']
];
const calls = [];
const sheet = {
  getLastRow: () => values.length,
  getLastColumn: () => headers.length,
  getRange(row,column,numRows,numColumns) {
    calls.push({row,column,numRows,numColumns});
    return { getValues: () => values.slice(row-1,row-1+numRows).map(line=>line.slice(column-1,column-1+numColumns)) };
  }
};
const rows = context.sheetRowsMatchingValues_(sheet,'ownerId',['wali-1'],['name','status']);
assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
  {rowNumber:2,name:'Anak A',status:'ACTIVE'},
  {rowNumber:4,name:'Anak C',status:'REVISION'},
  {rowNumber:5,name:'Anak D',status:'SUBMITTED'}
], 'Projected reads preserve matching row order and only expose requested fields');
assert.ok(calls.some(call=>call.column===1&&call.numColumns===1),
  'The matching helper must scan only the key column');
assert.ok(calls.every(call=>!(call.column===1&&call.numColumns===headers.length)),
  'The matching helper must not fetch full rows when projection is supplied');

console.log('PSB Dashboard and Wali narrow projection safeguards: OK');
