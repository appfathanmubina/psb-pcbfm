'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = code.indexOf('function saveRegistration(sessionToken, payload) {');
const end = code.indexOf('\nfunction submitRegistration(', start);
assert.ok(start >= 0 && end > start, 'saveRegistration function must exist');
const save = code.slice(start, end);

assert.match(code, /function registrationChildId_\(prefix, registrationId\)/,
  'related-row IDs must be deterministic from the registration ID');
assert.match(code, /Utilities\.computeDigest\(Utilities\.DigestAlgorithm\.SHA_256, source, Utilities\.Charset\.UTF_8\)/,
  'deterministic child keys must be bounded digests, not raw client input');
assert.match(save, /const finalRegistrationId = existing \? String\(existing\.registration\.registrationId\) : \(registrationId \|\| generateId_\('REG'\)\)/,
  'new registrations must retain the client-generated id, with server fallback');
assert.match(save, /existing\?\.registration\?\.candidateId \|\| registrationChildId_\('CND', finalRegistrationId\)/);
assert.match(save, /existing\?\.guardian\?\.guardianId \|\| registrationChildId_\('GRD', finalRegistrationId\)/);
assert.match(save, /existing\?\.address\?\.addressId \|\| registrationChildId_\('ADR', finalRegistrationId\)/);
assert.match(save, /existing\?\.school\?\.schoolId \|\| registrationChildId_\('SCH', finalRegistrationId\)/);

const anchor = save.indexOf("upsertById_(regSheet, 'registrationId', finalRegistrationId, registration);");
const candidate = save.indexOf("upsertById_(candidateSheet, 'candidateId', candidateId, candidate);");
const guardian = save.indexOf("upsertById_(guardianSheet, 'guardianId', guardianId, guardian);");
const address = save.indexOf("upsertById_(addressSheet, 'addressId', addressId, address);");
const school = save.indexOf("upsertById_(schoolSheet, 'schoolId', schoolId, school);");
assert.ok(anchor >= 0 && candidate > anchor && guardian > candidate && address > guardian && school > address,
  'registration ownership/status anchor must be written before every related row');
assert.match(save, /findRegistration_\(registrationId\)/,
  'retry must first discover the existing registration anchor');
assert.match(save, /existing\.registration\.userId.*actor\.userId/,
  'retry must retain the existing ownership check');
assert.match(save, /PSB_REGISTRATION_EDITABLE_STATUSES\.indexOf\(String\(existing\.registration\.status\)\)/,
  'retry must retain the editable-status check');

console.log('Idempotent registration persistence safeguards: OK');
