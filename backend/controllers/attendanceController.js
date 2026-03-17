// controllers/attendanceController.js
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { holidays } = require('../data/holidays');

// Generate unique session ID
const generateSessionId = () => {
    return uuidv4();
};

// Helper function to parse time string (e.g., "3:00 PM" or "15:00")
const parseTimeString = (timeStr) => {
    if (!timeStr) return null;

    console.log('Parsing time string:', timeStr);

    const parts = timeStr.split('-');
    let startTimeStr = timeStr;
    if (parts.length > 0) {
        startTimeStr = parts[0].trim();
    }

    let hour = 9, minute = 0;

    const ampmMatch = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (ampmMatch) {
        hour = parseInt(ampmMatch[1]);
        minute = parseInt(ampmMatch[2]);
        const ampm = ampmMatch[3].toUpperCase();

        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;

        return { hour, minute };
    }

    const militaryMatch = startTimeStr.match(/(\d{1,2}):(\d{2})/);
    if (militaryMatch) {
        hour = parseInt(militaryMatch[1]);
        minute = parseInt(militaryMatch[2]);
        return { hour, minute };
    }

    return { hour, minute };
};

// Parse shift timing to get total hours
const parseShiftTiming = (shiftString) => {
    if (!shiftString) {
        return {
            startHour: 9,
            startMinute: 0,
            endHour: 18,
            endMinute: 0,
            totalHours: 9
        };
    }

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

    let totalHours = endTime.hour - startTime.hour;
    if (totalHours < 0) totalHours += 24;
    totalHours += (endTime.minute - startTime.minute) / 60;

    return {
        startHour: startTime.hour,
        startMinute: startTime.minute,
        endHour: endTime.hour,
        endMinute: endTime.minute,
        totalHours: totalHours
    };
};

// Calculate overtime (only full hours count)
const calculateOvertime = (totalHours, shiftHours) => {
    const standardShiftHours = shiftHours || 9;
    
    // Only full hours above shift count as overtime
    // If totalHours = 10.2, overtime = 1 hour (only full hour above 9)
    // If totalHours = 10.8, overtime = 1 hour
    // If totalHours = 11.0, overtime = 2 hours
    const overtimeHours = Math.floor(Math.max(0, totalHours - standardShiftHours));
    const overtimeMinutes = overtimeHours * 60;
    
    return {
        overtimeHours,
        overtimeMinutes,
        hasOvertime: overtimeHours > 0,
        overtimeAmount: overtimeHours * 150 // ₹150 per hour
    };
};

// Check if a date is a holiday
const isHoliday = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { 
            isHoliday: true, 
            type: 'weekly_off',
            name: dayOfWeek === 0 ? 'Sunday' : 'Saturday'
        };
    }
    
    const holiday = holidays.find(h => h.date === dateStr);
    if (holiday) {
        return { 
            isHoliday: true, 
            type: 'public_holiday',
            name: holiday.name,
            region: holiday.region
        };
    }
    
    return { isHoliday: false };
};

