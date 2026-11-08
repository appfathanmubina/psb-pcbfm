# PSB Audit & Repair Log

Last updated: 2026-11-08
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


## Repair batch 10 — restore GitHub-hosted Apps Script PUSH and DEPLOY

| ID | Finding | Change | Status |
|---|---|---|---|
| CI-012 | Apps Script synchronization had been reduced to validation/manual checklist workflows, so GitHub could not publish repository source. | Added a repository-managed Apps Script project config and a direct Apps Script API helper. PUSH now uploads checked-in files from `apps-script/`; DEPLOY uploads the same source, creates a version, and updates only the configured existing deployment ID. | Implemented; requires OAuth and deployment secrets, then runtime verification |
| CI-013 | Apps Script API `updateContent` replaces the complete project and can silently remove files absent from the upload payload. | The helper reads the live file-name list first and blocks PUSH/DEPLOY if the live project contains additional files not represented in the repository. | Implemented; live test pending |
| CI-014 | Credential JSON previously caused `CLASPRC_JSON` parsing failures. | Uses three explicit GitHub Secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REFRESH_TOKEN`; deployment additionally requires `PRODUCTION_DEPLOYMENT_ID`. Credentials are exchanged in memory and never written to repository files. | Implemented; secrets must be configured by repository owner |

### Operational notes
- Project ID and source folder are versioned in `.github/apps-script-config.json`.
- Google OAuth credentials and the existing production deployment ID must be configured under repository Settings → Secrets and variables → Actions.
- The Google OAuth refresh token must have been granted Apps Script project and deployment scopes. Enable the Apps Script API for the associated Google Cloud project.
- PUSH updates Apps Script HEAD content but does not change the live Web App deployment.
- DEPLOY uploads the current checked-in source, creates a new immutable version, then updates the existing deployment ID. It does not create a new deployment.
- Before upload, the helper checks the remote project's file names and aborts if there are remote-only files, because the Apps Script updateContent API replaces the full project.
- No Apps Script PUSH or production DEPLOY was executed by this repository change. Configure secrets and run PUSH first; inspect the result and test the app before running DEPLOY.


## Repair batch 11 — Apps Script DEPLOY kembali manual

| ID | Temuan | Perubahan | Status |
|---|---|---|---|
| CI-015 | Workflow DEPLOY otomatis tidak lagi sesuai keputusan operasional: deployment Web App harus dilakukan langsung oleh pemilik project melalui editor Apps Script. | Menghapus `.github/workflows/deploy-apps-script.yml`. | Selesai |
| CI-016 | Helper API masih memuat fungsi untuk membuat versi dan mengubah deployment produksi. | Menghapus fungsi DEPLOY dari helper; helper kini hanya menerima perintah `push`. | Selesai |

### Alur kerja yang berlaku
- GitHub Pages tetap dibangun/deploy otomatis melalui workflow Pages yang sudah ada.
- PUSH Apps Script tetap tersedia sebagai workflow manual GitHub Actions dan hanya mengunggah source dari folder `apps-script/`; PUSH tidak mengubah deployment Web App yang sedang aktif.
- DEPLOY Apps Script dilakukan manual melalui editor Google Apps Script: periksa source yang sudah disinkronkan, buat versi baru, lalu kelola deployment Web App yang sudah ada. Pertahankan deployment ID dan URL produksi.
- `PRODUCTION_DEPLOYMENT_ID` tidak lagi diperlukan oleh workflow Apps Script karena workflow DEPLOY otomatis telah dihapus.
- PUSH otomatis melalui GitHub Actions masih membutuhkan autentikasi Google yang sah. Tidak ada token atau secret yang dibuat, dibaca, atau diubah dalam batch ini.
- Tidak ada file source aplikasi Apps Script, spreadsheet produksi, atau deployment Web App produksi yang diubah.


## Repair batch 12 — seluruh sinkronisasi Apps Script kembali manual

| ID | Temuan | Perubahan | Status |
|---|---|---|---|
| CI-017 | Workflow PUSH Apps Script masih meminta tiga OAuth GitHub Secrets, bertentangan dengan keputusan untuk memakai alur manual seperti aplikasi lain. | Menghapus `.github/workflows/push-apps-script.yml`. | Selesai |
| CI-018 | Helper API dan konfigurasi project hanya digunakan oleh workflow PUSH yang sudah dihapus. | Menghapus `.github/scripts/apps-script-api.mjs` dan `.github/apps-script-config.json`. | Selesai |
| CI-019 | Workflow validasi masih mewajibkan helper dan konfigurasi otomatisasi Apps Script. | Menghapus pemeriksaan yang sudah tidak relevan; validasi tetap memeriksa file source Apps Script dan manifest. | Selesai |

### Alur operasional final
- GitHub Pages: otomatis melalui workflow `.github/workflows/pages.yml` tanpa GitHub Secrets tambahan.
- Sinkronisasi source Apps Script: manual melalui editor Google Apps Script.
- DEPLOY Web App Apps Script: manual melalui editor Google Apps Script. Pertahankan deployment produksi yang sudah ada dan URL `/exec`.
- Tidak ada workflow GitHub Actions yang melakukan PUSH atau DEPLOY ke Apps Script.
- Tidak ada kebutuhan GitHub Secrets OAuth khusus Apps Script untuk alur ini. Secret lama, jika pernah dibuat, tidak disentuh atau dihapus.
- File source aplikasi Apps Script, spreadsheet produksi, project Apps Script, dan deployment produksi tidak diubah dalam batch ini.

**Catatan koreksi:** Batch 11 sebelumnya menyatakan PUSH Apps Script tetap tersedia; keputusan batch 12 menggantikannya. Mulai batch ini, baik PUSH maupun DEPLOY Apps Script dilakukan manual.


## Repair batch 13 — audit statis integrasi PWA API Bridge

| ID | Pemeriksaan | Hasil | Status |
|---|---|---|---|
| BRIDGE-004 | Kesesuaian fungsi yang dipanggil frontend dengan allowlist API Bridge. | Ditemukan 76 nama fungsi server yang dipanggil secara literal dari `frontend/app.js`; seluruhnya tercakup dalam allowlist `PSB_PWA_BRIDGE_ALLOWED_FUNCTIONS`. | Lulus statis |
| BRIDGE-005 | Kesesuaian allowlist dengan fungsi backend. | Seluruh 79 entri allowlist memiliki deklarasi fungsi backend; tidak ditemukan nama ganda. | Lulus statis |
| BRIDGE-006 | Versi Bridge antara HTML transport dan backend. | `Bridge.html` dan `Code.gs` sama-sama menggunakan versi `32.3.8`. | Lulus statis |
| BRIDGE-007 | Validasi akses fungsi backend. | Fungsi sensitif yang diperiksa menggunakan pemeriksaan sesi/role; endpoint publik dibatasi pada informasi publik, login, dan pendaftaran Wali. `getRegistrationDocuments` mendelegasikan pemeriksaan akses ke `getDocumentOptions`. | Lulus pemeriksaan statis; uji negatif runtime pending |
| BRIDGE-008 | Izin iframe Apps Script. | Jalur `doGet(e)` untuk `?bridge=1` mengembalikan template `Bridge` dengan `XFrameOptionsMode.ALLOWALL`; jalur aplikasi utama juga menggunakan mode tersebut. | Lulus statis |
| BRIDGE-009 | Handshake lintas origin. | Kode frontend memverifikasi origin Apps Script tepercaya dan sumber iframe; Bridge memeriksa origin PWA terhadap allowlist dan mendukung ping berulang. | Lulus review kode; browser runtime pending |

### Hasil validasi GitHub setelah Repair Batch 12
- Validate PSB PWA: berhasil pada commit `38b66a75f70ded6034eb083f9d498044878bae40`.
- Deploy PWA to GitHub Pages: berhasil pada commit yang sama.
- GitHub Pages build/deployment: berhasil pada commit yang sama.
- Tidak ada perubahan source aplikasi dalam batch 13; hanya hasil audit yang dicatat.

### Batas verifikasi dan langkah manual yang masih wajib
- Pemeriksaan di atas adalah audit statis repository, bukan bukti bahwa deployment Apps Script yang sedang aktif sudah menggunakan source `Bridge.html`/`Code.gs` versi `32.3.8`.
- URL Apps Script produksi tidak dapat diverifikasi melalui pemeriksaan repository. Tidak dilakukan PUSH, sinkronisasi source, atau DEPLOY ke Apps Script.
- Sebelum menyatakan integrasi PWA–Apps Script lulus runtime, pemilik project perlu memastikan source `Code.gs` dan `Bridge.html` versi repository sudah disalin ke editor Apps Script, lalu memperbarui deployment Web App yang sama secara manual. Pertahankan deployment ID dan URL produksi.
- Setelah deployment manual, uji URL PWA pada browser: sinyal bridge siap, `getPublicConfig`, login, `validateSession`, navigasi dashboard, logout, serta akses role yang tidak berwenang. Uji juga bahwa sesi Wali hanya dapat membaca/mengubah pendaftaran miliknya sendiri.
- Sampai uji tersebut selesai, status integrasi end-to-end tetap **menunggu uji runtime manual**; jangan menandai BRIDGE-004 s.d. BRIDGE-009 sebagai runtime verified.


## Repair batch 04 — announcement page batch reads

Branch: `perf/backend-batch-read-optimization`

| ID | Finding | Change | Status |
|---|---|---|---|
| PERF-ANN-001 | `getAnnouncementPageData()` called `findRegistration_()` inside both filtering and mapping loops. Each call reread registrations, candidates, guardians, addresses, and schools. | Batch-read registrations and candidates once, build ID maps, and reuse them for filtering and display. First matching IDs are retained to preserve the existing `findRowById_()` behavior if duplicate IDs exist. | Patch prepared; CI and staging behavior test pending |

### Scope and safety

- No spreadsheet schema, stored data, role rules, publication rules, or response fields were changed.
- Wali still sees only their own published announcements; active academic-year filtering and item sorting are preserved.
- No Apps Script deployment or production data mutation was performed.
- This optimization is limited to the announcement page. Other repeated-read paths remain for separate audited batches.


## Repair batch 05 — document page and verification queue read optimization

Branch: `perf/document-verification-batch-reads`

| ID | Finding | Change | Status |
|---|---|---|---|
| PERF-DOC-001 | `getDocumentPageData()` built the registration list, then called `findRegistration_()` for the selected item, rereading REGISTRATIONS, CANDIDATES, GUARDIANS, ADDRESSES, and SCHOOLS. | Reuse request-local registration and candidate indexes; load related guardian/address/school rows once and preserve first-row / first-primary selection behavior. Registration enrichment accepts optional preloaded maps; existing callers retain their original behavior. | Regression checks passed; runtime/staging test pending |
| PERF-VER-001 | `getVerificationQueue()` converted every registration row into an object before applying status and search filters. | Apply the same status and search conditions to raw row arrays first; create row objects only for matching queue entries. Keep enrichment, sorting, and the 200-row cap unchanged. | Patch prepared; CI pending |

### Scope and safety
- Wali registration ownership filtering and selected-registration authorization remain enforced before document details are returned.
- Document checklist still uses active document types; current documents remain scoped to the selected registration.
- Queue status matching, search fields, ordering, and response cap are unchanged.
- No spreadsheet schema, stored data, authentication, role definitions, or business status transitions changed.
- No Apps Script deployment or production data mutation was performed.


## Repair batch 06 — payment page registration and master batch reads

Branch: `perf/payment-page-batch-reads`

| ID | Finding | Change | Status |
|---|---|---|---|
| PERF-PAY-001 | `getPaymentPageData()` loaded and enriched the registration list, then called `findRegistration()` for the selected registration, rereading REGISTRATIONS, CANDIDATES, GUARDIANS, ADDRESSES, and SCHOOLS. | Reuse the registration row already read for the page and preload candidate, academic-year, admission-wave, and education-level maps once for enrichment. Preserve the first raw registration row for duplicate-ID compatibility. | Regression test added; CI pending |
| PERF-PAY-002 | Payment types were read separately by the page response and `buildPaymentData()`. | Load active payment types once and pass them into `buildPaymentData()`; other callers retain the original default lookup. | Regression test added; CI pending |

### Scope and safety

- Wali ownership filtering remains unchanged, and the selected registration is still checked with `canAccessRegistration_()` before payment data is returned.
- Existing role checks, registration ordering, 200-item cap, payment/bill filtering, payment status handling, and response fields are unchanged.
- The first matching raw registration row is retained for compatibility with the previous `findRegistration_()` behavior if duplicate IDs exist.
- No spreadsheet schema, stored data, payment business rules, or role definitions were changed.
- No Apps Script deployment or production data mutation was performed.


## Repair batch 07 — current document and verification detail read optimization

Branch: `perf/document-history-verification-batch-reads`

| ID | Finding | Change | Status |
|---|---|---|---|
| PERF-DOC-002 | `getCurrentDocuments_()` converted every row in DOCUMENTS into an object before filtering by registration and replacement status. It also issued separate range reads for headers and data. | Read the table once, filter raw rows by registration and non-REPLACED status, then convert only matching rows. Preserve newest-first ordering and sheet row numbers. | Regression checks added; CI passed (34 checks), runtime/staging test pending |
| PERF-VER-002 | `getVerificationDetail()` used `findRegistration_()`, which separately reread the header and body for each of five related sheets. `getDocumentOptions()` used the same lookup pattern. | Add `findRegistrationBatch_()`: read each related table once and preserve first registration/candidate match plus first-primary guardian/address/school selection. Reuse it in verification detail and document options. | Regression checks added; CI passed (34 checks), runtime/staging test pending |

### Scope and safety

- Verification role checks remain before registration detail is loaded.
- Document options continue to enforce `canAccessRegistration_()` before returning document records.
- Current document filtering still excludes `REPLACED` and sorts by `uploadedAt` newest first.
- Active document master filtering, checklist construction, response fields, and upload eligibility logic are unchanged.
- No spreadsheet schema, stored data, role definitions, verification decisions, or payment/reregistration business rules were changed.
- No Apps Script deployment or production data mutation was performed.


## Repair batch 08 — reregistration page batch-read optimization

Branch: `perf/reregistration-page-batch-reads`

| ID | Finding | Change | Status |
|---|---|---|---|
| PERF-REREG-001 | `getReregistrationPageData()` reread selection results, five registration-related tables, current documents, required-document masters, bills, payments, and payment-type masters inside the registration loop. | Read each required table once per request, build first-match indexes by registration/candidate ID, group current documents and payment data by registration, and reuse active masters. Preserve newest-first document selection and last-payment-row lookup semantics. | Regression test added; CI passed on implementation commit `f7eb47d` (35 workflow steps); runtime/staging test pending |

### Scope and safety

- The role gate remains before Spreadsheet reads, and Wali results remain restricted to registrations owned by the signed-in user.
- Only registrations with a PASSED result and a published announcement are included. A missing reregistration remains a read-only `needsOpen` item; this endpoint does not open or mutate reregistration state.
- First matching registration, selection result, reregistration, and candidate rows are retained to match the previous lookup helpers.
- Current documents still exclude `REPLACED`, sort newest first, and use active required document types only.
- Bills retain sheet order, the first matching Daftar Ulang bill is selected, and the last payment row for a bill remains the payment attached to it.
- Response fields, summary counts, readiness rules, payment status rules, and management permission output are unchanged.
- No spreadsheet schema, stored data, role definitions, payment rules, or reregistration transitions were changed.
- No Apps Script deployment or production data mutation was performed.


## Repair batch 09 — monitoring page batch-read and index optimization

Branch: `perf/monitoring-page-batch-reads`

| ID | Finding | Change | Status |
|---|---|---|---|
| PERF-MON-001 | `getMonitoringPageData()` loaded DOCUMENTS, BILLS, PAYMENTS, SELECTION_PARTICIPANTS, SELECTION_RESULTS, and REREGISTRATIONS once for active-period processing and then reread all six tables for orphan reconciliation. | Read each child table once per request and reuse the same rows for active-period filtering and orphan reconciliation. | Implemented; CI pending |
| PERF-MON-002 | Payment queue and reconciliation repeatedly filtered/sorted PAYMENTS by bill and PAYMENT_VERIFICATIONS by payment. | Build request-local payment-by-bill, latest-payment-by-bill, and verification-by-payment indexes once; use schedule ID set for participant validation. | Implemented; CI pending |
| PERF-MON-003 | Participant schedule validation scanned the full schedule array for every participant. | Build a schedule ID membership map once and use constant-time lookups. | Implemented; CI pending |

### Scope and safety

- The monitoring role gate remains the first operation before database access.
- Active-year filtering for operational queues and reconciliation remains unchanged.
- Full child-table rows are still used for orphan checks, including records outside the active year.
- Payment queue selection preserves the previous newest-payment ordering; equal or invalid timestamps retain first-row behavior.
- Payment amount mismatch tolerance, duplicate-bill detection, exception types, severity, response fields, queue ordering, and result limits are unchanged.
- Verification rows without a corresponding payment retain the existing filtering behavior; no reconciliation semantics were broadened in this performance-only patch.
- No spreadsheet schema, stored data, role definitions, business transitions, or production deployment changed.


## Repair batch 10 — selection page batch-read and lookup-index optimization

Branch: `perf/selection-page-batch-indexes`

| ID | Finding | Change | Status |
|---|---|---|---|
| PERF-SEL-001 | `getSelectionPageData()` called `findRegistration_()` while enriching participants and again when opening detail, causing repeated reads of REGISTRATIONS, CANDIDATES, GUARDIANS, ADDRESSES, and SCHOOLS. | Read REGISTRATIONS once, build a first-match registration index, and reuse it for participant enrichment and detail lookup. Candidate names are resolved from the preloaded CANDIDATES map. | Implemented; CI pending |
| PERF-SEL-002 | Registration enrichment reread CANDIDATES and each master table even though candidate/master maps can be shared within the request. | Preload candidate, academic-year, wave, and level maps and pass them to `enrichRegistrationList_()` for both list and detail. | Implemented; CI pending |
| PERF-SEL-003 | Wali score filtering scanned all participants for each score; detail lookup filtered scores and searched participants/results repeatedly. | Build request-local participant-by-registration, score-by-participant, and first-result-by-registration indexes; use a participant-ID membership map for Wali score filtering. | Implemented; CI pending |

### Scope and safety

- The selection role gate remains the first operation before database access.
- Wali registration filtering remains restricted to the signed-in `userId`; Wali participants, scores, and results remain restricted to the visible registration list and its participants.
- The 300-registration response cap and registration ordering by `updatedAt` remain unchanged.
- Participant order and first participant per registration in detail remain unchanged; first matching registration and result rows are retained for detail lookup.
- Schedule active-year filtering and ordering by `selectionDate` remain unchanged.
- The detail ownership check through `canAccessRegistration_()` and the existing admin-role exception remain in place.
- Response fields and all selection business rules remain unchanged.
- No spreadsheet schema, stored data, role definitions, or production deployment changed.
- Apps Script runtime/staging data tests remain pending; CI regression guards validate static contracts only.


## Repair batch 11 — reporting page payment aggregation and index optimization

Branch: `perf/reporting-payment-aggregation`

| ID | Finding | Change | Status |
|---|---|---|---|
| PERF-REP-001 | `getReportingPageData()` grouped payments by registration and copied/sorted each group again while constructing every report row. | Build a request-local latest-payment index once. Equal valid timestamps retain the first sheet row; groups containing invalid timestamps use the original stable-sort comparator as a compatibility fallback. | Implemented; CI pending |
| PERF-REP-002 | Each report row filtered and reduced its bills to calculate paid amount, then scanned the same bills again to determine whether any bill was PAID. | Aggregate paid amount and the PAID indicator together in one pass per bill row, indexed by registration. | Implemented; CI pending |

### Scope and safety

- The reporting role gate remains the first operation before database access.
- Active academic-year selection and explicit year, wave, level, gender, and status filters remain unchanged.
- A PAID bill continues to take precedence over payment status from the latest payment; paid amount retains the existing numeric coercion and sum behavior.
- Latest-payment selection retains first-row behavior for equal timestamps. Groups containing invalid timestamps retain the previous sort comparator and selection behavior.
- Participant, selection-result, and reregistration maps retain their existing last-matching-row behavior.
- Summary counts, grouping, option lists, response fields, and generated timestamp remain unchanged.
- No spreadsheet schema, stored data, role definitions, business rules, or production deployment changed.
- Apps Script runtime/staging data tests remain pending; CI regression tests validate the endpoint behavior with controlled fixtures.


## Repair batch 12 — dashboard role-scoped operational queues

Branch: `perf/dashboard-role-scoped-queues`

| ID | Finding | Change | Status |
|---|---|---|---|
| PERF-DASH-001 | `getDashboardPageData()` returned every operational queue to all dashboard roles; the frontend hid some panels but the API response still exposed their records. | Apply the matching backend permission before building each queue and return empty arrays/counts for unauthorized queue categories. Selection schedules and active schedule count are limited to selection roles; active-user count is limited to monitoring roles. | Implemented; CI pending |
| PERF-DASH-002 | Dashboard cache key did not encode the new role-scoped response contract. | Bump cache namespace from `PSB_DASHBOARD_V4_` to `PSB_DASHBOARD_V5_` to prevent reuse of old unfiltered payloads. | Implemented; CI pending |
| PERF-DASH-003 | Active schedules were filtered separately for the active count and today/tomorrow schedule cards. | Count active schedules and collect today/tomorrow entries in one pass, retaining the existing date ordering. | Implemented; CI pending |
| PERF-DASH-004 | The dashboard renderer displayed the schedule panel for roles without selection access. | Render the schedule panel only when `permissions.canSelection` is true in both PWA and Apps Script bridge frontend sources. | Implemented; CI pending |

### Scope and safety

- Dashboard role gate remains the first operation before cache/database access.
- Queue access uses the existing role constants; role definitions are unchanged.
- Existing response keys, queue limits/order, task fields, summary metrics, and workflow status rules remain unchanged; unauthorized queue keys remain present with zero counts and empty item arrays for frontend compatibility.
- Dashboard summary and KPI fields are unchanged; this batch scopes operational task queues and selection schedule details only.
- No Spreadsheet schema, stored data, or production deployment changed.
- Apps Script staging-runtime validation remains pending; CI adds a role-by-role backend fixture regression test.

## Repair batch 13 — idempotent new-registration persistence

Branch: `fix/registration-idempotent-save`

| ID | Finding | Change | Status |
|---|---|---|---|
| REG-002 | A new form's client-generated registration ID was ignored by the backend. Related-sheet writes occurred before the registration row, so a partial failure followed by retry could create a second registration and duplicate related records. | Reuse the supplied registration ID; derive bounded deterministic candidate/guardian/address/school IDs from it; write the registration ownership/status row first as a durable retry anchor; then upsert related rows. A retry rechecks owner and editable status before completing missing related rows. | Implemented; regression test added; CI pending; Apps Script staging/runtime test pending |

### Scope and safety

- Existing registration IDs and related IDs are preserved when present; the change only supplies deterministic IDs when creating a new registration or recovering a missing related row.
- Registration number generation remains inside the existing ScriptLock.
- Existing role checks, ownership checks, editable-status checks, operational mutation guard, master-data validation, field validation, audit behavior, and response shape remain unchanged.
- No Spreadsheet schema, frontend form, payment rule, status transition, or production data was changed.
- The registration row is written before related rows so a partial failure is discoverable on retry; subsequent retries reuse the same registration and child keys.
- No Apps Script deployment or production data mutation was performed.


## Repair batch 14 — payment partial-commit recovery

Branch: `fix/payment-partial-commit-recovery`

| ID | Finding | Change | Status |
|---|---|---|---|
| PAY-001 | A payment proof row could be saved while the linked bill status update failed. The API returned success, but the Dashboard queue depended only on the bill status, leaving the submitted proof outside the verification queue and the Wali UI able to show another upload action. | On the committed-payment error path, reacquire/retain ScriptLock, reload the bill by ID, and repair its status to `PAYMENT_REVIEW` unless it is already `PAID`; verify the write. Dashboard queue and review counts also recognize the latest `SUBMITTED` payment as a recovery fallback. Wali UI derives the pending state from the saved payment and hides duplicate upload while a submission is pending. | Implemented; regression test added; CI pending; Apps Script staging/runtime test pending |

### Scope and safety

- The payment row remains the durable submission record; no duplicate payment is created by recovery.
- Recovery re-reads the bill under ScriptLock and never overwrites `PAID`.
- Existing upload validation, ownership/role checks, file-size/type limits, payment verification workflow, and sheet schema remain unchanged.
- Dashboard fallback uses the latest payment already loaded for each bill and preserves role-scoped queue authorization.
- No production Spreadsheet data was changed and no Apps Script deployment was performed.


## Repair batch 15 — payment verification / re-registration synchronization recovery

Branch: `fix/payment-reregistration-sync-recovery`

| ID | Finding | Change | Status |
|---|---|---|---|
| PAY-002 | Re-registration status could be written as `COMPLETED` before the linked registration status update was confirmed. A failed or partial registration write could leave `REREGISTRATIONS` and `REGISTRATIONS` inconsistent while payment verification continued. | Update and re-read the linked registration first; propagate missing-registration or failed-transition results; only then write and re-read the re-registration status. The operation remains retryable when an earlier write succeeded but a later step failed. | Implemented; regression test added; CI pending; Apps Script staging/runtime test pending |

### Scope and safety

- The existing payment verification decision, required-document rules, role checks, ScriptLock, payment/bill commit order, and notification flow remain unchanged.
- `REREGISTRATIONS` is marked `COMPLETED` only after `REGISTRATIONS` is confirmed as `COMPLETED`.
- If the registration write succeeds but a later step fails, a retry recognizes the already-completed registration and continues synchronization without repeating the status transition.
- If required documents are incomplete, the re-registration status remains `PAYMENT_VERIFIED`; the registration is not prematurely marked `COMPLETED`.
- No Spreadsheet schema, frontend behavior, production data, or Apps Script deployment was changed.

## Repair batch 16 — payment verification and rejection recovery

Branch: `fix/payment-verification-rejection-recovery`

| ID | Finding | Change | Status |
|---|---|---|---|
| PAY-003 | Payment decisions could proceed without a usable `PAYMENT_VERIFICATIONS` sheet; bill status writes were not confirmed before the payment status commit; and a failed re-registration synchronization result could be ignored by the verification caller. | Require and validate the verification-history schema before writes; reuse an existing same-decision history row on retry and reject conflicting decisions; re-read and confirm the linked bill status before committing `PAYMENTS.status`; propagate failed re-registration synchronization results. | Implemented; regression test added; CI pending; Apps Script staging/runtime test pending |

### Scope and safety

- The payment row remains the final decision marker: history, linked bill status, and required registration synchronization are confirmed first.
- A retry reuses the existing history row for the same payment and decision; it does not append a duplicate history row or overwrite a conflicting decision.
- Rejected payments continue to set the linked bill to `UNPAID`, allowing the existing Wali upload-again flow to submit a new payment record.
- Existing role checks, ownership checks, ScriptLock, required rejection reason, 500-character note limit, upload validation, and notification behavior remain unchanged.
- No Spreadsheet schema, frontend behavior, production data, or Apps Script deployment was changed.


## Repair batch 17 — payment, bill, and re-registration state guards

Branch: `fix/payment-bill-reregistration-state-guards`

| ID | Finding | Change | Status |
|---|---|---|---|
| PAY-004 | Retrying rejection of an older payment could set its bill to `UNPAID` while a newer proof for the same bill remained `SUBMITTED`. | Under ScriptLock, re-read all payments for the bill. Preserve/repair `PAID` when another payment is `VERIFIED`, preserve/repair `PAYMENT_REVIEW` when another payment is `SUBMITTED`, and only use `UNPAID` when no newer active payment supports another state. | Regression assertions added; CI pending |
| PAY-005 | `ensureFormBillForRegistration_()` validated the active master amount before looking for an existing bill, so later master deactivation or amount misconfiguration could block access to an already-created bill. | Resolve the Formulir payment type from the complete master list, return an existing non-cancelled bill first, and validate active status/amount only before creating a new bill. | Regression assertions added; CI pending |
| PAY-006 | A submitted proof could still be verified after its linked bill had been cancelled. | Reject verification of a cancelled bill before writing verification history or changing payment/bill state. | Regression assertions added; CI pending |
| PAY-007 | Finalization and payment synchronization could select an older cancelled Daftar Ulang bill instead of a paid replacement bill. | Add a shared selector that resolves Daftar Ulang payment type IDs from the full master list, excludes cancelled bills, and prefers a paid non-cancelled bill. Use it in both finalization and payment synchronization. | Regression assertions added; CI pending |

### Scope and safety

- Existing ScriptLock, role/ownership gates, verification-history requirements, payment decision commit order, and read-back checks remain in place.
- The changes do not alter Spreadsheet schemas, create or delete production records, or deploy Apps Script.
- Regression tests are static source-contract checks; Apps Script runtime and staging transaction tests remain required before a production release.
- The broader state-machine review `TXN-001` remains open until remaining payment, selection, and re-registration transitions are audited.


## Repair batch 18 — selection and re-registration recovery guards

Branch: `fix/selection-reregistration-recovery-guards`

| ID | Finding | Change | Status |
|---|---|---|---|
| VER-002 | A notification write failure after `finalizeVerification()` had committed the registration status could make the API appear to fail, encouraging an unsafe retry. | Isolate the post-commit notification in `try/catch`; log notification failure while returning the already-committed verification result. | Regression assertions added; CI pending |
| RRG-008 | `getReregistrationPageData()` could select the first historical Daftar Ulang bill even when cancelled, masking a paid replacement bill. | Resolve bill type names from the full master list, exclude `CANCELLED` bills, and prefer a `PAID` non-cancelled bill. | Regression assertions added; CI pending |
| RRG-009 | Opening/repairing Daftar Ulang required an active payment type before checking whether a valid existing bill already existed. | Resolve the type from the full master list; reuse an existing non-cancelled bill regardless of later master deactivation; require active status and a valid amount only for a newly created bill. | Regression assertions added; CI pending |
| SEL-004 | `updateSelectionParticipantStatus()` could return success without writing when the status column was missing and did not confirm the persisted value. | Require the status column, write the status, re-read the participant, and compare the stored value before success. Audit logging failure after the confirmed write is isolated from the committed update. | Regression assertions added; CI pending |

### Scope and safety

- Existing role checks, ScriptLock boundaries, ownership checks, status transition rules, bill identifiers, payment history, and response shapes remain unchanged.
- Existing non-cancelled Daftar Ulang bills are preserved; no duplicate bill is created by this repair.
- No Spreadsheet schema, production records, or Apps Script deployment changed.
- Regression tests are static source-contract checks. Apps Script runtime and staging tests remain required before production rollout.
- The broader state-machine review `TXN-001` remains open for the remaining payment, selection, and re-registration transitions.
