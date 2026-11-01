'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const setup = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');
const bridge = fs.readFileSync('apps-script/Code.gs', 'utf8');
const pwa = fs.readFileSync('frontend/app.js', 'utf8');
const html = fs.readFileSync('apps-script/Index.html', 'utf8');

assert.match(code, /function startWaliRegistration\(payload\)/);
assert.match(code, /function verifyWaliRegistration\(verificationId, code\)/);
assert.match(code, /function resendWaliRegistrationOtp\(verificationId\)/);
assert.match(code, /function registerWali\(\)\s*\{\s*return fail_\(/);
assert.match(code, /sha256Hex_\(otp\+otpSalt\)/);
assert.match(code, /constantTimeEqual_\(expected,String\(row\[8\]\|\|''\)\)/);
assert.match(code, /PSB_WALI_OTP_TTL_MS_ = 5 \* 60 \* 1000/);
assert.match(code, /PSB_WALI_OTP_MAX_ATTEMPTS_ = 5/);
assert.match(code, /PSB_WALI_OTP_DAILY_LIMIT_ = 5/);
assert.match(code, /PSB_WALI_OTP_COOLDOWN_MS_ = 60 \* 1000/);
assert.match(code, /cleanupWaliOtpRecords_\(otpSheet,now\)/);
assert.match(code, /PropertiesService\.getScriptProperties\(\)/);
assert.match(code, /WA_ACCESS_TOKEN/);
assert.match(code, /graph\.facebook\.com/);
assert.match(code, /messaging_product:'whatsapp'/);
assert.match(code, /sub_type:'url',index:'0'/);
assert.match(code, /'startWaliRegistration','resendWaliRegistrationOtp','verifyWaliRegistration'/);
assert.doesNotMatch(code, /Akun WALI baru dibuat tanpa OTP/);

assert.match(setup, /WALI_OTP: 'WALI_OTP'/);
assert.match(setup, /WALI_OTP: \['verificationId'.*'waMessageId'\]/);

assert.match(pwa, /No\. HP WhatsApp \*/);
assert.match(pwa, /regWhatsappConsent/);
assert.match(pwa, /startWaliRegistration/);
assert.match(pwa, /renderWaliOtp/);
assert.match(pwa, /verifyWaliRegistration/);
assert.match(pwa, /resendWaliRegistrationOtp/);
assert.doesNotMatch(pwa, /Tanpa OTP/);

assert.match(html, /No\. HP WhatsApp \*/);
assert.match(html, /regWhatsappConsent/);
assert.match(html, /startWaliRegistration/);
assert.match(html, /renderWaliOtp/);
assert.match(html, /verifyWaliRegistration/);
assert.doesNotMatch(html, /Tanpa OTP/);

console.log('WhatsApp OTP registration safeguards: OK');
