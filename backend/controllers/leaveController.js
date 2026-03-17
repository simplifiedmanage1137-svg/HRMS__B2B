const LeaveYearlyService = require('../services/leaveYearlyService');
const supabase = require('../config/supabase');


// Get leave balance for employee
exports.getLeaveBalance = async (req, res) => {
    try {
        const { employee_id } = req.params;
        
        console.log('📊 Fetching leave balance for employee:', employee_id);

        // Get employee details first
        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('joining_date, comp_off_balance')
            .eq('employee_id', employee_id)
            .single();

        if (empError) throw empError;

        const joiningDate = new Date(employee.joining_date);
        const today = new Date();
        const currentYear = today.getFullYear();
        
        // Calculate months completed since joining
        let totalMonthsCompleted = (today.getFullYear() - joiningDate.getFullYear()) * 12;
        totalMonthsCompleted += (today.getMonth() - joiningDate.getMonth());
        
        if (today.getDate() < joiningDate.getDate()) {
            totalMonthsCompleted -= 1;
        }
        
        totalMonthsCompleted = Math.max(0, totalMonthsCompleted);
        
        // Check probation status (6 months)
        const isEligible = totalMonthsCompleted >= 6;
        
        // Calculate eligible from date
        const eligibleFromDate = new Date(joiningDate);
        eligibleFromDate.setMonth(eligibleFromDate.getMonth() + 6);
        const eligibleFromDateStr = eligibleFromDate.toISOString().split('T')[0];

        // Get or create leave balance for current year
        let { data: balance, error: balanceError } = await supabase
            .from('leave_balance')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('leave_year', currentYear)
            .maybeSingle();

        if (balanceError) throw balanceError;

        // If no balance for current year, create it
        if (!balance) {
            console.log(`📝 Creating new leave balance for ${employee_id} for year ${currentYear}`);
            
            // Calculate how many months in current year are completed
            const monthsInCurrentYear = today.getMonth() + 1; // Months from Jan to current month
            const daysInCurrentMonth = today.getDate();
            const lastDayOfMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();
            
            // Count completed months (full months only)
            let completedMonthsInYear = 0;
            if (daysInCurrentMonth === lastDayOfMonth) {
                // If it's the last day of month, count current month
                completedMonthsInYear = monthsInCurrentYear;
            } else {
                // Otherwise count previous months only
                completedMonthsInYear = Math.max(0, monthsInCurrentYear - 1);
            }
            
            // Calculate accrued leaves (1.5 per month)
            const totalAccrued = completedMonthsInYear * 1.5;
            
            // Get used leaves from current year
            const { data: usedLeaves, error: usedError } = await supabase
                .from('leaves')
                .select('days_count')
                .eq('employee_id', employee_id)
                .eq('status', 'approved')
                .in('leave_type', ['Annual', 'Sick', 'Personal', 'Maternity', 'Paternity', 'Bereavement'])
                .gte('start_date', `${currentYear}-01-01`)
                .lte('start_date', `${currentYear}-12-31`);

            if (usedError) throw usedError;

            const used = usedLeaves?.reduce((sum, leave) => sum + (leave.days_count || 0), 0) || 0;

            // Get pending leaves from current year
            const { data: pendingLeaves, error: pendingError } = await supabase
                .from('leaves')
                .select('days_count')
                .eq('employee_id', employee_id)
                .eq('status', 'pending')
                .gte('start_date', `${currentYear}-01-01`)
                .lte('start_date', `${currentYear}-12-31`);

            if (pendingError) throw pendingError;

            const pending = pendingLeaves?.reduce((sum, leave) => sum + (leave.days_count || 0), 0) || 0;

            // Calculate current balance
            const currentBalance = Math.max(0, totalAccrued - used - pending);

            // Insert new balance
            const { error: insertError } = await supabase
                .from('leave_balance')
                .insert([{
                    employee_id,
                    leave_year: currentYear,
                    total_accrued: totalAccrued,
                    total_used: used,
                    total_pending: pending,
                    current_balance: currentBalance,
                    last_updated: today.toISOString()
                }]);

            if (insertError) throw insertError;

            balance = {
                total_accrued: totalAccrued,
                total_used: used,
                total_pending: pending,
                current_balance: currentBalance
            };
        }

        // Get comp-off balance
        const compOffBalance = employee.comp_off_balance || 0;

        console.log('📊 Leave balance calculated:', {
            total_accrued: balance.total_accrued,
            used: balance.total_used,
            pending: balance.total_pending,
            available: balance.current_balance,
            monthsCompleted: totalMonthsCompleted,
            isEligible,
            compOffBalance,
            year: currentYear
        });

        res.json({
            success: true,
            total_accrued: (balance.total_accrued || 0).toFixed(1),
            used: (balance.total_used || 0).toFixed(1),
            pending: (balance.total_pending || 0).toFixed(1),
            available: (balance.current_balance || 0).toFixed(1),
            comp_off_balance: compOffBalance.toFixed(1),
            months_completed: totalMonthsCompleted,
            is_eligible: isEligible,
            eligible_from_date: eligibleFromDateStr,
            leave_year: currentYear
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

// Apply for leave
exports.applyLeave = async (req, res) => {
    try {
        console.log('='.repeat(50));
        console.log('📝 LEAVE APPLICATION');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(50));

        const {
            employee_id,
            leave_type,
            leave_duration,
            half_day_type,
            start_date,
            end_date,
            reason,
            days_count,
            reporting_manager
        } = req.body;

        // Validation
        if (!employee_id || !leave_type || !start_date || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Get employee details
        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('joining_date, comp_off_balance')
            .eq('employee_id', employee_id)
            .single();

        if (empError) throw empError;

        // Calculate months completed
        const joiningDate = new Date(employee.joining_date);
        const today = new Date();
        
        let monthsCompleted = (today.getFullYear() - joiningDate.getFullYear()) * 12;
        monthsCompleted += (today.getMonth() - joiningDate.getMonth());
        
        if (today.getDate() < joiningDate.getDate()) {
            monthsCompleted -= 1;
        }
        
        monthsCompleted = Math.max(0, monthsCompleted);
        const isEligible = monthsCompleted >= 6;

        // Check leave balance for non-Unpaid leaves
        if (leave_type !== 'Unpaid' && leave_type !== 'Comp-Off') {
            if (!isEligible) {
                return res.status(400).json({
                    success: false,
                    message: 'You are not eligible for paid leaves during probation period. Only Unpaid Leave is available.'
                });
            }

            // Get current balance
            const { data: balanceData, error: balanceError } = await exports.getLeaveBalance({ params: { employee_id } });
            
            if (balanceError) throw balanceError;
            
            if (parseFloat(balanceData.available) < days_count) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient leave balance. Available: ${balanceData.available} days`
                });
            }
        }

        // Check comp-off balance
        if (leave_type === 'Comp-Off') {
            if ((employee.comp_off_balance || 0) < days_count) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient Comp-Off balance. Available: ${employee.comp_off_balance || 0} days`
                });
            }
        }

        // Insert leave record
        const { data: leaveData, error: leaveError } = await supabase
            .from('leaves')
            .insert([{
                employee_id,
                leave_type,
                leave_duration,
                half_day_type: half_day_type || null,
                start_date,
                end_date: end_date || start_date,
                reason,
                days_count: days_count || 1,
                reporting_manager,
                status: 'pending',
                applied_date: new Date().toISOString().split('T')[0]
            }])
            .select();

        if (leaveError) throw leaveError;

        console.log('✅ Leave applied successfully:', leaveData[0]);

        res.json({
            success: true,
            message: leave_type === 'Comp-Off' 
                ? 'Comp-Off request submitted successfully!' 
                : 'Leave request submitted successfully!',
            leave: leaveData[0]
        });

    } catch (error) {
        console.error('Error applying leave:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply leave',
            error: error.message
        });
    }
};


