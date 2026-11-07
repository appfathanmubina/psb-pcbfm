'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const viewDeclaration = code.match(/^const PSB_SELECTION_VIEW_ROLES = \[([^\]]+)\];$/m);
assert.ok(viewDeclaration, 'Backend must declare the role allowlist used by getSelectionPageData');

const roles = viewDeclaration[1].split(',').map(value => value.trim().replace(/^['"]|['"]$/g, ''));
assert.deepEqual(roles, ['WALI', 'SUPERADMIN', 'ADMIN_PSB', 'SELEKSI', 'VERIFIKATOR'],
  'Tes page view roles must match the supported Wali and operational roles');

const start = code.indexOf('function getSelectionPageData(sessionToken, registrationId) {');
const end = code.indexOf('\nfunction createSelectionSchedule', start);
assert.ok(start >= 0 && end > start, 'Selection page data backend function must exist');
const page = code.slice(start, end);
assert.match(page, /requireRole_\(sessionToken, PSB_SELECTION_VIEW_ROLES\)/,
  'Selection page data must authorize access through the declared view-role allowlist');
assert.ok(page.indexOf('requireRole_(sessionToken, PSB_SELECTION_VIEW_ROLES)') < page.indexOf('getDatabaseSpreadsheet_()'),
  'Selection authorization must happen before database access');

const announcementDeclaration = code.match(/^const PSB_ANNOUNCEMENT_VIEW_ROLES = \[([^\]]+)\];$/m);
assert.ok(announcementDeclaration, 'Announcement view-role allowlist must exist');
const announcementRoles = announcementDeclaration[1].split(',').map(value => value.trim().replace(/^['"]|['"]$/g, ''));
assert.deepEqual(roles, announcementRoles,
  'Tes and Pengumuman must support the same view roles');

console.log('PSB selection page view-role allowlist safeguards: OK');
