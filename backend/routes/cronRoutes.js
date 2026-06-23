/**
 * Cron routes — called by Vercel Cron scheduler via the normal Express
 * catch-all (api/index.js).  They are NOT protected by authenticateToken
 * because Vercel's scheduler has no user JWT; instead they require the
 * shared CRON_SECRET environment variable.
 *
 * Vercel Cron sends:  Authorization: Bearer {CRON_SECRET}
 * Set CRON_SECRET in Vercel → Settings → Environment Variables.
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const attendanceController = require('../controllers/attendanceController');
const { markAbsentEmployeesAsLeave } = require('../cron/absentEmployeeCheck');
const { runMonthlyAccrual } = require('../cron/leaveAccrualJob');

const cronAuth = (req, res, next) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// GET /api/cron/auto-close — every hour (Pro plan only)
router.get('/auto-close', cronAuth, async (req, res) => {
    const t = Date.now();
    try {
        const result = await attendanceController.autoCloseStaleSessions();
        res.json({ success: true, closedCount: result.closedCount ?? 0, ms: Date.now() - t });
    } catch (err) {
        console.error('❌ [CRON auto-close]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/cron/daily-absent — 23:59 IST (18:29 UTC)
router.get('/daily-absent', cronAuth, async (req, res) => {
    const t = Date.now();
    try {
        const result = await markAbsentEmployeesAsLeave();
        res.json({ success: true, result, ms: Date.now() - t });
    } catch (err) {
        console.error('❌ [CRON daily-absent]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/cron/weekly-cleanup — Sunday 02:00 IST (20:30 UTC Sat)
router.get('/weekly-cleanup', cronAuth, async (req, res) => {
    const t = Date.now();
    try {
        const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

        await Promise.all([
            supabase.from('attendance_sessions').delete().eq('is_active', false).lt('clock_out_time', thirtyAgo),
            supabase.from('regularization_requests').delete().in('status', ['approved', 'rejected']).lt('created_at', ninetyAgo),
        ]);

        res.json({ success: true, ms: Date.now() - t });
    } catch (err) {
        console.error('❌ [CRON weekly-cleanup]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/cron/monthly-accrual — 1st of month 01:00 IST (19:30 UTC)
router.get('/monthly-accrual', cronAuth, async (req, res) => {
    const t = Date.now();
    try {
        await runMonthlyAccrual();
        res.json({ success: true, ms: Date.now() - t });
    } catch (err) {
        console.error('❌ [CRON monthly-accrual]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
