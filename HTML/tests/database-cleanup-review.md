# Database cleanup review

The following tables appear in historical migrations but have no references in the current application source (excluding migrations and tests):

- `clinic_patients`
- `clinic_dentists`
- `clinic_staff`
- `clinic_notifications`
- `additional_fees`
- `invoice_additional_fees`

These are candidates for investigation, not approved DROP targets. Live schema inspection timed out twice. Their existence, row counts, foreign keys, views, triggers, functions, and use by external clients remain unverified. Preserve or migrate any unique records before removal. Do not use CASCADE to bypass dependencies.

Keep `appointments` and `clinic_history`: the API still uses them as fallback tables. Keep `clinic_additional_fees`: it is the active additional-fee catalog. Keep historical migrations so database setup remains reproducible.

Saved SQL Editor queries are separate from tables and application queries. No saved-query list was available or deleted.

No database tables, records, queries, or migration files were deleted during this review.
