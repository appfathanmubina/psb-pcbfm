'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('frontend/app.js', 'utf8');

function functionSource(name) {
  const start = app.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Required function exists: ' + name);
  const next = app.indexOf('\nfunction ', start + 10);
  return app.slice(start, next < 0 ? app.length : next);
}

const initialize = functionSource('initializeAfterLogin');
assert.doesNotMatch(initialize, /server\(/,
  'Post-login UI initialization must not wait for unrelated page data RPCs');
assert.match(initialize, /state\.appInitialized\s*=\s*true/,
  'Post-login UI initialization must mark the app as initialized');

const warmScheduler = functionSource('scheduleWarmNavigationData');
assert.match(warmScheduler, /requestIdleCallback/,
  'Navigation prefetch should use browser idle time when available');
assert.match(warmScheduler, /setTimeout\(run,\s*8000\)/,
  'Navigation prefetch must wait before background work on browsers without idle callbacks');
assert.match(warmScheduler, /timeout:10000/,
  'Navigation prefetch must wait for a browser idle window');

const boot = functionSource('boot');
assert.match(boot, /const configTask\s*=\s*refreshPublicConfig\(\)/,
  'Public configuration refresh should start asynchronously');
assert.doesNotMatch(boot, /await\s+configTask/,
  'Public configuration refresh must not block the initial public page');

const login = functionSource('submitLogin');
assert.match(login, /server\('login',\s*identifier,\s*password\)/,
  'Login must make one direct authentication request');
assert.match(login, /server\('finalizeLogin',\s*state\.token\)\.catch\(\(\)=>\{\}\)/,
  'Last-login and audit bookkeeping must remain best-effort after UI entry');
assert.match(login, /renderApp\(\);\s*loading\(false\);\s*initializeAfterLogin\(\)/,
  'Successful login must render the app before noncritical background work');
assert.match(app, /function renderLogin\(error='',identifier=''\)/,
  'Failed login should retain the entered identifier');
assert.match(app, /value="\$\{esc\(identifier\)\}"/,
  'Login identifier must be safely escaped when restored');

assert.match(app, /function warmNavigationData\(\)/,
  'Lazy navigation prefetch remains available after the active page loads');
const warmData = functionSource('warmNavigationData');
assert.match(warmData, /getAnnouncementPageData/,
  'Only lightweight announcements may be warmed in the background');
assert.match(warmData, /getNotifications/,
  'Only lightweight notifications may be warmed in the background');
assert.doesNotMatch(warmData, /getRegistrationList|getVerificationQueue|getReportingPageData|getAuditLogPageData|getMasterData/,
  'Heavy menus must load on demand instead of competing with the active page');
assert.match(app, /scheduleWarmNavigationData\(\);/,
  'Navigation prefetch must be scheduled outside the initial render path');

assert.match(app, /state\.page==='home'\)warmNavigationData\(\)/,
  'Background navigation prefetch must only start while Home remains active');
assert.match(app, /!state\.token\|\|state\.page!=='home'\|\|document\.visibilityState==='hidden'\)return/,
  'Background navigation prefetch must stop when the user navigates away or the tab is hidden');
assert.match(app, /state\.publicGalleryLoadScheduled=false;[\s\S]{0,120}if\(document\.getElementById\('galleryTrack'\)\)loadPublicGallery\(\)/,
  'Static GitHub gallery rendering must be deferred and skipped after leaving the public home');
assert.match(app, /requestIdleCallback\(loadGalleryWhenIdle,\{timeout:3000\}\)/,
  'Static GitHub gallery should use browser idle time when available');
assert.match(app, /setTimeout\(loadGalleryWhenIdle,1200\)/,
  'Static GitHub gallery must retain a delayed fallback for browsers without idle callbacks');

const galleryLoader = functionSource('loadPublicGallery');
assert.match(galleryLoader, /PSB_PUBLIC_GALLERY_FILES/,
  'Gallery must be built from the static GitHub Pages image manifest');
assert.doesNotMatch(galleryLoader, /server\(|getPublicGallery|DriveApp|drive\.google\.com/i,
  'Gallery loading must not call Apps Script or Google Drive');

console.log('PSB loading and login critical-path safeguards: OK');
