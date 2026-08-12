// Single source of truth for ticket-aging thresholds. Mirrored on the frontend in
// frontend/src/utils/ticketAge.js — keep both in sync if these change.
// Values are hours-since-created (or since resolved/closed for finished tickets).

const AGE_THRESHOLDS_HOURS = {
    warning: 24,   // 1 day  — amber
    elevated: 72,  // 3 days — orange, counted in the "overdue" KPI bucket
    critical: 168, // 7 days — red, counted in the "critical" KPI bucket
};

module.exports = { AGE_THRESHOLDS_HOURS };
