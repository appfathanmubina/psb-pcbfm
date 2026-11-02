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

const chatAccess = functionSource('chatCanAccessThread_');
mustMatch(chatAccess, /PSB_CHAT_ADMIN_ROLES/,
  'Chat access must explicitly identify chat administrators');
mustMatch(chatAccess, /thread\.waliUserId\)===String\(actor\.userId\)/,
  'WALI chat access must enforce thread ownership');

// Read paths: WALI must not obtain another family's registration/payment/chat.
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
mustMatch(paymentPage, /canAccessRegistration_\(actor,\s*found\.registration\)/,
  'Selected payment registration must pass an ownership check');

const paymentRead = functionSource('getPaymentsForRegistration');
mustMatch(paymentRead, /requireRole_\(sessionToken,\s*PSB_PAYMENT_VIEW_ROLES\)/,
  'Payment read must require a permitted role');
mustMatch(paymentRead, /canAccessRegistration_\(actor,\s*found\.registration\)/,
  'Payment read must enforce registration ownership');

const chatRead = functionSource('getChatThread');
mustMatch(chatRead, /requireRole_\(sessionToken,\s*PSB_CHAT_ACCESS_ROLES\)/,
  'Chat read must require a permitted role');
mustMatch(chatRead, /chatCanAccessThread_\(actor,thread\)/,
  'Chat read must enforce thread ownership');

const chatWrite = functionSource('sendChatMessage');
mustMatch(chatWrite, /requireRole_\(sessionToken,\s*PSB_CHAT_ACCESS_ROLES\)/,
  'Chat write must require a permitted role');
mustMatch(chatWrite, /chatCanAccessThread_\(actor,thread\)/,
  'Chat write must enforce thread ownership before saving');

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

// OTP verification must be time-limited, attempt-limited, single-use and constant-time.
const otpVerify = functionSource('verifyWaliRegistration');
mustMatch(otpVerify, /PSB_WALI_OTP_MAX_ATTEMPTS_/,
  'Email OTP verification must enforce an attempt limit');
mustMatch(otpVerify, /expiresAt\.getTime\(\)/,
  'Email OTP verification must enforce expiry');
mustMatch(otpVerify, /constantTimeEqual_\(expected,String\(row\[8\]\|\|''\)\)/,
  'Email OTP hash comparison must be constant-time');
mustMatch(otpVerify, /String\(row\[15\]\) !== 'PENDING'/,
  'Email OTP verification must reject already-used or inactive codes');
mustMatch(otpVerify, /'VERIFIED'/,
  'Successful OTP verification must mark the challenge as verified');

console.log('Authorization and ownership regression safeguards passed.');
