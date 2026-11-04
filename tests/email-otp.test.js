'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const code = fs.readFileSync('apps-script/Code.gs','utf8');
const html = fs.readFileSync('apps-script/Index.html','utf8') + '\n' + fs.readFileSync('frontend/psb-fm-apps-script.js','utf8');
const pwa = fs.readFileSync('frontend/app.js','utf8');
const bridge = code.slice(code.indexOf('const PSB_PWA_BRIDGE_ALLOWED_FUNCTIONS'),code.indexOf(']);',code.indexOf('const PSB_PWA_BRIDGE_ALLOWED_FUNCTIONS')));
assert.ok(code.includes('function registerWali(payload)'), 'direct Wali registration endpoint must exist');
assert.ok(code.includes('function validateWaliRegistrationPayload_(payload)'), 'registration validation must remain');
assert.ok(code.includes("hashPassword_(input.password,passwordSalt)"), 'password must remain hashed');
assert.ok(code.includes("createSession_(userId)"), 'new account must receive a session');
assert.ok(code.includes("'WALI','ACTIVE'"), 'new account must be an active Wali');
assert.ok(code.includes("!phoneNormalized && !emailNormalized"), 'at least one login identifier must be required');
assert.ok(code.includes("if (email && (email.length > 254"), 'email must be optional but validated when supplied');
assert.ok(!/startWaliRegistration|resendWaliRegistrationEmailOtp|verifyWaliRegistration|PSB_WALI_OTP|sendWaliEmailOtp_|MailApp\.sendEmail/.test(code), 'email OTP backend must be removed');
assert.ok(!/startWaliRegistration|resendWaliRegistrationEmailOtp|verifyWaliRegistration|waliOtpVerificationId|Verifikasi Email|Kirim Kode Email/.test(html), 'Apps Script UI must not expose email verification');
assert.ok(!/startWaliRegistration|resendWaliRegistrationEmailOtp|verifyWaliRegistration|waliOtpVerificationId|Verifikasi Email|Kirim Kode Email/.test(pwa), 'PWA UI must not expose email verification');
assert.ok(bridge.includes("'registerWali'") && !/startWaliRegistration|resendWaliRegistrationEmailOtp|verifyWaliRegistration/.test(bridge), 'Bridge must expose only the direct registration endpoint');
for (const [source,label] of [[html,'Apps Script UI'],[pwa,'PWA']]) {
  assert.ok(source.includes('Email (opsional)'),label+' must show optional email');
  assert.ok(source.includes('No. HP (opsional)'),label+' must show optional phone');
  assert.ok(source.includes('Daftar & Masuk'),label+' must provide direct registration action');
}
console.log('Direct Wali registration without email verification safeguards: OK');