// Clock in
exports.clockIn = async (req, res) => {
    try {
        console.log('='.repeat(70));
        console.log('📍 CLOCK-IN REQUEST');
        console.log('Time:', new Date().toISOString());
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(70));

        const { employee_id, latitude, longitude, accuracy } = req.body;

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id', employee_id);

        if (empError) throw empError;

        if (!employees || employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const emp = employees[0];
        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const currentTimeStr = now.toTimeString().split(' ')[0];
        const sessionId = generateSessionId();

        console.log('Employee:', emp.first_name, emp.last_name);
        console.log('Today date (LOCAL):', today);
        console.log('Clock in time:', now.toString());

        const holidayCheck = isHoliday(now);
        console.log('📅 Holiday check:', holidayCheck);

        let shiftHour = 9, shiftMinute = 0;
        let shiftDisplay = emp.shift_timing || '9:00 AM';

        if (emp.shift_timing) {
            const parsedTime = parseTimeString(emp.shift_timing);
            if (parsedTime) {
                shiftHour = parsedTime.hour;
                shiftMinute = parsedTime.minute;
            }
        }

        const shiftStartTime = new Date(now);
        shiftStartTime.setHours(shiftHour, shiftMinute, 0, 0);

        const diffMs = now - shiftStartTime;
        const isLate = diffMs > 0;
        const isEarly = diffMs < 0;
        const lateMinutes = isLate ? diffMs / (1000 * 60) : 0;
        const earlyMinutes = isEarly ? Math.abs(diffMs) / (1000 * 60) : 0;

        try {
            const { error: attendanceError } = await supabase
                .from('attendance')
                .insert([{
                    employee_id,
                    attendance_date: today,
                    clock_in: now.toISOString(),
                    late_minutes: lateMinutes,
                    early_minutes: earlyMinutes,
                    latitude,
                    longitude,
                    location_accuracy: accuracy,
                    session_id: sessionId,
                    shift_time_used: shiftDisplay,
                    is_holiday: holidayCheck.isHoliday,
                    holiday_name: holidayCheck.name || null
                }]);

            if (attendanceError) throw attendanceError;

            const { data: existingSession, error: checkError } = await supabase
                .from('attendance_sessions')
                .select('*')
                .eq('session_id', sessionId);

            if (checkError) throw checkError;

            if (existingSession && existingSession.length === 0) {
                const { error: sessionError } = await supabase
                    .from('attendance_sessions')
                    .insert([{
                        employee_id,
                        session_id: sessionId,
                        clock_in_time: now.toISOString(),
                        last_heartbeat: now.toISOString(),
                        is_active: true,
                        latitude,
                        longitude,
                        location_accuracy: accuracy
                    }]);

                if (sessionError) throw sessionError;
            } else {
                const { error: sessionError } = await supabase
                    .from('attendance_sessions')
                    .update({
                        last_heartbeat: now.toISOString(),
                        is_active: true,
                        latitude,
                        longitude,
                        location_accuracy: accuracy
                    })
                    .eq('session_id', sessionId);

                if (sessionError) throw sessionError;
            }

            let status = 'On Time';
            let message = '✅ Clocked in on time';
            let lateDisplay = null;
            let earlyDisplay = null;

            if (isLate) {
                status = 'Late';
                const lateSeconds = Math.round(lateMinutes * 60);

                if (lateSeconds < 60) {
                    lateDisplay = `${lateSeconds} second${lateSeconds !== 1 ? 's' : ''}`;
                } else {
                    const minutes = Math.floor(lateSeconds / 60);
                    const seconds = lateSeconds % 60;
                    lateDisplay = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
                }
                message = `⚠️ Clocked in (${lateDisplay} late)`;
            } else if (isEarly) {
                status = 'Early';
                const earlySeconds = Math.round(earlyMinutes * 60);

                if (earlySeconds < 60) {
                    earlyDisplay = `${earlySeconds} second${earlySeconds !== 1 ? 's' : ''}`;
                } else {
                    const minutes = Math.floor(earlySeconds / 60);
                    const seconds = earlySeconds % 60;
                    earlyDisplay = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
                }
                message = `⏰ Clocked in (${earlyDisplay} early)`;
            }

            if (holidayCheck.isHoliday) {
                message = `🏢 ${message} - Working on ${holidayCheck.name || holidayCheck.type}`;
            }

            const response = {
                success: true,
                message,
                clock_in: now,
                clock_in_time: currentTimeStr,
                shift_time: shiftDisplay,
                status,
                is_late: isLate,
                is_early: isEarly,
                session_id: sessionId,
                employee_name: `${emp.first_name} ${emp.last_name}`,
                attendance_date: today,
                is_holiday: holidayCheck.isHoliday,
                holiday_name: holidayCheck.name || null
            };

            if (isLate) {
                response.late_minutes = lateMinutes;
                response.late_display = lateDisplay;
            }
            if (isEarly) {
                response.early_minutes = earlyMinutes;
                response.early_display = earlyDisplay;
            }

            console.log('✅ Response:', response.message, 'for date:', today);
            res.json(response);

        } catch (error) {
            console.error('❌ Transaction error:', error);
            throw error;
        }

    } catch (error) {
        console.error('❌ Clock-in error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clock in',
            error: error.message
        });
    }
};

