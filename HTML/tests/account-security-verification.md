# Account security verification

Implemented for Admin, Staff, Dentist, and Patient account settings.

- Name and phone changes require the current password, checked by the server.
- Admin and Staff profile job titles require the same verification. These titles do not change access roles.
- Password changes require the current password and a one-use code delivered to the registered email. Codes expire after ten minutes, allow five verification attempts, and have a one-minute resend cooldown.
- Account identity comes from the signed session. Submitted email and access-role changes are rejected.
- Password and code checks are repeated in the conditional database update to prevent concurrent reuse.
- Registered email fields are read-only. Email address changes require a separate verification flow and are outside this change.
- Forgot-password recovery remains separate; it rejects codes issued for signed-in account changes.

## Validation

`node --test --test-isolation=none tests/*.test.js`: 61 passed, one existing failure in `GCash submission queues a receipt without crediting the bill` (expected pending, received rejected).

Seven new security tests passed, covering all roles, incorrect passwords, privilege escalation, email/code requirements, expiry, attempt limits, resend cooldown, SMTP failure, simultaneous requests, and session identity.

Browser checks used an isolated in-memory Express instance with a local email stub. All four actual module forms completed the email-code flow and logged in with the new password; names and phone numbers persisted through login. Admin title persistence, cancellation, and Staff wrong-password rejection were verified. Test credentials and codes were not sent to real recipients. Screenshot: `account-verification.png`.

The `users.profile_title` schema addition was applied to the linked Supabase project and its column definition verified by query. Application code was subsequently deployed to production as `dpl_BVPkfVEx5j8Qv7SB7B1jkzuLoWXD` at https://gm-dental-smoky.vercel.app. All four module pages and the shared security script returned HTTP 200; an unauthenticated account update returned HTTP 401. Live SMTP delivery remains unverified.

## Existing database advisor findings

No users-table finding was reported. The database advisor also reported existing issues outside this field addition:

- [`user_effective_permissions` security-definer view](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).
- [`set_updated_at` mutable search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- [`rls_auto_enable` executable by anonymous clients](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [authenticated clients](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- [Supabase Auth leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); this application's login currently uses its own bcrypt-backed users table.
- [17 tables with RLS enabled and no client policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), informational for the existing server/service-role architecture.

These pre-existing settings were not changed by this task.
