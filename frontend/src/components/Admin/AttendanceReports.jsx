// src/components/Admin/AttendanceReports.jsx
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Badge, Form, Row, Col,
  Button, Spinner, Alert
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
  FaCalendarAlt,
  FaFileExcel,
  FaArrowLeft,
  FaArrowRight,
  FaSyncAlt,
  FaEye,
  FaClock,
  FaUmbrellaBeach,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaUserTie,
  FaVenusMars,
  FaUniversity,
  FaIdCard,
  FaMoon,
  FaTrophy,
  FaCheckCircle,
  FaInfoCircle
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import * as XLSX from 'xlsx';
import { holidays as holidayData } from '../../data/holidays';
import AttendanceImportPanel from './AttendanceImportPanel';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const getISTNow = () => new Date(Date.now() + IST_OFFSET_MS);
const getISTDateString = () => getISTNow().toISOString().split('T')[0];

const AttendanceReports = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('daily');
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getISTDateString());
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getISTNow().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(getISTNow().getFullYear());
  const [department, setDepartment] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [daysInMonth, setDaysInMonth] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('danger');

  const currentDate = getISTNow();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const months = [
    { value: 1, label: 'January', short: 'Jan' },
    { value: 2, label: 'February', short: 'Feb' },
    { value: 3, label: 'March', short: 'Mar' },
    { value: 4, label: 'April', short: 'Apr' },
    { value: 5, label: 'May', short: 'May' },
    { value: 6, label: 'June', short: 'Jun' },
    { value: 7, label: 'July', short: 'Jul' },
    { value: 8, label: 'August', short: 'Aug' },
    { value: 9, label: 'September', short: 'Sep' },
    { value: 10, label: 'October', short: 'Oct' },
    { value: 11, label: 'November', short: 'Nov' },
    { value: 12, label: 'December', short: 'Dec' }
  ];

  const years = [];
  for (let i = 2020; i <= currentYear + 1; i++) {
    years.push(i);
  }

  const PROFESSIONAL_TAX = 200;
  const OVERTIME_RATE = 150;

  // Replace the formatHours function with this corrected version
  const formatHours = (decimalHours) => {
    if (!decimalHours || decimalHours <= 0) return '-';

    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  // Add to your frontend components
  const isFullDay = (clockIn, clockOut, shiftHours = 9) => {
    if (!clockIn || !clockOut) return false;

    const clockInTime = new Date(clockIn);
    const clockOutTime = new Date(clockOut);
    const diffMs = clockOutTime - clockInTime;
    const diffMinutes = diffMs / (1000 * 60);
    const expectedMinutes = shiftHours * 60;

    return diffMinutes >= expectedMinutes;
  };

  const isHalfDay = (clockIn, clockOut, shiftHours = 9) => {
    if (!clockIn || !clockOut) return false;

    const clockInTime = new Date(clockIn);
    const clockOutTime = new Date(clockOut);
    const diffMs = clockOutTime - clockInTime;
    const diffMinutes = diffMs / (1000 * 60);
    const expectedMinutes = shiftHours * 60;

    return diffMinutes >= 300 && diffMinutes < expectedMinutes; // 5 hours to expected work hours
  };


  const formatLateDisplay = (lateMinutes) => {
    if (!lateMinutes || lateMinutes <= 0) return null;

    const totalSeconds = Math.round(lateMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || (hours === 0 && minutes === 0)) parts.push(`${seconds}s`);

    return parts.join(' ');
  };

  const parseDateTime = (datetime) => {
    if (!datetime) return null;
    if (datetime instanceof Date) return datetime;
    const value = String(datetime).trim();
    if (!value) return null;

    // Normalize space-separated datetime strings (common IST format from backend)
    let normalized = value;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      normalized = value.replace(' ', 'T');
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
      normalized = value.replace(' ', 'T');
    }

    const parsed = new Date(normalized);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatTime = (datetime) => {
    const parsed = parseDateTime(datetime);
    if (!parsed) return '—';
    return parsed.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatShortTime = (datetime) => {
    const parsed = parseDateTime(datetime);
    if (!parsed) return '-';
    return parsed.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    const parsed = parseDateTime(dateString);
    if (!parsed) return '-';
    return parsed.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  useEffect(() => {
    fetchAllEmployees();
  }, []);

  // Daily view: fetch when date or view changes — NOT dependent on allEmployees
  useEffect(() => {
    if (activeView === 'daily') {
      fetchDailyAttendance();
    }
  }, [activeView, selectedDate]);

  // Monthly view: fetch when month/year/dept/refreshKey changes, but only once employees are loaded
  useEffect(() => {
    if (activeView === 'monthly' && allEmployees.length > 0) {
      fetchMonthlyAttendance();
    }
  }, [activeView, selectedMonth, selectedYear, department, allEmployees, refreshKey]);

  const fetchAllEmployees = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.EMPLOYEES);
      setAllEmployees(response.data);
      const depts = ['all', ...new Set(response.data.map(emp => emp.department).filter(Boolean))];
      setDepartments(depts);
      setMessage('');
    } catch (error) {
      console.error('Error fetching employees:', error);
      setMessage('Failed to load employees');
      setMessageType('danger');
    }
  };

  const fetchDailyAttendance = async () => {
    try {
      setLoading(true);
      setMessage('');

      const url = `${API_ENDPOINTS.ATTENDANCE_REPORT}?start=${selectedDate}&end=${selectedDate}`;
      const response = await axios.get(url);

      const attendanceData = response.data.attendance || [];

      const dedupedMap = {};
      attendanceData.forEach(record => {
        const dateKey = record.attendance_date ? record.attendance_date.split('T')[0] : record.attendance_date;
        const key = `${record.employee_id}-${dateKey}`;
        const existing = dedupedMap[key];
        if (!existing) {
          dedupedMap[key] = record;
          return;
        }

        const existingClockOut = existing.clock_out || existing.clock_out_ist;
        const newClockOut = record.clock_out || record.clock_out_ist;
        if (newClockOut && !existingClockOut) {
          dedupedMap[key] = record;
        } else if (newClockOut && existingClockOut) {
          const existingMs = parseDateTime(existingClockOut)?.getTime() || 0;
          const newMs = parseDateTime(newClockOut)?.getTime() || 0;
          if (newMs > existingMs) dedupedMap[key] = record;
        }
      });

      // ✅ FIX: Real-time calculation for active sessions
      const processedAttendance = Object.values(dedupedMap).map(record => {
        // Parse clock in time
        const clockInStr = record.clock_in_ist || record.clock_in;
        let clockInTime = null;

        if (clockInStr && typeof clockInStr === 'string' && clockInStr.includes(' ')) {
          const [dp, tp] = clockInStr.split(' ');
          const [y, mo, d] = dp.split('-').map(Number);
          const [h, mi, s = 0] = tp.split(':').map(Number);
          clockInTime = new Date(y, mo - 1, d, h, mi, s);
        } else if (clockInStr) {
          clockInTime = new Date(clockInStr);
        }

        // ✅ CRITICAL FIX: Calculate real-time hours for active sessions (no clock_out)
        let totalMinutes = record.total_minutes || 0;
        let totalHours = record.total_hours || 0;
        let totalHoursDisplay = record.total_hours_display || '0h 0m';

        if (clockInTime && !record.clock_out && !record.clock_out_ist) {
          // Employee is still working - calculate real-time hours
          const now = new Date();
          let diffMinutes = Math.round((now - clockInTime) / (1000 * 60));

          // Handle negative (should not happen, but safe)
          if (diffMinutes < 0) diffMinutes += 24 * 60;

          totalMinutes = diffMinutes;
          totalHours = diffMinutes / 60;

          // Format display
          const hrs = Math.floor(diffMinutes / 60);
          const mins = diffMinutes % 60;
          totalHoursDisplay = `${hrs}h ${mins}m`;

          // Update record with real-time values
          record.total_hours = parseFloat(totalHours.toFixed(2));
          record.total_minutes = totalMinutes;
          record.total_hours_display = totalHoursDisplay;
          record.status = 'working';
        } else if (record.total_minutes) {
          // Already clocked out - use stored values
          const hrs = Math.floor(record.total_minutes / 60);
          const mins = record.total_minutes % 60;
          totalHoursDisplay = `${hrs}h ${mins}m`;
          record.total_hours_display = totalHoursDisplay;
        }

        record.late_minutes = Number(record.late_minutes) || 0;
        record.is_late = record.late_minutes > 0;

        // Determine status
        if (!record.status) {
          if (record.clock_in && !record.clock_out) {
            record.status = 'working';
          } else if (record.clock_in && record.clock_out) {
            if (totalMinutes >= 540) {
              record.status = 'present';
            } else if (totalMinutes >= 300) {
              record.status = 'half_day';
            } else {
              record.status = 'absent';
            }
          }
        }

        // Calculate late display
        if (record.late_minutes > 0) {
          const totalSeconds = Math.floor(record.late_minutes * 60);
          const hours = Math.floor(totalSeconds / 3600);
          const remainingSeconds = totalSeconds % 3600;
          const minutes = Math.floor(remainingSeconds / 60);
          const seconds = remainingSeconds % 60;

          const parts = [];
          if (hours > 0) parts.push(`${hours}h`);
          if (minutes > 0) parts.push(`${minutes}m`);
          if (seconds > 0 || (hours === 0 && minutes === 0)) parts.push(`${seconds}s`);
          record.late_display = parts.join(' ');
        } else {
          record.late_display = null;
        }

        return record;
      });

      // Merge with all active employees — those with no record for this date are marked absent
      const attendedIds = new Set(processedAttendance.map(r => r.employee_id));
      const absentStubs = allEmployees
        .filter(emp => (emp.status === 'active' || !emp.status) && !attendedIds.has(emp.employee_id))
        .map(emp => ({
          employee_id:    emp.employee_id,
          first_name:     emp.first_name,
          last_name:      emp.last_name,
          department:     emp.department,
          designation:    emp.designation,
          shift_time_used: emp.shift_timing || null,
          clock_in:       null,
          clock_out:      null,
          total_hours:    0,
          total_minutes:  0,
          late_minutes:   0,
          overtime_hours: 0,
          status:         'absent',
        }));

      const statusOrder = { present: 0, working: 1, half_day: 2, on_leave: 3, late: 4, absent: 5, weekend: 6, holiday: 7 };
      const allRecords = [...processedAttendance, ...absentStubs].sort((a, b) => {
        const ao = statusOrder[a.status] ?? 5;
        const bo = statusOrder[b.status] ?? 5;
        if (ao !== bo) return ao - bo;
        return (a.first_name || '').localeCompare(b.first_name || '');
      });

      setDailyAttendance(allRecords);

    } catch (error) {
      console.error('Error fetching daily attendance:', error);
      setMessage(error.response?.data?.message || 'Failed to load attendance');
      setMessageType('danger');
    } finally {
      setLoading(false);
    }
  };

  // Salary cycle: previous month 26th → selected month 25th
  // e.g. selected month=7 (July) → cycle: Jun 26 – Jul 25
  const getSalaryCycle = (month, year) => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const cycleStart = new Date(prevYear, prevMonth - 1, 26); // prev month 26th
    const cycleEnd   = new Date(year, month - 1, 25);         // selected month 25th
    return { cycleStart, cycleEnd };
  };

  const formatCycleLabel = (month, year) => {
    const { cycleStart, cycleEnd } = getSalaryCycle(month, year);
    const fmt = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(cycleStart)} – ${fmt(cycleEnd)}`;
  };

  const fetchMonthlyAttendance = async () => {
    try {
      setLoading(true);
      setMessage('');

      const { cycleStart, cycleEnd } = getSalaryCycle(selectedMonth, selectedYear);

      const formatLocalDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      const startDateStr = formatLocalDate(cycleStart);
      const endDateStr = formatLocalDate(cycleEnd);

      let url = `${API_ENDPOINTS.ATTENDANCE_REPORT}?start=${startDateStr}&end=${endDateStr}`;
      if (department !== 'all') url += `&department=${department}`;

      const response = await axios.get(url);
      const attendanceData = response.data.attendance || [];

      let leaveData = [];
      try {
        const leaveResponse = await axios.get(API_ENDPOINTS.LEAVES);
        leaveData = leaveResponse.data.filter(leave =>
          leave.status === 'approved' &&
          new Date(leave.end_date) >= cycleStart &&
          new Date(leave.start_date) <= cycleEnd
        );
      } catch (error) {
        console.log('Could not fetch leave data');
      }

      // Holidays across the cycle range (may span 2 calendar months)
      const cycleHolidays = holidayData.filter(holiday => {
        const hd = new Date(holiday.date);
        return hd >= cycleStart && hd <= cycleEnd;
      });

      const processedData = processMonthlyAttendance(
        attendanceData,
        allEmployees,
        leaveData,
        cycleHolidays,
        cycleStart,
        cycleEnd
      );

      setMonthlyAttendance(processedData);
      calculateMonthlyStatistics(processedData);

    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
      setMessage(error.response?.data?.message || 'Failed to load monthly attendance');
      setMessageType('danger');
    } finally {
      setLoading(false);
    }
  };

  const processMonthlyAttendance = (attendanceData, employees, leaveData, holidays, startDate, endDate) => {
    // Build total days in cycle
    const cycleDays = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      cycleDays.push(new Date(d));
    }
    const totalCycleDays = cycleDays.length;
    setDaysInMonth(totalCycleDays);

    const processedData = [];

    const attendanceMap = {};
    attendanceData.forEach(record => {
      if (record.attendance_date) {
        const dateStr = record.attendance_date.split('T')[0];
        if (dateStr && record.employee_id) {
          const key = `${record.employee_id}-${dateStr}`;
          attendanceMap[key] = record;
        }
      }
    });

    const leaveMap = {};
    leaveData.forEach(leave => {
      const leaveStart = new Date(leave.start_date);
      const leaveEnd = new Date(leave.end_date || leave.start_date);

      for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const key = `${leave.employee_id}-${dateStr}`;
        leaveMap[key] = {
          type: leave.leave_type,
          reason: leave.reason
        };
      }
    });

    const holidayMap = {};
    holidays.forEach(holiday => {
      const dateStr = holiday.date;
      holidayMap[dateStr] = {
        name: holiday.name,
        region: holiday.region
      };
    });

    let filteredEmployees = employees;
    if (department !== 'all') {
      filteredEmployees = employees.filter(emp => emp.department === department);
    }

    const today = new Date();

    filteredEmployees.forEach(employee => {
      // Get employee's shift timing to determine expected hours
      const shiftTiming = parseShiftTiming(employee.shift_timing);
      const expectedWorkHours = shiftTiming.totalHours || 9;
      const expectedWorkMinutes = expectedWorkHours * 60;

      cycleDays.forEach((currentDate, dayIndex) => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayStr}`;
        const day = dayIndex + 1;

        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = currentDate.toDateString() === new Date().toDateString();

        const attendanceKey = `${employee.employee_id}-${dateStr}`;
        const dayAttendance = attendanceMap[attendanceKey];
        const dayLeave = leaveMap[attendanceKey];
        const dayHoliday = holidayMap[dateStr];

        let status = 'absent';
        let statusBadge = 'danger';
        let statusIcon = '✗';
        let clockIn = null;
        let clockOut = null;
        let totalHours = 0;
        let lateMinutes = 0;
        let tooltip = 'Absent';
        let leaveType = null;
        let compOffAwarded = false;
        let compOffDays = 0;
        let overtimeHours = 0;
        let overtimeAmount = 0;

        // DB attendance has highest priority — Excel-imported data overrides holiday/weekend
        if (dayAttendance) {
          clockIn = dayAttendance.clock_in_ist || dayAttendance.clock_in;
          clockOut = dayAttendance.clock_out_ist || dayAttendance.clock_out;
          lateMinutes = dayAttendance.late_minutes || 0;
          compOffAwarded = dayAttendance.comp_off_awarded || false;
          compOffDays = dayAttendance.comp_off_days || 0;
          overtimeHours = dayAttendance.overtime_hours != null ? dayAttendance.overtime_hours : 0;
          overtimeAmount = dayAttendance.overtime_amount != null ? dayAttendance.overtime_amount : (overtimeHours * 150);

          const dbStatus = (dayAttendance.status || '').toLowerCase();
          const dbHours  = Number(dayAttendance.total_hours) || 0;
          totalHours = dbHours;

          // Special case: employee is actively working right now (not yet clocked out)
          if (clockIn && !clockOut && isToday) {
            let clockInTime;
            if (typeof clockIn === 'string' && clockIn.includes(' ')) {
              const [p, t] = clockIn.split(' ');
              const [yr, mo, dy] = p.split('-');
              const [hr, mn, sc] = t.split(':');
              clockInTime = new Date(yr, mo - 1, dy, hr, mn, sc || 0);
            } else {
              clockInTime = new Date(clockIn);
            }
            const liveMinutes = Math.round((new Date() - clockInTime) / (1000 * 60));
            totalHours = liveMinutes / 60;
            status = 'working'; statusBadge = 'info'; statusIcon = '✓';
            tooltip = `Working since ${formatShortTime(clockIn)}`;
            if (lateMinutes > 0) tooltip += ` | Late: ${formatLateDisplay(lateMinutes)}`;
            if (compOffAwarded)  tooltip += ` | Comp-Off Earned: ${compOffDays} day`;
            if (overtimeHours > 0) tooltip += ` | Overtime: ${overtimeHours}h (₹${overtimeAmount})`;
          } else {
            // DB status is the source of truth — covers both clock-in records and Excel imports.
            // Clock times are shown in the tooltip only; they never override the stored status.
            const statusDisplayMap = {
              present:  { status: 'present',  statusBadge: 'success',   statusIcon: '✓' },
              absent:   { status: 'absent',   statusBadge: 'danger',    statusIcon: '✗' },
              half_day: { status: 'half_day', statusBadge: 'warning',   statusIcon: 'HD' },
              on_leave: { status: 'on_leave', statusBadge: 'purple',    statusIcon: 'L'  },
              leave:    { status: 'on_leave', statusBadge: 'purple',    statusIcon: 'L'  },
              week_off: { status: 'weekend',  statusBadge: 'secondary', statusIcon: 'WO' },
              holiday:  { status: 'holiday',  statusBadge: 'warning',   statusIcon: '🎉' },
              comp_off: { status: 'comp_off', statusBadge: 'info',      statusIcon: 'CO' },
              working:  { status: 'present',  statusBadge: 'success',   statusIcon: '✓'  },
              missing:  { status: 'missing',  statusBadge: 'dark',      statusIcon: '⚠'  },
            };
            const mapped = statusDisplayMap[dbStatus];
            if (mapped) {
              status      = mapped.status;
              statusBadge = mapped.statusBadge;
              statusIcon  = mapped.statusIcon;
            }

            // Build tooltip — show clock times if available, otherwise use DB hours
            if (clockIn && clockOut) {
              tooltip = `In: ${formatShortTime(clockIn)} | Out: ${formatShortTime(clockOut)} | Hrs: ${dbHours}h`;
            } else if (clockIn) {
              tooltip = `In: ${formatShortTime(clockIn)} | No clock out`;
            } else {
              const h = dbHours ? ` (${dbHours}h)` : '';
              tooltip = status === 'present'  ? `Present${h}`
                      : status === 'absent'   ? 'Absent'
                      : status === 'half_day' ? `Half Day${h}`
                      : status === 'on_leave' ? 'On Leave'
                      : status === 'weekend'  ? 'Week Off'
                      : status === 'holiday'  ? 'Holiday'
                      : status === 'comp_off' ? 'Comp Off'
                      : status === 'missing'  ? 'Missing Clock-Out (auto-closed after 15h)'
                      : dbStatus;
            }
            if (lateMinutes > 0) tooltip += ` | Late: ${formatLateDisplay(lateMinutes)}`;
            if (compOffAwarded)  tooltip += ` | Comp-Off Earned: ${compOffDays} day`;
            if (overtimeHours > 0) tooltip += ` | Overtime: ${overtimeHours}h (₹${overtimeAmount})`;
          }
        }
        else if (isWeekend) {
          status = 'weekend';
          statusBadge = 'secondary';
          statusIcon = 'W';
          tooltip = 'Weekend (Saturday/Sunday)';
        }
        else if (dayHoliday) {
          status = 'holiday';
          statusBadge = 'warning';
          statusIcon = '🎉';
          tooltip = `Holiday: ${dayHoliday.name}`;
        }
        else if (dayLeave) {
          status = 'on_leave';
          statusBadge = 'purple';
          statusIcon = 'L';
          tooltip = `On Leave: ${dayLeave.type}`;
          leaveType = dayLeave.type;
        }

        processedData.push({
          id: `${employee.employee_id}-${dateStr}`,
          employee_id: employee.employee_id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          department: employee.department,
          date: dateStr,
          day,
          dayOfWeek,
          isWeekend,
          isToday,
          clock_in: clockIn,
          clock_out: clockOut,
          total_hours: totalHours.toFixed(1),
          status,
          statusBadge,
          statusIcon,
          late_minutes: lateMinutes,
          late_display: lateMinutes > 0 ? formatLateDisplay(lateMinutes) : null,
          is_late: lateMinutes > 0,
          tooltip,
          leave_type: leaveType,
          is_holiday: !!dayHoliday,
          holiday_name: dayHoliday?.name,
          comp_off_awarded: compOffAwarded,
          comp_off_days: compOffDays,
          overtime_hours: overtimeHours,
          overtime_amount: overtimeAmount
        });
      });
    });

    return processedData;
  };

  // Parse shift timing
  const parseShiftTiming = (shiftString) => {
    if (!shiftString) {
      return { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, totalHours: 9 };
    }
    const parts = shiftString.split('-');
    if (parts.length !== 2) {
      return { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, totalHours: 9 };
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
      return { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, totalHours: 9 };
    }

    const startTotalMinutes = (startTime.hour * 60) + startTime.minute;
    const endTotalMinutes = (endTime.hour * 60) + endTime.minute;
    let totalMinutes = endTotalMinutes - startTotalMinutes;
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    return {
      startHour: startTime.hour,
      startMinute: startTime.minute,
      endHour: endTime.hour,
      endMinute: endTime.minute,
      totalHours: totalMinutes / 60
    };
  };

  const calculateMonthlyStatistics = (data) => {
    const perEmployee = {};

    data.forEach(record => {
      if (!perEmployee[record.employee_id]) {
        perEmployee[record.employee_id] = {
          name: record.employee_name,
          present: 0,
          half_day: 0,
          absent: 0,
          on_leave: 0,
          working: 0,
          holiday: 0,
          weekend: 0,
          total_hours: 0,
          working_days_count: 0,
          avg_hours: 0,
          late_count: 0,
          total_late_minutes: 0,
          comp_off_count: 0,
          total_comp_off_days: 0,
          overtime_hours: 0,
          overtime_minutes: 0,
          overtime_amount: 0,
          leave_types: []
        };
      }

      // Status counting logic
      if (record.status === 'present') {
        perEmployee[record.employee_id].present++;
      } else if (record.status === 'half_day') {
        perEmployee[record.employee_id].half_day++;
      } else if (record.status === 'absent') {
        perEmployee[record.employee_id].absent++;
      } else if (record.status === 'on_leave') {
        perEmployee[record.employee_id].on_leave++;
        if (record.leave_type) {
          perEmployee[record.employee_id].leave_types.push(record.leave_type);
        }
      } else if (record.status === 'working') {
        perEmployee[record.employee_id].working++;
      } else if (record.status === 'holiday') {
        perEmployee[record.employee_id].holiday++;
      } else if (record.status === 'weekend') {
        perEmployee[record.employee_id].weekend++;
      }

      // ✅ IMPORTANT: Add hours for present, half_day, and working days
      if (record.status === 'present' || record.status === 'working' || record.status === 'half_day') {
        perEmployee[record.employee_id].working_days_count++;

        // Parse total_hours - handle both number and string
        let hours = 0;
        if (record.total_hours) {
          hours = parseFloat(record.total_hours);
        } else if (record.total_hours_display) {
          // Parse from "Xh Ym" format
          const match = record.total_hours_display.match(/(\d+)h\s*(\d*)m?/);
          if (match) {
            hours = parseInt(match[1]) + (parseInt(match[2] || 0) / 60);
          }
        } else if (record.clock_in && record.clock_out) {
          // Calculate manually if needed
          const clockInTime = new Date(record.clock_in);
          let clockOutTime = new Date(record.clock_out);
          if (clockOutTime < clockInTime) {
            clockOutTime.setDate(clockOutTime.getDate() + 1);
          }
          const diffMinutes = (clockOutTime - clockInTime) / (1000 * 60);
          hours = diffMinutes / 60;
        }

        perEmployee[record.employee_id].total_hours += hours;
      }

      // Late counting
      if (record.is_late) {
        perEmployee[record.employee_id].late_count++;
        perEmployee[record.employee_id].total_late_minutes += record.late_minutes || 0;
      }

      // Comp-off counting
      if (record.comp_off_awarded) {
        perEmployee[record.employee_id].comp_off_count++;
        perEmployee[record.employee_id].total_comp_off_days += record.comp_off_days || 0;
      }

      // Overtime counting
      if (record.overtime_hours > 0) {
        perEmployee[record.employee_id].overtime_hours += record.overtime_hours;
        perEmployee[record.employee_id].overtime_minutes += record.overtime_minutes || 0;
        perEmployee[record.employee_id].overtime_amount += record.overtime_amount || 0;
      }
    });

    // Calculate averages
    Object.keys(perEmployee).forEach(empId => {
      const emp = perEmployee[empId];
      if (emp.working_days_count > 0) {
        emp.avg_hours = emp.total_hours / emp.working_days_count;
      } else {
        emp.avg_hours = 0;
      }

      if (emp.late_count > 0) {
        emp.avg_late_minutes = (emp.total_late_minutes / emp.late_count).toFixed(1);
        emp.late_display = formatLateDisplay(emp.total_late_minutes);
      } else {
        emp.avg_late_minutes = '0';
        emp.late_display = '0';
      }
      emp.unique_leave_types = [...new Set(emp.leave_types)];
    });

    setMonthlyStats(perEmployee);
  };

  const getLeaveBalance = async (employeeId) => {
    try {
      const response = await axios.get(API_ENDPOINTS.LEAVE_BALANCE(employeeId));
      return response.data.available || '0';
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      return '0';
    }
  };

  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    const today = getISTNow();
    setSelectedMonth(today.getMonth() + 1);
    setSelectedYear(today.getFullYear());
  };

  const getGender = (employee) => {
    return employee.gender || 'Not Specified';
  };

  const calculateSalary = (employee, overtimeAmount) => {
    const grossSalary = parseFloat(employee.gross_salary) || 0;
    const netSalaryAfterDeduction = grossSalary - PROFESSIONAL_TAX;
    const actualSalaryAfterOT = netSalaryAfterDeduction + (overtimeAmount || 0);

    return {
      grossSalary: grossSalary.toFixed(2),
      professionalTax: PROFESSIONAL_TAX,
      netSalaryAfterDeduction: netSalaryAfterDeduction.toFixed(2),
      overtimeAmount: overtimeAmount || 0,
      actualSalaryAfterOT: actualSalaryAfterOT.toFixed(2),
      netSalaryToPay: actualSalaryAfterOT.toFixed(2)
    };
  };

  const handleExportExcel = async () => {
    try {
      if (activeView === 'daily') {
        const exportDate = new Date(selectedDate);
        const formattedDate = exportDate.toLocaleDateString();

        const exportData = dailyAttendance.map((record, index) => ({
          'Sr No': index + 1,
          'Date': formattedDate,
          'Employee ID': record.employee_id,
          'Employee Name': `${record.first_name} ${record.last_name}`,
          'Department': record.department,
          'Shift': record.shift_time_used || 'Not set',
          'Clock In': record.clock_in ? formatShortTime(record.clock_in) : '-',
          'Clock Out': record.clock_out ? formatShortTime(record.clock_out) : '-',
          'Total Hours': record.total_hours ? formatHours(parseFloat(record.total_hours)) : '-',
          'Late Duration': record.late_display || '0',
          'Overtime Hours': record.overtime_hours || '0',
          'Overtime Amount': record.overtime_amount || '0',
          'Is Holiday': record.is_holiday ? 'Yes' : 'No',
          'Holiday Name': record.holiday_name || '-',
          'Comp-Off Earned': record.comp_off_awarded ? 'Yes' : 'No',
          'Comp-Off Days': record.comp_off_days || 0,
          'Status': record.status === 'present' ? 'Present' :
            record.status === 'half_day' ? 'Half Day' :
              record.status === 'working' ? 'Working' :
                record.status === 'on_leave' ? 'On Leave' :
                  record.status === 'holiday' ? 'Holiday' :
                    record.status === 'weekend' ? 'Weekend Off' : 'Absent'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const colWidths = [
          { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
          { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 },
          { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 12 },
          { wch: 10 }, { wch: 12 }
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Daily Attendance');
        XLSX.writeFile(wb, `Daily_Attendance_${selectedDate}.xlsx`);

        setMessage('Daily report exported successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);

      } else {
        const { cycleStart: cStart, cycleEnd: cEnd } = getSalaryCycle(selectedMonth, selectedYear);
        const cycleDaysExport = [];
        for (let d = new Date(cStart); d <= cEnd; d.setDate(d.getDate() + 1)) cycleDaysExport.push(new Date(d));
        const cycleLabel = formatCycleLabel(selectedMonth, selectedYear);
        const monthName = months.find(m => m.value === selectedMonth)?.label || 'Month';

        const exportData = [];

        const sortedEmployees = [...allEmployees].sort((a, b) => {
          if (department !== 'all') {
            if (a.department === department && b.department !== department) return -1;
            if (a.department !== department && b.department === department) return 1;
          }
          return (a.first_name || '').localeCompare(b.first_name || '');
        });

        for (const employee of sortedEmployees) {
          if (department !== 'all' && employee.department !== department) continue;

          const empRecords = monthlyAttendance.filter(r => r.employee_id === employee.employee_id);
          const empStats = monthlyStats[employee.employee_id] || {
            present: 0,
            half_day: 0,
            absent: 0,
            on_leave: 0,
            weekend: 0,
            late_count: 0,
            total_late_minutes: 0,
            comp_off_count: 0,
            total_comp_off_days: 0,
            overtime_hours: 0,
            overtime_amount: 0,
            avg_hours: 0,
            total_hours: 0
          };

          const leaveBalance = await getLeaveBalance(employee.employee_id);
          const salary = calculateSalary(employee, empStats.overtime_amount);

          const row = {
            'Employee Name': `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
            'Date of Joining': employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : 'N/A',
            'Leave Balance': leaveBalance,
          };

          cycleDaysExport.forEach((cycleDate, idx) => {
            const dayRecord = empRecords.find(r => r.day === idx + 1);
            const colLabel = cycleDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            let status = 'A';
            if (dayRecord) {
              if (dayRecord.status === 'present' || dayRecord.status === 'working') status = 'P';
              else if (dayRecord.status === 'half_day') status = 'HD';
              else if (dayRecord.status === 'on_leave') status = 'L';
              else if (dayRecord.status === 'holiday') status = 'H';
              else if (dayRecord.status === 'weekend') status = 'W-OFF';
              else status = 'A';
            } else {
              if (cycleDate.getDay() === 0 || cycleDate.getDay() === 6) status = 'W-OFF';
            }
            row[colLabel] = status;
          });

          row['Cycle Days'] = cycleDaysExport.length;
          row['Present Days'] = empStats.present || 0;
          row['Half Days'] = empStats.half_day || 0;
          row['Leave Days'] = empStats.on_leave || 0;
          row['Weekend Off'] = empStats.weekend || 0;
          row['Absent'] = empStats.absent || 0;
          row['Late Count'] = empStats.late_count || 0;
          row['Overtime Hours'] = empStats.overtime_hours || 0;
          row['Overtime Amount'] = empStats.overtime_amount || 0;
          row['Avg Hours/Day'] = empStats.avg_hours ? formatHours(empStats.avg_hours) : '0h';
          row['Gross Salary'] = salary.grossSalary;
          row['Professional Tax'] = salary.professionalTax;
          row['Net Salary'] = salary.netSalaryAfterDeduction;
          row['Net Salary To Pay'] = salary.netSalaryToPay;
          row['Account Number'] = employee.account_number || 'N/A';
          row['IFSC Code'] = employee.ifsc_code || 'N/A';
          row['Bank Name'] = employee.bank_account_name || 'N/A';

          exportData.push(row);
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        XLSX.writeFile(wb, `Attendance_${monthName}_${selectedYear}_Cycle.xlsx`);

        setMessage('Report exported successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setMessage('Failed to export data');
      setMessageType('danger');
    }
  };

  const getStatusBadge = (record) => {
    const lateDisplay = record.late_display || (record.late_minutes > 0 ? formatLateDisplay(record.late_minutes) : null);

    if (record.overtime_hours > 0) {
      return (
        <Badge bg="success" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#28a745' }}>
          <FaClock className="me-1" size={10} /> OT +{record.overtime_hours}h
        </Badge>
      );
    }

    if (record.comp_off_awarded) {
      return (
        <Badge bg="purple" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#9b59b6' }}>
          <FaTrophy className="me-1" size={10} /> Comp-Off +{record.comp_off_days}
        </Badge>
      );
    }

    if (record.status === 'working') {
      return record.is_late ?
        <Badge bg="warning" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#fd7e14' }}>
          Working (Late {lateDisplay})
        </Badge> :
        <Badge bg="info" className="px-2 py-1 text-nowrap">Working</Badge>;
    }
    if (record.status === 'present') {
      return record.is_late ?
        <Badge bg="warning" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#fd7e14' }}>
          Present (Late {lateDisplay})
        </Badge> :
        <Badge bg="success" className="px-2 py-1 text-nowrap">Present</Badge>;
    }
    if (record.status === 'half_day') return <Badge bg="warning" className="px-2 py-1 text-nowrap">Half Day</Badge>;
    if (record.status === 'on_leave') return <Badge bg="purple" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#6f42c1' }}>On Leave</Badge>;
    if (record.status === 'holiday') return <Badge bg="warning" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#ffc107' }}>Holiday</Badge>;
    if (record.status === 'weekend') return <Badge bg="secondary" className="px-2 py-1 text-nowrap"><FaMoon className="me-1" size={10} /> W-OFF</Badge>;
    return <Badge bg="secondary" className="px-2 py-1 text-nowrap">Absent</Badge>;
  };

  const isCurrentDate = (day) => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    return selectedMonth === todayMonth &&
      selectedYear === todayYear &&
      day === todayDay;
  };

  return (
    <div className="p-2 p-md-3 p-lg-4">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-3 gap-2">
        <h5 className="mb-0 d-flex align-items-center">
          <FaCalendarAlt className="me-2 text-primary" />
          Attendance Reports
        </h5>
        <small className="text-muted">
          {activeView === 'daily' ? 'Daily View' : `Salary Cycle: ${formatCycleLabel(selectedMonth, selectedYear)}`}
        </small>
      </div>

      {message && (
        <Alert variant={messageType} onClose={() => setMessage('')} dismissible className="mb-3 py-2">
          <small>{message}</small>
        </Alert>
      )}

      <div className="mb-3 border-bottom pb-2 d-flex flex-wrap gap-2">
        <Button
          variant={activeView === 'daily' ? 'primary' : 'light'}
          size="sm"
          onClick={() => setActiveView('daily')}
          className="me-1"
        >
          <FaEye className="me-1" size={12} /> Daily View
        </Button>
        <Button
          variant={activeView === 'monthly' ? 'primary' : 'light'}
          size="sm"
          onClick={() => setActiveView('monthly')}
        >
          <FaCalendarAlt className="me-1" size={12} /> Monthly Calendar
        </Button>
        <Button
          variant={activeView === 'import' ? 'primary' : 'light'}
          size="sm"
          onClick={() => setActiveView('import')}
        >
          <FaFileExcel className="me-1" size={12} /> Import
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          className="ms-auto"
          disabled={loading}
          onClick={() => activeView === 'daily' ? fetchDailyAttendance() : activeView === 'monthly' ? fetchMonthlyAttendance() : null}
          title="Refresh current view"
        >
          {loading
            ? <><Spinner animation="border" size="sm" style={{ width: 11, height: 11 }} className="me-1" /> Refreshing…</>
            : <><FaSyncAlt className="me-1" size={11} /> Refresh</>}
        </Button>
      </div>

      {activeView === 'import' ? (
        <AttendanceImportPanel
          employees={allEmployees}
          onMonthYearChange={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
          onImportSuccess={(m, y) => {
            setSelectedMonth(m);
            setSelectedYear(y);
            setActiveView('monthly');
            setRefreshKey(k => k + 1);
          }}
        />
      ) : activeView === 'daily' ? (
        <div className="d-flex flex-column flex-sm-row mb-3 gap-2 align-items-start align-items-sm-center">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => {
              const ist = getISTNow();
              ist.setDate(ist.getDate() - 1);
              setSelectedDate(ist.toISOString().split('T')[0]);
            }}
            className="text-nowrap"
          >
            <FaArrowLeft size={10} className="me-1" /> Yesterday
          </Button>
          <Form.Control
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            size="sm"
            style={{ maxWidth: '160px' }}
          />
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => setSelectedDate(getISTDateString())}
            className="text-nowrap"
            disabled={selectedDate === getISTDateString()}
          >
            Today
          </Button>
          <Button variant="success" size="sm" onClick={handleExportExcel} className="text-nowrap">
            <FaFileExcel className="me-2" size={12} /> Export
          </Button>
        </div>
      ) : (
        <div className="mb-3">
          <Row className="g-2">
            <Col xs={12} lg={8}>
              <div className="d-flex flex-wrap gap-2">
                <div className="d-flex">
                  <Button variant="outline-secondary" size="sm" onClick={handlePreviousMonth}>
                    <FaArrowLeft size={10} />
                  </Button>
                  <Form.Select
                    size="sm"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="mx-1"
                    style={{ width: '90px' }}
                  >
                    {months.map(m => <option key={m.value} value={m.value}>{m.short}</option>)}
                  </Form.Select>
                  <Form.Select
                    size="sm"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="me-1"
                    style={{ width: '75px' }}
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </Form.Select>
                  <Button variant="outline-secondary" size="sm" onClick={handleNextMonth}>
                    <FaArrowRight size={10} />
                  </Button>
                </div>

                <Button variant="outline-primary" size="sm" onClick={goToCurrentMonth} className="text-nowrap">
                  Current
                </Button>

                <Form.Select
                  size="sm"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  style={{ width: '130px' }}
                  className="text-truncate"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>
                      {dept === 'all' ? 'All Departments' : dept}
                    </option>
                  ))}
                </Form.Select>
              </div>
            </Col>

            <Col xs={12} lg={4}>
              <div className="d-flex gap-2 justify-content-start justify-content-lg-end">
                <Button variant="success" size="sm" onClick={handleExportExcel} className="w-50 w-lg-auto">
                  <FaFileExcel className="me-2" size={12} /> Export Report
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 gap-md-3 mb-3 small justify-content-center justify-content-md-start">
        <span className="d-flex align-items-center"><Badge bg="success" pill className="me-1">P</Badge> Present</span>
        <span className="d-flex align-items-center"><Badge bg="warning" pill className="me-1">HD</Badge> Half Day</span>
        <span className="d-flex align-items-center"><Badge bg="info" pill className="me-1">W</Badge> Working</span>
        <span className="d-flex align-items-center"><Badge bg="purple" pill style={{ backgroundColor: '#6f42c1' }} className="me-1">L</Badge> On Leave</span>
        <span className="d-flex align-items-center"><Badge bg="warning" pill style={{ backgroundColor: '#ffc107' }} className="me-1">H</Badge> Holiday</span>
        <span className="d-flex align-items-center"><Badge bg="secondary" pill className="me-1"><FaMoon className="me-1" size={10} /> W-OFF</Badge> Weekend</span>
        <span className="d-flex align-items-center"><Badge bg="secondary" pill className="me-1">A</Badge> Absent</span>
        <span className="d-flex align-items-center"><Badge bg="warning" pill style={{ backgroundColor: '#fd7e14' }} className="me-1">⚠️</Badge> Late</span>
        <span className="d-flex align-items-center"><Badge bg="success" pill style={{ backgroundColor: '#28a745' }} className="me-1"><FaClock className="me-1" size={10} /> OT</Badge> Overtime</span>
        <span className="d-flex align-items-center"><Badge bg="purple" pill style={{ backgroundColor: '#9b59b6' }} className="me-1"><FaTrophy className="me-1" size={10} /> Comp-Off</Badge> Comp-Off</span>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" size="sm" />
          <p className="mt-2 small text-muted">Loading attendance data...</p>
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-light py-2 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
            <h6 className="mb-0 fw-semibold small">
              {activeView === 'daily' ? 'Daily Attendance' : 'Monthly Attendance'}
            </h6>
            {activeView === 'daily' && (
              <div className="d-flex gap-2 ms-0 ms-sm-auto flex-wrap">
                <Badge bg="success" pill>
                  {dailyAttendance.filter(r => ['present','working','half_day'].includes(r.status)).length} Present
                </Badge>
                <Badge bg="danger" pill>
                  {dailyAttendance.filter(r => r.status === 'absent').length} Absent
                </Badge>
                <Badge bg="secondary" pill>
                  {dailyAttendance.length} Total
                </Badge>
              </div>
            )}
          </Card.Header>
          <Card.Body className="p-0">
            {activeView === 'daily' ? (
              <div className="table-responsive" style={{ maxHeight: '400px', overflow: 'auto' }}>
                <Table size="sm" striped className="mb-0">
                  <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                    <tr className="small">
                      <th className="text-dark fw-normal small text-center" style={{ width: '50px' }}>Sr No</th>
                      <th className="text-dark fw-normal small">Employee</th>
                      <th className="text-dark fw-normal small d-none d-sm-table-cell">Dept</th>
                      <th className="text-dark fw-normal small d-none d-md-table-cell">Shift</th>
                      <th className="text-dark fw-normal small">In</th>
                      <th className="text-dark fw-normal small">Late</th>
                      <th className="text-dark fw-normal small d-none d-lg-table-cell">Out</th>
                      <th className="text-dark fw-normal small d-none d-xl-table-cell">Hours</th>
                      <th className="text-dark fw-normal small d-none d-xl-table-cell">OT</th>
                      <th className="text-dark fw-normal small d-none d-xl-table-cell">Comp-Off</th>
                      <th className="text-dark fw-normal small">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyAttendance.length > 0 ? (
                      dailyAttendance.map((record, index) => {
                        // Calculate late display
                        const lateDisplay = record.late_display || (record.late_minutes > 0 ? formatLateDisplay(record.late_minutes) : null);

                        return (
                          <tr key={index} className={record.late_minutes > 0 ? 'table-warning' : ''}>
                            <td className="text-center small">{index + 1}</td>
                            <td className="small">
                              <div className="text-truncate" style={{ maxWidth: '100px' }} title={`${record.first_name} ${record.last_name}`}>
                                {record.first_name} {record.last_name}
                              </div>
                              <small className="text-muted text-truncate d-block" style={{ maxWidth: '100px' }} title={record.employee_id}>
                                {record.employee_id}
                              </small>
                            </td>
                            <td className="small d-none d-sm-table-cell">
                              <span className="text-truncate d-inline-block" style={{ maxWidth: '80px' }} title={record.department}>
                                {record.department}
                              </span>
                            </td>
                            <td className="small d-none d-md-table-cell">
                              <span className="text-nowrap">{record.shift_time_used || '-'}</span>
                            </td>
                            <td className={`small ${record.clock_in ? 'text-success' : 'text-muted'}`}>
                              <span className="text-nowrap" title={formatShortTime(record.clock_in)}>
                                {formatShortTime(record.clock_in) || '--:--'}
                              </span>
                            </td>
                            <td className="small">
                              {lateDisplay ? (
                                <Badge bg="warning" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#fd7e14' }}>
                                  <FaExclamationTriangle className="me-1" size={10} />
                                  {lateDisplay}
                                </Badge>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td className={`small d-none d-lg-table-cell ${record.clock_out ? 'text-danger' : 'text-muted'}`}>
                              <span className="text-nowrap" title={formatShortTime(record.clock_out)}>
                                {formatShortTime(record.clock_out) || '--:--'}
                              </span>
                            </td>
                            <td className="small d-none d-xl-table-cell">
                              {record.total_hours ? (
                                <span className="text-nowrap">
                                  {record.total_hours_display || formatHours(parseFloat(record.total_hours))}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="small d-none d-xl-table-cell">
                              {record.overtime_hours > 0 ? (
                                <Badge bg="success" pill className="text-nowrap">
                                  +{record.overtime_hours}h
                                </Badge>
                              ) : '-'}
                            </td>
                            <td className="small d-none d-xl-table-cell">
                              {record.comp_off_awarded ? (
                                <Badge bg="purple" pill className="text-nowrap" style={{ backgroundColor: '#9b59b6' }}>
                                  <FaTrophy className="me-1" size={8} /> +{record.comp_off_days}
                                </Badge>
                              ) : '-'}
                            </td>
                            <td className="small">
                              {record.status === 'present' ? (
                                <Badge bg="success" className="px-2 py-1 text-nowrap">
                                  <FaCheckCircle className="me-1" size={10} />
                                  Present
                                </Badge>
                              ) : record.status === 'working' ? (
                                <Badge bg="info" className="px-2 py-1 text-nowrap">Working</Badge>
                              ) : record.status === 'half_day' ? (
                                <Badge bg="warning" className="px-2 py-1 text-nowrap">Half Day</Badge>
                              ) : record.status === 'on_leave' ? (
                                <Badge bg="purple" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#6f42c1' }}>On Leave</Badge>
                              ) : record.status === 'holiday' ? (
                                <Badge bg="warning" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#ffc107' }}>Holiday</Badge>
                              ) : record.status === 'weekend' ? (
                                <Badge bg="secondary" className="px-2 py-1 text-nowrap">
                                  <FaMoon className="me-1" size={10} /> W-OFF
                                </Badge>
                              ) : record.status === 'late' ? (
                                <Badge bg="warning" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#fd7e14' }}>
                                  <FaExclamationTriangle className="me-1" size={10} />
                                  Late {lateDisplay}
                                </Badge>
                              ) : (
                                <Badge bg="secondary" className="px-2 py-1 text-nowrap">Absent</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="11" className="text-center py-4">No attendance records</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            ) : (() => {
                const { cycleStart, cycleEnd } = getSalaryCycle(selectedMonth, selectedYear);
                const cycleDateList = [];
                const cur = new Date(cycleStart);
                while (cur <= cycleEnd) { cycleDateList.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }

                const STATUS_CELL = {
                  present:  { bg: '#dcfce7', color: '#15803d', label: 'P'   },
                  working:  { bg: '#dbeafe', color: '#1d4ed8', label: 'W'   },
                  absent:   { bg: '#fee2e2', color: '#b91c1c', label: 'A'   },
                  half_day: { bg: '#fef9c3', color: '#a16207', label: 'HD'  },
                  on_leave: { bg: '#ede9fe', color: '#6d28d9', label: 'L'   },
                  holiday:  { bg: '#fef3c7', color: '#92400e', label: 'H'   },
                  weekend:  { bg: '#f1f5f9', color: '#64748b', label: 'W-OFF'},
                  comp_off: { bg: '#e0f2fe', color: '#0369a1', label: 'CO'  },
                };

                const empIds = Object.keys(monthlyStats);
                const totalP    = empIds.reduce((s, id) => s + (monthlyStats[id].present   || 0), 0);
                const totalA    = empIds.reduce((s, id) => s + (monthlyStats[id].absent    || 0), 0);
                const totalHD   = empIds.reduce((s, id) => s + (monthlyStats[id].half_day  || 0), 0);
                const totalL    = empIds.reduce((s, id) => s + (monthlyStats[id].on_leave  || 0), 0);
                const totalLate = empIds.reduce((s, id) => s + (monthlyStats[id].late_count|| 0), 0);

                const SUMMARY_COLS = [
                  { key: 'P',   label: 'P',    bg: '#dcfce7', color: '#15803d', title: 'Present',    val: e => e.present   || 0 },
                  { key: 'HD',  label: 'HD',   bg: '#fef9c3', color: '#a16207', title: 'Half Day',   val: e => e.half_day  || 0 },
                  { key: 'W',   label: 'W',    bg: '#dbeafe', color: '#1d4ed8', title: 'Working',    val: e => e.working   || 0 },
                  { key: 'L',   label: 'L',    bg: '#ede9fe', color: '#6d28d9', title: 'On Leave',   val: e => e.on_leave  || 0 },
                  { key: 'H',   label: 'H',    bg: '#fef3c7', color: '#92400e', title: 'Holiday',    val: e => e.holiday   || 0 },
                  { key: 'WO',  label: 'W-OFF',bg: '#f1f5f9', color: '#64748b', title: 'Weekend Off',val: e => e.weekend   || 0 },
                  { key: 'A',   label: 'A',    bg: '#fee2e2', color: '#b91c1c', title: 'Absent',     val: e => e.absent    || 0 },
                  { key: 'LT',  label: '⚠️',   bg: '#fff7ed', color: '#c2410c', title: 'Late',       val: e => e.late_count|| 0 },
                  { key: 'OT',  label: 'OT',   bg: '#f0fdf4', color: '#15803d', title: 'Overtime',   val: e => e.overtime_hours > 0 ? e.overtime_hours + 'h' : 0 },
                  { key: 'CO',  label: 'CO',   bg: '#e0f2fe', color: '#0369a1', title: 'Comp-Off',   val: e => e.comp_off_count|| 0 },
                ];

                return (
                  <>
                    {/* ── Summary strip ── */}
                    <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#374151' }}>{empIds.length}</div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>Employees</div>
                      </div>
                      {[
                        { label: 'Present',  value: totalP,    bg: '#dcfce7', color: '#15803d' },
                        { label: 'Half Day', value: totalHD,   bg: '#fef9c3', color: '#a16207' },
                        { label: 'Absent',   value: totalA,    bg: '#fee2e2', color: '#b91c1c' },
                        { label: 'On Leave', value: totalL,    bg: '#ede9fe', color: '#6d28d9' },
                        { label: 'Late',     value: totalLate, bg: '#fff7ed', color: '#c2410c' },
                      ].map(({ label, value, bg, color }) => (
                        <div key={label} style={{ background: bg, borderRadius: 8, padding: '5px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
                          <div style={{ fontSize: 10, color }}>{label}</div>
                        </div>
                      ))}
                      <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                        {formatCycleLabel(selectedMonth, selectedYear)}
                      </div>
                    </div>

                    {/* ── Date grid ── */}
                    <div style={{ overflowX: 'auto', maxHeight: '460px' }}>
                      <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb', borderRight: '2px solid #d1d5db', position: 'sticky', left: 0, top: 0, background: '#f9fafb', zIndex: 3, minWidth: 160, whiteSpace: 'nowrap' }}>
                              Employee
                            </th>
                            {cycleDateList.map((d, i) => {
                              const dn  = d.getDate();
                              const mon = d.toLocaleString('en-US', { month: 'short' });
                              const dow = ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()];
                              const isWknd  = d.getDay() === 0 || d.getDay() === 6;
                              const isToday = d.toDateString() === new Date().toDateString();
                              return (
                                <th key={i} style={{ padding: '3px 2px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #f3f4f6', minWidth: 30, position: 'sticky', top: 0, zIndex: 2, background: isToday ? '#1e40af' : isWknd ? '#eff6ff' : '#f9fafb' }}>
                                  <div style={{ color: isToday ? '#fff' : isWknd ? '#1d4ed8' : '#374151', fontSize: 11, fontWeight: 800, lineHeight: 1.1 }}>{dn}</div>
                                  <div style={{ color: isToday ? '#bfdbfe' : isWknd ? '#3b82f6' : '#9ca3af', fontSize: 9, lineHeight: 1.2 }}>{mon}</div>
                                  <div style={{ color: isToday ? '#93c5fd' : isWknd ? '#93c5fd' : '#d1d5db', fontSize: 9, lineHeight: 1.2 }}>{dow}</div>
                                </th>
                              );
                            })}
                            {/* Summary column headers */}
                            {SUMMARY_COLS.map(({ key, label, bg, color, title }) => (
                              <th key={key} title={title} style={{ padding: '4px 2px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', borderLeft: key === 'P' ? '2px solid #d1d5db' : '1px solid #f3f4f6', minWidth: 30, position: 'sticky', top: 0, zIndex: 2, background: bg }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color }}>{label}</span>
                              </th>
                            ))}
                            <th style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', borderLeft: '1px solid #e5e7eb', minWidth: 52, position: 'sticky', top: 0, zIndex: 2, background: '#f9fafb' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>Avg Hrs</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {empIds.length > 0 ? empIds.map((empId, idx) => {
                            const empStats   = monthlyStats[empId];
                            const empRecords = monthlyAttendance.filter(r => r.employee_id === empId);
                            const rowBg      = idx % 2 === 0 ? '#fff' : '#fafafa';

                            return (
                              <tr key={empId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '4px 10px', position: 'sticky', left: 0, zIndex: 1, background: rowBg, borderRight: '2px solid #d1d5db', whiteSpace: 'nowrap' }}>
                                  <div style={{ fontWeight: 600, color: '#111827', fontSize: 11 }}>{empStats.name}</div>
                                  <div style={{ fontSize: 9, color: '#9ca3af' }}>{empId}</div>
                                </td>
                                {cycleDateList.map((d, i) => {
                                  const yr  = d.getFullYear();
                                  const mo  = String(d.getMonth() + 1).padStart(2, '0');
                                  const dy  = String(d.getDate()).padStart(2, '0');
                                  const ds  = `${yr}-${mo}-${dy}`;
                                  const rec = empRecords.find(r => r.date === ds);
                                  const cs  = rec ? (STATUS_CELL[rec.status] || { bg: '#f3f4f6', color: '#6b7280', label: '?' }) : null;
                                  const isTd = d.toDateString() === new Date().toDateString();
                                  return (
                                    <td key={i} title={rec?.tooltip} style={{ padding: '2px 1px', textAlign: 'center', background: isTd ? '#eff6ff' : rowBg, borderRight: '1px solid #f3f4f6' }}>
                                      {rec ? (
                                        <span style={{ position: 'relative', display: 'inline-block' }}>
                                          <span style={{ display: 'inline-block', background: cs.bg, color: cs.color, borderRadius: 3, padding: '1px 2px', fontSize: 10, fontWeight: 700, minWidth: 26, textAlign: 'center', lineHeight: 1.5 }}>{cs.label}</span>
                                          {rec.is_late && rec.status !== 'weekend' && rec.status !== 'holiday' && (
                                            <span style={{ position: 'absolute', top: -3, right: -3, color: '#ea580c', fontSize: 8, fontWeight: 900, lineHeight: 1 }}>⚠</span>
                                          )}
                                          {rec.overtime_hours > 0 && (
                                            <span style={{ position: 'absolute', top: -3, left: -3, color: '#15803d', fontSize: 8, fontWeight: 900, lineHeight: 1 }}>+</span>
                                          )}
                                        </span>
                                      ) : (
                                        <span style={{ color: '#e5e7eb', fontSize: 10 }}>·</span>
                                      )}
                                    </td>
                                  );
                                })}
                                {/* Summary cells */}
                                {SUMMARY_COLS.map(({ key, bg, color, val }) => {
                                  const v = val(empStats);
                                  return (
                                    <td key={key} style={{ padding: '3px 2px', textAlign: 'center', background: rowBg, borderLeft: key === 'P' ? '2px solid #d1d5db' : '1px solid #f3f4f6' }}>
                                      {v !== 0
                                        ? <span style={{ background: bg, color, borderRadius: 4, padding: '1px 4px', fontSize: 10, fontWeight: 700 }}>{v}</span>
                                        : <span style={{ color: '#d1d5db', fontSize: 10 }}>—</span>}
                                    </td>
                                  );
                                })}
                                <td style={{ padding: '3px 6px', textAlign: 'center', background: rowBg, borderLeft: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>{empStats.avg_hours ? formatHours(empStats.avg_hours) : '—'}</span>
                                  <div style={{ fontSize: 9, color: '#9ca3af' }}>{empStats.total_hours ? empStats.total_hours.toFixed(0) + 'h' : ''}</div>
                                </td>
                              </tr>
                            );
                          }) : (
                            <tr>
                              <td colSpan={cycleDateList.length + SUMMARY_COLS.length + 2} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: 13 }}>
                                No attendance data for this period
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
            })()}
          </Card.Body>
        </Card>
      )}

      <div className="text-center mt-3 text-muted small">
        <p className="mb-0 d-flex flex-wrap justify-content-center gap-2">
          <span><FaClock className="me-1" /> Hover for details</span>
          <span className="d-none d-sm-inline">|</span>
          <span><FaExclamationTriangle className="me-1 text-warning" size={10} /> * late login</span>
          <span className="d-none d-sm-inline">|</span>
          <span><FaClock className="me-1 text-success" size={10} /> ⏰ Overtime</span>
          <span className="d-none d-sm-inline">|</span>
          <span><FaTrophy className="me-1 text-purple" size={10} /> 🎉 Comp-Off</span>
        </p>
      </div>
    </div>
  );
};

export default AttendanceReports;