// Helper function to parse shift timing
const parseShiftTiming = (shiftString) => {
    // Default shift if not provided
    if (!shiftString) {
        return {
            startHour: 9,
            startMinute: 0,
            endHour: 18,
            endMinute: 0,
            totalHours: 9
        };
    }

    // Parse format like "9:00 AM - 6:00 PM" or "3:00 PM - 12:00 AM"
    const parts = shiftString.split('-');
    if (parts.length !== 2) {
        return {
            startHour: 9,
            startMinute: 0,
            endHour: 18,
            endMinute: 0,
            totalHours: 9
        };
    }

    const startPart = parts[0].trim();
    const endPart = parts[1].trim();

    const parseTime = (timeStr) => {
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return null;

        let hour = parseInt(match[1]);
        const minute = parseInt(match[2]);
        const ampm = match[3].toUpperCase();

        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;

        return { hour, minute };
    };

    const startTime = parseTime(startPart);
    const endTime = parseTime(endPart);

    if (!startTime || !endTime) {
        return {
            startHour: 9,
            startMinute: 0,
            endHour: 18,
            endMinute: 0,
            totalHours: 9
        };
    }

    // Calculate total hours
    let totalHours = endTime.hour - startTime.hour;
    if (totalHours < 0) totalHours += 24; // Handle overnight shifts
    totalHours += (endTime.minute - startTime.minute) / 60;

    return {
        startHour: startTime.hour,
        startMinute: startTime.minute,
        endHour: endTime.hour,
        endMinute: endTime.minute,
        totalHours: totalHours
    };
};

