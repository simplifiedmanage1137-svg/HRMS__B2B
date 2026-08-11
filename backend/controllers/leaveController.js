const supabase = require('../config/supabase');
const { sendLeaveStatusEmail } = require('../services/emailService');
const {
    PAID_LEAVE_ELIGIBILITY_MONTHS,
    MONTHLY_ACCRUAL_RATE,
    getTotalMonthsFromJoining,
    isProbationComplete,
    getEligibleFromDate,
    getCompletedMonthsInCurrentYear,
    calculateCurrentYearAccruedLeaves,
} = require('../config/leavePolicy');
const { syncAttendanceForApprovedLeave, revertAttendanceForLeave } = require('../services/leaveAttendanceSync');

// Helper: check if designation is team leader/manager level
const isTeamLeaderDesignation = (designation) => {
    if (!designation) return false;
    const d = designation.toLowerCase();
    return d.includes('team leader') || d.includes('team manager') ||
           d.includes('tl') || d.includes('lead') || d.includes('manager') ||
           d.includes('head') || d.includes('supervisor');
};

// ==================== GET LEAVE BALANCE ====================
exports.getLeaveBalance = async (req, res) => {
    try {
        const { employee_id } = req.params;

        console.log('📊 Fetching leave balance for employee:', employee_id);

        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('joining_date, comp_off_balance')
            .eq('employee_id', employee_id)
            .single();

        if (empError) throw empError;

        // Get actual valid comp-off count from comp_off_earnings table (non-expired, non-used)
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const CompOffService = require('../services/compOffService');
        const actualCompOffBalance = await CompOffService.getValidCompOffCount(employee_id);

        // Sync employees table if mismatch
        if (actualCompOffBalance !== (employee.comp_off_balance || 0)) {
            await supabase
                .from('employees')
                .update({ comp_off_balance: actualCompOffBalance })
                .eq('employee_id', employee_id);
        }

        const joiningDate = new Date(employee.joining_date);
        const currentYear = today.getFullYear();

        const currentYearAccrual = calculateCurrentYearAccruedLeaves(joiningDate, today);
        const totalMonthsFromJoining = getTotalMonthsFromJoining(joiningDate, today);
        const isProbComplete = isProbationComplete(joiningDate, today);
        const eligibleFromDateStr = getEligibleFromDate(joiningDate);
        const completedMonths = getCompletedMonthsInCurrentYear(joiningDate, today);

        console.log('📊 Leave Calculation:', {
            employee_id,
            joining_date: employee.joining_date,
            current_year: currentYear,
            completed_months_in_current_year: completedMonths,
            current_year_accrual: currentYearAccrual,
            total_months_from_joining: totalMonthsFromJoining,
            is_probation_complete: isProbComplete
        });

        // Approved leaves - split by type
        const { data: usedLeaves, error: usedError } = await supabase
            .from('leaves')
            .select('days_count, leave_type')
            .eq('employee_id', employee_id)
            .eq('status', 'approved')
            .gte('start_date', `${currentYear}-01-01`)
            .lte('start_date', `${currentYear}-12-31`);
        if (usedError) throw usedError;

        // Paid leaves used (excludes Unpaid, Comp-Off & Birthday)
        const used = usedLeaves
            ?.filter(l => l.leave_type !== 'Unpaid' && l.leave_type !== 'Comp-Off' && l.leave_type !== 'Birthday')
            ?.reduce((sum, l) => sum + (parseFloat(l.days_count) || 0), 0) || 0;

        // Unpaid leaves used separately
        const unpaidUsed = usedLeaves
            ?.filter(l => l.leave_type === 'Unpaid')
            ?.reduce((sum, l) => sum + (parseFloat(l.days_count) || 0), 0) || 0;

        // Pending paid leaves
        const { data: pendingLeaves, error: pendingError } = await supabase
            .from('leaves')
            .select('days_count, leave_type')
            .eq('employee_id', employee_id)
            .eq('status', 'pending')
            .gte('start_date', `${currentYear}-01-01`)
            .lte('start_date', `${currentYear}-12-31`);
        if (pendingError) throw pendingError;

        const pending = pendingLeaves
            ?.filter(l => l.leave_type !== 'Unpaid' && l.leave_type !== 'Comp-Off' && l.leave_type !== 'Birthday')
            ?.reduce((sum, l) => sum + (parseFloat(l.days_count) || 0), 0) || 0;

        const unpaidPending = pendingLeaves
            ?.filter(l => l.leave_type === 'Unpaid')
            ?.reduce((sum, l) => sum + (parseFloat(l.days_count) || 0), 0) || 0;

        let available = 0;
        if (isProbComplete) {
            available = Math.max(0, currentYearAccrual - used - pending);
        }

        await supabase
            .from('leave_balance')
            .upsert({
                employee_id,
                leave_year: currentYear,
                total_accrued: currentYearAccrual,
                total_used: used,
                total_pending: pending,
                current_balance: available,
                last_updated: today.toISOString()
            }, {
                onConflict: 'employee_id,leave_year'
            });

        res.json({
            success: true,
            total_accrued: currentYearAccrual.toFixed(1),
            used: used.toFixed(1),
            pending: pending.toFixed(1),
            available: available.toFixed(1),
            unpaid_used: unpaidUsed.toFixed(1),
            unpaid_pending: unpaidPending.toFixed(1),
            comp_off_balance: actualCompOffBalance.toFixed(1),
            months_completed_in_year: completedMonths,
            total_months_from_joining: totalMonthsFromJoining,
            is_probation_complete: isProbComplete,
            is_eligible: isProbComplete,
            eligible_from_date: eligibleFromDateStr,
            leave_year: currentYear,
            joining_date: employee.joining_date,
            next_accrual_date: new Date(currentYear, today.getMonth() + 1, 0).toISOString().split('T')[0],
            probation_info: {
                is_active: !isProbComplete,
                months_completed: totalMonthsFromJoining,
                months_remaining: Math.max(0, PAID_LEAVE_ELIGIBILITY_MONTHS - totalMonthsFromJoining),
                eligible_from_date: eligibleFromDateStr,
                accrued_but_unusable: !isProbComplete ? currentYearAccrual : 0
            }
        });

    } catch (error) {
        console.error('Error fetching leave balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leave balance',
            error: error.message
        });
    }
};

