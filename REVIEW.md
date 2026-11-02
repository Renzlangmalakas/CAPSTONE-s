# Review and fixes — 2026-09-22

Implemented:

- Preserve deleted and renamed fee catalog entries; avoid writes on unchanged reads.
- Normalize invalid fee amounts and round totals to cents.
- Separate service prices from additional fees in legacy billing and preserve collected fee payments.
- Track browser storage writes correctly; protect newer local edits from delayed pull/push responses; avoid acknowledging unconfirmed unload writes.
- Remove duplicate client reminder requests (the write endpoint already processes reminders).
- Reject malformed clinic snapshots and avoid clearing omitted collections.
- Require signed, expiring API sessions and administrator roles for admin endpoints.
- Persist hashed password-reset codes in the existing Supabase users verification_token column, with expiry and attempt limits.
- Restore same-origin production admin account creation/listing.
- Validate registration credentials on the server and disable automatic production demo-user seeding.
- Exclude local debugging pages, tests and environment files from deployment.

Validation: nine Node regression tests, JavaScript syntax checks, and local HTML asset reference checks. API tests use isolated in-memory fixtures; they do not write production clinic records or send email.

Known remaining issues:

- Signed-in users still use a shared full-database sync API. Patient-level read/write authorization needs a change to both the API and client data model; authentication alone does not provide record isolation.
- Full-snapshot writes can still conflict between different browsers. Some table replacements delete before inserting and are not transactional. Server-side version checks and transactional database writes are needed to fully resolve this.
- Previously created demo accounts are not removed or have their passwords changed by this update. Existing credentials should be reviewed before storing real patient data.
- Password-reset and email delivery need a real-account end-to-end check. The reset-code attempt counter is persisted but updates are not atomic across simultaneous requests.
- No full interactive browser walkthrough was performed. Passing automated checks does not establish that every workflow is bug-free.

Users logged in before this deployment need to sign in again to obtain a signed API session.

## GCash receipt review — 2026-09-23

