const supabase = require('../config/supabase');
const { isDateHoliday, getHolidayName } = require('../data/holidays');
const { getDeductionTotal } = require('./deductionController');
const { toUTCMs } = require('./attendanceController')._shared;

const FIXED_WORKING_DAYS = 22;
// Helper function to get month name
function getMonthName(monthNumber) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNumber - 1] || 'Unknown';
}

// Get cycle dates (26th of previous month to 25th of current month)
const getCycleDates = (month, year) => {
    const startMonth = month - 1;
    const startYear = startMonth === 0 ? year - 1 : year;
    const actualStartMonth = startMonth === 0 ? 12 : startMonth;

    const pad = (n) => String(n).padStart(2, '0');
    const startDateStr = `${startYear}-${pad(actualStartMonth)}-26`;
    const endDateStr = `${year}-${pad(month)}-25`;

    return {
        startDate: parseLocalDate(startDateStr),
        endDate: parseLocalDate(endDateStr),
        startDateStr,
        endDateStr,
        startMonth: actualStartMonth,
        startYear: startYear,
        endMonth: month,
        endYear: year
    };
};

// Parse date string YYYY-MM-DD as local date (avoid UTC shift)
const parseLocalDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Calculate working days in cycle (Monday to Friday only)
const calculateWorkingDaysInCycle = (startDate, endDate, joiningDate = null) => {
    let workingDays = 0;
    const start    = parseLocalDate(startDate.toISOString().split('T')[0]);
    const end      = parseLocalDate(endDate.toISOString().split('T')[0]);
    const joinDate = joiningDate
        ? parseLocalDate(joiningDate.toISOString().split('T')[0])
        : null;

    const currentDate = new Date(start);
    while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            if (!joinDate || currentDate >= joinDate) {
                workingDays++;
            }
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return workingDays;
};

// Count company holidays (weekdays only) in cycle
const countHolidaysInCycle = (startDateStr, endDateStr) => {
    const startDate = parseLocalDate(startDateStr);
    const endDate   = parseLocalDate(endDateStr);
    let holidayDays = 0;
    const holidayNames = [];

    const toLocalDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const dateStr = toLocalDateStr(currentDate);
            if (isDateHoliday(dateStr)) {
                holidayDays++;
                holidayNames.push({ date: dateStr, name: getHolidayName(dateStr) });
            }
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return { holidayDays, holidayNames };
};

// Calculate days employed in the cycle (for prorated salary)
const calculateDaysEmployedInCycle = (startDate, endDate, joiningDate) => {
    if (!joiningDate) return null;

    const joinDate   = parseLocalDate(joiningDate.toISOString().split('T')[0]);
    const cycleStart = parseLocalDate(startDate.toISOString().split('T')[0]);
    const cycleEnd   = parseLocalDate(endDate.toISOString().split('T')[0]);

    if (joinDate > cycleEnd) return 0;
    if (joinDate <= cycleStart) return null;

    let employedDays = 0;
    let currentDate = new Date(joinDate);

    while (currentDate <= cycleEnd) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            employedDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return employedDays;
};

// Get employee details
const getEmployeeDetails = async (employeeId) => {
    const { data: employee, error } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', employeeId)
        .single();

    if (error) throw error;
    return employee;
};

// Get attendance records for the cycle - best record per day
//
// Dedup logic mirrors attendanceController.getAttendanceReport exactly (same bug, same fix,
// ported rather than reinvented): this used to have a rule where a 0-minute "admin absent"
// row always beat a genuine clock-in row for the same day, on the theory that it must have
// been an explicit admin override. In practice that shape is indistinguishable from
// cron/absentEmployeeCheck.js's stale nightly placeholder (clock_in null, status 'absent',
// written before the employee actually clocked in) — so real present/working days were
// silently counted as absent in salary calculations whenever both rows existed for a date.
// Recency (whichever row was actually written most recently) is the reliable signal instead.
const getAttendanceRecords = async (employeeId, startDateStr, endDateStr) => {
    const { data: attendance, error } = await supabase
        .from('attendance')
        .select('attendance_date, clock_in, clock_out, clock_in_ist, clock_out_ist, status, total_minutes, late_minutes, overtime_hours, overtime_amount, is_holiday, holiday_name, created_at, updated_at')
        .eq('employee_id', employeeId)
        .gte('attendance_date', startDateStr)
        .lte('attendance_date', endDateStr)
        .order('attendance_date', { ascending: true });

    if (error) throw error;

    const bestPerDay = {};
    for (const rec of (attendance || [])) {
        const dateKey = rec.attendance_date.split('T')[0];
        const existing = bestPerDay[dateKey];
        if (!existing) {
            bestPerDay[dateKey] = rec;
            continue;
        }

        const existingClockOut = existing.clock_out_ist || existing.clock_out;
        const newClockOut = rec.clock_out_ist || rec.clock_out;

        if (newClockOut && !existingClockOut) {
            bestPerDay[dateKey] = rec;
        } else if (newClockOut && existingClockOut) {
            if (toUTCMs(newClockOut) > toUTCMs(existingClockOut)) {
                bestPerDay[dateKey] = rec;
            }
        } else if (!existingClockOut && !newClockOut) {
            const existingTime = new Date(existing.updated_at || existing.created_at).getTime() || 0;
            const newTime = new Date(rec.updated_at || rec.created_at).getTime() || 0;
            if (newTime > existingTime) {
                bestPerDay[dateKey] = rec;
            } else if (newTime === existingTime) {
                const existingHasClockIn = !!(existing.clock_in || existing.clock_in_ist);
                const newHasClockIn = !!(rec.clock_in || rec.clock_in_ist);
                if (newHasClockIn && !existingHasClockIn) {
                    bestPerDay[dateKey] = rec;
                }
            }
        }
    }

    return Object.values(bestPerDay);
};