// ==================== LEAVE USAGE BY TYPE ====================
// Days used this year, grouped by leave_type — real data (used, not "remaining per type",
// since this app tracks one pooled balance across Annual/Sick/Personal/etc.).
exports.getLeaveUsageByType = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const currentYear = new Date().getFullYear();

        const { data: leaves, error } = await supabase
            .from('leaves')
            .select('days_count, leave_type')
            .eq('employee_id', employee_id)
            .eq('status', 'approved')
            .gte('start_date', `${currentYear}-01-01`)
            .lte('start_date', `${currentYear}-12-31`);
        if (error) throw error;

        const usage = (leaves || []).reduce((acc, l) => {
            const type = l.leave_type || 'Other';
            acc[type] = (acc[type] || 0) + (parseFloat(l.days_count) || 0);
            return acc;
        }, {});

        res.json({ success: true, leave_year: currentYear, usage });
    } catch (error) {
        console.error('Error fetching leave usage by type:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch leave usage by type', error: error.message });
    }
};

// ==================== APPLY LEAVE ====================
exports.applyLeave = async (req, res) => {
    try {
        const {
            employee_id, leave_type, leave_duration, half_day_type,
            start_date, end_date, reason, days_count, reporting_manager
        } = req.body;

        if (!employee_id || !leave_type || !start_date || !reason) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        if (!reporting_manager || !reporting_manager.trim()) {
            return res.status(400).json({ success: false, message: 'Reporting manager is required' });
        }

        const { data: employee, error: empError } = await supabase
            .from('employees').select('joining_date, comp_off_balance, first_name, last_name, dob')
            .eq('employee_id', employee_id).single();
        if (empError) throw empError;

        // ── Birthday Leave — special handling ────────────────────────────────
        if (leave_type === 'Birthday') {
            if (!employee.dob) {
                return res.status(400).json({
                    success: false,
                    message: 'Your date of birth is not on record. Please contact admin to update your profile.'
                });
            }
            const dob     = new Date(employee.dob);
            const leaveStart = new Date(start_date);
            if (dob.getMonth() !== leaveStart.getMonth() || dob.getDate() !== leaveStart.getDate()) {
                const dobFormatted = dob.toLocaleString('en-IN', { month: 'long', day: 'numeric' });
                return res.status(400).json({
                    success: false,
                    message: `Birthday leave must be on your birthday (${dobFormatted}).`
                });
            }
            if (end_date && start_date !== end_date) {
                return res.status(400).json({ success: false, message: 'Birthday leave is only 1 day.' });
            }
            const leaveYear = leaveStart.getFullYear();
            const { data: existing } = await supabase
                .from('leaves')
                .select('id, status')
                .eq('employee_id', employee_id)
                .eq('leave_type', 'Birthday')
                .gte('start_date', `${leaveYear}-01-01`)
                .lte('start_date', `${leaveYear}-12-31`)
                .in('status', ['pending', 'approved'])
                .maybeSingle();
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'You have already applied for Birthday leave this year.'
                });
            }
            // Birthday leave skips all probation/balance checks — fall through to insert
        } else {
            const joiningDate = new Date(employee.joining_date);
            const today = new Date();
            const totalMonths = getTotalMonthsFromJoining(joiningDate, today);
            const isProbComplete = isProbationComplete(joiningDate, today);

            if (!isProbComplete && leave_type !== 'Unpaid' && leave_type !== 'Comp-Off') {
                return res.status(400).json({
                    success: false,
                    message: `During probation (${totalMonths}/${PAID_LEAVE_ELIGIBILITY_MONTHS} months), only Unpaid or Comp-Off leave allowed.`
                });
            }

            if (isProbComplete && leave_type !== 'Unpaid' && leave_type !== 'Comp-Off') {
                const { data: balanceData } = await supabase
                    .from('leave_balance').select('current_balance')
                    .eq('employee_id', employee_id).eq('leave_year', today.getFullYear()).maybeSingle();
                const available = balanceData?.current_balance || 0;
                if (available < days_count) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient leave balance. Available: ${available.toFixed(1)} days.`
                    });
                }
            }

            if (leave_type === 'Comp-Off' && (employee.comp_off_balance || 0) < days_count) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient Comp-Off balance. Available: ${employee.comp_off_balance || 0} days`
                });
            }
        }

        // IST timestamp for created_at
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const nowUTC = new Date();
        const istMs = nowUTC.getTime() + IST_OFFSET_MS;
        const istDate = new Date(istMs);
        const createdAtIST = `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth()+1).padStart(2,'0')}-${String(istDate.getUTCDate()).padStart(2,'0')} ${String(istDate.getUTCHours()).padStart(2,'0')}:${String(istDate.getUTCMinutes()).padStart(2,'0')}:${String(istDate.getUTCSeconds()).padStart(2,'0')}`;

        // Birthday Leave is a company-provided benefit, not subject to manager judgement —
        // it's auto-approved the moment it's submitted instead of sitting as pending.
        const isBirthday = leave_type === 'Birthday';
        const statusFields = isBirthday
            ? { status: 'approved', approved_by: 'SYSTEM', approved_date: nowUTC.toISOString().split('T')[0] }
            : { status: 'pending' };

        const { data: leaveData, error: leaveError } = await supabase
            .from('leaves')
            .insert([{
                employee_id,
                employee_name: `${employee.first_name} ${employee.last_name}`,
                leave_type, leave_duration,
                half_day_type: half_day_type || null,
                start_date,
                end_date: end_date || start_date,
                reason,
                days_count: days_count || 1,
                reporting_manager: reporting_manager.trim(),
                ...statusFields,
                applied_date: nowUTC.toISOString().split('T')[0],
                created_at: createdAtIST,
                updated_at: createdAtIST
            }])
            .select();

        let insertedLeave;
        if (leaveError) {
            // If employee_name column doesn't exist, retry without it
            if (leaveError.message && leaveError.message.includes('employee_name')) {
                const { data: leaveData2, error: leaveError2 } = await supabase
                    .from('leaves')
                    .insert([{
                        employee_id, leave_type, leave_duration,
                        half_day_type: half_day_type || null,
                        start_date, end_date: end_date || start_date,
                        reason, days_count: days_count || 1,
                        reporting_manager: reporting_manager.trim(),
                        ...statusFields,
                        applied_date: nowUTC.toISOString().split('T')[0],
                        created_at: createdAtIST, updated_at: createdAtIST
                    }])
                    .select();
                if (leaveError2) throw leaveError2;
                insertedLeave = leaveData2[0];
            } else {
                throw leaveError;
            }
        } else {
            insertedLeave = leaveData[0];
        }

        if (isBirthday) {
            await syncAttendanceForApprovedLeave(insertedLeave);
        }

        res.json({
            success: true,
            message: isBirthday ? 'Birthday leave approved automatically!' : 'Leave request submitted successfully!',
            leave: insertedLeave
        });

    } catch (error) {
        console.error('❌ Error applying leave:', error);
        res.status(500).json({ success: false, message: 'Failed to apply leave', error: error.message });
    }
};