- Patient GCash submissions now upload a receipt, extract an amount/reference with OCR, allow corrections, and check the amount and duplicate references. Submission stores a pending receipt without reducing the balance.
- Staff and Admin Billing include a receipt review queue. Approval requires checking the clinic's actual GCash transaction history; rejection requires a reason. Approval allocates the payment to the selected services/additional fees or treatment plan. Changed balances require a new submission.
- OCR uses browser-side [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 via CDN. Network access is required to load its worker/language assets. Manual entry remains available if OCR fails. Receipt images are resized and stored with existing clinic records; browser storage capacity limits still apply.
- Removed the fake payment QR and fictional phone number. The patient page expects the user's exact image at `HTML/Patient/gcash-qr.png`. The chat attachment was not available as a local file, so the QR replacement remains pending that file. Until then the page displays a payment-instructions fallback.
- Validation: 25 tests passed with `node --test --test-isolation=none HTML/tests/*.test.js`; normal test-worker spawning is blocked by this environment. JavaScript syntax checks passed. No interactive browser/OCR or real GCash transfer verification was performed.
- This is a staff-assisted receipt workflow, not payment-provider verification. Existing shared-snapshot API access and cross-browser conflict limitations above also apply to receipts and approvals; this does not establish server-enforced financial authorization.

## Admin content management — 2026-09-23

Implemented locally:

- Admin sidebar has Content Management for homepage heading/introduction, About text, public clinic name/contact numbers/hours, and GCash recipient/mobile/QR image.
- Save Draft, content Preview, Publish Changes, and reload controls. QR uploads preserve original bytes (PNG/JPG/WebP, maximum 2 MB); admins can scan the preview before publishing. No QR image is fabricated from a phone number.
- A dedicated public endpoint returns only published website content. Admin endpoints require the existing signed administrator session. A database revision check prevents stale CMS writes from overwriting newer edits.
- Landing and patient billing pages fetch published content on page load. Existing content remains available when CMS storage is unavailable. The CMS does not change service pricing or patient records. Existing Settings remains separate from public website content.

Required setup:

1. Run `HTML/Landing/supabase/migrations/20260923000000_create_site_content.sql` in the project's Supabase SQL Editor. This creates the separate CMS table, enables row-level security, and limits table access to the server service role.
2. Deploy these changes to Vercel, then open Admin > Content Management, upload the original GCash QR image, and publish.

The read-only setup check returned `PGRST205`: `clinic_site_content` is missing in the connected database. The configured service-role REST connection cannot apply schema migrations, and no SQL-management connection is available. This CMS update has not been deployed yet.

Validation: 29 tests passed, including unpublished draft isolation, admin-only writes, stale revision rejection, malformed content/image rejection, public-route access, and unavailable-storage handling. JavaScript syntax checks passed. Interactive browser testing and live CMS publishing remain pending database setup.

## Email retry fix deployed — 2026-09-23

- Production signup logs confirmed Gmail SMTP `454 4.7.0 Too many login attempts` (`EAUTH`). Clinic snapshot writes were also repeatedly attempting reminder emails and failing on the same error.
- Removed email sending from clinic snapshot writes. Disabled the legacy browser-triggered reminder endpoint; scheduled reminders remain. Cron requests now require the configured secret, including when that secret is missing.
- Added serialized sends, SMTP connection timeouts and a 15-minute per-instance cooldown after authentication/temporary transport failures. This is not a distributed limiter and does not clear Google's sender restriction. Signup now reports temporary mail unavailability rather than a generic registration failure.
- Successfully sent reminder markers are persisted if a later send in the batch fails.
- 31 tests passed. Production deployment `dpl_HzxnoNvKGJwBabieVN1JQZ6YwBsM` is ready at https://gm-dental-smoky.vercel.app. Public cron access returns 401.
- This deployment also includes the CMS code described above, superseding the earlier undeployed status. CMS storage still needs its migration; the public content endpoint returns 503 and pages retain their existing content.
- No verification emails were sent by these checks. Automatic approval review blocked exporting production credentials to a temporary local file for an SMTP check; that check was not performed. End-to-end signup delivery remains unverified until the sender recovers and signup is retried.

## Dentist sync correction — 2026-09-24

- Production logs showed duplicate conflict keys (`21000`) and appointment compare-and-set failures during snapshot saves.
- Sync now deduplicates record IDs, preferring the newest timestamp (last occurrence for ties), and deduplicates raw rows again after service-name-to-ID mapping. Appointment snapshots write each ID once and skip unchanged records, preventing a duplicate from conflicting with the same batch's earlier update.
- 33 tests passed, including duplicate appointment writes and unchanged-record handling. Real concurrent edits may still produce a conflict; this does not provide transactional or fully isolated snapshot synchronization.
- Dentist JavaScript syntax passes. The logged backend failure is addressed; an authenticated browser walkthrough of the user's specific failing buttons remains unverified.

## Dentist startup crash identified — 2026-09-24

- The user's console revealed `ReferenceError: apt is not defined` inside `normalizeBillingServiceRecord`. Payment allocation re-normalizes a service without appointment options, exposing an invalid reference to an outer appointment variable. The fallback now uses the service record's own status.
- Added a paid legacy appointment regression that exercises normalization, allocation, dentist filtering and dashboard summary. A local DOM test using synthetic data confirmed startup, personalized greeting and Schedule navigation without errors. No production patient records were used.
- Notification upserts now deduplicate conflict keys as appointment/service batches already do; a regression covers a repeated notification ID across target lists.
- Validation: the existing 34-test suite passed after the startup fix, and all three sync-record tests passed after adding the notification regression (35 tests total). This corrects a startup path that earlier empty and unpaid fixtures did not exercise.

## Additional Fees dialog and sync feedback — 2026-09-24

- Remove/dispose the fee dialog when closed and scope its controls to its own element. Reopening no longer updates a hidden old dialog with duplicate IDs.
- Fee saves read the latest local appointment, reject fees changed since opening, and preserve unrelated newer fields. The dialog waits for server acknowledgement; failed sync retains a Retry Sync action and explicitly reports local-only storage.
- Appointment equality ignores object-key ordering. A failed compare-and-set is accepted only if a re-read shows the identical intended record already saved; different concurrent edits return 409 and remain protected. Failed background sync retries back off up to 60 seconds instead of repeatedly retrying every second.
- Local synthetic DOM checks passed for repeated dialog opening, totals, cleanup, failed-sync feedback and preservation of newer appointment fields. Real cross-browser edit conflicts can still occur with the shared full-snapshot architecture.

## Requested fee catalog — 2026-09-25

- Replaced the default catalog with the user's 11 fee names, descriptions and sample prices. Existing invoice fee snapshots remain unchanged.
- Added fixed/range/starting-price/variable pricing metadata. Dentist and Staff fee dialogs show descriptions and accept a validated unit price; "Varies" requires an explicit positive quote and Laboratory Fee allows PHP 500 or more. Admin can edit pricing type.
- 39 tests passed, including price-range validation, variable-price requirements and catalog import ID reuse.
- A read-only fee-catalog check returned PGRST205: `clinic_additional_fees` is missing in the configured Supabase database. No live catalog rows were inserted.
- Run `HTML/Landing/supabase/migrations/20260925000000_requested_fee_catalog.sql` in the Supabase SQL Editor to create and populate the catalog. This migration does not modify patient bills. For an already populated catalog, `node HTML/tests/import-fee-catalog.cjs --apply` reuses IDs for matching names/legacy aliases and does not delete unrelated fees.


### Existing Additional Fees update (2026-09-25)
- Retained the existing catalog and screens; no new table or module. Requested 11 definitions and numeric pricing types are in additional-fees.js.
- Staff conversion now retains fee snapshots. Staff/Dentist bill lines and patient invoices display saved descriptions; authorized selection validates fixed/range/custom numeric prices.
- Admin edits reset numeric minimum/maximum consistently. Import matching ignores case/extra spaces and retains existing IDs.
- Withdrew catalog table creation from the latest proposed data migration, per the request to use existing storage.
- Configured Supabase REST schema exposes no Additional Fees table; catalog population is pending identification of existing storage. No patient records or historical invoices were migrated. Earlier instructions to create a catalog table are superseded.
- Validation: 42 tests passed, including the 1550 example, Staff roundtrip and immutable fee snapshot values.

2026-09-29: Fixed fee catalog sync deleting all rows when a browser sent an empty snapshot. Catalog sync now merges newer records by ID; only admins can write catalog data. Admin deletion archives the catalog record, preserving historical bill references. All 43 tests pass. Deployed dpl_J9sKRFaNbZBn423FvpqaQ6VieSLf; restored 11 requested fees (3 inserted, 8 updated).
