'use strict';
const fs = require('fs');
const assert = require('assert');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const frontend = fs.readFileSync('frontend/app.js', 'utf8');

function section(source, start, end) {
  const a = source.indexOf(start);
  assert.notStrictEqual(a, -1, 'Missing section: ' + start);
  const b = source.indexOf(end, a + start.length);
  assert.notStrictEqual(b, -1, 'Missing section end: ' + end);
  return source.slice(a, b);
}

const paymentGate = section(backend, 'function getFormPaymentVerifiedRegistrationIds_()', 'function getWaliHomeData(sessionToken)');
assert.match(paymentGate, /MASTER_JENIS_PEMBAYARAN/);
assert.match(paymentGate, /formulir/i);
assert.match(paymentGate, /status.*VERIFIED/);
assert.match(paymentGate, /status.*PAID/);

const queue = section(backend, 'function getVerificationQueue(sessionToken, filters)', 'function getVerificationDetail(sessionToken, registrationId)');
assert.match(queue, /getFormPaymentVerifiedRegistrationIds_\(\)/);
assert.match(queue, /formPaidIds\.has\(registrationId\)/);

const startVerification = section(backend, 'function startVerification(sessionToken, registrationId)', 'function verifyDocument(sessionToken, payload)');
assert.match(startVerification, /isFormPaymentVerified_\(registrationId\)/);
assert.match(startVerification, /setelah pembayaran formulir dikonfirmasi/i);

const verifyDocument = section(backend, 'function verifyDocument(sessionToken, payload)', 'function finalizeVerification(sessionToken, payload)');
assert.match(verifyDocument, /isFormPaymentVerified_/);
assert.match(verifyDocument, /setelah pembayaran formulir dikonfirmasi/i);

const finalizeVerification = section(backend, 'function finalizeVerification(sessionToken, payload)', 'function setRegistrationStatus_(registration, status, actorUserId, note)');
assert.match(finalizeVerification, /isFormPaymentVerified_\(registrationId\)/);

const submitRegistration = section(backend, 'function submitRegistration(sessionToken, registrationId)', 'function validateRegistrationPayload_(payload, strict)');
assert.match(submitRegistration, /KEUANGAN/);
assert.match(submitRegistration, /secara bersamaan/);
assert.match(submitRegistration, /ensureFormBillForRegistration_/);
assert.match(submitRegistration, /Tagihan formulir telah dibuat otomatis/);
assert.match(submitRegistration, /Verifikasi PSB dimulai setelah pembayaran dikonfirmasi/i);

const verifyPayment = section(backend, 'function verifyPayment(sessionToken,payload)', 'function getSelectionPageData(sessionToken, registrationId)');
assert.match(verifyPayment, /notifyUsersByRoles_\(\['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'\]/);
assert.match(verifyPayment, /notifyRegistrationOwner_\(String\(regFound\.registration\.registrationId\)/);
assert.match(verifyPayment, /Alasan penolakan pembayaran wajib diisi/i);
assert.match(verifyPayment, /note\.length>500/);


const paymentData = section(backend, 'function buildPaymentData_(registrationId, paymentTypes)', 'function createBill(sessionToken,payload)');
assert.match(paymentData, /PAYMENT_VERIFICATIONS/);
assert.match(paymentData, /verificationNote/);

const waliHome = section(backend, 'function getWaliHomeData(sessionToken)', 'function statusLabel_(s)');
assert.match(waliHome, /paymentNote/);
assert.match(waliHome, /uploadedRequiredCount/);
assert.match(waliHome, /registrationStatus === 'COMPLETED'/);

const waliDashboard = section(frontend, 'function renderWaliHomeFlow(data)', 'function dashboardTaskItems(items, emptyText)');
assert.match(waliDashboard, /Pembayaran Formulir/);
assert.match(waliDashboard, /waliFlowAction\('documents'/);
assert.match(waliDashboard, /waliFlowAction\('payments'/);
assert.match(waliDashboard, /wali-flow-list/);
assert.doesNotMatch(waliDashboard, /wali-flow-parallel|wali-flow-current|wali-flow-next/);

const verifyPaymentUi = section(frontend, 'async function verifyPaymentUI(paymentId,status)', 'function openCreateBill()');
assert.match(verifyPaymentUi, /Tuliskan alasan penolakan/i);
assert.match(verifyPaymentUi, /if\(status==='REJECTED'&&!note\)/);

const paymentPage = section(frontend, 'function renderPaymentContent()', 'function openPaymentUpload(billId)');
assert.match(paymentPage, /Tagihan formulir akan dibuat otomatis setelah pendaftaran dikirim/);
assert.doesNotMatch(paymentPage, /openCreateBill\(\)/);
assert.match(paymentPage, /Alasan penolakan/);
assert.match(paymentPage, /verificationNote/);

console.log('Wali parallel document/payment workflow safeguards passed.');

const autoBill = section(backend, 'function ensureFormBillForRegistration_', 'function getPaymentPageData(sessionToken, registrationId)');
assert.match(autoBill, /MASTER_JENIS_PEMBAYARAN/);
assert.match(autoBill, /formulir/i);
assert.match(autoBill, /amount>0/);
assert.match(autoBill, /CANCELLED/);
assert.match(autoBill, /Tagihan formulir dibuat otomatis/);
const paymentPageData = section(backend, 'function getPaymentPageData(sessionToken, registrationId)', 'function getPaymentsForRegistration');
assert.match(paymentPageData, /ensureFormBillForRegistration_/);
assert.match(paymentPageData, /withScriptLock_/);
const createBill = section(backend, 'function createBill(sessionToken,payload)', 'function submitPayment(sessionToken,payload)');
assert.match(createBill, /requireRole_\(sessionToken,\['SUPERADMIN'\]\)/);
