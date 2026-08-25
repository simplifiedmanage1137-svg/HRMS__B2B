-- backend/scripts/create-employee-offer-letters-table.sql
-- Run manually against Supabase (same convention as the other scripts in this folder —
-- this app has no migration runner). Tracks every generated/sent offer letter for audit
-- and resend, independent of the existing `employees.offer_letter` column (which stores an
-- *uploaded* document URL, not a system-generated one).

create table if not exists employee_offer_letters (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references employees(employee_id),
  letter_data jsonb not null,
  pdf_path text,
  pdf_url text,
  status text not null default 'generated' check (status in ('generated', 'sent', 'failed')),
  primary_email text,
  additional_email text,
  sent_at timestamptz,
  failed_reason text,
  generated_by text,
  generated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_offer_letters_employee on employee_offer_letters(employee_id);
create index if not exists idx_offer_letters_created_at on employee_offer_letters(created_at desc);
