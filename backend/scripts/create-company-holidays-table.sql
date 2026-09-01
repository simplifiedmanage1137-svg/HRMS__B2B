-- backend/scripts/create-company-holidays-table.sql
-- Run manually against Supabase (same convention as the other scripts in this folder —
-- this app has no migration runner).
--
-- Lets HR/Admin mark an arbitrary date as a company-wide holiday (e.g. an unplanned
-- Friday off) without a code deploy, on top of the static calendar in backend/data/holidays.js.
-- One row per date — no per-employee attendance rows are created for it; the HOL status is
-- resolved at report-generation time by checking this table (see
-- backend/services/companyHolidayService.js), exactly like the static holiday list already is.
--
-- NOTE: on this project's database this table already existed before this feature was built
-- (two rows dated 2026-07-03 / 2026-07-29), with columns `holiday_name` (not `name`) and no
-- `created_by_name` column — companyHolidayService.js reads/writes exactly those real column
-- names. The CREATE TABLE below matches that real schema, so this script is safe to (re-)run
-- anywhere: `IF NOT EXISTS` is a no-op against the existing table, and creates the same shape
-- fresh on a database that doesn't have it yet.

create table if not exists company_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  holiday_name text not null default 'Company Holiday',
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_holidays_date on company_holidays(holiday_date);

-- Optional but recommended: enforce "one holiday per date" at the database level too, not
-- just in application code. Idempotent (safe to run this script more than once) and safe to
-- run against the existing table — as of this writing it has no duplicate holiday_date
-- values. If it ever does, this will fail with a clear "could not create unique index" error
-- naming the dupes to clean up first.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_holidays_holiday_date_key'
  ) then
    alter table company_holidays add constraint company_holidays_holiday_date_key unique (holiday_date);
  end if;
end $$;
