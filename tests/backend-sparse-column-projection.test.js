'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
function extract(name) {
  const start = code.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' exists');
  const end = code.indexOf('\nfunction ', start + 10);
  return code.slice(start, end < 0 ? undefined : end);
}
const context = {
  rowObject_: (headers, values, rowNumber) => {
    const out = { rowNumber };
    headers.forEach((header, index) => { out[header] = values[index]; });
    return out;
  }
};
vm.createContext(context);
vm.runInContext([
  'sheetRowsProjected_',
  'sheetRowsProjectedAll_',
  'sheetRowsByFields_',
  'sheetRowsMatchingValuesByFields_'
].map(extract).join('\n'), context);

function makeSheet(rows) {
  const calls = [];
  const width = rows[0].length;
  return {
    calls,
    getLastRow: () => rows.length,
    getLastColumn: () => width,
    getRange(row, column, height, columns) {
      calls.push({ row, column, height, columns });
      return {
        getValues: () => rows.slice(row - 1, row - 1 + height)
          .map(values => values.slice(column - 1, column - 1 + columns))
      };
    }
  };
}

const grid = [
  ['id', 'name', 'privateNote', 'status', 'internalFlag'],
  ['r1', 'Alpha', 'secret-a', 'PASSED', true],
  ['r2', 'Beta', 'secret-b', 'PENDING', false],
  ['r1', 'Gamma', 'secret-c', 'WAITLIST', true]
];
const allSheet = makeSheet(grid);
const projected = context.sheetRowsByFields_(allSheet, ['id', 'name', 'status']);
assert.deepEqual(JSON.parse(JSON.stringify(projected)), [
  { rowNumber: 2, id: 'r1', name: 'Alpha', status: 'PASSED' },
  { rowNumber: 3, id: 'r2', name: 'Beta', status: 'PENDING' },
  { rowNumber: 4, id: 'r1', name: 'Gamma', status: 'WAITLIST' }
]);
assert.ok(allSheet.calls.some(x => x.row === 2 && x.column === 1 && x.height === 3 && x.columns === 2),
  'Adjacent requested columns may be read together');
assert.ok(allSheet.calls.some(x => x.row === 2 && x.column === 4 && x.height === 3 && x.columns === 1),
  'A separated requested column must be read independently');
assert.ok(!allSheet.calls.some(x => x.row === 2 && x.column === 1 && x.columns === 5),
  'Unrequested columns between projections must not be transferred');

const matchingSheet = makeSheet(grid);
const matching = context.sheetRowsMatchingValuesByFields_(matchingSheet, 'id', ['r1'], ['status', 'name']);
assert.deepEqual(JSON.parse(JSON.stringify(matching)), [
  { rowNumber: 2, id: 'r1', status: 'PASSED', name: 'Alpha' },
  { rowNumber: 4, id: 'r1', status: 'WAITLIST', name: 'Gamma' }
]);
assert.ok(matchingSheet.calls.some(x => x.row === 2 && x.column === 1 && x.height === 3 && x.columns === 1),
  'Matching must scan only the lookup key column');
assert.ok(!matchingSheet.calls.some(x => x.row === 2 && x.column === 1 && x.columns === 5),
  'Matching projections must not transfer unrelated columns');

console.log('PSB sparse column projection safeguards: OK');