// Clock out with overtime calculation
exports.clockOut = async (req, res) => {
    try {
        console.log('='.repeat(70));
        console.log('📍 CLOCK-OUT REQUEST');
        console.log('Time:', new Date().toISOString());
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(70));

        const { employee_id, session_id, latitude, longitude, accuracy } = req.body;

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        if (!session_id) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required. Please clock in first.'
            });
        }

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        const holidayCheck = isHoliday(now);

        console.log(`🔍 Looking for active session: ${session_id} for employee: ${employee_id}`);
        console.log(`📅 Holiday check for ${today}:`, holidayCheck);

        try {
            const { data: activeSessions, error: sessionError } = await supabase
                .from('attendance_sessions')
                .select('*')
                .eq('session_id', session_id)
                .eq('employee_id', employee_id)
                .eq('is_active', true);

            if (sessionError) throw sessionError;

            console.log(`Found ${activeSessions?.length || 0} active sessions`);

            let session;
            let attendanceRecord;

            if (!activeSessions || activeSessions.length === 0) {
                const { data: fallbackSessions, error: fallbackError } = await supabase
                    .from('attendance_sessions')
                    .select('*')
                    .eq('employee_id', employee_id)
                    .eq('is_active', true)
                    .order('clock_in_time', { ascending: false })
                    .limit(1);

                if (fallbackError) throw fallbackError;

                if (!fallbackSessions || fallbackSessions.length === 0) {
                    console.log('❌ No active session found for employee:', employee_id);
                    return res.status(400).json({
                        success: false,
                        message: 'No active clock-in session found. Please clock in first.',
                        error_type: 'NO_ACTIVE_SESSION'
                    });
                }

                console.log('Using fallback session:', fallbackSessions[0].session_id);
                session = fallbackSessions[0];

                const { data: attendanceRecords, error: attendanceError } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', employee_id)
                    .eq('session_id', session.session_id)
                    .is('clock_out', null);

                if (attendanceError) throw attendanceError;

                if (!attendanceRecords || attendanceRecords.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No matching attendance record found for the active session.'
                    });
                }

                attendanceRecord = attendanceRecords[0];
            } else {
                session = activeSessions[0];
                console.log('✅ Found active session:', session);

                const { data: attendanceRecords, error: attendanceError } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', employee_id)
                    .eq('session_id', session_id)
                    .is('clock_out', null);

                if (attendanceError) throw attendanceError;

                if (!attendanceRecords || attendanceRecords.length === 0) {
                    const { data: fallbackAttendance, error: fallbackError } = await supabase
                        .from('attendance')
                        .select('*')
                        .eq('employee_id', employee_id)
                        .is('clock_out', null)
                        .order('clock_in', { ascending: false })
                        .limit(1);

                    if (fallbackError) throw fallbackError;

                    if (!fallbackAttendance || fallbackAttendance.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'No matching attendance record found for this session.'
                        });
                    }

                    attendanceRecord = fallbackAttendance[0];
                } else {
                    attendanceRecord = attendanceRecords[0];
                }
            }

            const clockIn = new Date(attendanceRecord.clock_in);
            const totalMs = now - clockIn;
            const totalHours = totalMs / (1000 * 60 * 60);
            const totalHoursRounded = Math.round(totalHours * 100) / 100;

            // Get employee shift timing to calculate overtime
            const { data: employee, error: empError } = await supabase
                .from('employees')
                .select('shift_timing')
                .eq('employee_id', employee_id)
                .single();

            if (empError) throw empError;

            const shiftTiming = parseShiftTiming(employee.shift_timing);
            const shiftHours = shiftTiming.totalHours || 9;

            const overtime = calculateOvertime(totalHoursRounded, shiftHours);

            console.log(`📊 Hours worked: ${totalHoursRounded}, Shift: ${shiftHours}h, Overtime: ${overtime.overtimeHours}h`);

            let compOffAwarded = false;
            let compOffDays = 0;

            if (holidayCheck.isHoliday && totalHoursRounded >= 8) {
                compOffAwarded = true;
                compOffDays = 1.0;
                
                console.log(`🎉 Employee worked on ${holidayCheck.type}: ${holidayCheck.name}. Awarding ${compOffDays} comp-off day!`);
                
                const { error: compOffError } = await supabase
                    .from('comp_off_earnings')
                    .insert([{
                        employee_id,
                        attendance_date: today,
                        holiday_name: holidayCheck.name || holidayCheck.type,
                        hours_worked: totalHoursRounded,
                        comp_off_days: compOffDays,
                        is_used: false
                    }]);

                if (compOffError) {
                    console.error('❌ Error inserting comp-off earning:', compOffError);
                } else {
                    const { error: updateError } = await supabase
                        .from('employees')
                        .update({
                            comp_off_balance: supabase.raw('comp_off_balance + ?', [compOffDays]),
                            total_comp_off_earned: supabase.raw('total_comp_off_earned + ?', [compOffDays])
                        })
                        .eq('employee_id', employee_id);

                    if (updateError) {
                        console.error('❌ Error updating comp-off balance:', updateError);
                    }
                }
            }

            // Save overtime earnings
            if (overtime.hasOvertime) {
                const { error: overtimeError } = await supabase
                    .from('overtime_earnings')
                    .insert([{
                        employee_id,
                        attendance_date: today,
                        overtime_minutes: overtime.overtimeMinutes,
                        overtime_hours: overtime.overtimeHours,
                        overtime_amount: overtime.overtimeAmount,
                        is_paid: false
                    }]);

                if (overtimeError) {
                    console.error('❌ Error inserting overtime earnings:', overtimeError);
                }
            }

            let status = 'present';
            if (totalHours < 4) {
                status = 'absent';
            } else if (totalHours < 8) {
                status = 'half_day';
            }

            const { error: updateAttendanceError } = await supabase
                .from('attendance')
                .update({
                    clock_out: now.toISOString(),
                    total_hours: totalHoursRounded,
                    status: status,
                    latitude: latitude || attendanceRecord.latitude,
                    longitude: longitude || attendanceRecord.longitude,
                    location_accuracy: accuracy || attendanceRecord.location_accuracy,
                    is_holiday: holidayCheck.isHoliday,
                    holiday_name: holidayCheck.name || null,
                    comp_off_awarded: compOffAwarded,
                    comp_off_days: compOffDays,
                    overtime_minutes: overtime.overtimeMinutes,
                    overtime_hours: overtime.overtimeHours,
                    overtime_amount: overtime.overtimeAmount
                })
                .eq('id', attendanceRecord.id);

            if (updateAttendanceError) throw updateAttendanceError;

            const { error: updateSessionError } = await supabase
                .from('attendance_sessions')
                .update({
                    is_active: false,
                    clock_out_time: now.toISOString()
                })
                .eq('id', session.id);

            if (updateSessionError) throw updateSessionError;

            console.log('✅ Clock-out successful');

            let message = '';
            if (compOffAwarded) {
                message = `✅ Clocked out successfully! 🎉 You earned ${compOffDays} Comp-Off day for working on ${holidayCheck.name || holidayCheck.type}!`;
            } else if (overtime.hasOvertime) {
                message = `✅ Clocked out successfully! You worked ${overtime.overtimeHours} hour(s) overtime! (₹${overtime.overtimeAmount})`;
            } else {
                message = `✅ Clocked out successfully. ${status === 'present' ? 'Full day' : status === 'half_day' ? 'Half day' : 'Absent'}`;
            }

            res.json({
                success: true,
                message,
                clock_out: now,
                total_hours: totalHoursRounded,
                status,
                session_id: session.session_id,
                comp_off_awarded: compOffAwarded,
                comp_off_days: compOffDays,
                holiday_worked: holidayCheck.isHoliday ? holidayCheck.name || holidayCheck.type : null,
                overtime: {
                    hours: overtime.overtimeHours,
                    minutes: overtime.overtimeMinutes,
                    amount: overtime.overtimeAmount,
                    hasOvertime: overtime.hasOvertime
                }
            });

        } catch (error) {
            throw error;
        }

    } catch (error) {
        console.error('❌ Clock-out error:', error);
        console.error('Error stack:', error.stack);

        res.status(500).json({
            success: false,
            message: 'Failed to clock out',
            error: error.message,
            error_type: 'SERVER_ERROR'
        });
    }
};

