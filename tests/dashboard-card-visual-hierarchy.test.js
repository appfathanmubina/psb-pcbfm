'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const pwa = fs.readFileSync('frontend/styles.css', 'utf8');
const apps = fs.readFileSync('apps-script/Index.html', 'utf8');
for (const [css, label] of [[pwa, 'PWA'], [apps, 'Apps Script']]) {
  assert.match(css, /\.dashboard-task-card:nth-child\(5n\+2\)/,
    label + ' operational cards must have distinct category treatments');
  assert.match(css, /\.dashboard-task-count\s*\{[^}]*color:\s*#fff/s,
    label + ' operational count badges must retain high contrast');
  assert.match(css, /\.dashboard-kpi:nth-child\(4n\+3\)/,
    label + ' dashboard KPIs must not all render as identical white cards');
  assert.match(css, /\.card\s*\{[^}]*linear-gradient/s,
    label + ' general app cards must use stronger surface hierarchy');
}
assert.match(pwa, /#0f766e/, 'Teal operational accent must remain available');
assert.match(pwa, /#b45309/, 'Amber operational accent must remain available');
console.log('Dashboard card contrast and PWA/Apps Script visual parity safeguards: OK');
