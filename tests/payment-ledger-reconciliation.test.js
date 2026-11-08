'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const helperStart = backend.indexOf('function paymentAmountMatchesBill_(');
const helperEnd = backend.indexOf('\nfunction preferredPaymentForBill_(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Canonical payment reconciliation helpers must exist');
const sandbox = {};
vm.runInNewContext(backend.slice(helperStart, helperEnd), sandbox);

const bill = (id, registrationId, amount, status='UNPAID') =>
  ({billId:id,registrationId,amount,status});
const payment = (id, billId, registrationId, amount, status) =>
  ({paymentId:id,billId,registrationId,amount,status});

let ledger = sandbox.reconcilePaymentLedger_(
  [bill('b1','r1',125000,'PAID')],
  [payment('p1','b1','r1',125000,'VERIFIED')]
);
assert.equal(ledger.summary.paidAmount,125000);
assert.equal(ledger.summary.paidBills,1);
assert.equal(ledger.byBill.b1.status,'PAID');
assert.equal(ledger.byBill.b1.requiresReview,false);

ledger = sandbox.reconcilePaymentLedger_([bill('b2','r2',200000,'PAID')],[]);
assert.equal(ledger.summary.paidAmount,0,'A PAID bill without a payment row must not count as received money');
assert.equal(ledger.byBill.b2.status,'UNPAID');
assert.equal(ledger.summary.paidWithoutVerifiedBills,1);
assert.equal(ledger.byBill.b2.requiresReview,true);

ledger = sandbox.reconcilePaymentLedger_(
  [bill('b3','r3',300000,'PAID')],
  [payment('p3','b3','r3',300000,'SUBMITTED')]
);
assert.equal(ledger.byBill.b3.status,'WAITING','SUBMITTED takes precedence over an inconsistent PAID bill');
assert.equal(ledger.summary.paidAmount,0);
assert.equal(ledger.summary.pendingAmount,300000);
assert.equal(ledger.summary.paidWithoutVerifiedBills,1);

ledger = sandbox.reconcilePaymentLedger_(
  [bill('b4','r4',400000)],
  [payment('p4','b4','r4',400000,'REJECTED')]
);
assert.equal(ledger.byBill.b4.status,'REJECTED');
assert.equal(ledger.summary.rejectedPayments,1);
assert.equal(ledger.summary.paidAmount,0);

ledger = sandbox.reconcilePaymentLedger_(
  [bill('b5','r5',500000)],
  [payment('orphan','missing-bill','r5',500000,'VERIFIED')]
);
assert.equal(ledger.summary.orphanPayments,1);
assert.equal(ledger.summary.paidAmount,0);

ledger = sandbox.reconcilePaymentLedger_(
  [bill('b6','r6',600000)],
  [payment('wrong-reg','b6','other-reg',600000,'VERIFIED')]
);
assert.equal(ledger.summary.registrationMismatchPayments,1);
assert.equal(ledger.summary.paidAmount,0);
assert.equal(ledger.byBill.b6.requiresReview,true);

ledger = sandbox.reconcilePaymentLedger_(
  [bill('b7','r7',700000)],
  [payment('wrong-amount','b7','r7',699000,'VERIFIED')]
);
assert.equal(ledger.summary.amountMismatchPayments,1);
assert.equal(ledger.summary.paidAmount,0);
assert.equal(ledger.byBill.b7.status,'UNPAID');

ledger = sandbox.reconcilePaymentLedger_(
  [bill('b8','r8',800000,'PAID')],
  [payment('p8a','b8','r8',800000,'VERIFIED'),payment('p8b','b8','r8',800000,'VERIFIED')]
);
assert.equal(ledger.summary.duplicateVerifiedBills,1);
assert.equal(ledger.summary.paidAmount,800000,'Duplicate verified rows must not double-count one bill');
assert.equal(ledger.byBill.b8.requiresReview,true);

ledger = sandbox.reconcilePaymentLedger_(
  [bill('b9','r9',900000,'UNPAID')],
  [payment('p9','b9','r9',900000,'VERIFIED')]
);
assert.equal(ledger.byBill.b9.status,'PAID','A matching verified receipt is authoritative when the bill status write was missed');
assert.equal(ledger.summary.verifiedBillStatusMismatch,1);

ledger = sandbox.reconcilePaymentLedger_(
  [bill('b10','r10',1000000,'CANCELLED')],
  [payment('p10','b10','r10',1000000,'VERIFIED')]
);
assert.equal(ledger.summary.paidAmount,0);
assert.equal(ledger.summary.cancelledBillPayments,1);

function section(source,start,end,label){
  const a=source.indexOf(start);assert.ok(a>=0,label+' start');
  const b=source.indexOf(end,a+start.length);assert.ok(b>a,label+' boundary');
  return source.slice(a,b);
}
const formGate=section(backend,'function getFormPaymentVerifiedRegistrationIds_()','\nfunction isFormPaymentVerified_', 'Form payment gate');
assert.match(formGate,/reconcilePaymentLedger_\(bills,payments\)/);
assert.match(formGate,/state\?\.status==='PAID'&&!state\.requiresReview/);
assert.doesNotMatch(formGate,/String\(x\.status\|\|''\)\.toUpperCase\(\)==='PAID'/,
  'Bill status alone must not authorize document upload or verification');

const verifyPayment=section(backend,'function verifyPayment(sessionToken,payload){','\nfunction getSelectionPageData', 'Payment verification');
assert.match(verifyPayment,/paymentAmountMatchesBill_\(br\.object,found\.object\)/,
  'Finance must not approve a payment whose amount differs from the current bill');

const verifyDocument=section(backend,'function verifyDocument(sessionToken, payload) {','\nfunction finalizeVerification', 'Document verification');
assert.match(verifyDocument,/isFormPaymentVerified_\(/,
  'Document verification must use the same reconciled payment gate');
assert.match(verifyDocument,/status==='REREGISTRATION'/,
  'The separate re-registration document workflow remains supported');

const finalize=section(backend,'function finalizeVerification(sessionToken, payload) {','\nfunction setRegistrationStatus_', 'Registration verification');
assert.match(finalize,/getCurrentDocuments_\(registrationId\)/);
assert.match(finalize,/d\.status\|\|''\)\.toUpperCase\(\)!=='VERIFIED'/);

const openRereg=section(backend,'function openReregistration(sessionToken, registrationId) {','\nfunction finalizeReregistration', 'Reregistration opening');
assert.match(openRereg,/ensureReregistration_\(id,actor\.userId,true\)/);
const finalizeRereg=section(backend,'function finalizeReregistration(sessionToken, registrationId) {','\nfunction syncReregistrationAfterPayment_', 'Reregistration completion');
assert.match(finalizeRereg,/getCurrentDocuments_\(id\)/);
assert.match(finalizeRereg,/findReregistrationBillPayment_\(id\)/);
assert.match(finalizeRereg,/status\|\|''\)\.toUpperCase\(\)!=='PAID'/);

for(const name of ['getDashboardPageData','getReportingPageData','getAdvancedReportingData']){
  assert.match(backend,new RegExp('function '+name+'\\([\\s\\S]*?reconcilePaymentLedger_\\('),
    name+' must use the canonical ledger calculation');
}

console.log('Payment ledger reconciliation and registration-to-reregistration workflow regression: OK');
