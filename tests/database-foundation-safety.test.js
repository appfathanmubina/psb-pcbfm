'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');

function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Missing setup function: ' + name);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

const setup = functionSource('setupPSBDatabase_');
const validate = functionSource('validateExistingDatabaseSheets_');
const migration = functionSource('recordDatabaseMigration_');
const config = functionSource('ensureDefaultConfig_');
const masters = functionSource('ensureInitialMasterData_');
const superadmin = functionSource('createInitialSuperadmin_');

// Database validation must run before any setup writes or external Drive work.
const validateAt = setup.indexOf('validateExistingDatabaseSheets_(ss)');
assert.ok(validateAt >= 0, 'Existing database validation must run first');
for (const operation of [
  'setProperties(', 'ensureSheet_(', 'ensureDefaultConfig_(',
  'ensureInitialMasterData_(', 'setupDriveFolders_(', 'createInitialSuperadmin_('
]) {
  const operationAt = setup.indexOf(operation);
  assert.ok(operationAt > validateAt, operation + ' must run only after schema validation');
}
assert.match(setup, /waitLock\(30000\)/, 'Database setup must serialize concurrent runs');
assert.match(setup, /finally\s*\{\s*lock\.releaseLock\(\);\s*\}/,
  'Database setup must release its lock even after a failure');

// Every known existing sheet must be checked against its declared header contract.
assert.match(validate, /Object\.keys\(PSB_SHEETS\)\.forEach/,
  'Schema validation must inspect every declared sheet');
assert.match(validate, /PSB_HEADERS\[key\]/,
  'Schema validation must use the canonical headers');
assert.match(validate, /getDisplayValues\(\)/,
  'Schema validation must compare existing header values');
assert.match(validate, /Tidak ada perubahan dilakukan/,
  'Schema mismatch must stop setup before mutation');

// Baseline migration logging must be idempotent.
assert.match(migration, /ids\.indexOf\(migrationId\)\s*>=\s*0/,
  'An already-recorded migration must not be appended again');
assert.ok(migration.indexOf('ids.indexOf(migrationId)') < migration.indexOf('appendRow('),
  'Migration duplicate check must happen before append');

// Existing configuration values must be preserved; only missing keys are seeded.
assert.match(config, /new Set\(existing\.slice\(1\)\.map\(r => r\[0\]\)/,
  'Default config seeding must detect existing keys');
assert.match(config, /defaults\.filter\(r => !keys\.has\(r\[0\]\)\)/,
  'Default config seeding must append only missing keys');
assert.match(config, /if \(rows\.length\) sheet\.getRange/,
  'Default config writes must be skipped when all keys already exist');

// Master data seeding must be keyed by stable IDs and append only missing records.
assert.match(masters, /yearRows\.indexOf\('TA-2027-2028'\) < 0/,
  'Academic year seed must use its stable ID');
assert.match(masters, /existingIds\.indexOf\(row\[0\]\) < 0/,
  'Jenjang seed must use stable IDs');
assert.match(masters, /if \(missing\.length\)/,
  'Master seeding must skip writes when all expected IDs already exist');

// Bootstrap must be safe to repeat and must remove temporary credentials.
assert.match(superadmin, /if \(exists\)[\s\S]*?deleteProperty\('PSB_INITIAL_SUPERADMIN_HASH'\)/,
  'Existing Superadmin must prevent duplicate creation and clear bootstrap secrets');
assert.match(superadmin, /sheet\.appendRow\(/,
  'Initial Superadmin must be persisted only through the USERS sheet');
assert.match(superadmin, /PSB_INITIAL_SUPERADMIN_USERNAME[\s\S]*?PSB_INITIAL_SUPERADMIN_NAME/,
  'Bootstrap credentials must be sourced from Script Properties');
assert.match(superadmin, /props\.deleteProperty\('PSB_INITIAL_SUPERADMIN_HASH'\)[\s\S]*?props\.deleteProperty\('PSB_INITIAL_SUPERADMIN_SALT'/,
  'Successful bootstrap must clear stored password hash and salt');

// Private implementations must remain callable from explicit editor entry points.
assert.match(source, /function RUN_SETUP_DATABASE\(\)\s*\{\s*return setupPSBDatabase_\(\);\s*\}/,
  'Database setup must expose a deliberate editor-only entry point');
assert.match(source, /function RUN_CONFIGURE_INITIAL_SUPERADMIN\(\)\s*\{\s*return configureInitialSuperadmin_\(\);\s*\}/,
  'Superadmin bootstrap must expose a deliberate editor-only entry point');

console.log('Database foundation and setup idempotency safeguards: OK');
