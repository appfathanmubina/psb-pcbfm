# PSB Audit & Repair Log

Last updated: 2026-11-01
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
| START-001 | PWA splash logo was injected only after `getPublicConfig` returned, so it was absent during the initial checking screen. | Render the repository-local logo directly in the initial HTML, make the splash visible before app.js finishes loading, and retain an eager local asset fallback in the app bootstrap. Removed the splash's dependency on the old remote PNG URL. | Code fixed; browser test pending |
| START-002 | The unauthenticated first screen waited for the non-critical `getPublicConfig` server request before rendering the public landing page. | Render the public landing page immediately and refresh public configuration asynchronously. Cache the latest public config locally in the PWA for subsequent launches. | Code fixed; browser test pending |
| START-003 | The Apps Script interface also waited for public configuration before rendering the public landing page. | Render the public landing page immediately; refresh configuration in the background. The brand logo is hydrated before any server request. | Code fixed; Apps Script test pending |
| START-004 | PWA cache version was not changed when startup assets changed. | Bump PWA asset query versions and service-worker cache to `v32.4.16`. | Code fixed; cache-refresh test pending |

### Startup behavior and security notes

- The private dashboard is still withheld until `validateSession` succeeds. This optimization does not bypass authentication.
- Logged-out users should see the public landing page without waiting for `getPublicConfig`; the academic-year label is updated when configuration arrives.
- The PWA logo is loaded from the local repository asset `frontend/assets/logo-fathanmubina.svg`, not the old hard-coded remote splash PNG. The splash is visible from initial HTML parsing, before the large application JavaScript bundle executes.
- The service-worker cache is versioned so the new HTML, JavaScript, manifest, and logo references are fetched as a coherent release.
- Runtime startup time, logo rendering on target phones, Apps Script HTML Service behavior, and service-worker activation still require browser/device testing. No Apps Script deployment was performed.

## Repair batch 03 — PWA bridge handshake and splash brand asset

PWA release/cache version: `32.4.17`

| ID | Finding | Change | Status |
|---|---|---|---|
| BRIDGE-001 | PWA depended on a single unsolicited `ready` message from the Apps Script iframe. A missed early message left every API call waiting until timeout, even though the login UI rendered. | Added iframe load handling and a retryable `ping` handshake. The parent accepts replies only from the expected iframe window and trusted Apps Script origins; only the metadata-only ping uses wildcard target origin to tolerate Apps Script redirects. | Code fixed; live PWA-to-Apps-Script test pending |
| BRIDGE-002 | Bridge startup errors were opaque and the PWA had no way to re-request readiness after iframe load. | Added explicit readiness timeout diagnostics and periodic ping retries while waiting. | Code fixed; live test pending |
| START-005 | The PWA splash referenced a complex SVG while the existing local PNG brand asset was already included in the shell cache. | Use the local PNG for initial splash and async splash hydration; bump PWA assets and service-worker cache to `32.4.17`. | Code fixed; browser/device logo test pending |

### Deployment and verification notes
- GitHub Pages source changes do not update the Apps Script deployment. The matching Apps Script source is now versioned as bridge `32.3.8` in `apps-script/Bridge.html` and `apps-script/Code.gs`; sync both files to the Apps Script editor and deploy a new Web App version so the deployed iframe can answer the retryable `ping` handshake.
- No Apps Script deployment was performed by this repair. Live login, iframe handshake, and splash rendering must still be verified in the deployed PWA.

## Repair batch 04 — service-worker cache alignment and Apps Script workflow paths

| ID | Finding | Change | Status |
|---|---|---|---|
| CACHE-001 | Asset references in the PWA were versioned `32.4.17`, but the service-worker cache name remained `psb-pwa-shell-v32-4-16`. | Align the cache name to `psb-pwa-shell-v32-4-17` so the service worker treats the current shell as a new release and removes the previous cache on activation. | Code fixed; browser activation test pending |
| CI-001 | Push and deploy workflows required `apps-script/Bridge.gs`, which does not exist. The actual project uses `Bridge.html` and `BridgeServer.gs`. | Validate both real bridge files (`Bridge.html` and `BridgeServer.gs`) in both workflows. | Code fixed; GitHub Actions run pending |

