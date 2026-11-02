# PSB Fathan Mubina — Security Audit

**Repository:** `appfathanmubina/psb-pcbfm`  
**Branch audited:** `main` (static review of the current repository source)  
**Repository visibility:** Public  
**Audit type:** Static source review and GitHub repository hygiene review  
**Runtime status:** Google Apps Script production runtime was not tested; repository changes have not been copied to or deployed in production.

## Scope

- Apps Script backend: `Code.gs`, `SetupDatabase.gs`, `BridgeServer.gs`, and `Bridge.html`
- PWA client: `frontend/app.js`, `frontend/api-bridge.js`, `frontend/index.html`, and `frontend/sw.js`
- Apps Script manifests and GitHub Actions validation workflow
- Authentication, session handling, role checks, registration ownership, payment, documents, chat, public endpoints, and browser-to-server bridge

## Changes applied in the repository

1. Removed hardcoded Superadmin hash/salt bootstrap values and dummy test-data seed/clear helpers in an earlier hardening batch.
2. Replaced the old initial-account setup with a trusted-editor bootstrap stored temporarily in Apps Script Script Properties. Bootstrap properties are deleted after account creation; stale bootstrap properties are also cleared if the account already exists.
3. Renamed setup/bootstrap functions to private Apps Script function names ending in underscore:
   - `setupPSBDatabase_`
   - `configureInitialSuperadmin_`
   - `createInitialSuperadmin_`
   - `installChatAutomationTrigger_`
4. Renamed internal maintenance functions to private names:
   - `runChatAutomation_`
   - The session cleanup helper remains private as `cleanupPSBSessions_`; the redundant public wrapper was removed.
5. The chat automation trigger setup removes both the legacy public handler and the new private handler before installing the current trigger.
6. Bridge backend exceptions return a generic public error while details are written to the execution log.
7. Existing spreadsheet headers are checked and mismatches cause a safe stop rather than overwriting headers.
8. Added CI checks to prevent the protected setup/maintenance functions from being reintroduced as browser-callable public functions, and to parse-check Apps Script JavaScript files.
9. Earlier repository checks found no matches for common Google API keys, GitHub tokens, OAuth client secrets, private-key markers, or Google access-token patterns in the scanned source. A pattern scan is not proof that no secret exists anywhere.
10. Added Email OTP verification to Wali registration; the old direct registration endpoint is disabled.

## Controls observed in reviewed application paths

- The PWA bridge has an explicit function allowlist.
- Authenticated data and mutation endpoints reviewed use session validation and role checks.
- Wali registration, payment, document, and chat paths reviewed include ownership checks against the authenticated user's registration or thread.
- Public configuration returns a narrow allowlist of browser-needed settings.
- Public gallery is intentionally unauthenticated and reads images from a configured Drive folder.
- Session tokens are generated with UUID entropy and only token hashes are stored in the session sheet.
- Password changes and administrator resets revoke existing sessions.

## Audit log and API data minimization

- `writeAudit_()` now redacts credential, token, OTP, file-reference, contact, address, and identity-number fields from structured old/new values before they are stored.
- Historical audit rows are sanitized again when returned by `getAuditLogPageData()`, so previously recorded values are not sent to the browser verbatim.
- Free-text audit descriptions receive email, Indonesian mobile-number, bearer-token, and JWT masking. Keep descriptions action-oriented; do not include raw request payloads.
- Audit write failures and login exceptions use generic execution-log markers rather than serializing exception objects that could contain request details.
- The audit viewer remains restricted to `SUPERADMIN` and `ADMIN_PSB`. These controls reduce accidental disclosure; they do not replace runtime access testing or a review of every endpoint's returned fields.

## Remaining risks — not closed by this audit

### High priority

- **Password hashing / work factor:** new and migrated passwords now use PBKDF2-HMAC-SHA256 with a per-user random salt and 60,000 iterations. Existing one-round SHA-256 accounts are verified using the legacy method only at successful login, then upgraded in place; the password, user ID, role, registration records, and other user data are preserved. This is a compatibility-preserving improvement, but 60,000 iterations is a transitional work factor and must be benchmarked on a test Apps Script deployment before production rollout. Increase the work factor only after measuring login latency and Apps Script execution limits. Argon2id/bcrypt/scrypt are not natively available through the current Apps Script Utilities interface.
- **Email delivery readiness:** Wali registration uses Email OTP through `MailApp.sendEmail()`. Delivery depends on the Apps Script execution account's remaining daily quota, sender reputation, recipient filtering, and Google Workspace/Gmail policy. Validate delivery and quota behavior in a test deployment; MailApp accepting a message does not guarantee inbox delivery.

### Medium priority

