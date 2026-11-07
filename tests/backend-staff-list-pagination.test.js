'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const app = fs.readFileSync('frontend/app.js', 'utf8');

function functionBody(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  const end = nextName ? source.indexOf('\nfunction ' + nextName + '(', start) : -1;
  assert.notEqual(start, -1, name + ' must exist');
  assert.ok(!nextName || end > start, name + ' boundary must exist');
  return source.slice(start, end > start ? end : undefined);
}

const registrations = functionBody(code, 'getRegistrationList', 'getRegistrationDetail');
assert.match(registrations, /requireRole_\(sessionToken, PSB_REGISTRATION_ADMIN_ROLES\)/,
  'Registration list must retain its staff role gate');
assert.match(registrations, /pageSize = Math\.min\(100, Math\.max\(1/,
  'Registration page size must be bounded');
assert.match(registrations, /candidateId/,
  'Registration search must resolve candidate records');
assert.match(registrations, /candidate\.fullName, candidate\.name/,
  'Registration search must include candidate name');
assert.match(registrations, /registrationNumber, item\.registrationId/,
  'Registration search must include registration number and ID');
assert.match(registrations, /selected\.slice\(\(page - 1\) \* pageSize, page \* pageSize\)/,
  'Registration backend must select only the requested page');
assert.match(registrations, /total:total, pageCount:pageCount/,
  'Registration response must include pagination metadata');
assert.match(registrations, /enrichRegistrationList_\(items\)/,
  'Only page rows may be enriched');

const verification = functionBody(code, 'getVerificationQueue', 'getVerificationDetail');
assert.match(verification, /requireRole_\(sessionToken, PSB_VERIFICATION_ROLES\)/,
  'Verification queue must retain its staff role gate');
assert.match(verification, /getFormPaymentVerifiedRegistrationIds_\(\)/,
  'Payment prerequisite must remain enforced for verification queue');
assert.match(verification, /candidate\.fullName, candidate\.name/,
  'Verification search must include candidate name');
assert.match(verification, /registrationNumber, item\.registrationId/,
  'Verification search must include registration number and ID');
assert.match(verification, /selected\.slice\(\(page - 1\) \* pageSize, page \* pageSize\)/,
  'Verification backend must select only the requested page');
assert.match(verification, /total:total, pageCount:pageCount/,
  'Verification response must include pagination metadata');
assert.match(verification, /enrichRegistrationList_\(limitedItems\)/,
  'Only the requested verification page may be enriched');

assert.match(app, /async function loadApplicantPage\(page\)/,
  'Applicant UI must request server-side pages');
assert.match(app, /async function loadVerificationQueue\(page\)/,
  'Verification UI must request server-side pages');
assert.match(app, /pageSize:50,search:state\.applicantSearch,status:state\.applicantStatus/,
  'Applicant UI must send search and status filters to the backend');
assert.match(app, /pageSize:50,search:state\.verificationSearch,status:state\.verificationStatus/,
  'Verification UI must send search and status filters to the backend');
assert.ok(app.includes('Halaman ${meta.page}') && app.includes('Halaman ${page.page}'),
  'Both staff tables must display pagination labels');

console.log('PSB staff registration and verification server pagination safeguards: OK');
