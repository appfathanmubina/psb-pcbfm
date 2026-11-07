'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const backend = fs.readFileSync('apps-script/Code.gs', 'utf8');
const frontend = fs.readFileSync('frontend/app.js', 'utf8');

const submitStart = backend.indexOf('function submitPayment(sessionToken,payload){');
const verifyStart = backend.indexOf('\nfunction verifyPayment(sessionToken,payload){', submitStart);
assert.ok(submitStart >= 0 && verifyStart > submitStart);
const submit = backend.slice(submitStart, verifyStart);
const catchAt = submit.indexOf('if(paymentRowWritten)');
assert.ok(catchAt >= 0);
const recovery = submit.slice(catchAt);
assert.match(recovery, /lock\.waitLock\(10000\)/, 'post-commit recovery must serialize bill status repair');
assert.match(recovery, /findRowById_\(billSheet,'billId'/, 'recovery must locate the exact linked bill');
assert.match(recovery, /latestBill\.object\.status\|\|''\)\.toUpperCase\(\)!=='PAID'/, 'recovery must never downgrade a paid bill');
assert.match(recovery, /setValue\('PAYMENT_REVIEW'\)/, 'recovery must move a submitted bill to the review queue');

const dashStart = backend.indexOf('function getDashboardPageData(sessionToken)');
const dashEnd = backend.indexOf('\nfunction ', dashStart + 1);
const dashboard = backend.slice(dashStart, dashEnd);
assert.match(dashboard, /latestStatus==='SUBMITTED'/, 'dashboard must include a submitted payment even if bill status is stale');
assert.match(dashboard, /recoveryNeeded:/, 'dashboard task should identify stale bill status for operational visibility');

const renderStart = frontend.indexOf('function renderPaymentContent(){');
const renderEnd = frontend.indexOf('\nfunction ', renderStart + 1);
const render = frontend.slice(renderStart, renderEnd);
assert.match(render, /ps==='SUBMITTED'\|\|st==='PAYMENT_REVIEW'/, 'Wali UI must show a submitted payment as awaiting verification');
assert.match(render, /!pending/, 'Wali UI must suppress duplicate upload while payment is submitted');
assert.match(render, /ps==='SUBMITTED'/, 'payment manager actions must remain available for submitted records');

console.log('Payment submission partial-write recovery safeguards passed.');