- **Public gallery Drive folder:** `getPublicGallery` now fails closed unless trusted administrators explicitly configure `PSB_PUBLIC_GALLERY_FILE_IDS`. Only up to 15 allowlisted JPEG/PNG/WEBP/GIF files that remain direct children of `PSB_PUBLIC_GALLERY_FOLDER_ID` (or the legacy folder fallback) are returned. Original Drive filenames are not exposed. Keep student documents and private family photos outside the gallery, and manually verify each approved image's sharing/access settings. The allowlist is a publication control, not a substitute for checking image consent.
- **Upload resource limits:** the current repository source now checks encoded Base64 length before decoding, enforces server-side byte limits, and verifies PDF/JPEG/PNG/WEBP signatures for document, payment, and chat uploads. Chat attachments are capped at 10 MB even if configuration is higher; document uploads default to 10 MB and are capped at 20 MB. These controls still require Apps Script runtime testing with valid and deliberately mismatched files.
- **Abuse throttling:** login lockout uses CacheService, which is best-effort and can be affected by concurrent requests or cache eviction. Add stronger server-side throttling for login and public registration if the service receives abusive traffic.
- **Bootstrap password entry:** the trusted-editor bootstrap uses a standard Apps Script prompt; the password is not masked. Run it only in a private environment with the screen not visible to others.

## Email OTP registration

- `startWaliRegistration()` sends a six-digit OTP using Google Apps Script `MailApp.sendEmail()`. `verifyWaliRegistration()` creates the WALI account and session only after the OTP is correct. The old `registerWali()` endpoint fails closed.
- Email is mandatory and is the sole verification channel. Phone number is optional contact data and is not used for OTP or resend throttling.
- OTP expires after 5 minutes, permits at most 5 attempts, has a 60-second resend cooldown, and is limited to 5 sends per email address in a rolling 24-hour window. Old OTP records are removed after 24 hours.
- OTP values are never stored or returned. Only SHA-256(OTP + per-request random salt) is stored and checked with constant-time comparison. Pending records store PBKDF2 password hashes, never plaintext passwords.
- Duplicate email checks occur only after OTP entry to avoid exposing account existence. Phone duplicate checking occurs only when a phone number was supplied.
- MailApp quota is checked before sending. Quota depends on Google account / Apps Script execution context; MailApp acceptance does not guarantee inbox delivery. Recipients should check spam/promotions.
- Optional Script Properties: `PSB_OTP_SENDER_NAME` and `PSB_OTP_REPLY_TO`. No external provider token is required.
- The existing `WALI_OTP` sheet schema remains unchanged for compatibility; the legacy `waMessageId` metadata column is retained but left blank. Run updated database setup only in a test project / duplicate spreadsheet first.

## Upload validation details

- `decodeAndValidateUpload_()` rejects empty/malformed Base64 and checks the encoded length against the maximum byte size before calling `Utilities.base64Decode()`.
- The decoded byte count is checked again, and the file signature must match the declared MIME type for PDF, JPEG, PNG, or WEBP.
- Payment proof uploads are limited to 5 MB; chat attachments use the configured limit with a hard ceiling of 10 MB; document uploads use the document-type limit (or 10 MB when unset) with a hard ceiling of 20 MB.
- The existing per-document MIME allowlist and ownership/role checks remain in place. This is defense-in-depth, not antivirus scanning; uploaded files should still be treated as untrusted content.
- Verify actual browser payloads and Apps Script behavior in a test deployment before production sync.

## Password migration details

- Stored new hash format: `pbkdf2_sha256$60000$<64-hex-character-derived-key>`; the existing `passwordSalt` column stores the per-user salt.
- The login path accepts both legacy SHA-256 and the versioned PBKDF2 format. Only successful legacy authentication triggers migration.
- Password change, administrator reset, and migration serialize through the Apps Script script lock; password change/reset re-read the user row without cache before updating the hash.
- Migration uses a script lock, reloads the user row bypassing cache, and writes only the password hash and salt columns. If a concurrent password reset/change has occurred, the migration does not overwrite it.
- New registrations, manual account creation, administrator password resets, password changes, and Superadmin bootstrap all use the new `hashPassword_` implementation.
- A successful migration is recorded in the audit log without recording the password or derived hash.

## Operational requirements before production sync

1. Do not assume GitHub changes automatically update the deployed Apps Script project. Copy the reviewed Apps Script source manually and deploy it only after a controlled backup and test.
2. When applying the new source to Apps Script, run `installChatAutomationTrigger_` from the trusted Apps Script editor once. This replaces any legacy `runChatAutomation` trigger with the private `runChatAutomation_` handler. Alternatively, run `setupPSBDatabase_` if a full setup pass is intentionally required.
3. Verify login, Wali registration, password change/reset, session expiry/logout, Wali ownership boundaries, payments, documents, chat, and scheduled chat automation in a test deployment.
4. Do not copy any source into the production Apps Script project until the source comparison and backup are complete.

## Audit conclusion

The repository has received meaningful static hardening and the previously exposed setup/maintenance entry points have been made private to the Apps Script HTML-service client. The application is **not certified secure** and this is **not a penetration test**. The remaining high-priority issues above should be resolved before describing the authentication system as strongly secured. The repository can remain Public provided the listed public assets/endpoints contain only information intended for public access and no secrets are committed.
