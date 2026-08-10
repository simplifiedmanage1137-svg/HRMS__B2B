-- Supports auto-approval-on-submit for the "Generate Employee Offer Link" flow:
-- submission now creates the employee account immediately (see POST
-- /api/onboarding/:token/submit in backend/routes/onboardingRoutes.js), so these
-- columns give HR/Admin a place to view the generated credentials afterward —
-- there is no longer a manual "Approve" click whose one-time API response would
-- otherwise be the only place temp_password ever appeared.
--
-- temp_password is intentionally plaintext (not just the bcrypt hash already
-- stored on employees.password) so HR/Admin can relay it to the new hire. It
-- should be cleared once the employee changes their password (see the clearing
-- logic added to POST /api/auth/change-password in backend/routes/authRoutes.js)
-- or manually via the "Clear" action in OfferLinksManager.jsx.
ALTER TABLE employee_offer_links
ADD COLUMN IF NOT EXISTS temp_password TEXT,
ADD COLUMN IF NOT EXISTS created_employee_id TEXT,
ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN employee_offer_links.temp_password IS 'Plaintext temp password for the auto-created employee account. Cleared once the employee changes their password, or manually by an admin. NULL = never set or already cleared.';
COMMENT ON COLUMN employee_offer_links.created_employee_id IS 'employee_id of the employees row auto-created from this offer link (set on auto-approval or legacy manual approval).';
COMMENT ON COLUMN employee_offer_links.auto_approved IS 'TRUE if the employee account was created automatically on form submission (no manual admin Approve click).';
