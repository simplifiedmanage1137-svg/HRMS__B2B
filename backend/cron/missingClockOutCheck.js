const cron = require('node-cron');
const attendanceController = require('../controllers/attendanceController');

/**
 * Scans all open attendance records (clock_in set, clock_out NULL) across every employee
 * and force-closes any that have been open for 15+ hours (status → 'missing', clock_out set
 * to exactly clock_in + 15h, session deactivated).
 *
 * Delegates to attendanceController.closeStaleOpenAttendance — the single source of truth
 * for the 15-hour rule, also invoked inline by getTodayAttendance on every dashboard/login
 * check so the rule holds even when this scheduled job doesn't run (e.g. on a serverless
 * deployment where node-cron can't stay resident — see server.js's `!process.env.VERCEL`
 * guard, and use the `/api/cron/missing-clockout` HTTP route + Vercel Cron there instead).
 */
const markMissingClockOuts = async () => {
    console.log('🔍 [MissingClockOut] Starting check...');
    const { closedCount } = await attendanceController.closeStaleOpenAttendance();
    console.log(`✅ [MissingClockOut] Done. Marked ${closedCount} record(s) as missing.`);
    return { success: true, markedCount: closedCount };
};

// Run every 15 minutes
const scheduleMissingClockOutCheck = () => {
    cron.schedule('*/15 * * * *', async () => {
        await markMissingClockOuts();
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    console.log('📅 [MissingClockOut] Cron scheduled — runs every 15 minutes');
};

module.exports = { scheduleMissingClockOutCheck, markMissingClockOuts };
