-- ============================================================================
-- Break note column — lets Sales employees (unlimited/typeless breaks, see
-- backend/routes/attendanceRoutes.js POST /break/start) attach a short note
-- explaining what a break is for, so managers/admins can trace every break
-- taken instead of just seeing an anonymous timestamp range.
--
-- Additive only — every other role's breaks simply have break_note = NULL.
-- Safe to run more than once. Run once in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE employee_breaks ADD COLUMN IF NOT EXISTS break_note TEXT;