// ==================== GET ALL LEAVES ====================
exports.getLeaves = async (req, res) => {
    try {
        const authenticatedUserId = req.user?.employeeId;
        const userRole = req.user?.role;
        
        console.log('🔍 getLeaves called with:', {
            authenticatedUserId,
            userRole,
            query: req.query
        });

        let query = supabase
            .from('leaves')
            .select('*, employees!inner(first_name, last_name, department, designation, profile_image)');

        const isAdmin = (userRole === 'admin' || userRole === 'desktop_support' || userRole === 'hr') && req.query.all === 'true';
        // sub_admin/manager share the /admin/leave-requests page (which always calls ?all=true),
        // but unlike full admin/hr they must only see their own team + leaves tagged to them —
        // never the whole company's leaves.
        const isReportingManager = req.query.reporting_manager === 'true'
            || (req.query.all === 'true' && !isAdmin && (userRole === 'sub_admin' || userRole === 'manager'));

        console.log('🔍 Query flags:', { isAdmin, isReportingManager });

        if (isAdmin) {
            // Admin: all leaves or filtered leaves
            console.log('🔍 Admin requesting all leaves');
            // Show all leaves for admin (no filtering by team leader)
            if (req.query.employee_id) {
                query = query.eq('employee_id', req.query.employee_id);
            }
            // No additional filtering for admin when all=true
        } else if (isReportingManager) {
            // Reporting manager: leaves where reporting_manager matches OR
            // employee's reporting_manager in employees table matches (for old leaves with null reporting_manager)
            const { data: emp } = await supabase
                .from('employees').select('first_name, last_name')
                .eq('employee_id', authenticatedUserId).single();
            const managerName = emp ? `${emp.first_name} ${emp.last_name}` : '';

            // Get all employee_ids who report to this manager
            const { data: teamEmps } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('reporting_manager', managerName);
            const teamIds = (teamEmps || []).map(e => e.employee_id);

            // Also pick up leaves explicitly tagged to this manager at the time of applying —
            // an employee can pick a different manager/TL in the Apply Leave form than the one
            // assigned on their profile, so team membership alone can miss those requests.
            const { data: taggedLeaves } = await supabase
                .from('leaves')
                .select('id')
                .eq('reporting_manager', managerName);
            const taggedIds = (taggedLeaves || []).map(l => l.id);

            if (teamIds.length === 0 && taggedIds.length === 0) {
                return res.json([]);
            }

            const orFilters = [];
            if (teamIds.length > 0) orFilters.push(`employee_id.in.(${teamIds.join(',')})`);
            if (taggedIds.length > 0) orFilters.push(`id.in.(${taggedIds.join(',')})`);

            // Fetch leaves where employee is in team OR the leave was directly tagged to this manager
            query = query.or(orFilters.join(','));
        } else {
            // Employee: own leaves only
            if (!authenticatedUserId) return res.json([]);
            query = query.eq('employee_id', authenticatedUserId);
        }

        query = query.order('created_at', { ascending: false });
        const { data: leaves, error } = await query;
        if (error) {
            console.error('❌ Database error in getLeaves:', error);
            throw error;
        }
        
        console.log('✅ Leaves fetched successfully:', leaves?.length || 0, 'records');

        const formatted = (leaves || []).map(l => ({
            ...l,
            first_name: l.employees?.first_name || l.employee_name?.split(' ')[0] || '',
            last_name: l.employees?.last_name || l.employee_name?.split(' ').slice(1).join(' ') || '',
            department: l.employees?.department || '',
            designation: l.employees?.designation || '',
            profile_image: l.employees?.profile_image || null,
            employees: undefined
        }));
        
        console.log('✅ Returning formatted leaves:', formatted.length, 'records');
        console.log('📊 Sample leave data:', formatted.slice(0, 2));

        res.json(formatted);
    } catch (error) {
        console.error('❌ Error in getLeaves:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching leaves', 
            error: error.message,
            leaves: [] // Return empty array on error
        });
    }
};