### Verification limits
- Static checks confirm all asset query versions and the service-worker cache name are aligned at `32.4.17`.
- Both Apps Script workflows now validate the actual bridge filenames used by the repository.
- No GitHub Actions push/deploy workflow was run. No Apps Script source was pushed and no production deployment was updated by this repair.

 
## Repair batch 05 — cross-device cache freshness and bridge diagnostics

PWA release/cache version: `32.4.18`

| ID | Finding | Change | Status |
|---|---|---|---|
| CACHE-002 | Navigation requests were cache-first, allowing a device to keep serving an older cached PWA entry page after a newer Pages deployment. | Changed service-worker navigation handling to network-first with the cached shell as an offline fallback. | Code updated; deployment/device verification pending |
| CACHE-003 | Service-worker registration did not explicitly request update checks with HTTP cache bypass. | Register with `updateViaCache: 'none'` and request `registration.update()` on page load. | Code updated; browser verification pending |
| CACHE-004 | PWA asset URLs and cache key needed a coordinated release bump for all clients to fetch the updated shell. | Bumped shell/manifest/script asset versions and cache name to `32.4.18`. | Code updated; GitHub Pages deployment pending |

### Cross-device verification limits
- These changes reduce stale navigation/cache behavior but cannot force-clear every browser's already-installed service worker until the updated PWA is fetched and activated.
- The Apps Script iframe still depends on the deployed Web App version and the browser's Google session/access policy. This batch does not change Apps Script deployment or permissions.
- Test GitHub Pages Actions deployment, then test the same URL in a normal browser tab and installed PWA on each affected device. If the bridge still fails only on one browser, inspect whether the Apps Script `/exec?bridge=1` endpoint redirects to a Google sign-in or access-denied page in that browser.


## Repair batch 06 — remove remote pull and temporary comparison directories from Apps Script workflows

| ID | Finding | Change | Status |
|---|---|---|---|
| CI-002 | The PUSH workflow ran a custom comparison script that created a temporary directory, generated a second clasp project config, and executed `clasp pull --force`. This failed when the remote response was not valid JSON and made the source upload dependent on a pull step. | Removed the remote-difference review and remote file-status steps. PUSH now validates checked-in repository files and manifest parity, then uploads the checked-in `apps-script/` source directly using `clasp push --force`. | Workflow updated; Actions run pending |
| CI-003 | The DEPLOY workflow repeated the same temporary-directory/`clasp pull` process before updating the existing deployment. | Removed remote-pull verification. DEPLOY validates repository source and updates only the configured existing deployment ID. | Workflow updated; Actions run pending |
| CI-004 | Obsolete helper scripts retained the `mktemp` + `clasp pull` implementation and could be mistakenly reused. | Removed `.github/scripts/check-apps-script-push.sh` and `.github/scripts/check-apps-script-remote.sh`. | Removed |

### Workflow behavior and limitations
- Neither workflow now runs `clasp pull`, `clasp show-file-status`, `mktemp`, or a remote source-comparison script.
- GitHub Actions still checks out the repository and creates ephemeral clasp configuration/credential files on its hosted runner because the clasp CLI requires those files. They are not read from or written to the user's computer or phone and are discarded with the runner.
- PUSH is a source upload only. It does not create or update a Web App deployment.
- DEPLOY updates only the existing deployment ID stored in `PRODUCTION_DEPLOYMENT_ID`.
- The updated workflows have not yet been executed. Run PUSH first and inspect its result; only run DEPLOY after PUSH succeeds.


## Repair batch 07 — replace clasp CLI with direct Apps Script API calls

| ID | Finding | Change | Status |
|---|---|---|---|
| CI-005 | Removing `clasp pull` alone still left the workflows dependent on clasp credential/config files written to the GitHub runner. | Replaced `clasp push` and `clasp deploy` with direct authenticated calls to the Google Apps Script API using a committed Node.js helper. Credentials are parsed from the GitHub Secret in memory; no `.clasprc.json`, `.clasp.json`, or temporary comparison directory is created. | Code updated; Actions/API test pending |
| CI-006 | The deployment process needed to preserve the production Web App URL while avoiding the clasp CLI. | The helper reads the configured existing deployment, creates a new Apps Script version, then updates that same deployment ID. | Code updated; production deployment test pending |

