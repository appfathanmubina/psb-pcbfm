'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const setup = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');

// Both setup stages must merge their keys into Script Properties rather than
// deleting unrelated configuration (including Superadmin bootstrap and OTP settings).
const databaseSetup = setup.match(/function setupPSBDatabase_\(\)\s*\{[\s\S]*?\n\}/);
const driveSetup = setup.match(/function setupDriveFolders_\(\)\s*\{[\s\S]*?\n\}/);
assert.ok(databaseSetup, 'setupPSBDatabase_ must exist');
assert.ok(driveSetup, 'setupDriveFolders_ must exist');

assert.match(
  databaseSetup[0],
  /setProperties\(\s*\{[\s\S]*?PSB_SPREADSHEET_ID:[\s\S]*?PSB_ROOT_FOLDER_ID:[\s\S]*?\},\s*false\s*\)/,
  'database setup must preserve existing Script Properties'
);
assert.match(
  driveSetup[0],
  /setProperties\(\s*\{[\s\S]*?PSB_DRIVE_ROOT_ID:[\s\S]*?PSB_DRIVE_YEAR_ID:[\s\S]*?\},\s*false\s*\)/,
  'Drive setup must preserve existing Script Properties'
);
assert.doesNotMatch(
  setup,
  /setProperties\(\s*\{[\s\S]*?\},\s*true\s*\)/,
  'no setup operation may clear all Script Properties'
);

// Bootstrap configuration must remain saved with merge semantics until the
// account is created and the bootstrap secrets are explicitly deleted.
assert.match(
  setup,
  /PSB_INITIAL_SUPERADMIN_HASH:[\s\S]*?\},\s*false\s*\)/,
  'Superadmin bootstrap credentials must be stored without clearing other properties'
);
console.log('Setup Script Properties preservation safeguards: OK');