// ==================== UPDATE LEAVE STATUS ====================
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;
        const approver_id = req.user?.employeeId;
        const userRole = req.user?.role;

        if (!status || !['approved', 'rejected', 'cancelled'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Valid status required' });
        }

        const { data: leave, error: fetchError } = await supabase
            .from('leaves').select('*').eq('id', id).single();
        if (fetchError || !leave) {
            return res.status(404).json({ success: false, message: 'Leave request not found' });
        }

        // Authorization logic:
        // - Admin can approve/reject any leave request
        // - Team Leader/Manager employee's leave: only admin can approve/reject
        // - Regular employee's leave: their reporting manager or admin can approve/reject
        // - Employee can cancel their own leave
        if (status === 'cancelled') {
            // Employee cancelling own leave - allow
        } else if (userRole === 'admin' || userRole === 'hr') {
            // Admin/HR can approve/reject any leave request
        } else {
            // Non-admin: must be the reporting manager of the employee
            const { data: approver } = await supabase
                .from('employees').select('first_name, last_name')
                .eq('employee_id', approver_id).single();
            const approverName = approver ? `${approver.first_name} ${approver.last_name}` : '';
            // Allow either the employee's officially assigned reporting manager, OR whoever the
            // employee explicitly tagged as reporting manager on this specific leave request —
            // the Apply Leave form lets an employee pick a different manager/TL than the one on
            // their profile, and that tagged manager must be able to act on it too.
            const { data: empData } = await supabase
                .from('employees').select('reporting_manager')
                .eq('employee_id', leave.employee_id).single();
            const empReportingManager = empData?.reporting_manager || '';
            const leaveTaggedManager = leave.reporting_manager || '';
            if (empReportingManager !== approverName && leaveTaggedManager !== approverName) {
                return res.status(403).json({
                    success: false,
                    message: 'Only the assigned reporting manager or admin can approve or reject this leave'
                });
            }
        }

        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(Date.now() + IST_OFFSET_MS);
        const updatedAtIST = `${nowIST.getUTCFullYear()}-${String(nowIST.getUTCMonth()+1).padStart(2,'0')}-${String(nowIST.getUTCDate()).padStart(2,'0')} ${String(nowIST.getUTCHours()).padStart(2,'0')}:${String(nowIST.getUTCMinutes()).padStart(2,'0')}:${String(nowIST.getUTCSeconds()).padStart(2,'0')}`;

        const updateData = {
            status,
            remarks: remarks || null,
            updated_at: updatedAtIST,
            approved_by: approver_id || null,
            approved_date: status === 'approved' ? new Date().toISOString().split('T')[0] : null
        };

        const { data: updatedLeave, error: updateError } = await supabase
            .from('leaves').update(updateData).eq('id', id).select();
        if (updateError) throw updateError;

        // On approval: immediately deduct from leave balance
        if (status === 'approved') {
            const today = new Date();
            const leaveYear = today.getFullYear();

            if (leave.leave_type === 'Comp-Off') {
                // Deduct from comp_off_balance
                const { data: emp } = await supabase
                    .from('employees').select('comp_off_balance').eq('employee_id', leave.employee_id).single();
                const newBalance = Math.max(0, (emp?.comp_off_balance || 0) - (leave.days_count || 1));
                await supabase.from('employees')
                    .update({ comp_off_balance: newBalance })
                    .eq('employee_id', leave.employee_id);
            } else if (leave.leave_type !== 'Unpaid' && leave.leave_type !== 'Birthday') {
                // Deduct from leave_balance (Birthday leave is a free benefit — no deduction)
                const { data: bal } = await supabase
                    .from('leave_balance').select('*')
                    .eq('employee_id', leave.employee_id).eq('leave_year', leaveYear).maybeSingle();
                if (bal) {
                    const newUsed = (bal.total_used || 0) + (leave.days_count || 1);
                    const newBalance = Math.max(0, (bal.total_accrued || 0) - newUsed - (bal.total_pending || 0));
                    await supabase.from('leave_balance').update({
                        total_used: newUsed,
                        current_balance: newBalance,
                        last_updated: new Date().toISOString()
                    }).eq('employee_id', leave.employee_id).eq('leave_year', leaveYear);
                }
            }

            // Approved Paid/Birthday/Comp-Off leave days must show Present, not Absent —
            // write the attendance placeholder now that approval is final.
            await syncAttendanceForApprovedLeave(updatedLeave[0]);
        } else if ((status === 'rejected' || status === 'cancelled') && leave.status === 'approved') {
            // A previously-approved leave is being reversed — undo the Present
            // placeholder so the day gets recalculated instead of staying stuck as leave.
            await revertAttendanceForLeave(leave);
        }

        res.json({ success: true, message: `Leave ${status} successfully`, leave: updatedLeave[0] });

        // Non-blocking email notification
        supabase.from('employees').select('email, first_name, last_name')
            .eq('employee_id', leave.employee_id).single()
            .then(({ data: emp }) => {
                if (emp?.email) {
                    sendLeaveStatusEmail(emp, {
                        status,
                        leaveType: leave.leave_type,
                        startDate: leave.start_date,
                        endDate: leave.end_date,
                        daysCount: leave.days_count,
                        remarks: remarks || null,
                        approvedBy: approver_id || null,
                    }).catch(err => console.error('⚠️ Leave email error:', err.message));
                }
            })
            .catch(err => console.error('⚠️ Leave email fetch error:', err.message));

    } catch (error) {
        console.error('❌ Error updating leave status:', error);
        res.status(500).json({ success: false, message: 'Failed to update leave status', error: error.message });
    }
};

