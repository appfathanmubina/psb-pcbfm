# PSB Audit & Repair Log

Last updated: 2026-10-31
Repository: `appfathanmubina/psb-pcbfm`
Working branch: `main`

This log is the single tracking register for findings from the read-only audit and subsequent repairs. A finding is not considered complete until the code change is reviewed and the relevant behavior is tested.

## Repair batch 01 — backend registration, session, and verification

Commit: `13290f6b485025235207d4a5cad94a3c20b45075`
File changed: `apps-script/Code.gs`

| ID | Finding | Change | Status |
|---|---|---|---|
| REG-001 | `submitRegistration()` reassigns a variable declared with `const`, which can throw at submission time after the latest record is re-read. | Changed the binding to `let` so the latest registration snapshot can be assigned. | Code fixed; runtime test pending |
| AUTH-001 | Cached session path could accept a session without rereading its current status, delaying revocation. | Session validation now reads the SESSIONS row directly on each check. | Code fixed; runtime test pending |
| AUTH-002 | Cached user profile could delay enforcement of an account deactivation. | Session validation bypasses the user cache when checking account status. | Code fixed; runtime test pending |
| DOC-001 | Concurrent document verification requests were not serialized. | Added ScriptLock and rereads document/registration while holding the lock. | Code fixed; concurrency test pending |
| VER-001 | Concurrent finalization requests could act on a stale registration/document snapshot. | Added ScriptLock and performs status plus required-document checks after acquiring the lock. | Code fixed; concurrency test pending |

### Verification limits

- The updated file was fetched again from `main` and the expected code patterns were confirmed.
- No Apps Script deployment, production Spreadsheet mutation, or live end-to-end test was performed.
- Session validation now performs direct Spreadsheet reads on each authenticated request. Monitor latency and execution quotas during staging tests before production rollout.

## Outstanding audit findings

| ID | Finding | Next action | Status |
|---|---|---|---|
| AUTH-003 | Password storage uses one-round SHA-256 with salt. | Design and test a backward-compatible password-hash migration; do not invalidate existing accounts. | Open |
| AUTH-004 | Wali signup does not verify ownership of the submitted phone/email. | Confirm product policy, then decide whether OTP/email verification is required. | Open — policy decision |
| SYNC-001 | Ten functions differ between Apps Script UI and PWA UI. | Review each difference and confirm intentional parity or implement alignment. | Open |
| PWA-001 | PWA icon assets are duplicated/inappropriately sized. | Generate and verify favicon, 192px, 512px, and maskable assets and references. | Open |
| TXN-001 | Payment, bill, selection, and re-registration state transitions need a complete state-machine review. | Continue the next audit batch after the current repairs are tested. | Open |

## Working rules

1. Keep all source changes on the explicitly requested `main` branch.
2. Fetch the latest file and blob SHA immediately before each update.
3. Make focused commits with clear messages.
4. Do not run setup, seed, cleanup, or other production data mutations as part of a static audit.
5. Do not mark a repair verified until its relevant staging/runtime test has passed.

## Repair batch 02 — startup splash, logo, and first paint

Files changed:
- `frontend/app.js`
- `frontend/index.html`
- `frontend/sw.js`
- `frontend/manifest.webmanifest`
- `apps-script/Index.html`

PWA release/cache version: `32.4.16`

| ID | Finding | Change | Status |
|---|---|---|---|
| START-001 | PWA splash logo was injected only after `getPublicConfig` returned, so it was absent during the initial checking screen. | Render the repository-local logo directly in the initial HTML and retain an eager local asset fallback in the app bootstrap. Removed the splash's dependency on the old remote PNG URL. | Code fixed; browser test pending |
| START-002 | The unauthenticated first screen waited for the non-critical `getPublicConfig` server request before rendering the public landing page. | Render the public landing page immediately and refresh public configuration asynchronously. Cache the latest public config locally in the PWA for subsequent launches. | Code fixed; browser test pending |
| START-003 | The Apps Script interface also waited for public configuration before rendering the public landing page. | Render the public landing page immediately; refresh configuration in the background. The brand logo is hydrated before any server request. | Code fixed; Apps Script test pending |
| START-004 | PWA cache version was not changed when startup assets changed. | Bump PWA asset query versions and service-worker cache to `v32.4.16`. | Code fixed; cache-refresh test pending |

### Startup behavior and security notes

- The private dashboard is still withheld until `validateSession` succeeds. This optimization does not bypass authentication.
- Logged-out users should see the public landing page without waiting for `getPublicConfig`; the academic-year label is updated when configuration arrives.
- The PWA logo is loaded from the local repository asset `frontend/assets/logo-fathanmubina.svg`, not the old hard-coded remote splash PNG.
- The service-worker cache is versioned so the new HTML, JavaScript, manifest, and logo references are fetched as a coherent release.
- Runtime startup time, logo rendering on target phones, Apps Script HTML Service behavior, and service-worker activation still require browser/device testing. No Apps Script deployment was performed.
