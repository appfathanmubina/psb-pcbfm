'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');

function section(name, source = code) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Function exists: ' + name);
  const end = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, end < 0 ? source.length : end);
}

// One canonical rule for payment eligibility: cancelled bills must never
// authorize document upload or move a registration into the verification queue.
const paidIds = section('getFormPaymentVerifiedRegistrationIds_');
assert.match(paidIds, /reconcilePaymentLedger_\(bills,payments\)/);
assert.match(code, /status\|\|''\)\.toUpperCase\(\)!=='CANCELLED'/,
  'Cancelled bills must be excluded by the canonical ledger before document eligibility is granted');
assert.match(paidIds, /reconcilePaymentLedger_\(bills,payments\)/);
assert.match(paidIds, /state\?\.status==='PAID'&&!state\.requiresReview/);
assert.doesNotMatch(paidIds, /String\(x\.status\|\|''\)\.toUpperCase\(\)\s*===\s*'PAID'\s*\|\|/,
  'A PAID bill flag without a matched verified payment must not authorize document uploads');

// Admin lists and the Wali home must select the newest active bill, newest
// payment attempt, and newest non-replaced document using the same timestamps.
const statusMap = section('getRegistrationPaymentDocumentStatusMap_');
assert.match(statusMap, /String\(x\.status\|\|''\)\.toUpperCase\(\)==='CANCELLED'\)return/,
  'cancelled bills must be excluded before payment status aggregation');
assert.match(statusMap, /const stamp=String\(x\.createdAt\|\|''\);/);
assert.match(statusMap, /stamp\.localeCompare\(billStampByReg\[id\]\)>0/);
assert.match(statusMap, /if\(!billByReg\[id\]\|\|stamp\.localeCompare\(billStampByReg\[id\]\)>0\)\{billByReg\[id\]=x/);
assert.match(statusMap, /String\(x\.status\|\|''\)\.toUpperCase\(\)==='REPLACED'\)return/,
  'replaced documents must be excluded from the latest required-document aggregation');
assert.match(statusMap, /const key=id\+'\|'\+typeId,stamp=String\(x\.uploadedAt\|\|''\);/);
assert.match(statusMap, /stamp\.localeCompare\(docStamp\[key\]\)>0/);

const wali = section('getWaliHomeData');
assert.match(wali, /status\|\|''\)\.toUpperCase\(\)!=='CANCELLED'/);
assert.match(wali, /createdAt\|\|''\)\.localeCompare/);
assert.match(wali, /if\(billId&&!Object\.prototype\.hasOwnProperty\.call\(paymentByBill,billId\)\)\s*paymentByBill\[billId\]=x/);
assert.match(wali, /status\|\|''\)\.toUpperCase\(\)!=='REPLACED'/);
assert.match(wali, /uploadedAt\|\|''\)\.localeCompare/);
assert.match(wali, /paymentStatusLabel/);
assert.match(wali, /documentsStatus|statusLabel:requiredDocumentTypes/);
assert.doesNotMatch(wali, /const formPaid\s*=\s*String\(reg\.status\)/,
  'Legacy registration status alone must not grant payment eligibility');
assert.match(wali, /\['VERIFIED','PAYMENT_VERIFIED','SELECTION','PASSED','NOT_PASSED','REREGISTRATION','COMPLETED'\]\.includes\(registrationStatus\)/,
  'The Wali workflow must keep the verification stage pending while the registration is UNDER_REVIEW');

const verificationQueue = section('getVerificationQueue');
assert.match(verificationQueue, /const queueStatuses = \['SUBMITTED','UNDER_REVIEW','REVISION','REREGISTRATION'\]/,
  'The verification queue must list only actionable registrations and document-review registrations');
assert.match(verificationQueue, /requestedStatus \? \(queueStatuses\.includes\(requestedStatus\) \? \[requestedStatus\] : \[\]\)/,
  'An unsupported status filter must not expose records with unavailable verification actions');

const finalize = section('finalizeVerification');
assert.match(finalize, /x\.required===true\|\|String\(x\.required\)\.toUpperCase\(\)==='TRUE'/,
  'Required document configuration must support boolean and string TRUE values');


