'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8').replace(/\r\n/g, '\n');
const start = code.indexOf('function getProductionReadiness(sessionToken) {');
const end = code.indexOf('\n\nfunction psbDate_(', start);
assert.ok(start >= 0 && end > start, 'Production readiness function boundary exists');

const readiness = code.slice(start, end);
assert.match(readiness, /const unresolvedTestData=checks\.some\(x=>x\.key==='testData'&&x\.status==='WARNING'\)/,
  'Detected test data must remain a human review blocker');
assert.match(readiness, /productionReady:errors===0&&!unresolvedTestData/,
  'Production readiness must not report ready while test data indicators remain');

console.log('Production readiness test-data blocker safeguards passed.');
