-- Read-only inventory. Does not delete data, reset the database, or run VACUUM.
-- Run after database connectivity is restored; estimates avoid counting every row.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

SELECT schemaname, relname AS table_name,
       n_live_tup AS estimated_rows, n_dead_tup AS estimated_dead_rows,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY n_live_tup DESC;

-- Review structure before selecting cleanup candidates. Never export secrets.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name ILIKE '%audit%' OR table_name ILIKE '%notification%'
       OR table_name ILIKE '%otp%' OR table_name ILIKE '%session%')
ORDER BY table_name, ordinal_position;

COMMIT;

-- Next steps require live evidence and explicit approval of a specific record list:
-- 1. Identify expired temporary records using their actual expiry fields.
-- 2. Review proven redundant audit entries against preserved original evidence.
-- 3. Do not classify accounts or clinical records as test data by name alone.
-- 4. Check references and take a backup before any approved deletion.
-- Estimated dead rows are PostgreSQL maintenance data, not disposable patient rows.