// Get approved leaves for the cycle
const getApprovedLeaves = async (employeeId, startDateStr, endDateStr) => {
    const { data: leaves, error } = await supabase
        .from('leaves')
        .select('leave_type, start_date, end_date, days_count, leave_duration')
        .eq('employee_id', employeeId)
        .eq('status', 'approved')
        .lte('start_date', endDateStr)
        .gte('end_date', startDateStr);

    if (error) throw error;
    return leaves || [];
};

// Calculate attendance summary
const calculateAttendanceSummary = (attendanceRecords, leaves, startDateStr, endDateStr, joiningDate = null) => {
    const startDate = parseLocalDate(startDateStr);
    const endDate   = parseLocalDate(endDateStr);
    const joinDate  = joiningDate ? parseLocalDate(joiningDate.toISOString().split('T')[0]) : null;

    // Use local date string (YYYY-MM-DD) to avoid UTC offset issues
    const toLocalDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const attendanceMap = {};
    attendanceRecords.forEach(record => {
        // attendance_date is already YYYY-MM-DD string from DB
        const key = record.attendance_date.split('T')[0];
        attendanceMap[key] = record;
    });

    const leaveMap = {};
    leaves.forEach(leave => {
        const leaveStart = new Date(`${leave.start_date.split('T')[0]}T00:00:00`);
        const leaveEnd   = new Date(`${leave.end_date.split('T')[0]}T00:00:00`);
        for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
            const dateStr = toLocalDateStr(d);
            if (!leaveMap[dateStr]) {
                leaveMap[dateStr] = {
                    type: leave.leave_type,
                    duration: leave.leave_duration || 'Full Day'
                };
            }
        }
    });

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let totalOvertimeHours = 0;
    let totalOvertimeAmount = 0;
    let totalLateMinutes = 0;
    let lateDays = 0;

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr    = toLocalDateStr(currentDate);
        const dayOfWeek  = currentDate.getDay();
        const isWeekday  = dayOfWeek !== 0 && dayOfWeek !== 6;

        if (!isWeekday) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }

        if (joinDate && currentDate < joinDate) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }

        const attendance = attendanceMap[dateStr];
        const leave      = leaveMap[dateStr];

        if (leave) {
            if (leave.type === 'Unpaid') {
                unpaidLeaveDays += leave.duration === 'Half Day' ? 0.5 : 1;
            } else {
                paidLeaveDays += leave.duration === 'Half Day' ? 0.5 : 1;
            }
        } else if (attendance) {
            // Use DB status field directly — it's already correctly set by clockOut
            // Also handle still-clocked-in (clock_out null but status='present')
            const dbStatus = (attendance.status || '').toLowerCase();
            const totalMinutes = attendance.total_minutes || 0;

            if (dbStatus === 'present') {
                presentDays++;
            } else if (dbStatus === 'half_day') {
                halfDays++;
                presentDays += 0.5;
            } else if (dbStatus === 'absent') {
                // Admin-marked week_off or holiday (is_holiday=true) → paid, no deduction
                if (attendance.is_holiday) {
                    presentDays++;
                } else {
                    absentDays++;
                }
            } else if (attendance.clock_in && !attendance.clock_out) {
                // Still working — count as present for salary
                presentDays++;
            } else if (attendance.clock_in && attendance.clock_out) {
                // Fallback: calculate from total_minutes
                if (totalMinutes >= 9 * 60) {
                    presentDays++;
                } else if (totalMinutes >= 300) {
                    halfDays++;
                    presentDays += 0.5;
                } else {
                    absentDays++;
                }
            } else {
                absentDays++;
            }

            if (attendance.overtime_hours > 0) {
                totalOvertimeHours  += Number(attendance.overtime_hours)  || 0;
                totalOvertimeAmount += Number(attendance.overtime_amount) || 0;
            }
            if (attendance.late_minutes > 0) {
                lateDays++;
                totalLateMinutes += Number(attendance.late_minutes) || 0;
            }
        } else {
            absentDays++;
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
        presentDays,
        halfDays,
        absentDays,
        paidLeaveDays,
        unpaidLeaveDays,
        totalOvertimeHours,
        totalOvertimeAmount,
        lateDays,
        totalLateMinutes
    };
};

