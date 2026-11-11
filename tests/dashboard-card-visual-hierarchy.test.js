'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const pwa = fs.readFileSync('frontend/styles.css', 'utf8');
const apps = fs.readFileSync('apps-script/Index.html', 'utf8');
const appScripts = [
  fs.readFileSync('frontend/app.js', 'utf8'),
  fs.readFileSync('frontend/psb-fm-apps-script.js', 'utf8')
];
const categories = [
  ['verification', 'Verifikasi'],
  ['payments', 'Pembayaran Menunggu Verifikasi'],
  ['selection', 'Peserta Tes'],
  ['announcement', 'Hasil Siap Dipublikasikan'],
  ['reregistration', 'Daftar Ulang']
];

for (const [scriptIndex, script] of appScripts.entries()) {
  for (const [key, title] of categories) {
    assert.match(script, new RegExp('dashboard-task-card dashboard-task-card--' + key + '[^\x60]*dashboard-task-title">' + title),
      'dashboard renderer ' + scriptIndex + ' must assign a stable semantic class to ' + title);
  }
}
for (const [css, label] of [[pwa, 'PWA'], [apps, 'Apps Script']]) {
  for (const [key] of categories) {
    assert.ok(css.includes('.dashboard-ops-grid > .dashboard-task-card.dashboard-task-card--' + key),
      label + ' must style ' + key + ' by semantic category');
  }
  assert.doesNotMatch(css, /\.dashboard-task-card:nth-child\(5n\+/,
    label + ' must not depend on role-dependent DOM order for operational colors');
  assert.match(css, /\.dashboard-kpi \.kpi-label\{font-size:12px/,
    label + ' KPI labels must be comfortably readable');
  assert.match(css, /\.dashboard-kpi \.kpi-note\{font-size:11px/,
    label + ' KPI notes must be comfortably readable');
  assert.match(css, /\.dashboard-task-name\{font-size:12px/,
    label + ' applicant names must be comfortably readable');
  assert.match(css, /\.dashboard-task-meta\{font-size:10px/,
    label + ' task metadata must be comfortably readable');
  assert.match(css, /\.dashboard-schedule-item span\{font-size:10px/,
    label + ' schedule details must be comfortably readable');
  assert.match(css, /\.dashboard-ops-grid\{[^}]*grid-template-columns:1fr(?:;|\})/,
    label + ' operational cards must remain single-column on mobile');
  assert.match(css, /@media\(min-width:760px\)[^{]*\{\.dashboard-ops-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,
    label + ' operational cards must use two columns on wider screens');
  assert.match(css, /\.dashboard-kpi \.kpi-value\{[^}]*overflow-wrap:anywhere/,
    label + ' long currency values must wrap instead of clipping');
  assert.match(css, /\.dashboard-task-count\s*\{[^}]*color:#fff/s,
    label + ' operational count badges must retain white text');
  assert.match(css, /\.card\s*\{[^}]*linear-gradient/s,
    label + ' general app cards must retain stronger surface hierarchy');
}
assert.match(pwa, /#0f766e/, 'Teal operational accent must remain available');
assert.match(pwa, /#b45309/, 'Amber operational accent must remain available');
console.log('Dashboard semantic colors, readability, responsive layout, and PWA/Apps Script safeguards: OK');
