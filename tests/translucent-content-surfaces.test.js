'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const pwaCss = fs.readFileSync('frontend/styles.css', 'utf8');
const appsHtml = fs.readFileSync('apps-script/Index.html', 'utf8');
const inlineStyle = (appsHtml.match(/<style>([\\s\\S]*?)<\\/style>/) || [])[1] || '';
const marker = '/* Translucent content surfaces: reduce white card-on-lavender contrast without changing layout. */';
const pwaBlock = pwaCss.slice(pwaCss.lastIndexOf(marker));
const appsBlock = inlineStyle.slice(inlineStyle.lastIndexOf(marker));

assert.ok(pwaBlock.startsWith(marker), 'PWA stylesheet must include the final translucent-surface override');
assert.ok(appsBlock.startsWith(marker), 'Apps Script HTML must include the final translucent-surface override');
assert.equal(pwaBlock, appsBlock, 'PWA and Apps Script translucent-surface rules must remain byte-for-byte identical');

const contentSurfaces = [
  '.card', '.status-card', '.progress-card', '.public-card', '.public-info',
  '.form-section', '.registration-item', '.doc-item', '.master-item',
  '.notification-card', '.announcement-card', '.selection-card',
  '.analytics-card', '.report-summary', '.report-table-wrap', '.doc-stat',
  '.doc-empty', '.empty-state', '.announcement-empty', '.wali-flow-empty'
];
for (const selector of contentSurfaces) {
  assert.ok(pwaBlock.includes(selector), 'Content surface coverage missing ' + selector);
}
for (const label of ['PWA', 'Apps Script']) {
  const block = label === 'PWA' ? pwaBlock : appsBlock;
  assert.match(block, /background:\\s*transparent\\s*!important/, label + ' content cards must no longer render as solid white boxes');
  assert.match(block, /\\.dashboard-kpi:nth-child\\(4n\\+2\\)[\\s\\S]*?rgba\\(99, 102, 241/, label + ' must preserve the indigo KPI semantic tint');
  assert.match(block, /\\.dashboard-kpi:nth-child\\(4n\\+3\\)[\\s\\S]*?rgba\\(20, 184, 166/, label + ' must preserve the teal KPI semantic tint');
  assert.match(block, /\\.dashboard-kpi:nth-child\\(4n\\)[\\s\\S]*?rgba\\(245, 158, 11/, label + ' must preserve the amber KPI semantic tint');
  assert.match(block, /\\.dashboard-ops-grid > \\.dashboard-task-card\\.dashboard-task-card--payments[\\s\\S]*?rgba\\(99, 102, 241/, label + ' must preserve payment task tint');
}
assert.doesNotMatch(pwaBlock, /(^|\\n)\\s*(input|select|textarea|\\.modal|\\.login-card|\\.public-login-panel|\\.topbar|\\.bottom-nav)\\s*\\{/,
  'Form controls, login panels, dialogs, and navigation must remain outside the transparency override');
assert.doesNotMatch(pwaBlock, /@media/, 'Surface-only override must not change responsive layout rules');
assert.match(fs.readFileSync('frontend/index.html', 'utf8'), /styles\\.css\\?v=32\\.37\\.0/, 'PWA HTML must request the refreshed stylesheet');
const sw = fs.readFileSync('frontend/sw.js', 'utf8');
assert.match(sw, /styles\\.css\\?v=32\\.37\\.0/, 'PWA service worker must precache the refreshed stylesheet');
assert.match(sw, /psb-pwa-shell-v32-57-0/, 'PWA shell cache must be versioned for the visual update');
console.log('Translucent content surfaces, semantic color preservation, and PWA/Apps Script CSS parity: OK');