// Get today's attendance
exports.getTodayAttendance = async (req, res) => {
    try {
        const { employee_id } = req.params;
        
        console.log('📊 getTodayAttendance called with employee_id:', employee_id);

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        console.log('📊 Today date:', todayStr);

        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id', employee_id);

        if (empError) throw empError;

        if (!employees || employees.length === 0) {
            console.log('❌ Employee not found:', employee_id);
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const employee = employees[0];
        console.log('✅ Employee found:', employee.first_name, employee.last_name);

        const { data: todayAttendance, error: attendanceError } = await supabase
            .from('attendance')
            .select(`
                *,
                employees!inner(first_name, last_name, shift_timing, comp_off_balance)
            `)
            .eq('employee_id', employee_id)
            .eq('attendance_date', todayStr)
            .order('clock_in', { ascending: false })
            .limit(1);

        if (attendanceError) throw attendanceError;

        console.log('📊 Today attendance records found:', todayAttendance?.length || 0);

        const { data: activeSession, error: sessionError } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('is_active', true);

        if (sessionError) throw sessionError;
        
        console.log('📊 Active session found:', activeSession?.length || 0);

        let formattedAttendance = null;
        
        if (todayAttendance && todayAttendance.length > 0) {
            formattedAttendance = { ...todayAttendance[0] };
            
            if (formattedAttendance.employees) {
                formattedAttendance.first_name = formattedAttendance.employees.first_name;
                formattedAttendance.last_name = formattedAttendance.employees.last_name;
                formattedAttendance.shift_timing = formattedAttendance.employees.shift_timing;
                formattedAttendance.comp_off_balance = formattedAttendance.employees.comp_off_balance;
                delete formattedAttendance.employees;
            }
            
            if (formattedAttendance.late_minutes && formattedAttendance.late_minutes > 0) {
                const lateSeconds = Math.round(formattedAttendance.late_minutes * 60);
                formattedAttendance.late_display = lateSeconds < 60 ?
                    `${lateSeconds}s` :
                    `${Math.floor(lateSeconds / 60)}m ${lateSeconds % 60}s`;
            }
            
            if (formattedAttendance.clock_in && !formattedAttendance.clock_out) {
                const clockIn = new Date(formattedAttendance.clock_in);
                const now = new Date();
                const currentHours = (now - clockIn) / (1000 * 60 * 60);
                formattedAttendance.current_hours = currentHours.toFixed(2);
            }
            
            console.log('📊 Today\'s attendance:', {
                date: formattedAttendance.attendance_date,
                clock_in: formattedAttendance.clock_in ? 'Yes' : 'No',
                clock_out: formattedAttendance.clock_out ? 'Yes' : 'No',
                is_holiday: formattedAttendance.is_holiday,
                comp_off_awarded: formattedAttendance.comp_off_awarded,
                overtime_hours: formattedAttendance.overtime_hours
            });
        }

        const response = {
            success: true,
            attendance: formattedAttendance,
            active_session: activeSession && activeSession.length > 0 ? activeSession[0] : null,
            has_active_session: activeSession && activeSession.length > 0,
            today_date: todayStr
        };

        console.log('📊 Sending response for date:', todayStr);
        res.json(response);

    } catch (error) {
        console.error('❌ Error in getTodayAttendance:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error message:', error.message);
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get attendance',
            error: error.message
        });
    }
};