// Simplified generateSalarySlip function
exports.generateSalarySlip = async (req, res) => {
    try {
        console.log('📝 Generating salary slip with body:', req.body);

        const { employee_id, month, year } = req.body;

        if (!employee_id || !month || !year) {
            return res.status(400).json({ success: false, message: 'Employee ID, month, and year are required' });
        }

        // Get employee details
        const employee = await getEmployeeDetails(employee_id);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        // Get cycle dates
        const cycle = getCycleDates(parseInt(month), parseInt(year));

        // Check if salary slip already exists
        // Preserve any manually-set OT (from Payroll Adjustment) before deleting
        // Use limit(1) instead of maybeSingle() to avoid errors when duplicate rows exist
        const { data: slipList } = await supabase
            .from('salary_slips').select('id, overtime_amount')
            .eq('employee_id', employee_id).eq('month', month).eq('year', year)
            .order('generated_date', { ascending: false })
            .limit(1);
        const existingSlip = slipList?.[0] || null;

        // null = no prior slip → use attendance OT for first-time generation.
        // number (even 0) = prior slip had this OT → use exactly, so admin setting 0 is respected.
        const preservedOtAmount = existingSlip !== null
            ? parseFloat(existingSlip.overtime_amount ?? 0)
            : null;

        // Delete ALL rows for this month to prevent duplicates accumulating
        await supabase.from('salary_slips').delete()
            .eq('employee_id', employee_id).eq('month', month).eq('year', year);

        const monthlySalary = parseFloat(employee.in_hand_salary || employee.gross_salary || employee.salary || 0);
        const joiningDate   = employee.joining_date ? new Date(employee.joining_date) : null;

        // ── 1. Actual working days in cycle (Mon–Fri only, 26th to 25th) ──
        const totalWorkingDays = calculateWorkingDaysInCycle(cycle.startDate, cycle.endDate);

        // ── 2. Per-day salary based on actual cycle working days ──
        const perDaySalary = totalWorkingDays > 0 ? monthlySalary / totalWorkingDays : 0;

        // ── 3. Attendance & leave data ──
        const attendanceRecords = await getAttendanceRecords(employee_id, cycle.startDateStr, cycle.endDateStr);
        const leaveRecords      = await getApprovedLeaves(employee_id, cycle.startDateStr, cycle.endDateStr);

        // If 0 records, treat as fully absent (all working days deducted).
        // This allows slips to generate for months where admin marked attendance
        // outside the normal import flow or where records were just entered.

        // ── 4. Count company holidays (weekdays only) in cycle ──
        // Holidays are treated as present days (not deducted)
        const { holidayDays, holidayNames } = countHolidaysInCycle(cycle.startDateStr, cycle.endDateStr);

        // ── 5. Calculate attendance summary ──
        const summary = calculateAttendanceSummary(
            attendanceRecords, leaveRecords,
            cycle.startDateStr, cycle.endDateStr,
            joiningDate
        );

        // ── 6. Salary calculation ──
        // Paid days = present + paid leave + company holidays (holidays always paid)
        const totalPaidDays = summary.presentDays + summary.paidLeaveDays + holidayDays;
        const basicSalary = parseFloat(Math.min(totalPaidDays * perDaySalary, monthlySalary).toFixed(2));

        // Absent/unpaid deduction — always applied against the full monthly salary
        const deductibleDays  = summary.absentDays + summary.unpaidLeaveDays;
        const unpaidDeduction = parseFloat((deductibleDays * perDaySalary).toFixed(2));

        // When holidays inflate totalPaidDays to >= totalWorkingDays, basicSalary hits
        // the monthly cap and absent days are NOT already excluded from it.
        // In that case we must explicitly subtract the absent deduction.
        // When no holidays, basicSalary < monthlySalary and absent days were never
        // added to totalPaidDays, so they are already excluded — no double-deduction.
        const absentAlreadyExcluded = totalPaidDays < totalWorkingDays;
        const effectiveUnpaidDeduction = absentAlreadyExcluded ? 0 : unpaidDeduction;

        // OT: if a prior slip exists, use its overtime_amount exactly (including 0 to respect admin override).
        // For first-time generation (no existing slip), derive OT from attendance records.
        const attendanceOtAmount = parseFloat((summary.totalOvertimeAmount || 0).toFixed(2));
        const attendanceOtHours  = parseFloat((summary.totalOvertimeHours  || 0).toFixed(2));
        const overtimeAmount     = parseFloat(
            (preservedOtAmount !== null ? preservedOtAmount : attendanceOtAmount).toFixed(2)
        );
        const overtimeHours      = overtimeAmount === attendanceOtAmount
            ? attendanceOtHours
            : parseFloat((overtimeAmount / 150).toFixed(2));

        // Fixed deduction: DT ₹200 before May 2026; PF (per employee) + PT + Professional Tax from May 2026 onwards
        const isPFApplicable = parseInt(year) > 2026 || (parseInt(year) === 2026 && parseInt(month) >= 5);
        const pfAmount = isPFApplicable ? (employee.pf_amount != null ? parseInt(employee.pf_amount) : 1800) : 0;
        // PT no longer auto-defaults to ₹200 — admin must explicitly set it (PF/PT tab); unset = 0.
        const ptAmount = isPFApplicable ? (employee.pt_amount != null ? parseInt(employee.pt_amount) : 0) : 0;
        // Professional Tax is a distinct deduction from PT — no prior hardcoded value, so null = 0.
        const professionalTaxAmount = isPFApplicable ? (employee.professional_tax_amount != null ? parseInt(employee.professional_tax_amount) : 0) : 0;
        const dtDeduction = basicSalary > 0 ? (isPFApplicable ? pfAmount + ptAmount + professionalTaxAmount : 200) : 0;

        // Custom admin deductions for this employee/month/year
        const customDeduction = parseFloat((await getDeductionTotal(employee_id, month, year)).toFixed(2));

        // Net salary
        const netSalary = parseFloat(Math.max(0, basicSalary + overtimeAmount - effectiveUnpaidDeduction - dtDeduction - customDeduction).toFixed(2));

        const salaryData = {
            employee_id,
            month:              parseInt(month),
            year:               parseInt(year),
            cycle_start_date:   cycle.startDateStr,
            cycle_end_date:     cycle.endDateStr,
            monthly_salary:     monthlySalary,
            per_day_salary:     parseFloat(perDaySalary.toFixed(2)),
            total_working_days: totalWorkingDays,
            present_days:       summary.presentDays,
            half_days:          summary.halfDays,
            absent_days:        summary.absentDays,
            paid_leave_days:    summary.paidLeaveDays,
            unpaid_leave_days:  summary.unpaidLeaveDays,
            unpaid_deduction:   unpaidDeduction,
            basic_salary:       basicSalary,
            overtime_hours:     overtimeHours,
            overtime_amount:    overtimeAmount,
            dt:                 dtDeduction,
            custom_deduction:   customDeduction,
            net_salary:         netSalary,
            generated_date:     new Date().toISOString(),
            is_paid:            false
        };

        console.log('📝 Salary calculation (Actual cycle working days):', {
            monthlySalary,
            cycleStart: cycle.startDateStr, cycleEnd: cycle.endDateStr,
            totalWorkingDays, perDaySalary: perDaySalary.toFixed(2),
            presentDays: summary.presentDays, halfDays: summary.halfDays,
            absentDays: summary.absentDays, paidLeaveDays: summary.paidLeaveDays,
            unpaidLeaveDays: summary.unpaidLeaveDays,
            holidayDays, holidayNames,
            totalPaidDays, basicSalary,
            overtimeHours, overtimeAmount, dtDeduction, netSalary
        });

        let { data: salarySlip, error: insertError } = await supabase
            .from('salary_slips').insert([salaryData]).select().single();

        // present_days/half_days/absent_days/total_working_days are INTEGER on some DBs
        // (not yet migrated to NUMERIC — see scripts/widen-salary-slips-day-columns.sql).
        // Half-day attendance produces genuinely fractional values (e.g. 9.5 present days),
        // which those columns reject outright. Retry with rounded values rather than hard-
        // failing generation — but flag it clearly, since rounding does lose precision until
        // the migration is run.
        let roundedFallbackUsed = false;
        if (insertError && /invalid input syntax for type integer/i.test(insertError.message || '')) {
            roundedFallbackUsed = true;
            const roundedData = {
                ...salaryData,
                present_days: Math.round(salaryData.present_days),
                half_days: Math.round(salaryData.half_days),
                absent_days: Math.round(salaryData.absent_days),
                total_working_days: Math.round(salaryData.total_working_days),
            };
            ({ data: salarySlip, error: insertError } = await supabase
                .from('salary_slips').insert([roundedData]).select().single());
        }

        if (insertError) {
            console.error('❌ Insert error:', insertError);
            return res.status(500).json({ success: false, message: 'Failed to insert salary slip', error: insertError.message });
        }

        res.json({
            success: true,
            message: roundedFallbackUsed
                ? 'Salary slip generated (day counts rounded to whole numbers — run scripts/widen-salary-slips-day-columns.sql for exact half-day precision)'
                : 'Salary slip generated successfully',
            salarySlip,
            ...(roundedFallbackUsed ? { warning: 'day_columns_not_migrated' } : {}),
        });

    } catch (error) {
        console.error('❌ Error generating salary slip:', error);
        res.status(500).json({ success: false, message: 'Failed to generate salary slip', error: error.message });
    }
};
// Get salary slips for employee
exports.getEmployeeSalarySlips = async (req, res) => {
    try {
        const { employee_id } = req.params;

        const { data: allSlips, error } = await supabase
            .from('salary_slips')
            .select('*')
            .eq('employee_id', employee_id)
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .order('generated_date', { ascending: false });

        if (error) throw error;

        // Deduplicate: keep only the most-recently-generated slip per month/year
        const seen = new Set();
        const salarySlips = (allSlips || []).filter(s => {
            const key = `${s.year}-${s.month}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Get employee joining info
        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('joining_date')
            .eq('employee_id', employee_id)
            .single();

        let joiningInfo = null;
        if (employee && !empError) {
            const joiningDate = new Date(employee.joining_date);
            joiningInfo = {
                year: joiningDate.getFullYear(),
                month: joiningDate.getMonth() + 1,
                formattedDate: joiningDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
            };
        }

        res.json({
            success: true,
            salarySlips,
            joiningInfo
        });

    } catch (error) {
        console.error('Error fetching salary slips:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary slips',
            error: error.message
        });
    }
};

// Get salary slip by ID
exports.getSalarySlipById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: slips, error } = await supabase
            .from('salary_slips')
            .select('*')
            .eq('id', id);

        if (error) throw error;

        if (!slips || slips.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found'
            });
        }

        res.json({
            success: true,
            salarySlip: slips[0]
        });

    } catch (error) {
        console.error('Error fetching salary slip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary slip',
            error: error.message
        });
    }
};

// Get salary slip by month and year
exports.getSalarySlipByMonth = async (req, res) => {
    try {
        const { employee_id, month, year } = req.params;

        const { data: slips, error } = await supabase
            .from('salary_slips')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('month', parseInt(month))
            .eq('year', parseInt(year));

        if (error) throw error;

        if (!slips || slips.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found for this month'
            });
        }

        res.json({
            success: true,
            salarySlip: slips[0]
        });

    } catch (error) {
        console.error('Error fetching salary slip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary slip',
            error: error.message
        });
    }
};

// Generate bulk salary slips
exports.generateBulkSalarySlips = async (req, res) => {
    try {
        const { month, year, employee_ids } = req.body;

        // Only active, non-excluded employees are ever eligible for bulk generation —
        // enforced here server-side so exclusion can't be bypassed by frontend state,
        // and so inactive employees (a latent bug — this used to have no filter at all)
        // never get slips generated.
        let query = supabase
            .from('employees')
            .select('employee_id')
            .eq('is_active', true)
            .eq('exclude_from_payroll', false);
        if (Array.isArray(employee_ids) && employee_ids.length > 0) {
            query = query.in('employee_id', employee_ids);
        }

        let { data: employees, error: empError } = await query;

        if (empError && /exclude_from_payroll|does not exist/i.test(empError.message || '')) {
            // exclude_from_payroll not migrated yet on this DB — fall back without it.
            let fallbackQuery = supabase.from('employees').select('employee_id').eq('is_active', true);
            if (Array.isArray(employee_ids) && employee_ids.length > 0) {
                fallbackQuery = fallbackQuery.in('employee_id', employee_ids);
            }
            ({ data: employees, error: empError } = await fallbackQuery);
        }

        if (empError) throw empError;

        const results = [];

        for (const emp of employees || []) {
            try {
                const { data: existing } = await supabase
                    .from('salary_slips')
                    .select('*')
                    .eq('employee_id', emp.employee_id)
                    .eq('month', month)
                    .eq('year', year);

                if (!existing || existing.length === 0) {
                    const genReq = { body: { employee_id: emp.employee_id, month, year } };
                    const genRes = { json: (data) => results.push({ employee_id: emp.employee_id, ...data }), status: () => genRes };
                    await exports.generateSalarySlip(genReq, genRes);
                } else {
                    results.push({ employee_id: emp.employee_id, status: 'already_exists' });
                }
            } catch (empError) {
                results.push({ employee_id: emp.employee_id, status: 'failed', error: empError.message });
            }
        }

        res.json({
            success: true,
            message: 'Bulk salary slip generation completed',
            results
        });

    } catch (error) {
        console.error('Error generating bulk salary slips:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate bulk salary slips',
            error: error.message
        });
    }
};

// Mark salary as paid
exports.markAsPaid = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_mode, notes } = req.body;

        const { data, error } = await supabase
            .from('salary_slips')
            .update({
                is_paid: true,
                payment_date: new Date().toISOString().split('T')[0],
                payment_mode,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found'
            });
        }

        res.json({
            success: true,
            message: 'Salary marked as paid',
            salarySlip: data[0]
        });

    } catch (error) {
        console.error('Error marking salary as paid:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark salary as paid',
            error: error.message
        });
    }
};

// Delete salary slip
exports.deleteSalarySlip = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('salary_slips')
            .delete()
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found'
            });
        }

        res.json({
            success: true,
            message: 'Salary slip deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting salary slip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete salary slip',
            error: error.message
        });
    }
};

// Get salary statistics
exports.getSalaryStatistics = async (req, res) => {
    try {
        const { year, month } = req.query;

        let query = supabase
            .from('salary_slips')
            .select('*');

        if (year) {
            query = query.eq('year', year);
        }
        if (month) {
            query = query.eq('month', month);
        }

        const { data: slips, error } = await query;

        if (error) throw error;

        const totalEmployees = new Set(slips?.map(s => s.employee_id)).size;
        const totalSalary = slips?.reduce((sum, s) => sum + (parseFloat(s.net_salary) || 0), 0) || 0;
        const paidCount = slips?.filter(s => s.is_paid).length || 0;
        const unpaidCount = slips?.filter(s => !s.is_paid).length || 0;

        res.json({
            success: true,
            statistics: {
                total_employees: totalEmployees,
                total_slips: slips?.length || 0,
                total_salary: totalSalary.toFixed(2),
                paid_count: paidCount,
                unpaid_count: unpaidCount
            }
        });

    } catch (error) {
        console.error('Error fetching salary statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary statistics',
            error: error.message
        });
    }
};

// Update salary slip
exports.updateSalarySlip = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        delete updates.id;
        delete updates.employee_id;
        delete updates.generated_date;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('salary_slips')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found'
            });
        }

        res.json({
            success: true,
            message: 'Salary slip updated successfully',
            salarySlip: data[0]
        });

    } catch (error) {
        console.error('Error updating salary slip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update salary slip',
            error: error.message
        });
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// Salary Earned Adjustment — helpers + endpoints
// ══════════════════════════════════════════════════════════════════════════════

// Parse numeric shift hours from a string like "9:00 AM - 6:00 PM"
const parseShiftHours = (shiftTiming) => {
    try {
        if (!shiftTiming) return 8;
        const parts = shiftTiming.split('-').map(s => s.trim());
        if (parts.length < 2) return 8;
        const toMinutes = (str) => {
            const [time, period] = str.trim().split(' ');
            let [h, m] = (time || '').split(':').map(Number);
            h = h || 0; m = m || 0;
            if ((period || '').toUpperCase() === 'PM' && h !== 12) h += 12;
            if ((period || '').toUpperCase() === 'AM' && h === 12) h = 0;
            return h * 60 + m;
        };
        const diff = toMinutes(parts[1]) - toMinutes(parts[0]);
        return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 8;
    } catch { return 8; }
};

// Core adjustment calculation — mirrors frontend live calc exactly
const calcAdjustment = (monthlySalary, salaryEarned, totalWorkingDays, shiftHours) => {
    const monthly  = parseFloat(monthlySalary)    || 0;
    const earned   = parseFloat(salaryEarned) >= 0 ? parseFloat(parseFloat(salaryEarned).toFixed(2)) : monthly;
    const wDays    = parseFloat(totalWorkingDays)  || 22;
    const sHours   = parseFloat(shiftHours)        || 8;

    const difference = parseFloat((earned - monthly).toFixed(2));

    let adjOvertimeAmount  = 0;
    let adjDeductionAmount = 0;
    if (difference > 0)      adjOvertimeAmount  = parseFloat(difference.toFixed(2));
    else if (difference < 0) adjDeductionAmount = parseFloat(Math.abs(difference).toFixed(2));

    const perDaySalary    = wDays  > 0 ? monthly / wDays  : 0;
    const perHourSalary   = sHours > 0 ? perDaySalary / sHours : 0;
    const adjOvertimeHours = perHourSalary > 0
        ? parseFloat((adjOvertimeAmount / perHourSalary).toFixed(2))
        : 0;

    const finalPayableSalary = parseFloat(
        Math.max(0, monthly + adjOvertimeAmount - adjDeductionAmount).toFixed(2)
    );

    return {
        salary_earned:        parseFloat(earned.toFixed(2)),
        earned_difference:    difference,
        adj_overtime_amount:  adjOvertimeAmount,
        adj_overtime_hours:   adjOvertimeHours,
        adj_deduction_amount: adjDeductionAmount,
        final_payable_salary: finalPayableSalary,
    };
};

// POST /api/salary/adjustment — save salary earned OR overtime for one employee + month
exports.saveSalaryAdjustment = async (req, res) => {
    try {
        const { employee_id, month, year, salary_earned, shift_hours, overtime_amount } = req.body;

        if (!employee_id || !month || !year) {
            return res.status(400).json({ success: false, message: 'employee_id, month and year are required' });
        }

        // ── OT-DIRECT MODE ───────────────────────────────────────────────────────
        // When overtime_amount is passed directly (₹150/hr rate),
        // we bypass the salary_earned→diff calculation and update OT fields only.
        if (overtime_amount !== undefined) {
            const otAmount = Math.max(0, parseFloat(overtime_amount) || 0);
            const otHours  = parseFloat((otAmount / 150).toFixed(2));

            const employee = await getEmployeeDetails(employee_id);
            if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
            const monthlySalary = parseFloat(employee.in_hand_salary || employee.gross_salary || employee.salary || 0);
            const isPFApplicableOT = parseInt(year) > 2026 || (parseInt(year) === 2026 && parseInt(month) >= 5);
            const pfAmountOT = isPFApplicableOT ? (employee.pf_amount != null ? parseInt(employee.pf_amount) : 1800) : 0;
            const ptAmountOT = isPFApplicableOT ? (employee.pt_amount != null ? parseInt(employee.pt_amount) : 0) : 0;
            const professionalTaxAmountOT = isPFApplicableOT ? (employee.professional_tax_amount != null ? parseInt(employee.professional_tax_amount) : 0) : 0;
            const dt = monthlySalary > 0 ? (isPFApplicableOT ? pfAmountOT + ptAmountOT + professionalTaxAmountOT : 200) : 0;

            // Use limit(1) to avoid maybeSingle() error when duplicate rows exist
            const { data: slipRows } = await supabase
                .from('salary_slips')
                .select('id, basic_salary, net_salary')
                .eq('employee_id', employee_id)
                .eq('month', parseInt(month))
                .eq('year',  parseInt(year))
                .order('generated_date', { ascending: false })
                .limit(1);
            const existingSlip = slipRows?.[0] || null;

            const basicSalary = parseFloat(existingSlip?.basic_salary || 0);
            const netSalary   = parseFloat(Math.max(0, basicSalary + otAmount - dt).toFixed(2));

            const otPayload = {
                overtime_amount: otAmount,
                overtime_hours:  otHours,
                net_salary:      netSalary,
                updated_at:      new Date().toISOString(),
            };

            let resultSlip;
            if (existingSlip) {
                const { data, error } = await supabase
                    .from('salary_slips')
                    .update(otPayload)
                    .eq('id', existingSlip.id)
                    .select()
                    .single();
                if (error) throw error;
                resultSlip = data;
            } else {
                // No slip yet — create a minimal stub so OT is persisted
                const cycle = getCycleDates(parseInt(month), parseInt(year));
                const totalWD = calculateWorkingDaysInCycle(cycle.startDate, cycle.endDate);
                const { data, error } = await supabase
                    .from('salary_slips')
                    .insert([{
                        employee_id,
                        month:              parseInt(month),
                        year:               parseInt(year),
                        cycle_start_date:   cycle.startDateStr,
                        cycle_end_date:     cycle.endDateStr,
                        monthly_salary:     monthlySalary,
                        total_working_days: totalWD,
                        per_day_salary:     totalWD > 0 ? parseFloat((monthlySalary / totalWD).toFixed(2)) : 0,
                        present_days:       0,
                        half_days:          0,
                        absent_days:        0,
                        paid_leave_days:    0,
                        unpaid_leave_days:  0,
                        unpaid_deduction:   0,
                        basic_salary:       0,
                        overtime_amount:    otAmount,
                        overtime_hours:     otHours,
                        dt,
                        net_salary:         netSalary,
                        is_paid:            false,
                        generated_date:     new Date().toISOString(),
                    }])
                    .select()
                    .single();
                if (error) throw error;
                resultSlip = data;
            }

            return res.json({
                success: true,
                message: `Overtime ₹${otAmount} (${otHours} hrs) saved`,
                salarySlip: resultSlip,
            });
        }
        // ── END OT-DIRECT MODE ───────────────────────────────────────────────────
        if (salary_earned !== undefined && parseFloat(salary_earned) < 0) {
            return res.status(400).json({ success: false, message: 'Salary earned cannot be negative' });
        }

        const employee = await getEmployeeDetails(employee_id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const monthlySalary = parseFloat(employee.in_hand_salary || employee.gross_salary || employee.salary || 0);
        const resolvedShiftHours = parseFloat(shift_hours) > 0
            ? parseFloat(shift_hours)
            : parseShiftHours(employee.shift_timing);

        // Get existing slip for working days
        const { data: existingSlip } = await supabase
            .from('salary_slips')
            .select('id, total_working_days')
            .eq('employee_id', employee_id)
            .eq('month', parseInt(month))
            .eq('year',  parseInt(year))
            .maybeSingle();

        const cycle = getCycleDates(parseInt(month), parseInt(year));
        const totalWorkingDays = existingSlip?.total_working_days
            || calculateWorkingDaysInCycle(cycle.startDate, cycle.endDate);

        const earnedValue = salary_earned !== undefined && salary_earned !== ''
            ? parseFloat(salary_earned)
            : monthlySalary;

        const adj = calcAdjustment(monthlySalary, earnedValue, totalWorkingDays, resolvedShiftHours);

        // Calculate absent days implied by the deduction (deduction ÷ per-day rate)
        const perDaySalary = totalWorkingDays > 0 ? monthlySalary / totalWorkingDays : 0;
        const impliedAbsentDays = adj.adj_deduction_amount > 0 && perDaySalary > 0
            ? Math.round(adj.adj_deduction_amount / perDaySalary)
            : 0;

        const isPFApplicableAdj = parseInt(year) > 2026 || (parseInt(year) === 2026 && parseInt(month) >= 5);
        const pfAmountAdj = isPFApplicableAdj ? (employee.pf_amount != null ? parseInt(employee.pf_amount) : 1800) : 0;
        const ptAmountAdj = isPFApplicableAdj ? (employee.pt_amount != null ? parseInt(employee.pt_amount) : 0) : 0;
        const professionalTaxAmountAdj = isPFApplicableAdj ? (employee.professional_tax_amount != null ? parseInt(employee.professional_tax_amount) : 0) : 0;
        const fixedDeductions = monthlySalary > 0 ? (isPFApplicableAdj ? pfAmountAdj + ptAmountAdj + professionalTaxAmountAdj : 200) : 0;

        // basic_salary = what the employee earned (before fixed deductions)
        // For OT case:  earned(49900) - OT(1900) = monthly(48000) ← base pay
        // For short case: earned(41350) - 0 = 41350 ← reduced pay
        const adjBasicSalary = parseFloat((adj.salary_earned - adj.adj_overtime_amount).toFixed(2));
        const adjNetSalary   = parseFloat(Math.max(0, adj.salary_earned - fixedDeductions).toFixed(2));

        // Core payload — only uses columns that always exist in salary_slips
        // NOTE: absent_days is NOT included here — it stays from generateSalarySlip (attendance-based)
        const corePayload = {
            basic_salary:     adjBasicSalary,
            net_salary:       adjNetSalary,
            overtime_amount:  adj.adj_overtime_amount,
            overtime_hours:   adj.adj_overtime_hours,
            unpaid_deduction: 0,
            dt:               fixedDeductions,
            updated_at:       new Date().toISOString(),
        };

        // Extended payload — uses migration columns; silently skipped if migration not run
        const extPayload = {
            salary_earned:        adj.salary_earned,
            earned_difference:    adj.earned_difference,
            adj_overtime_amount:  adj.adj_overtime_amount,
            adj_overtime_hours:   adj.adj_overtime_hours,
            adj_deduction_amount: adj.adj_deduction_amount,
            final_payable_salary: adj.final_payable_salary,
            shift_hours:          resolvedShiftHours,
        };

        let resultSlip;

        if (existingSlip) {
            // Single combined update (core + extended adj_ columns) so the returned
            // resultSlip always reflects everything that was actually saved, instead of
            // core-only stale data from a separate first call. Falls back to core-only if
            // the extended migration columns don't exist yet on this DB.
            let { data, error } = await supabase
                .from('salary_slips')
                .update({ ...corePayload, ...extPayload })
                .eq('id', existingSlip.id)
                .select()
                .single();
            if (error && /does not exist|schema cache/i.test(error.message || '')) {
                ({ data, error } = await supabase
                    .from('salary_slips')
                    .update(corePayload)
                    .eq('id', existingSlip.id)
                    .select()
                    .single());
            }
            if (error) throw error;
            resultSlip = data;
        } else {
            // No attendance-based slip yet — create a stub with adjustment only
            const totalWD = calculateWorkingDaysInCycle(cycle.startDate, cycle.endDate);
            const impliedPresentDays = Math.max(0, totalWD - impliedAbsentDays);
            const { data, error } = await supabase
                .from('salary_slips')
                .insert([{
                    employee_id,
                    month:              parseInt(month),
                    year:               parseInt(year),
                    cycle_start_date:   cycle.startDateStr,
                    cycle_end_date:     cycle.endDateStr,
                    monthly_salary:     monthlySalary,
                    total_working_days: totalWD,
                    per_day_salary:     totalWD > 0 ? parseFloat((monthlySalary / totalWD).toFixed(2)) : 0,
                    present_days:       impliedPresentDays,
                    half_days:          0,
                    absent_days:        impliedAbsentDays,
                    paid_leave_days:    0,
                    unpaid_leave_days:  0,
                    unpaid_deduction:   0,
                    basic_salary:       adjBasicSalary,
                    overtime_hours:     adj.adj_overtime_hours,
                    overtime_amount:    adj.adj_overtime_amount,
                    dt:                 fixedDeductions,
                    net_salary:         adjNetSalary,
                    is_paid:            false,
                    generated_date:     new Date().toISOString(),
                }])
                .select()
                .single();
            if (error) throw error;
            resultSlip = data;
        }

        res.json({ success: true, message: 'Salary adjustment saved', salarySlip: resultSlip, adjustment: adj });

    } catch (error) {
        console.error('Error saving salary adjustment:', error?.message, error?.code, error?.details, error?.hint);
        res.status(500).json({
            success: false,
            message: 'Failed to save salary adjustment',
            error: error?.message,
            code: error?.code,
            details: error?.details,
        });
    }
};

// GET /api/salary/bulk?month=M&year=YYYY — all employees + their adjustment data
exports.getBulkPayroll = async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'month and year are required' });
        }

        const EMP_FIELDS_FULL = 'id, employee_id, first_name, last_name, designation, department, in_hand_salary, gross_salary, shift_timing, is_active, joining_date, reporting_manager, pf_amount, pt_amount, professional_tax_amount, exclude_from_payroll';
        const EMP_FIELDS_NO_PROF_EXCL = 'id, employee_id, first_name, last_name, designation, department, in_hand_salary, gross_salary, shift_timing, is_active, joining_date, reporting_manager, pf_amount, pt_amount';
        const EMP_FIELDS_BASE = 'id, employee_id, first_name, last_name, designation, department, in_hand_salary, gross_salary, shift_timing, is_active, joining_date, reporting_manager, pf_amount';

        // employees.professional_tax_amount / exclude_from_payroll / pt_amount may not be
        // migrated on this DB yet — cascading fallback so the page still loads either way.
        const fetchEmployees = async () => {
            let { data, error } = await supabase.from('employees').select(EMP_FIELDS_FULL)
                .eq('is_active', true).order('first_name', { ascending: true });
            if (error && /professional_tax_amount|exclude_from_payroll|does not exist/i.test(error.message || '')) {
                ({ data, error } = await supabase.from('employees').select(EMP_FIELDS_NO_PROF_EXCL)
                    .eq('is_active', true).order('first_name', { ascending: true }));
            }
            if (error && /pt_amount|does not exist/i.test(error.message || '')) {
                ({ data, error } = await supabase.from('employees').select(EMP_FIELDS_BASE)
                    .eq('is_active', true).order('first_name', { ascending: true }));
            }
            if (error) throw error;
            return data || [];
        };

        const [employees, { data: slips, error: slipErr }] = await Promise.all([
            fetchEmployees(),
            supabase
                .from('salary_slips')
                .select('*')
                .eq('month', parseInt(month))
                .eq('year',  parseInt(year)),
        ]);

        if (slipErr) throw slipErr;

        const slipMap = {};
        (slips || []).forEach(s => { slipMap[s.employee_id] = s; });

        const cycle = getCycleDates(parseInt(month), parseInt(year));
        const defaultWD = calculateWorkingDaysInCycle(cycle.startDate, cycle.endDate);

        // Attendance summary per employee for this cycle — reuses the exact same helpers
        // generateSalarySlip uses, so Payroll Preview numbers are guaranteed to match the
        // slip that would actually be generated (single source of truth, not a second calc).
        const attendanceByEmployee = {};
        await Promise.all(employees.map(async emp => {
            try {
                const joiningDate = emp.joining_date ? new Date(emp.joining_date) : null;
                const [attendanceRecords, leaveRecords] = await Promise.all([
                    getAttendanceRecords(emp.employee_id, cycle.startDateStr, cycle.endDateStr),
                    getApprovedLeaves(emp.employee_id, cycle.startDateStr, cycle.endDateStr),
                ]);
                attendanceByEmployee[emp.employee_id] = calculateAttendanceSummary(
                    attendanceRecords, leaveRecords, cycle.startDateStr, cycle.endDateStr, joiningDate
                );
            } catch (attErr) {
                console.error(`Error computing attendance summary for ${emp.employee_id}:`, attErr);
                attendanceByEmployee[emp.employee_id] = null;
            }
        }));

        const records = employees.map(emp => {
            const monthlySalary   = parseFloat(emp.in_hand_salary || emp.gross_salary || emp.salary || 0);
            const slip            = slipMap[emp.employee_id] || null;
            const totalWorkingDays = slip?.total_working_days || defaultWD;
            const shiftHours      = slip?.shift_hours || parseShiftHours(emp.shift_timing) || 8;
            const attendance      = attendanceByEmployee[emp.employee_id];

            let adj;
            if (slip?.salary_earned != null) {
                adj = calcAdjustment(monthlySalary, slip.salary_earned, totalWorkingDays, shiftHours);
            } else {
                // No manual adjustment yet — show defaults
                adj = {
                    salary_earned:        monthlySalary,
                    earned_difference:    0,
                    adj_overtime_amount:  0,
                    adj_overtime_hours:   0,
                    adj_deduction_amount: 0,
                    final_payable_salary: slip ? parseFloat(slip.net_salary || monthlySalary) : monthlySalary,
                };
            }

            return {
                id:                 emp.id,
                employee_id:        emp.employee_id,
                first_name:         emp.first_name,
                last_name:          emp.last_name,
                designation:        emp.designation || '',
                department:         emp.department  || '',
                reporting_manager:  emp.reporting_manager || '',
                monthly_salary:     monthlySalary,
                shift_hours:        shiftHours,
                total_working_days: totalWorkingDays,
                has_slip:           !!slip,
                slip_id:            slip?.id   || null,
                net_salary:         slip?.net_salary != null ? parseFloat(slip.net_salary) : null,
                is_paid:            slip?.is_paid || false,
                basic_salary:       slip?.basic_salary != null ? parseFloat(slip.basic_salary) : null,
                overtime_amount:    slip?.overtime_amount != null ? parseFloat(slip.overtime_amount) : 0,
                dt_deduction:       slip?.dt != null ? parseFloat(slip.dt) : null,
                custom_deduction:   slip?.custom_deduction != null ? parseFloat(slip.custom_deduction) : 0,
                cycle_start_date:   slip?.cycle_start_date || null,
                cycle_end_date:     slip?.cycle_end_date || null,
                generated_date:     slip?.generated_date || null,
                pf_amount:                emp.pf_amount != null ? parseFloat(emp.pf_amount) : null,
                pt_amount:                emp.pt_amount != null ? parseFloat(emp.pt_amount) : null,
                professional_tax_amount:  emp.professional_tax_amount != null ? parseFloat(emp.professional_tax_amount) : null,
                exclude_from_payroll:     Boolean(emp.exclude_from_payroll),
                present_days:       attendance ? attendance.presentDays : null,
                half_days:          attendance ? attendance.halfDays : null,
                absent_days:        attendance ? attendance.absentDays : null,
                paid_leave_days:    attendance ? attendance.paidLeaveDays : null,
                unpaid_leave_days:  attendance ? attendance.unpaidLeaveDays : null,
                ...adj,
            };
        });

        res.json({ success: true, month: parseInt(month), year: parseInt(year), records });

    } catch (error) {
        console.error('Error fetching bulk payroll:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payroll data', error: error.message });
    }
};