### Direct API workflow notes
- PUSH calls Apps Script `projects.updateContent` with source files read from the checked-out repository and does not retrieve remote source.
- DEPLOY calls Apps Script deployment/version APIs and targets only `PRODUCTION_DEPLOYMENT_ID`; it does not create a new deployment ID.
- Both workflows use the OAuth refresh token contained in `CLASPRC_JSON` directly in process memory. The secret must be the complete clasp credential JSON containing `oauth2ClientSettings.clientId`, `oauth2ClientSettings.clientSecret`, and `token.refresh_token`.
- No `clasp` CLI, `clasp pull`, `mktemp`, `.clasprc.json`, or generated `.clasp.json` is used by either workflow.
- GitHub Actions still checks out repository source into its hosted runner workspace; this is how the runner reads version-controlled source and is not access to files on the user's PC or phone.
- No PUSH or DEPLOY was executed as part of this code change. Run PUSH first; confirm its Apps Script API response before running DEPLOY.


## Repair batch 08 — remove JSON credential parsing and update Actions runtime

| ID | Finding | Change | Status |
|---|---|---|---|
| CI-007 | `CLASPRC_JSON` was supplied in a non-JSON format, causing the direct API helper to stop before OAuth. | Replaced the single JSON credential secret with three independent secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REFRESH_TOKEN`. The helper reads them directly from environment variables and exchanges the refresh token in memory. | Updated; user must configure new secrets and rerun PUSH |
| CI-008 | Workflow action versions/runtime generated Node 20 deprecation warnings. | Updated checkout/setup-node to v5, selected Node.js 24, and pinned runner to `ubuntu-24.04` in both Apps Script workflows. | Updated; Actions run pending |

### Credential migration
- Add the three secrets above in repository Settings → Secrets and variables → Actions.
- Keep existing `APPS_SCRIPT_ID` and `PRODUCTION_DEPLOYMENT_ID` secrets.
- The old `CLASPRC_JSON` secret is no longer read by either Apps Script workflow; it can be deleted after the new three secrets are saved.
- Never publish or send OAuth client secrets or refresh tokens in chat/issues/logs.
- No source PUSH or production DEPLOY was executed by this repair.


## Repair batch 09 — remove OAuth automation dependency

| ID | Finding | Change | Status |
|---|---|---|---|
| CI-009 | User chose to remove OAuth credentials from automated PUSH and DEPLOY workflows. | PUSH workflow is now source-validation-only and explicitly reports that it does not upload source to Apps Script. | Updated |
| CI-010 | DEPLOY workflow cannot update a Google Apps Script deployment without authenticated access. | DEPLOY workflow now displays a manual deployment checklist and explicitly reports that it does not deploy. | Updated |
| CI-011 | Direct Apps Script API helper required OAuth secrets. | Removed `.github/scripts/apps-script-api.mjs` because the workflows no longer invoke it. | Removed |

**Important operational limitation:** GitHub Actions cannot upload source to, or update a deployment in, a Google Apps Script project without an authenticated Google identity. These workflows no longer request OAuth secrets and do not perform remote PUSH/DEPLOY. Source files under `apps-script/` and the PWA application source were not modified by this batch. The manual path is to synchronize source through the Apps Script editor and update the existing deployment there, preserving its deployment ID and URL.


### Follow-up cleanup after repository verification
A full workflow-directory review found two legacy workflows that still referenced `CLASPRC_JSON`, installed clasp, and used `clasp pull` with a temporary directory:
- `.github/workflows/preflight-apps-script.yml`
- `.github/workflows/reconcile-apps-script.yml`

Both obsolete workflows have now been removed. This also removes their stale reference to the previously deleted `.github/scripts/check-apps-script-remote.sh`. No application runtime source was changed.
