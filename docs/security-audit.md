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

- **Password hashing:** passwords still use one-round SHA-256 with salt. This is not a password-hardening algorithm such as Argon2id, scrypt, bcrypt, or PBKDF2 with a suitably high work factor. Do not treat this as production-grade password storage. A migration must preserve existing users or require a controlled password reset; this audit did not change the hash format.
- **Wali identity verification:** `registerWali` accepts a new account without OTP or verified email/phone. This allows unverified accounts and potential registration spam. Introduce a verified contact flow or another suitable anti-abuse control before relying on contact details for identity.

### Medium priority

- **Public gallery Drive folder:** the folder configured in `getPublicGallery` is exposed by design. Confirm it contains only images approved for public display; do not place student documents, private family photos, or internal images there.
- **Upload resource limits:** document, payment, and chat upload handlers decode base64 before fully bounding the encoded request size. Add an early encoded-size limit and server-side content-signature validation to reduce memory/CPU abuse and file-type spoofing.
- **Abuse throttling:** login lockout uses CacheService, which is best-effort and can be affected by concurrent requests or cache eviction. Add stronger server-side throttling for login and public registration if the service receives abusive traffic.
- **Bootstrap password entry:** the trusted-editor bootstrap uses a standard Apps Script prompt; the password is not masked. Run it only in a private environment with the screen not visible to others.

## Operational requirements before production sync

1. Do not assume GitHub changes automatically update the deployed Apps Script project. Copy the reviewed Apps Script source manually and deploy it only after a controlled backup and test.
2. When applying the new source to Apps Script, run `installChatAutomationTrigger_` from the trusted Apps Script editor once. This replaces any legacy `runChatAutomation` trigger with the private `runChatAutomation_` handler. Alternatively, run `setupPSBDatabase_` if a full setup pass is intentionally required.
3. Verify login, Wali registration, password change/reset, session expiry/logout, Wali ownership boundaries, payments, documents, chat, and scheduled chat automation in a test deployment.
4. Do not copy any source into the production Apps Script project until the source comparison and backup are complete.

## Audit conclusion

The repository has received meaningful static hardening and the previously exposed setup/maintenance entry points have been made private to the Apps Script HTML-service client. The application is **not certified secure** and this is **not a penetration test**. The remaining high-priority issues above should be resolved before describing the authentication system as strongly secured. The repository can remain Public provided the listed public assets/endpoints contain only information intended for public access and no secrets are committed.