// ==================== GET LEAVE TYPES ====================
exports.getLeaveTypes = async (req, res) => {
    try {
        const { employee_id } = req.query;

        let availableTypes = [
            { value: 'Unpaid', label: 'Unpaid Leave', icon: '💰' }
        ];

        if (employee_id) {
            const { data: employee, error } = await supabase
                .from('employees')
                .select('comp_off_balance, joining_date, dob')
                .eq('employee_id', employee_id)
                .single();

            if (!error && employee) {
                if (employee.comp_off_balance > 0) {
                    availableTypes.unshift({
                        value: 'Comp-Off',
                        label: `Comp-Off (${employee.comp_off_balance} days available)`,
                        icon: '🎉'
                    });
                }

                // Birthday Leave — available to all employees (no probation restriction)
                if (employee.dob) {
                    const today = new Date();
                    const dob = new Date(employee.dob);
                    const mm = String(dob.getMonth() + 1).padStart(2, '0');
                    const dd = String(dob.getDate()).padStart(2, '0');
                    const birthdayThisYear = `${today.getFullYear()}-${mm}-${dd}`;
                    availableTypes.push({
                        value: 'Birthday',
                        label: '🎂 Birthday Leave',
                        icon: '🎂',
                        birthday_date: birthdayThisYear
                    });
                }

                if (employee.joining_date) {
                    const joiningDate = new Date(employee.joining_date);
                    const today = new Date();

                    if (isProbationComplete(joiningDate, today)) {
                        availableTypes.push(
                            { value: 'Annual', label: 'Annual Leave', icon: '🌴' },
                            { value: 'Sick', label: 'Sick Leave', icon: '🤒' },
                            { value: 'Personal', label: 'Personal Leave', icon: '👤' },
                            { value: 'Maternity', label: 'Maternity Leave', icon: '🤱' },
                            { value: 'Paternity', label: 'Paternity Leave', icon: '👨‍👧' },
                            { value: 'Bereavement', label: 'Bereavement Leave', icon: '💐' }
                        );
                    }
                }
            }
        }

        res.json({
            success: true,
            leaveTypes: availableTypes
        });

    } catch (error) {
        console.error('Error fetching leave types:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leave types',
            error: error.message
        });
    }
};

