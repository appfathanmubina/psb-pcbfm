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

console.log('Role-based navigation consistency safeguards passed.');
