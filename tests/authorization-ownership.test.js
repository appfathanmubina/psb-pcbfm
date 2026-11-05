'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');

function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Required backend function exists: ' + name);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}

function mustMatch(text, pattern, message) {
  assert.match(text, pattern, message);
}

// Central authorization primitives must bind permissions to a validated session
// and to the resource owner, rather than trusting client-supplied identifiers.
const requireRole = functionSource('requireRole_');
mustMatch(requireRole, /getSessionUser_\(sessionToken,\s*true\)/,
  'Role checks must begin with a validated session');
mustMatch(requireRole, /userRoles\.indexOf\(String\(r\)\.toUpperCase\(\)\)/,
  'Role checks must compare normalized roles');

const registrationAccess = functionSource('canAccessRegistration_');
mustMatch(registrationAccess, /PSB_REGISTRATION_ADMIN_ROLES/,
  'Registration access must explicitly identify administrator roles');
mustMatch(registrationAccess, /hasRoleDirect_\(actor,\s*\['WALI'\]\)/,
  'Non-admin registration access must be restricted to WALI');
mustMatch(registrationAccess, /registration\.userId\)\s*===\s*String\(actor\.userId\)/,
  'WALI registration access must enforce ownership');

// Read paths: WALI must not obtain another family's registration or payment.
const myRegistrations = functionSource('getMyRegistrations');
mustMatch(myRegistrations, /requireRole_\(sessionToken,\s*\['WALI','SUPERADMIN','ADMIN_PSB'\]\)/,
  'My registrations endpoint must require an allowed role');
mustMatch(myRegistrations, /filter\(x\s*=>\s*String\(x\.userId\)\s*===\s*String\(user\.userId\)\)/,
  'My registrations endpoint must filter by authenticated owner');

const registrationDetail = functionSource('getRegistrationDetail');
mustMatch(registrationDetail, /getSessionUser_\(sessionToken,\s*true\)/,
  'Registration detail must validate the session');
mustMatch(registrationDetail, /String\(reg\.registration\.userId\)\s*===\s*String\(user\.userId\)/,
  'WALI registration detail must enforce owner matching');

const paymentPage = functionSource('getPaymentPageData');
mustMatch(paymentPage, /if\s*\(isWali\)\s*items\s*=\s*items\.filter\(x\s*=>\s*String\(x\.userId\)\s*===\s*String\(actor\.userId\)\)/,
  'WALI payment page must list only the authenticated owner registrations');
mustMatch(paymentPage, /canAccessRegistration_\(actor,\s*selectedRegistration\)/,
  'Selected payment registration must pass an ownership check using the already-read registration row');

const paymentRead = functionSource('getPaymentsForRegistration');
mustMatch(paymentRead, /requireRole_\(sessionToken,\s*PSB_PAYMENT_VIEW_ROLES\)/,
  'Payment read must require a permitted role');
mustMatch(paymentRead, /canAccessRegistration_\(actor,\s*found\.registration\)/,
  'Payment read must enforce registration ownership');

// Mutation paths: authenticate, authorize the resource, then mutate.
const paymentSubmit = functionSource('submitPayment');
mustMatch(paymentSubmit, /requireRole_\(sessionToken,\s*\['WALI','SUPERADMIN','ADMIN_PSB','KEUANGAN'\]\)/,
  'Payment submission must require an allowed role');
mustMatch(paymentSubmit, /canAccessRegistration_\(actor,found\.registration\)/,
  'Payment submission must enforce registration ownership');
mustMatch(paymentSubmit, /LockService\.getScriptLock\(\)/,
  'Payment submission must serialize duplicate checks and writes');

const documentUpload = functionSource('uploadDocument');
mustMatch(documentUpload, /requireRole_\(sessionToken,\s*PSB_DOCUMENT_ACCESS_ROLES\)/,
  'Document upload must require a permitted role');
mustMatch(documentUpload, /canAccessRegistration_\(actor,\s*found\.registration\)/,
  'Document upload must enforce registration ownership');
mustMatch(documentUpload, /decodeAndValidateUpload_\(/,
  'Document upload must use centralized server-side file validation');

const paymentVerify = functionSource('verifyPayment');
mustMatch(paymentVerify, /requireRole_\(sessionToken,\s*PSB_PAYMENT_MANAGE_ROLES\)/,
  'Payment verification must be restricted to payment managers');
mustMatch(paymentVerify, /LockService\.getScriptLock\(\)/,
  'Payment verification must serialize status changes');

const documentVerify = functionSource('verifyDocument');
mustMatch(documentVerify, /requireRole_\(sessionToken,\s*PSB_VERIFICATION_ROLES\)/,
  'Document verification must be restricted to verification roles');
mustMatch(documentVerify, /LockService\.getScriptLock\(\)/,
  'Document verification must serialize status changes');

// Public WALI registration must serialize account creation, reject duplicate identifiers,
// store only a password hash, and issue a WALI session after successful creation.
const waliRegistration = functionSource('registerWali');
mustMatch(waliRegistration, /LockService\.getScriptLock\(\)/,
  'WALI registration must serialize duplicate checks and account creation');
mustMatch(waliRegistration, /const duplicate = users\.some/,
  'WALI registration must reject duplicate phone/email identifiers');
mustMatch(waliRegistration, /hashPassword_\(input\.password,\\s*passwordSalt\)/,
  'WALI registration must hash passwords before storage');
mustMatch(waliRegistration, /'WALI','ACTIVE'/,
  'WALI registration must create an active WALI account only');
mustMatch(waliRegistration, /createSession_\(userId\)/,
  'WALI registration must create a session after account creation');

console.log('Authorization and ownership regression safeguards passed.');
