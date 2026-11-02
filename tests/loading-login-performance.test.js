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
assert.match(warmScheduler, /setTimeout\(run,\s*1200\)/,
  'Navigation prefetch must have a delayed fallback');

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
assert.match(app, /scheduleWarmNavigationData\(\);/,
  'Navigation prefetch must be scheduled outside the initial render path');

console.log('PSB loading and login critical-path safeguards: OK');
