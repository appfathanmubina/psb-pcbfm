'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const setup = fs.readFileSync('apps-script/SetupDatabase.gs', 'utf8');
const pwa = fs.readFileSync('frontend/app.js', 'utf8');
const html = fs.readFileSync('apps-script/Index.html', 'utf8');
const mustInclude = (source, parts, label) => {
  for (const part of parts) assert.ok(source.includes(part), label + ' missing: ' + part);
};
mustInclude(code, [
  'function startWaliRegistration(payload)',
  'function verifyWaliRegistration(verificationId, code)',
  'function resendWaliRegistrationEmailOtp(verificationId)',
  'function sendWaliEmailOtp_(email, otp)',
  'MailApp.sendEmail(options)',
  'MailApp.getRemainingDailyQuota()',
  'if (!email || email.length > 254',
  'sha256Hex_(otp+otpSalt)',
  'constantTimeEqual_(expected,String(row[8]||\'\'))',
  'PSB_WALI_OTP_TTL_MS_ = 5 * 60 * 1000',
  'PSB_WALI_OTP_MAX_ATTEMPTS_ = 5',
  'PSB_WALI_OTP_DAILY_LIMIT_ = 5',
  'PSB_WALI_OTP_COOLDOWN_MS_ = 60 * 1000',
  'countRecentWaliEmailOtpSends_(otpSheet,input.emailNormalized,now)',
  'waliOtpEmailKey_(input.emailNormalized)',
  'emailNormalized:emailNormalized',
  "'startWaliRegistration','resendWaliRegistrationEmailOtp','verifyWaliRegistration'"
], 'backend');
assert.ok(!/graph\.facebook\.com|WA_ACCESS_TOKEN|WHATSAPP OTP/.test(code), 'WhatsApp API remnants found in registration backend');
assert.ok(code.includes("return (String(row[3]||'') && String(r[3]||'')===String(row[3]||''))"), 'optional phone duplicate check must return a boolean');
assert.ok(setup.includes("'waMessageId'"), 'keep the existing OTP sheet schema compatible; legacy metadata column remains unused');
for (const [source,label] of [[pwa,'PWA'],[html,'Apps Script UI']]) {
  mustInclude(source,['Email aktif *','No. HP (opsional)','resendWaliRegistrationEmailOtp','Verifikasi Email'],label);
  assert.ok(!/regWhatsappConsent|No\. HP WhatsApp \*|Email \(opsional\)/.test(source),label+' still has WhatsApp registration controls');
}
console.log('Email OTP registration safeguards: OK');
