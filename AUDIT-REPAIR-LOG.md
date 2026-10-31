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
