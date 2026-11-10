'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('frontend/app.js', 'utf8');
const start = source.indexOf('function buildRoleNav(){');
assert.notEqual(start, -1, 'buildRoleNav must exist');
const end = source.indexOf('\nfunction buildMobileNav(', start);
assert.notEqual(end, -1, 'buildRoleNav must have a stable boundary');
const implementation = source.slice(start, end);

function menuFor(...roles) {
  const context = { hasAnyRole: allowed => allowed.some(role => roles.includes(role)) };
  return vm.runInNewContext(implementation + '\nbuildRoleNav();', context);
}
function ids(menu) { return Array.from(menu, item => String(item[0])); }

assert.deepEqual(ids(menuFor('KEUANGAN')), ['home','payments','reregistration','reports']);
assert.deepEqual(ids(menuFor('SELEKSI')), ['home','selection','announcement','reports']);
assert.deepEqual(ids(menuFor('VERIFIKATOR')), ['home','applicants','verification','selection','announcement','reregistration','reports']);
assert.deepEqual(ids(menuFor('KEUANGAN','SELEKSI')), ['home','payments','selection','announcement','reregistration','reports']);
assert.deepEqual(ids(menuFor('WALI')), ['home','registration','payments','documents','selection','announcement']);
assert.deepEqual(ids(menuFor('ADMIN_PSB')).slice(0,9), ['home','applicants','verification','payments','selection','announcement','reregistration','reports','master']);
assert.ok(ids(menuFor('ADMIN_PSB')).includes('audit'));
assert.ok(!ids(menuFor('ADMIN_PSB')).includes('userManagement'));
assert.ok(ids(menuFor('SUPERADMIN')).includes('userManagement'));

const mobileStart = source.indexOf('function buildMobileNav(){');
const mobileEnd = source.indexOf('\nfunction navButtonsHtml(', mobileStart);
assert.notEqual(mobileStart, -1, 'buildMobileNav must exist');
assert.ok(mobileEnd > mobileStart, 'buildMobileNav boundary exists');
const mobileNav = source.slice(mobileStart, mobileEnd);
function mobileIds(...roles) {
  const context = { buildRoleNav: () => menuFor(...roles), hasAnyRole: allowed => allowed.some(role => roles.includes(role)) };
  return Array.from(vm.runInNewContext(mobileNav + '\nbuildMobileNav();', context), item => String(item[0]));
}
for (const role of ['ADMIN_PSB','SUPERADMIN']) {
  const ids = mobileIds(role);
  assert.ok(ids.includes('verification'), role + ' must have direct mobile access to Verification');
  assert.ok(ids.includes('more'), role + ' must retain the More menu for secondary modules');
  assert.ok(!ids.includes('announcement'), role + ' announcement remains available through More to preserve five-item mobile navigation');
}

const renderMoreStart = source.indexOf('function renderMore(){');
const renderMoreEnd = source.indexOf('\nfunction hasAnyRole(', renderMoreStart);
assert.notEqual(renderMoreStart, -1, 'renderMore must exist');
assert.notEqual(renderMoreEnd, -1, 'renderMore must have a stable boundary');
const renderMore = source.slice(renderMoreStart, renderMoreEnd);
assert.match(renderMore, /const canVerification=hasAnyRole/,
  'Admin PSB and VERIFIKATOR must see the Verification shortcut in More');
assert.match(renderMore, /add\(canVerification,'verification','Verifikasi'/,
  'The More menu must expose the Verification page to authorized roles');
assert.match(renderMore, /const canSelection=hasAnyRole\(\['SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR'\]\)/,
  'VERIFIKATOR can view selection and must see it in the More menu');
assert.match(renderMore, /const canAnnouncement=hasAnyRole\(\['SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR'\]\)/,
  'VERIFIKATOR can view announcements and must see them in the More menu');

const renderAppStart = source.indexOf('function renderApp(options={})');
const renderAppEnd = source.indexOf('\nasync function reloadCurrentData(', renderAppStart);
assert.notEqual(renderAppStart, -1, 'renderApp must exist');
assert.notEqual(renderAppEnd, -1, 'renderApp must have a stable boundary');
const renderApp = source.slice(renderAppStart, renderAppEnd);
assert.match(renderApp, /KEUANGAN:'KEUANGAN'/,
  'KEUANGAN-only accounts must display their actual role label instead of WALI');
assert.match(renderApp, /split\(','\)/,
  'Multi-role labels must preserve all assigned roles');

console.log('Role-based navigation consistency safeguards passed.');
