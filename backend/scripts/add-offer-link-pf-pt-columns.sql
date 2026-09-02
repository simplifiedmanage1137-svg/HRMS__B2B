-- backend/scripts/add-offer-link-pf-pt-columns.sql
-- Run manually against Supabase (same convention as add-offer-link-email-columns.sql and
-- the other scripts in this folder — this app has no migration runner).
--
-- Lets HR/Admin set PF and Professional Tax when generating an offer link, alongside the
-- existing `salary` column, so the candidate's in-hand salary (salary - pf - professional
-- tax) can be shown up front instead of only being configured later via Payroll > PF/PT.
-- These values flow into the new employee's `pf_amount`/`professional_tax_amount` columns
-- (already used by real payroll calculations, see backend/controllers/salaryController.js)
-- when the offer is accepted and the employee account is created.

alter table employee_offer_links add column if not exists pf_amount numeric;
alter table employee_offer_links add column if not exists professional_tax_amount numeric;