// ==================== ON LEAVE TODAY ====================
exports.getOnLeaveToday = async (req, res) => {
    try {
        const { employeeId, role } = req.user;
        let { scope = 'department', department } = req.query;

        const { data: caller, error: callerErr } = await supabase
            .from('employees')
            .select('first_name, last_name, department')
            .eq('employee_id', employeeId)
            .maybeSingle();
        if (callerErr) throw callerErr;

        if (scope === 'company' && !['admin', 'sub_admin', 'hr'].includes(role)) {
            scope = 'department';
        }

        const today = new Date().toISOString().split('T')[0];

        const { data: leaves, error: leavesErr } = await supabase
            .from('leaves')
            .select('employee_id, leave_type, start_date, end_date')
            .eq('status', 'approved')
            .lte('start_date', today)
            .gte('end_date', today);
        if (leavesErr) throw leavesErr;

        if (!leaves || leaves.length === 0) {
            return res.json({ success: true, scope, date: today, count: 0, employees: [] });
        }

        const empIds = [...new Set(leaves.map(l => l.employee_id))];
        const { data: emps, error: empsErr } = await supabase
            .from('employees')
            .select('employee_id, first_name, last_name, department, designation, profile_image, reporting_manager')
            .in('employee_id', empIds);
        if (empsErr) throw empsErr;

        const callerName = `${caller?.first_name || ''} ${caller?.last_name || ''}`.trim().toLowerCase();
        const targetDept = (department || caller?.department || '').toLowerCase();

        const scoped = (emps || []).filter(e => {
            if (scope === 'team') {
                return (e.reporting_manager || '').trim().toLowerCase() === callerName;
            }
            if (scope === 'company') return true;
            return (e.department || '').toLowerCase() === targetDept;
        });

        const result = scoped.map(e => {
            const leave = leaves.find(l => l.employee_id === e.employee_id);
            return {
                employee_id: e.employee_id,
                first_name: e.first_name,
                last_name: e.last_name,
                department: e.department,
                designation: e.designation,
                profile_image: e.profile_image,
                leave_type: leave?.leave_type,
                start_date: leave?.start_date,
                end_date: leave?.end_date,
            };
        });

        res.json({ success: true, scope, date: today, count: result.length, employees: result });
    } catch (error) {
        console.error('Error fetching on-leave-today:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch on-leave-today', error: error.message });
    }
};

