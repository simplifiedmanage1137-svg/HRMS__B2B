const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { isAdminOrDesktopSupport, isAdminOrFinance } = require('../middleware/auth');

// Note: This module exports a function that takes supabase, authenticateToken, and requireAdmin
module.exports = (supabase, authenticateToken, requireAdmin) => {
    
    // Clock in/out endpoints
    router.post('/clock-in', attendanceController.clockIn);
    router.post('/clock-out', attendanceController.clockOut);
    router.post('/heartbeat', attendanceController.heartbeat);

    router.post('/clock-out-missed', authenticateToken, attendanceController.clockOutMissed);

    // Get today's attendance for an employee
    router.get('/today/:employee_id', attendanceController.getTodayAttendance);

    // Employee self-service attendance report
    router.get('/employee-report/:employee_id', authenticateToken, attendanceController.getEmployeeAttendanceReport);

    // Regularization endpoints (Employee)
    router.get('/missed-clockouts/:employee_id', attendanceController.getMissedClockOuts);
    router.post('/regularization/:employee_id/request', attendanceController.requestRegularization);

    // Admin-only attendance report (also allowed for desktop_support and finance)
    router.get('/report', authenticateToken, isAdminOrFinance, attendanceController.getAttendanceReport);

    // ✅ NEW: Team attendance report for managers
    router.get('/team-report', authenticateToken, attendanceController.getTeamAttendanceReport);

    // Regularization endpoints
    // Managers and admins can view and act on regularization requests according to team-level approval rules.
    router.get('/regularization/pending', authenticateToken, attendanceController.getPendingRegularizations);
    router.put('/regularization/:request_id/approve', authenticateToken, attendanceController.approveRegularization);
    router.put('/regularization/:request_id/reject', authenticateToken, attendanceController.rejectRegularization);

    // Overtime endpoints (Admin or own data)
    router.get('/overtime/:employee_id/:month/:year', authenticateToken, attendanceController.getOvertimeSummary);

    // Comp-off endpoints - employee can view own, admin can view all
    router.get('/comp-off/:employee_id', authenticateToken, attendanceController.getCompOffBalance);
    router.get('/comp-off/:employee_id/history', authenticateToken, attendanceController.getCompOffHistory);

    // ── Attendance Import / Export (Admin only) ──────────────────────────────
    router.post('/import/validate', authenticateToken, requireAdmin, attendanceController.validateAttendanceImport);
    router.post('/import',          authenticateToken, requireAdmin, attendanceController.importAttendance);
    router.get('/export',           authenticateToken, requireAdmin, attendanceController.exportAttendanceData);
    router.get('/import-history',   authenticateToken, requireAdmin, attendanceController.getImportHistory);

    // Auto-close stale sessions (Admin only)
    router.post('/auto-close-stale', authenticateToken, requireAdmin, async (req, res) => {
        const result = await attendanceController.autoCloseStaleSessions();
        res.json(result);
    });

    // Fix orphaned attendance records (clock_out NULL but session closed) - All employees
    router.post('/fix-orphaned', authenticateToken, requireAdmin, attendanceController.fixOrphanedAttendance);

    // Trigger missing clock-out check immediately (Admin only)
    // Also used to force-clock-out employees stuck with open clock-in (e.g., forgot to clock out)
    router.post('/admin/trigger-missing-check', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { markMissingClockOuts } = require('../cron/missingClockOutCheck');
            const result = await markMissingClockOuts();
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // Admin mark attendance (with Paid Leave / Comp Off balance management)
    router.post('/admin/mark', authenticateToken, requireAdmin, attendanceController.adminMarkAttendance);

    // Update historical late marks (Admin only)
    router.post('/update-historical-late-marks', authenticateToken, requireAdmin, attendanceController.updateHistoricalLateMarks);

    // Mark absent employees as leave (Admin only)
    router.post('/mark-absent-as-leave', authenticateToken, requireAdmin, attendanceController.markAbsentEmployeesAsLeave);

    // Dashboard stats (Admin only)
    router.get('/dashboard-stats', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Get total employees count
            const { count: totalEmployees, error: totalError } = await supabase
                .from('employees')
                .select('*', { count: 'exact', head: true });

            if (totalError) throw totalError;

            // Get today's attendance stats
            const { data: todayAttendance, error: attendanceError } = await supabase
                .from('attendance')
                .select('status, employee_id, late_minutes')
                .eq('attendance_date', today);

            if (attendanceError) throw attendanceError;

            const presentToday = todayAttendance?.filter(a => a.status === 'present').length || 0;
            const halfDayToday = todayAttendance?.filter(a => a.status === 'half_day').length || 0;
            const absentToday = todayAttendance?.filter(a => a.status === 'absent').length || 0;
            const lateToday = todayAttendance?.filter(a => a.late_minutes > 0).length || 0;

            // Get pending update requests
            const { count: pendingRequests, error: updateError } = await supabase
                .from('update_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (updateError) throw updateError;

            // Get pending regularization requests
            const { count: pendingRegularizations, error: regError } = await supabase
                .from('regularization_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (regError) throw regError;

            // Get pending leave requests
            const { count: pendingLeaveRequests, error: leaveError } = await supabase
                .from('leave_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (leaveError) throw leaveError;

            // Get employees on leave today
            const { count: onLeave, error: onLeaveError } = await supabase
                .from('leave_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .lte('start_date', today)
                .gte('end_date', today);

            if (onLeaveError) throw onLeaveError;

            res.json({
                success: true,
                stats: {
                    totalEmployees: totalEmployees || 0,
                    presentToday: presentToday + halfDayToday,
                    absentToday: absentToday,
                    onLeave: onLeave || 0,
                    pendingRequests: pendingRequests || 0,
                    pendingRegularizations: pendingRegularizations || 0,
                    pendingLeaveRequests: pendingLeaveRequests || 0,
                    lateToday: lateToday
                }
            });

        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard stats',
                error: error.message
            });
        }
    });

    // ── Break management ─────────────────────────────────────────────────────────
    // All break routes require auth. The employee must be clocked-in to start a break.

    const BREAK_TYPES = {
        tea_break_1: { label: 'Tea Break 1', minutes: 15 },
        tea_break_2: { label: 'Tea Break 2', minutes: 15 },
        lunch_break:  { label: 'Lunch Break',  minutes: 30 },
    };

    // POST /api/attendance/break/start
    router.post('/break/start', authenticateToken, async (req, res) => {
        const employeeId = req.user.employeeId;
        const { break_type = 'tea_break_1' } = req.body;

        if (!BREAK_TYPES[break_type]) {
            return res.status(400).json({ success: false, message: 'Invalid break type.' });
        }
        try {
            // Must have an open clock-in session
            const { data: att } = await supabase.from('attendance')
                .select('id, clock_in, attendance_date')
                .eq('employee_id', employeeId)
                .not('clock_in', 'is', null)
                .is('clock_out', null)
                .order('attendance_date', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!att) return res.status(400).json({ success: false, message: 'You must be clocked in before starting a break.' });

            // No active break already running
            const { data: active } = await supabase.from('employee_breaks')
                .select('id').eq('employee_id', employeeId).is('break_end', null).maybeSingle();
            if (active) return res.status(400).json({ success: false, message: 'You already have an active break. End it first.' });

            // This break_type must not have been used this session
            const { data: alreadyUsed } = await supabase.from('employee_breaks')
                .select('id')
                .eq('employee_id', employeeId)
                .eq('break_type', break_type)
                .gte('break_start', att.clock_in)
                .maybeSingle();
            if (alreadyUsed) {
                return res.status(400).json({ success: false, message: `${BREAK_TYPES[break_type].label} has already been used today.` });
            }

            const { data, error } = await supabase.from('employee_breaks').insert([{
                employee_id: employeeId,
                attendance_date: att.attendance_date,
                break_start: new Date().toISOString(),
                break_type,
            }]).select().single();
            if (error) throw error;

            return res.json({ success: true, break: data, message: `${BREAK_TYPES[break_type].label} started.` });
        } catch (err) {
            console.error('[break] start error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // POST /api/attendance/break/end
    router.post('/break/end', authenticateToken, async (req, res) => {
        const employeeId = req.user.employeeId;
        try {
            const { data: active, error: findErr } = await supabase.from('employee_breaks')
                .select('id, break_start, break_type').eq('employee_id', employeeId).is('break_end', null).maybeSingle();
            if (findErr) throw findErr;
            if (!active) return res.status(400).json({ success: false, message: 'No active break found.' });

            const breakEnd = new Date();
            const durationMinutes = Math.round((breakEnd - new Date(active.break_start)) / 60000);

            const { data, error } = await supabase.from('employee_breaks').update({
                break_end: breakEnd.toISOString(),
                break_duration_minutes: durationMinutes,
                updated_at: breakEnd.toISOString(),
            }).eq('id', active.id).select().single();
            if (error) throw error;

            const label = BREAK_TYPES[active.break_type]?.label || 'Break';
            return res.json({ success: true, break: data, duration_minutes: durationMinutes, message: `${label} ended. Duration: ${durationMinutes} min.` });
        } catch (err) {
            console.error('[break] end error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // GET /api/attendance/break/my-status
    // Returns active break + which break types have been used this clock-in session
    router.get('/break/my-status', authenticateToken, async (req, res) => {
        const employeeId = req.user.employeeId;
        try {
            // Find the current open attendance session
            const { data: att } = await supabase.from('attendance')
                .select('clock_in')
                .eq('employee_id', employeeId)
                .not('clock_in', 'is', null)
                .is('clock_out', null)
                .order('clock_in', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!att?.clock_in) {
                return res.json({ success: true, active_break: null, used_break_types: [] });
            }

            // All breaks since this clock-in
            const { data: sessionBreaks, error } = await supabase.from('employee_breaks')
                .select('id, break_type, break_start, break_end, break_duration_minutes, attendance_date')
                .eq('employee_id', employeeId)
                .gte('break_start', att.clock_in)
                .order('break_start', { ascending: true });
            if (error) throw error;

            const used_break_types = (sessionBreaks || []).filter(b => b.break_end).map(b => b.break_type);
            const active_break = (sessionBreaks || []).find(b => !b.break_end) || null;

            return res.json({ success: true, active_break, used_break_types });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // GET /api/attendance/break/team-active
    // Uses the same reporting_manager lookup as the rest of the codebase.
    // Admin → all active breaks. TL/Manager → breaks of employees whose reporting_manager = their name.
    router.get('/break/team-active', authenticateToken, async (req, res) => {
        const { employeeId, role } = req.user;
        try {
            let employeeIds = null; // null = admin sees all

            if (role !== 'admin') {
                // Step 1: get this user's full name
                const { data: me } = await supabase
                    .from('employees')
                    .select('first_name, last_name')
                    .eq('employee_id', employeeId)
                    .maybeSingle();

                if (!me) return res.json({ success: true, breaks: [] });

                const myName = `${me.first_name} ${me.last_name}`.trim().toLowerCase();

                // Step 2: find all active employees whose reporting_manager matches (same logic as team report)
                const { data: allEmps } = await supabase
                    .from('employees')
                    .select('employee_id, reporting_manager')
                    .eq('is_active', true);

                employeeIds = (allEmps || [])
                    .filter(e => (e.reporting_manager || '').trim().toLowerCase() === myName)
                    .map(e => e.employee_id);

                if (employeeIds.length === 0) return res.json({ success: true, breaks: [] });
            }

            // Step 3: find active breaks — no date filter, just break_end IS NULL
            let query = supabase
                .from('employee_breaks')
                .select('id, employee_id, break_start, break_type, attendance_date')
                .is('break_end', null)
                .order('break_start', { ascending: true });

            if (employeeIds !== null) query = query.in('employee_id', employeeIds);

            const { data: breaks, error: breakErr } = await query;
            if (breakErr) throw breakErr;

            // Step 4: enrich with employee details
            const ids = (breaks || []).map(b => b.employee_id);
            let empMap = {};
            if (ids.length > 0) {
                const { data: emps } = await supabase
                    .from('employees')
                    .select('employee_id, first_name, last_name, designation, department')
                    .in('employee_id', ids);
                (emps || []).forEach(e => { empMap[e.employee_id] = e; });
            }

            return res.json({
                success: true,
                breaks: (breaks || []).map(b => ({
                    ...b,
                    employee: empMap[b.employee_id] || { first_name: b.employee_id, last_name: '' },
                })),
            });
        } catch (err) {
            console.error('[break] team-active error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    console.log('✅ Attendance routes loaded with regularization support and team report');
    return router;
};