// Get attendance report with overtime
exports.getAttendanceReport = async (req, res) => {
    try {
        const { start, end, employee_id } = req.query;
        
        console.log('📊 Getting attendance report from', start, 'to', end, 'for employee:', employee_id);
        
        if (!start || !end) {
            console.log('❌ Missing start or end date');
            return res.status(400).json({
                success: false,
                message: 'Start and end dates are required'
            });
        }

        let query = supabase
            .from('attendance')
            .select(`
                *,
                employees (
                    first_name, 
                    last_name, 
                    department, 
                    shift_timing,
                    comp_off_balance
                )
            `)
            .gte('attendance_date', start)
            .lte('attendance_date', end);

        if (employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        query = query.order('attendance_date', { ascending: false });

        const { data: attendance, error: attendanceError } = await query;

        if (attendanceError) {
            console.error('❌ Attendance query error:', attendanceError);
            throw attendanceError;
        }

        console.log(`📊 Found ${attendance?.length || 0} attendance records`);

        const formattedAttendance = (attendance || []).map(record => {
            const employee = record.employees || {};
            
            return {
                id: record.id,
                employee_id: record.employee_id,
                attendance_date: record.attendance_date,
                clock_in: record.clock_in,
                clock_out: record.clock_out,
                total_hours: record.total_hours,
                status: record.status,
                late_minutes: record.late_minutes,
                early_minutes: record.early_minutes,
                shift_time_used: record.shift_time_used,
                is_holiday: record.is_holiday,
                holiday_name: record.holiday_name,
                comp_off_awarded: record.comp_off_awarded,
                comp_off_days: record.comp_off_days,
                overtime_minutes: record.overtime_minutes || 0,
                overtime_hours: record.overtime_hours || 0,
                overtime_amount: record.overtime_amount || 0,
                first_name: employee.first_name || '',
                last_name: employee.last_name || '',
                department: employee.department || '',
                shift_timing: employee.shift_timing || '',
                comp_off_balance: employee.comp_off_balance || 0,
                employees: undefined
            };
        });

        res.json({
            success: true,
            attendance: formattedAttendance,
            stats: {
                total: formattedAttendance.length,
                present: formattedAttendance.filter(a => a.status === 'present').length,
                half_day: formattedAttendance.filter(a => a.status === 'half_day').length,
                absent: formattedAttendance.filter(a => a.status === 'absent').length,
                comp_off_earned: formattedAttendance.filter(a => a.comp_off_awarded).length,
                total_overtime_hours: formattedAttendance.reduce((sum, a) => sum + (a.overtime_hours || 0), 0),
                total_overtime_amount: formattedAttendance.reduce((sum, a) => sum + (a.overtime_amount || 0), 0)
            }
        });

    } catch (error) {
        console.error('❌ Error in getAttendanceReport:', error);
        console.error('❌ Error details:', error);
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get attendance report',
            error: error.message,
            details: error.details || error.hint
        });
    }
};

