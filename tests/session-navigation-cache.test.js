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
assert.match(app, /const SNAPSHOT_PAGES=new Set\(\['home','profile','master','registration','applicants','documents','notifications','announcement','verification','verificationStatus','payments','selection','reregistration','reports','audit','userManagement','more'\]\)/,
  'all navigable menus must support one-load-per-session snapshots');
assert.match(app, /if\(MUTATING_SERVER_FUNCTIONS\.has\(fn\)&&result\?\.success\)\{invalidatePageDataCache\(\);\}/,
  'successful actions must not discard already visited menu views');
assert.match(app, /function restorePageSnapshot\(page\)\{if\(!SNAPSHOT_PAGES\.has\(page\)\)return false;const snap=state\.pageSnapshots\[pageSnapshotKey\(page\)\];if\(!snap\)return false;/,
  'visited menu views must remain available for the active login session');
console.log('Session restore and menu navigation cache safeguards passed.');

const reload = app.slice(app.indexOf('async function reloadCurrentData()'), app.indexOf('function toggleSidebar()'));
assert.doesNotMatch(reload, /renderApp\\(\\)/,
  'Reload must not rebuild the whole shell or route through Home');
assert.match(reload, /invalidateCurrentPageData\\(\\)/,
  'Reload must invalidate page snapshots and per-menu data caches');
assert.match(reload, /goPage\\(currentPage,\\{forceReload:true\\}\\)/,
  'Reload must force-fetch only the currently active menu');
assert.match(reload, /const activeBtn=\\$\\('reloadDataBtn'\\)/,
  'Reload completion must reacquire the current header button before resetting its loading state');
assert.match(app, /function goPage\\(page,options=\\{\\}\\)/,
  'Navigation must support an explicit force-reload path');
assert.match(app, /if\\(!forceReload&&restorePageSnapshot\\(page\\)\\)/,
  'A forced reload must bypass the current page snapshot');
assert.match(app, /async function renderDocuments\\(registrationId,force=false\\)/,
  'Document reload must bypass its registration-specific cache');
assert.match(app, /async function renderPayments\\(registrationId,force=false\\)/,
  'Payment reload must bypass its registration-specific cache');
assert.match(app, /async function renderRegistrationHub\\(force=false\\)/,
  'Registration reload must bypass the registration list cache');
assert.match(app, /async function renderSelection\\(force=false\\)/,
  'Selection reload must bypass selection data and warm-page caches');
console.log('Header reload current-page freshness safeguards passed.');