// Validate half-day based on shift and working hours - 5 HOURS RULE
const validateHalfDay = async (employee_id, leaveDate, halfDayType, shiftTiming) => {
    try {
        const date = new Date(leaveDate);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        // Get attendance/working hours for this employee on this date
        const { data: attendance, error: attError } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('attendance_date', leaveDate);

        if (attError) throw attError;

        let hoursWorked = 0;
        let clockIn = null;
        let clockOut = null;

        if (attendance && attendance.length > 0) {
            // Calculate actual hours worked
            if (attendance[0].clock_in && attendance[0].clock_out) {
                const clockInTime = new Date(attendance[0].clock_in);
                const clockOutTime = new Date(attendance[0].clock_out);
                hoursWorked = (clockOutTime - clockInTime) / (1000 * 60 * 60);
            }
        }

        // Calculate total shift hours
        const totalShiftHours = shiftTiming.totalHours;

        // MINIMUM REQUIRED HOURS FOR HALF-DAY VALIDITY = 5 HOURS
        const MINIMUM_REQUIRED_HOURS = 5;

        let requiredHours = 0;
        let remainingHalf = '';

        if (halfDayType === 'First Half') {
            // Taking first half off, must work second half
            remainingHalf = 'Second Half';
            requiredHours = MINIMUM_REQUIRED_HOURS;
        } else if (halfDayType === 'Second Half') {
            // Taking second half off, must work first half
            remainingHalf = 'First Half';
            requiredHours = MINIMUM_REQUIRED_HOURS;
        }

        console.log('Half-day validation (5-hour rule):', {
            halfDayType,
            remainingHalf,
            requiredHours: requiredHours.toFixed(1),
            hoursWorked: hoursWorked.toFixed(1),
            shiftTiming,
            totalShiftHours: totalShiftHours.toFixed(1)
        });

        // Check if employee worked enough hours (at least 5 hours) in the remaining half
        if (hoursWorked >= requiredHours) {
            return {
                valid: true,
                message: `Valid half-day leave. You worked ${hoursWorked.toFixed(1)} hours in the ${remainingHalf} (minimum 5 hours required).`
            };
        } else {
            return {
                valid: false,
                message: `Insufficient work hours. You only worked ${hoursWorked.toFixed(1)} hours in the ${remainingHalf}. Minimum 5 hours required for half-day. Converting to full day.`
            };
        }

    } catch (error) {
        console.error('Error validating half-day:', error);
        return {
            valid: false,
            message: 'Unable to validate work hours. Converting to full day for compliance.'
        };
    }
};


// Get leaves
exports.getLeaves = async (req, res) => {
    try {
        const { employee_id, role } = req.query;

        console.log('📋 Fetching leaves with params:', { employee_id, role });

        // Simple query first - just get leaves without join
        let query = supabase
            .from('leaves')
            .select('*');

        // Apply employee filter if needed
        if (role === 'employee' && employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        // Order by applied_date descending
        query = query.order('applied_date', { ascending: false });

        const { data: leaves, error } = await query;

        if (error) {
            console.error('❌ Error fetching leaves:', error);
            throw error;
        }

        console.log(`✅ Found ${leaves?.length || 0} leaves`);

        // If no leaves, return empty array
        if (!leaves || leaves.length === 0) {
            return res.json([]);
        }

        // Now get employee details for each leave
        const formattedLeaves = [];

        for (const leave of leaves) {
            try {
                // Fetch employee details for this leave
                const { data: employee, error: empError } = await supabase
                    .from('employees')
                    .select('first_name, last_name, department, designation')
                    .eq('employee_id', leave.employee_id)
                    .single();

                if (empError) {
                    console.warn(`⚠️ Could not fetch employee details for ${leave.employee_id}:`, empError.message);
                }

                formattedLeaves.push({
                    id: leave.id,
                    employee_id: leave.employee_id,
                    leave_type: leave.leave_type,
                    leave_duration: leave.leave_duration,
                    start_date: leave.start_date,
                    end_date: leave.end_date,
                    half_day_type: leave.half_day_type,
                    reason: leave.reason,
                    reporting_manager: leave.reporting_manager,
                    status: leave.status,
                    applied_date: leave.applied_date,
                    days_count: leave.days_count,
                    admin_comments: leave.admin_comments,
                    created_at: leave.created_at,
                    updated_at: leave.updated_at,
                    first_name: employee?.first_name || '',
                    last_name: employee?.last_name || '',
                    department: employee?.department || '',
                    designation: employee?.designation || ''
                });
            } catch (empErr) {
                console.error(`❌ Error processing leave ${leave.id}:`, empErr);
                formattedLeaves.push({
                    ...leave,
                    first_name: '',
                    last_name: '',
                    department: '',
                    designation: ''
                });
            }
        }

        res.json(formattedLeaves);

    } catch (error) {
        console.error('❌ Error in getLeaves:', error);
        console.error('Error details:', error);
        
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching leaves',
            error: error.message
        });
    }
};

