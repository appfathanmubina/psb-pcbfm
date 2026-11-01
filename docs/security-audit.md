# PSB Fathan Mubina — Security Audit

**Repository:** `appfathanmubina/psb-pcbfm`  
**Branch audited:** `main`  
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

## Controls observed in reviewed application paths

- The PWA bridge has an explicit function allowlist.
- Authenticated data and mutation endpoints reviewed use session validation and role checks.
- Wali registration, payment, document, and chat paths reviewed include ownership checks against the authenticated user's registration or thread.
- Public configuration returns a narrow allowlist of browser-needed settings.
- Public gallery is intentionally unauthenticated and reads images from a configured Drive folder.
- Session tokens are generated with UUID entropy and only token hashes are stored in the session sheet.
- Password changes and administrator resets revoke existing sessions.

## Remaining risks — not closed by this audit

### High priority

- **Password hashing / work factor:** new and migrated passwords now use PBKDF2-HMAC-SHA256 with a per-user random salt and 60,000 iterations. Existing one-round SHA-256 accounts are verified using the legacy method only at successful login, then upgraded in place; the password, user ID, role, registration records, and other user data are preserved. This is a compatibility-preserving improvement, but 60,000 iterations is a transitional work factor and must be benchmarked on a test Apps Script deployment before production rollout. Increase the work factor only after measuring login latency and Apps Script execution limits. Argon2id/bcrypt/scrypt are not natively available through the current Apps Script Utilities interface.
- **Wali identity verification:** `registerWali` accepts a new account without OTP or verified email/phone. This allows unverified accounts and potential registration spam. Introduce a verified contact flow or another suitable anti-abuse control before relying on contact details for identity.

### Medium priority

- **Public gallery Drive folder:** the folder configured in `getPublicGallery` is exposed by design. Confirm it contains only images approved for public display; do not place student documents, private family photos, or internal images there.
- **Upload resource limits:** document, payment, and chat upload handlers decode base64 before fully bounding the encoded request size. Add an early encoded-size limit and server-side content-signature validation to reduce memory/CPU abuse and file-type spoofing.
- **Abuse throttling:** login lockout uses CacheService, which is best-effort and can be affected by concurrent requests or cache eviction. Add stronger server-side throttling for login and public registration if the service receives abusive traffic.
- **Bootstrap password entry:** the trusted-editor bootstrap uses a standard Apps Script prompt; the password is not masked. Run it only in a private environment with the screen not visible to others.

## Password migration details

- Stored new hash format: `pbkdf2_sha256$60000$<64-hex-character-derived-key>`; the existing `passwordSalt` column stores the per-user salt.
- The login path accepts both legacy SHA-256 and the versioned PBKDF2 format. Only successful legacy authentication triggers migration.
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