// ==================== MANUAL ACCRUAL ====================
exports.manualAccrual = async (req, res) => {
    try {
        const { employee_id } = req.params;
        
        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('joining_date')
            .eq('employee_id', employee_id)
            .single();
            
        if (empError) throw empError;
        
        const joiningDate = new Date(employee.joining_date);
        const today = new Date();
        const currentYearAccrual = calculateCurrentYearAccruedLeaves(joiningDate, today);
        const currentYear = today.getFullYear();
        
        const { data: existingBalance } = await supabase
            .from('leave_balance')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('leave_year', currentYear)
            .single();
            
        if (existingBalance) {
            await supabase
                .from('leave_balance')
                .update({
                    total_accrued: currentYearAccrual,
                    current_balance: currentYearAccrual - (existingBalance.total_used || 0),
                    last_updated: today.toISOString()
                })
                .eq('employee_id', employee_id)
                .eq('leave_year', currentYear);
        } else {
            await supabase
                .from('leave_balance')
                .insert([{
                    employee_id,
                    leave_year: currentYear,
                    total_accrued: currentYearAccrual,
                    total_used: 0,
                    total_pending: 0,
                    current_balance: currentYearAccrual,
                    last_updated: today.toISOString()
                }]);
        }
        
        res.json({
            success: true,
            message: `Manual accrual updated: ${currentYearAccrual} days`,
            total_accrued: currentYearAccrual,
            completed_months: getCompletedMonthsInCurrentYear(joiningDate, today)
        });
        
    } catch (error) {
        console.error('Error in manual accrual:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add manual accrual',
            error: error.message
        });
    }
};

// ==================== YEARLY RESET ====================
exports.yearlyReset = async (req, res) => {
    try {
        const nextYear = new Date().getFullYear() + 1;
        
        const { data: employees } = await supabase
            .from('employees')
            .select('employee_id, joining_date');
            
        if (employees) {
            for (const emp of employees) {
                const joiningDate = new Date(emp.joining_date);
                const today = new Date(nextYear, 0, 1);
                
                let accruedMonths = 0;
                const joinYear = joiningDate.getFullYear();
                
                if (joinYear <= nextYear) {
                    for (let month = 0; month < 12; month++) {
                        accruedMonths++;
                    }
                }
                
                const accrualAmount = accruedMonths * MONTHLY_ACCRUAL_RATE;
                
                const { data: existing } = await supabase
                    .from('leave_balance')
                    .select('id')
                    .eq('employee_id', emp.employee_id)
                    .eq('leave_year', nextYear)
                    .single();
                    
                if (!existing) {
                    await supabase
                        .from('leave_balance')
                        .insert([{
                            employee_id: emp.employee_id,
                            leave_year: nextYear,
                            total_accrued: accrualAmount,
                            total_used: 0,
                            total_pending: 0,
                            current_balance: accrualAmount,
                            last_updated: new Date().toISOString()
                        }]);
                }
            }
        }
        
        res.json({
            success: true,
            message: `Yearly reset completed for ${nextYear}`,
            year: nextYear
        });
        
    } catch (error) {
        console.error('Error in yearly reset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset yearly leaves',
            error: error.message
        });
    }
};

module.exports = exports;