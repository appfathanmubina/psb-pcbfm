'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('frontend/app.js', 'utf8');

assert.match(app, /localStorage\.getItem\('psb_session'\)/,
  'session token must survive a browser reload');
assert.match(app, /sessionStorage\.getItem\('psb_current_page'\)/,
  'boot must restore the last opened menu in the current tab');
assert.match(app, /sessionStorage\.setItem\('psb_current_page',page\)/,
  'navigation must persist the current menu');
assert.match(app, /renderSessionRecovery\(/,
  'transient session validation failures must show a retry view, not the login form');
assert.match(app, /const SNAPSHOT_PAGES=new Set\(\['home','profile','master','registration','applicants','documents','notifications','announcement','verification','payments','selection','reregistration','reports','audit','userManagement','more'\]\)/,
  'all navigable menus must support one-load-per-session snapshots');
assert.match(app, /if\(MUTATING_SERVER_FUNCTIONS\.has\(fn\)&&result\?\.success\)\{invalidatePageDataCache\(\);\}/,
  'successful actions must not discard already visited menu views');
assert.match(app, /function restorePageSnapshot\(page\)\{if\(!SNAPSHOT_PAGES\.has\(page\)\)return false;const snap=state\.pageSnapshots\[pageSnapshotKey\(page\)\];if\(!snap\)return false;/,
  'visited menu views must remain available for the active login session');
console.log('Session restore and menu navigation cache safeguards passed.');