// Update leave status (Admin only)
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        if (!status || !['approved', 'rejected', 'cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required'
            });
        }

        // Get leave details first
        const { data: leave, error: fetchError } = await supabase
            .from('leaves')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // Update leave status
        const { data, error } = await supabase
            .from('leaves')
            .update({
                status,
                approved_by: req.user?.employeeId || req.body.approved_by,
                approved_date: status === 'approved' ? new Date().toISOString().split('T')[0] : null,
                remarks: remarks || null
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        // If comp-off leave is approved, deduct from balance
        if (status === 'approved' && leave.leave_type === 'Comp-Off') {
            // Update employee's comp_off_balance
            const { error: updateError } = await supabase
                .from('employees')
                .update({
                    comp_off_balance: supabase.raw('comp_off_balance - ?', [leave.days_count]),
                    total_comp_off_used: supabase.raw('total_comp_off_used + ?', [leave.days_count])
                })
                .eq('employee_id', leave.employee_id);

            if (updateError) {
                console.error('Error updating comp-off balance:', updateError);
            } else {
                // Mark comp-off earnings as used
                const { error: markError } = await supabase
                    .from('comp_off_earnings')
                    .update({
                        is_used: true,
                        used_date: new Date().toISOString().split('T')[0],
                        used_leave_id: id
                    })
                    .eq('employee_id', leave.employee_id)
                    .eq('is_used', false)
                    .order('attendance_date')
                    .limit(leave.days_count);

                if (markError) {
                    console.error('Error marking comp-off as used:', markError);
                }
            }
        }

        console.log(`✅ Leave ${status}:`, data[0]);

        res.json({
            success: true,
            message: `Leave request ${status} successfully`,
            leave: data[0]
        });

    } catch (error) {
        console.error('Error updating leave status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update leave status',
            error: error.message
        });
    }
};

// Get leave types
exports.getLeaveTypes = async (req, res) => {
    try {
        const { employee_id } = req.query;
        
        let availableTypes = [
            { value: 'Unpaid', label: 'Unpaid Leave', icon: '💰' }
        ];
        
        if (employee_id) {
            // Get employee details to check comp-off balance
            const { data: employee, error } = await supabase
                .from('employees')
                .select('comp_off_balance')
                .eq('employee_id', employee_id)
                .single();
                
            if (!error && employee.comp_off_balance > 0) {
                availableTypes.unshift({ 
                    value: 'Comp-Off', 
                    label: `Comp-Off (${employee.comp_off_balance} days available)`, 
                    icon: '🎉' 
                });
            }
            
            // Check probation status for other leave types
            const { data: empData } = await supabase
                .from('employees')
                .select('joining_date')
                .eq('employee_id', employee_id)
                .single();
                
            if (empData) {
                const joiningDate = new Date(empData.joining_date);
                const today = new Date();
                
                let monthsCompleted = (today.getFullYear() - joiningDate.getFullYear()) * 12;
                monthsCompleted += (today.getMonth() - joiningDate.getMonth());
                
                if (today.getDate() < joiningDate.getDate()) {
                    monthsCompleted -= 1;
                }
                
                monthsCompleted = Math.max(0, monthsCompleted);
                
                if (monthsCompleted >= 6) {
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

// Manual accrual for testing
exports.manualAccrual = async (req, res) => {
    try {
        const { employee_id } = req.params;

        const result = await LeaveYearlyService.addMonthlyAccrual(employee_id);

        res.json(result);
    } catch (error) {
        console.error('Error in manual accrual:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add manual accrual',
            error: error.message
        });
    }
};

// Yearly reset (admin only)
exports.yearlyReset = async (req, res) => {
    try {
        const result = await LeaveYearlyService.resetAllForNewYear();
        res.json(result);
    } catch (error) {
        console.error('Error in yearly reset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset yearly leaves',
            error: error.message
        });
    }
};