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

    // POST /api/attendance/break/start
    router.post('/break/start', authenticateToken, async (req, res) => {
        const employeeId = req.user.employeeId;
        const today = new Date().toISOString().split('T')[0];
        try {
            // Must be clocked in today
            const { data: att } = await supabase.from('attendance')
                .select('id, clock_in, clock_out').eq('employee_id', employeeId).eq('attendance_date', today).maybeSingle();
            if (!att?.clock_in) return res.status(400).json({ success: false, message: 'You must be clocked in before starting a break.' });
            if (att.clock_out)  return res.status(400).json({ success: false, message: 'You have already clocked out for today.' });

            // No active break already running
            const { data: active } = await supabase.from('employee_breaks')
                .select('id').eq('employee_id', employeeId).is('break_end', null).maybeSingle();
            if (active) return res.status(400).json({ success: false, message: 'You already have an active break. Please end it first.' });

            const { data, error } = await supabase.from('employee_breaks').insert([{
                employee_id: employeeId,
                attendance_date: today,
                break_start: new Date().toISOString(),
            }]).select().single();
            if (error) throw error;

            console.log(`[break] ${employeeId} started break at ${data.break_start}`);
            return res.json({ success: true, break: data, message: 'Break started successfully.' });
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
                .select('id, break_start').eq('employee_id', employeeId).is('break_end', null).maybeSingle();
            if (findErr) throw findErr;
            if (!active) return res.status(400).json({ success: false, message: 'No active break found.' });

            const breakEnd = new Date();
            const breakStart = new Date(active.break_start);
            const durationMinutes = Math.round((breakEnd - breakStart) / 60000);

            const { data, error } = await supabase.from('employee_breaks').update({
                break_end: breakEnd.toISOString(),
                break_duration_minutes: durationMinutes,
                updated_at: breakEnd.toISOString(),
            }).eq('id', active.id).select().single();
            if (error) throw error;

            console.log(`[break] ${employeeId} ended break, duration: ${durationMinutes} min`);
            return res.json({ success: true, break: data, duration_minutes: durationMinutes, message: `Break ended. Duration: ${durationMinutes} min.` });
        } catch (err) {
            console.error('[break] end error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // GET /api/attendance/break/my-status
    router.get('/break/my-status', authenticateToken, async (req, res) => {
        const employeeId = req.user.employeeId;
        try {
            const { data, error } = await supabase.from('employee_breaks')
                .select('id, break_start, break_end, break_duration_minutes, attendance_date')
                .eq('employee_id', employeeId)
                .is('break_end', null)
                .maybeSingle();
            if (error) throw error;
            return res.json({ success: true, active_break: data || null });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // GET /api/attendance/break/team-active
    // Admin  → all employees currently on break
    // sub_admin (Manager) → members of their managed team(s)
    // manager (TL) → members of their managed team(s)
    // employee → empty list
    router.get('/break/team-active', authenticateToken, async (req, res) => {
        const { employeeId, role } = req.user;
        const today = new Date().toISOString().split('T')[0];
        try {
            let employeeIds = null; // null = all (admin only)

            if (role !== 'admin') {
                // Find all teams this user manages (manager_id = their ID)
                const { data: myTeams, error: teamsErr } = await supabase
                    .from('teams').select('id').eq('manager_id', employeeId);
                if (teamsErr) throw teamsErr;

                if (!myTeams || myTeams.length === 0) {
                    return res.json({ success: true, breaks: [] });
                }

                const teamIds = myTeams.map(t => t.id);
                const { data: members, error: memErr } = await supabase
                    .from('team_members').select('employee_id').in('team_id', teamIds);
                if (memErr) throw memErr;

                employeeIds = (members || []).map(m => m.employee_id);
                if (employeeIds.length === 0) return res.json({ success: true, breaks: [] });
            }

            // Query active breaks
            let query = supabase.from('employee_breaks')
                .select('id, employee_id, break_start, attendance_date')
                .eq('attendance_date', today)
                .is('break_end', null)
                .order('break_start', { ascending: true });

            if (employeeIds !== null) query = query.in('employee_id', employeeIds);

            const { data: breaks, error: breakErr } = await query;
            if (breakErr) throw breakErr;

            // Enrich with employee details
            const ids = (breaks || []).map(b => b.employee_id);
            let empMap = {};
            if (ids.length > 0) {
                const { data: emps } = await supabase.from('employees')
                    .select('employee_id, first_name, last_name, designation, department')
                    .in('employee_id', ids);
                (emps || []).forEach(e => { empMap[e.employee_id] = e; });
            }

            const enriched = (breaks || []).map(b => ({
                ...b,
                employee: empMap[b.employee_id] || { first_name: b.employee_id, last_name: '' },
            }));

            return res.json({ success: true, breaks: enriched });
        } catch (err) {
            console.error('[break] team-active error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    console.log('✅ Attendance routes loaded with regularization support and team report');
    return router;
};