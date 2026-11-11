'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const pwaCss = fs.readFileSync('frontend/styles.css', 'utf8');
const appsHtml = fs.readFileSync('apps-script/Index.html', 'utf8');
const styleStart = appsHtml.indexOf('<style>');
const styleEnd = appsHtml.indexOf('</style>', styleStart);
assert.ok(styleStart >= 0 && styleEnd > styleStart, 'Apps Script inline stylesheet must exist');
const inlineStyle = appsHtml.slice(styleStart + 7, styleEnd);
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
assert.ok(pwaBlock.includes('background: transparent !important'), 'Content cards must no longer render as solid white boxes');
assert.ok(pwaBlock.includes('.dashboard-kpi:nth-child(4n+2)') && pwaBlock.includes('rgba(99, 102, 241, .065)'), 'Indigo KPI semantic tint must remain');
assert.ok(pwaBlock.includes('.dashboard-kpi:nth-child(4n+3)') && pwaBlock.includes('rgba(20, 184, 166, .065)'), 'Teal KPI semantic tint must remain');
assert.ok(pwaBlock.includes('.dashboard-kpi:nth-child(4n)') && pwaBlock.includes('rgba(245, 158, 11, .075)'), 'Amber KPI semantic tint must remain');
assert.ok(pwaBlock.includes('.dashboard-task-card--payments') && pwaBlock.includes('rgba(99, 102, 241, .065)'), 'Payment task tint must remain');

for (const protectedSelector of ['input', 'select', 'textarea', '.modal', '.login-card', '.public-login-panel', '.topbar', '.bottom-nav']) {
  assert.ok(!pwaBlock.includes(protectedSelector + ' {'), 'Interactive surface must stay opaque/outside override: ' + protectedSelector);
}
assert.ok(!pwaBlock.includes('@media'), 'Surface-only override must not change responsive layout rules');
assert.ok(fs.readFileSync('frontend/index.html', 'utf8').includes('styles.css?v=32.37.0'), 'PWA HTML must request the refreshed stylesheet');
const sw = fs.readFileSync('frontend/sw.js', 'utf8');
assert.ok(sw.includes('styles.css?v=32.37.0'), 'PWA service worker must precache the refreshed stylesheet');
assert.ok(sw.includes('psb-pwa-shell-v32-57-0'), 'PWA shell cache must be versioned for the visual update');
console.log('Translucent content surfaces, semantic color preservation, and PWA/Apps Script CSS parity: OK');