// Dashboard verification tasks must use the same form-payment eligibility as the
// dedicated verification queue, and duplicate historical uploads must not replace
// the newest document in the verification checklist.
const dashboard = section('getDashboardPageData');
assert.match(dashboard, /getFormPaymentVerifiedRegistrationIds_\(\)/,
  'Dashboard verification tasks must use the canonical verified form-payment set');
assert.match(dashboard, /verifiedFormPaymentIds\.has\(String\(r\.registrationId\|\|''\)\)/,
  'Dashboard must exclude registrations whose form payment is not verified');
assert.match(dashboard, /\['SUBMITTED','UNDER_REVIEW','REVISION'\]/,
  'Dashboard initial verification queue must match actionable registration statuses');

const verificationDetail = section('getVerificationDetail');
assert.match(verificationDetail, /!Object\.prototype\.hasOwnProperty\.call\(byType, typeId\)/,
  'Verification detail must retain the newest-first document for each document type');
const documentOptions = section('getDocumentOptions');
assert.match(documentOptions, /!Object\.prototype\.hasOwnProperty\.call\(byType, typeId\)/,
  'Document options must retain the newest-first document for each document type');
assert.match(code, /function getDocumentPageData[\s\S]*?const byType = Object\.create\(null\);[\s\S]*?!Object\.prototype\.hasOwnProperty\.call\(byType, typeId\)/,
  'Document page data must retain the newest-first document for each document type');

console.log('Registration payment/document status consistency safeguards passed.');


// Successful status-changing transactions must advance the server dashboard cache
// generation, while the frontend clears page snapshots as well as page data caches.
const dashboardCacheHelper = section('invalidateOperationalReadCaches_');
assert.match(dashboardCacheHelper, /PSB_OPERATIONAL_READ_CACHE_REVISION_KEY_/);
assert.match(section('getOperationalReadCacheRevision_'), /getProperty\(PSB_OPERATIONAL_READ_CACHE_REVISION_KEY_\)/);
assert.match(section('getDashboardPageData'), /dashboardRevision/);
assert.match(section('getDashboardPageData'), /if \(dashboardRevision\) try \{ dashboardCache\.put/);
for (const name of ['createBill','submitPayment','verifyPayment','verifyDocument','finalizeVerification','uploadDocument','saveRegistration','submitRegistration','createSelectionSchedule','updateSelectionScheduleStatus','addSelectionParticipant','addSelectionParticipantsBulk','updateSelectionParticipantStatus','saveSelectionScore','saveSelectionResult','publishAnnouncement','openReregistration','finalizeReregistration','saveMasterItem','deactivateMasterItem']) {
  assert.match(section(name), /invalidateOperationalReadCaches_\(\)/, name + ' must invalidate the dashboard cache after a committed mutation');
}
const frontend = fs.readFileSync('frontend/app.js', 'utf8');
assert.match(frontend, /const success=result=>\{if\(MUTATING_SERVER_FUNCTIONS\.has\(fn\)&&result\?\.success\)\{invalidatePageDataCache\(\);\}if\(MUTATING_SERVER_FUNCTIONS\.has\(fn\)&&result\?\.success\)\{invalidateOperationalPageSnapshots\(\);\}/,
  'Successful mutations must clear data caches and invalidate status-dependent snapshots');
const snapshotInvalidation = frontend.slice(frontend.indexOf('function invalidateOperationalPageSnapshots()'), frontend.indexOf('function invalidateCurrentPageData()'));
assert.match(snapshotInvalidation, /new Set\(\['home','registration','applicants','documents','verification','verificationStatus','payments','selection','reregistration','reports','announcement','notifications','audit'\]\)/,
  'Only pages affected by operational status changes should have their snapshots invalidated');
assert.match(snapshotInvalidation, /state\.cache\.registration=null[\s\S]*?state\.cache\.documents=\{\}[\s\S]*?state\.cache\.payments=\{\}/,
  'Registration, document, and payment entity caches must be cleared after a successful mutation');