// Heartbeat
exports.heartbeat = async (req, res) => {
    try {
        const { employee_id, session_id, latitude, longitude } = req.body;

        const { error } = await supabase
            .from('attendance_sessions')
            .update({
                last_heartbeat: new Date().toISOString(),
                latitude: latitude,
                longitude: longitude
            })
            .eq('employee_id', employee_id)
            .eq('session_id', session_id)
            .eq('is_active', true);

        if (error) throw error;

        res.json({ success: true, timestamp: new Date() });

    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ success: false, message: 'Heartbeat failed' });
    }
};

// Check active sessions
exports.checkActiveSessions = async () => {
    try {
        const { count: activeCount, error: countError } = await supabase
            .from('attendance_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (countError) throw countError;

        console.log(`📊 Active sessions: ${activeCount}`);

        const timeoutMinutes = 60;
        const timeoutDate = new Date();
        timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);

        const { data: inactiveSessions, error: inactiveError } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('is_active', true)
            .lt('last_heartbeat', timeoutDate.toISOString());

        if (inactiveError) throw inactiveError;

        for (const session of inactiveSessions || []) {
            console.log(`⚠️ Session ${session.session_id} for employee ${session.employee_id} has been inactive for ${timeoutMinutes}+ minutes`);
        }

        return {
            success: true,
            active: activeCount,
            inactive: inactiveSessions?.length || 0
        };

    } catch (error) {
        console.error('Error checking active sessions:', error);
        return { success: false, error: error.message };
    }
};

