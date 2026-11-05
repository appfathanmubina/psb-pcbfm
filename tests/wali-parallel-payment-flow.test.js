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
assert.match(submitRegistration, /Verifikasi PSB dimulai setelah pembayaran dikonfirmasi/i);

const waliDashboard = section(frontend, 'function renderWaliHomeFlow(data)', 'function dashboardTaskItems(items, emptyText)');
assert.match(waliDashboard, /Pembayaran Formulir/);
assert.match(waliDashboard, /Dokumen Persyaratan/);
assert.match(waliDashboard, /waliFlowAction\('documents'/);
assert.match(waliDashboard, /waliFlowAction\('payments'/);
assert.match(waliDashboard, /stageIndex<7/);
assert.match(waliDashboard, /repeat\(auto-fit/);

const paymentPage = section(frontend, 'function renderPaymentContent()', 'function openPaymentUpload(billId)');
assert.match(paymentPage, /Tagihan formulir belum diterbitkan/);
assert.match(paymentPage, /melengkapi dokumen persyaratan sambil menunggu/);

console.log('Wali parallel document/payment workflow safeguards passed.');