// Mark absent for employees who didn't punch in
exports.markAbsentAtDayEnd = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        console.log('📝 Running end-of-day absent marking for:', today);

        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('employee_id');

        if (empError) throw empError;

        let markedCount = 0;
        let updatedCount = 0;

        for (const emp of employees || []) {
            const { data: attendance, error: attError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', emp.employee_id)
                .eq('attendance_date', today);

            if (attError) throw attError;

            if (!attendance || attendance.length === 0) {
                const { error: insertError } = await supabase
                    .from('attendance')
                    .insert([{
                        employee_id: emp.employee_id,
                        attendance_date: today,
                        status: 'absent'
                    }]);

                if (insertError) throw insertError;
                markedCount++;
                console.log(`✅ Marked absent for employee ${emp.employee_id}`);
            }
            else if (attendance[0].clock_in && !attendance[0].clock_out) {
                const clockIn = new Date(attendance[0].clock_in);
                const totalHours = (now - clockIn) / (1000 * 60 * 60);
                
                const { error: updateError } = await supabase
                    .from('attendance')
                    .update({
                        status: 'half_day',
                        total_hours: totalHours
                    })
                    .eq('id', attendance[0].id);

                if (updateError) throw updateError;
                updatedCount++;
                console.log(`⚠️ Auto-marked half_day for employee ${emp.employee_id} (forgot to clock out)`);
            }
        }

        console.log(`✅ End-of-day absent marking completed. Marked ${markedCount} absent, updated ${updatedCount} half_day.`);
        return { success: true, message: `Marked ${markedCount} absent, ${updatedCount} half_day` };

    } catch (error) {
        console.error('Error marking absent:', error);
        return { success: false, error: error.message };
    }
};

// Get comp-off balance
exports.getCompOffBalance = async (req, res) => {
    try {
        const { employee_id } = req.params;
        
        const { data, error } = await supabase
            .from('employees')
            .select('comp_off_balance, total_comp_off_earned, total_comp_off_used')
            .eq('employee_id', employee_id)
            .single();

        if (error) throw error;

        res.json({
            success: true,
            comp_off_balance: data.comp_off_balance || 0,
            total_earned: data.total_comp_off_earned || 0,
            total_used: data.total_comp_off_used || 0
        });

    } catch (error) {
        console.error('Error fetching comp-off balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch comp-off balance',
            error: error.message
        });
    }
};

// Get comp-off history
exports.getCompOffHistory = async (req, res) => {
    try {
        const { employee_id } = req.params;
        
        const { data, error } = await supabase
            .from('comp_off_earnings')
            .select('*')
            .eq('employee_id', employee_id)
            .order('attendance_date', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            earnings: data || []
        });

    } catch (error) {
        console.error('Error fetching comp-off history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch comp-off history',
            error: error.message
        });
    }
};

// Get overtime summary
exports.getOvertimeSummary = async (req, res) => {
    try {
        const { employee_id, month, year } = req.params;
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const { data: overtime, error } = await supabase
            .from('overtime_earnings')
            .select('*')
            .eq('employee_id', employee_id)
            .gte('attendance_date', startDateStr)
            .lte('attendance_date', endDateStr)
            .order('attendance_date', { ascending: true });

        if (error) throw error;

        const totalMinutes = overtime?.reduce((sum, record) => sum + (record.overtime_minutes || 0), 0) || 0;
        const totalHours = overtime?.reduce((sum, record) => sum + (record.overtime_hours || 0), 0) || 0;
        const totalAmount = overtime?.reduce((sum, record) => sum + (record.overtime_amount || 0), 0) || 0;

        res.json({
            success: true,
            employee_id,
            month,
            year,
            overtime: overtime || [],
            summary: {
                total_days: overtime?.length || 0,
                total_minutes: totalMinutes,
                total_hours: totalHours,
                total_amount: totalAmount,
                average_per_day: overtime?.length > 0 ? (totalHours / overtime.length).toFixed(2) : 0
            }
        });

    } catch (error) {
        console.error('Error fetching overtime summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch overtime summary',
            error: error.message
        });
    }
};