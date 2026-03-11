// components/Admin/AttendanceReports.jsx
import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Badge, Form, Row, Col, 
  Button, Spinner, Alert 
} from 'react-bootstrap';
import { 
  FaCalendarAlt, 
  FaFileExcel,
  FaArrowLeft,
  FaArrowRight,
  FaEye,
  FaClock,
  FaUmbrellaBeach,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaUserTie,
  FaVenusMars,
  FaUniversity,
  FaIdCard
} from 'react-icons/fa';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { holidays as holidayData } from '../../data/holidays';

const AttendanceReports = () => {
  // ============== STATE VARIABLES ==============
  const [activeView, setActiveView] = useState('daily');
  
  // Daily View State
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  
  // Monthly View State
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [department, setDepartment] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState({});
  const [daysInMonth, setDaysInMonth] = useState(0);
  const [exportFormat, setExportFormat] = useState('detailed');
  
  // Current date for highlighting
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  // Common State
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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

  // Generate years
  const years = [];
  for (let i = 2020; i <= currentYear + 1; i++) {
    years.push(i);
  }

  // Fixed deduction amount
  const PROFESSIONAL_TAX = 200;
  const OTHER_DEDUCTIONS = 0;

  // ============== INITIAL LOADS ==============
  useEffect(() => {
    fetchAllEmployees();
  }, []);

  useEffect(() => {
    const days = new Date(selectedYear, selectedMonth, 0).getDate();
    setDaysInMonth(days);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (activeView === 'daily') {
      fetchDailyAttendance();
    } else {
      if (allEmployees.length > 0) {
        fetchMonthlyAttendance();
      }
    }
  }, [activeView, selectedDate, selectedMonth, selectedYear, department, allEmployees]);

  // ============== FETCH ALL EMPLOYEES ==============
  const fetchAllEmployees = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/employees');
      setAllEmployees(response.data);
      
      const depts = ['all', ...new Set(response.data.map(emp => emp.department).filter(Boolean))];
      setDepartments(depts);
      
    } catch (error) {
      console.error('Error fetching employees:', error);
      setMessage('Failed to load employees');
    }
  };

  // ============== FETCH DAILY ATTENDANCE ==============
  const fetchDailyAttendance = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get(
        `http://localhost:5000/api/attendance/report?start=${selectedDate}&end=${selectedDate}`
      );
      
      const attendanceData = response.data.attendance || [];
      
      // Process attendance data
      const processedAttendance = attendanceData.map(record => {
        if (record.clock_in && !record.clock_out) {
          const now = new Date();
          const clockInTime = new Date(record.clock_in);
          const currentHours = (now - clockInTime) / (1000 * 60 * 60);
          record.total_hours = currentHours.toFixed(2);
          record.status = 'working';
        }
        
        if (record.late_minutes > 0) {
          const totalSeconds = Math.round(record.late_minutes * 60);
          if (totalSeconds < 60) {
            record.late_display = `${totalSeconds}s late`;
          } else {
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;
            record.late_display = mins > 0 ? 
              (secs > 0 ? `${mins}m ${secs}s late` : `${mins}m late`) : 
              `${secs}s late`;
          }
        }
        
        return record;
      });
      
      setDailyAttendance(processedAttendance);
      setMessage('');
      
    } catch (error) {
      console.error('Error fetching daily attendance:', error);
      setMessage('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  // ============== FETCH MONTHLY ATTENDANCE ==============
  const fetchMonthlyAttendance = async () => {
    try {
      setLoading(true);
      
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      let url = `http://localhost:5000/api/attendance/report?start=${startDateStr}&end=${endDateStr}`;
      if (department !== 'all') {
        url += `&department=${department}`;
      }
      
      const response = await axios.get(url);
      const attendanceData = response.data.attendance || [];
      
      // Fetch leave data
      let leaveData = [];
      try {
        const leaveResponse = await axios.get('http://localhost:5000/api/leaves');
        leaveData = leaveResponse.data.filter(leave => 
          leave.status === 'approved' && 
          new Date(leave.end_date) >= startDate && 
          new Date(leave.start_date) <= endDate
        );
      } catch (error) {
        console.log('Could not fetch leave data');
      }
      
      // Filter holidays for selected month and year
      const monthHolidays = holidayData.filter(holiday => {
        const holidayDate = new Date(holiday.date);
        return holidayDate.getFullYear() === selectedYear && 
               holidayDate.getMonth() + 1 === selectedMonth;
      });
      
      // Process data with holiday support
      const processedData = processMonthlyAttendance(
        attendanceData,
        allEmployees,
        leaveData,
        monthHolidays,
        startDate,
        endDate
      );
      
      setMonthlyAttendance(processedData);
      calculateMonthlyStatistics(processedData);
      setMessage('');
      
    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
      setMessage('Failed to load monthly attendance');
    } finally {
      setLoading(false);
    }
  };

  // ============== PROCESS MONTHLY ATTENDANCE WITH HOLIDAYS ==============
  const processMonthlyAttendance = (attendanceData, employees, leaveData, holidays, startDate, endDate) => {
    const daysInMonth = endDate.getDate();
    const processedData = [];
    
    // Create attendance map
    const attendanceMap = {};
    attendanceData.forEach(record => {
      const dateStr = record.attendance_date ? record.attendance_date.split('T')[0] : '';
      if (dateStr && record.employee_id) {
        const key = `${record.employee_id}-${dateStr}`;
        attendanceMap[key] = record;
      }
    });
    
    // Create leave map
    const leaveMap = {};
    leaveData.forEach(leave => {
      const leaveStart = new Date(leave.start_date);
      const leaveEnd = new Date(leave.end_date || leave.start_date);
      
      for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const key = `${leave.employee_id}-${dateStr}`;
        leaveMap[key] = {
          type: leave.leave_type,
          reason: leave.reason
        };
      }
    });
    
    // Create holiday map
    const holidayMap = {};
    holidays.forEach(holiday => {
      const dateStr = holiday.date;
      holidayMap[dateStr] = {
        name: holiday.name,
        region: holiday.region
      };
    });
    
    // Filter employees by department
    let filteredEmployees = employees;
    if (department !== 'all') {
      filteredEmployees = employees.filter(emp => emp.department === department);
    }
    
    filteredEmployees.forEach(employee => {
      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(selectedYear, selectedMonth - 1, day);
        const dateStr = currentDate.toISOString().split('T')[0];
        
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
        
        // PRIORITY: Holiday > Leave > Attendance
        if (dayHoliday) {
          status = 'holiday';
          statusBadge = 'warning';
          statusIcon = '🎉';
          tooltip = `Holiday: ${dayHoliday.name}`;
        }
        else if (dayLeave) {
          status = 'on_leave';
          statusBadge = 'purple';
          statusIcon = '🏖️';
          tooltip = `On Leave: ${dayLeave.type}`;
          leaveType = dayLeave.type;
        }
        else if (dayAttendance) {
          clockIn = dayAttendance.clock_in;
          clockOut = dayAttendance.clock_out;
          totalHours = parseFloat(dayAttendance.total_hours) || 0;
          lateMinutes = dayAttendance.late_minutes || 0;
          
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          
          if (isToday && clockIn && !clockOut) {
            status = 'working';
            statusBadge = 'info';
            statusIcon = '✓';
            tooltip = `Working since ${formatTime(clockIn)}`;
            if (lateMinutes > 0) {
              tooltip += ` | Late: ${formatLateDisplay(lateMinutes)}`;
            }
            
            const now = new Date();
            const clockInTime = new Date(clockIn);
            totalHours = (now - clockInTime) / (1000 * 60 * 60);
          }
          else if (clockIn && clockOut) {
            if (totalHours >= 8) {
              status = 'present';
              statusBadge = 'success';
              statusIcon = '✓';
            } else if (totalHours >= 4) {
              status = 'half_day';
              statusBadge = 'warning';
              statusIcon = '½';
            } else {
              status = 'absent';
              statusBadge = 'danger';
              statusIcon = '✗';
            }
            
            tooltip = `In: ${formatShortTime(clockIn)} | Out: ${formatShortTime(clockOut)} | Hrs: ${totalHours.toFixed(1)}`;
            if (lateMinutes > 0) {
              tooltip += ` | Late: ${formatLateDisplay(lateMinutes)}`;
            }
          }
          else if (clockIn) {
            status = 'present';
            statusBadge = 'success';
            statusIcon = '✓';
            tooltip = `In: ${formatShortTime(clockIn)} | No clock out`;
            if (lateMinutes > 0) {
              tooltip += ` | Late: ${formatLateDisplay(lateMinutes)}`;
            }
          }
        }
        
        processedData.push({
          id: `${employee.employee_id}-${dateStr}`,
          employee_id: employee.employee_id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          department: employee.department,
          date: dateStr,
          day,
          clock_in: clockIn,
          clock_out: clockOut,
          total_hours: status === 'holiday' ? '0' : totalHours.toFixed(1),
          status,
          statusBadge,
          statusIcon,
          late_minutes: lateMinutes,
          is_late: lateMinutes > 0,
          tooltip,
          leave_type: leaveType,
          is_holiday: !!dayHoliday,
          holiday_name: dayHoliday?.name
        });
      }
    });
    
    return processedData;
  };

  // ============== CALCULATE MONTHLY STATISTICS ==============
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
          total_hours: 0,
          late_count: 0,
          total_late_minutes: 0,
          leave_types: []
        };
      }
      
      if (record.status === 'present') perEmployee[record.employee_id].present++;
      else if (record.status === 'half_day') perEmployee[record.employee_id].half_day++;
      else if (record.status === 'absent') perEmployee[record.employee_id].absent++;
      else if (record.status === 'on_leave') {
        perEmployee[record.employee_id].on_leave++;
        if (record.leave_type) {
          perEmployee[record.employee_id].leave_types.push(record.leave_type);
        }
      }
      else if (record.status === 'working') perEmployee[record.employee_id].working++;
      else if (record.status === 'holiday') perEmployee[record.employee_id].holiday++;
      
      // Count late logins
      if (record.is_late) {
        perEmployee[record.employee_id].late_count++;
        perEmployee[record.employee_id].total_late_minutes += record.late_minutes || 0;
      }
      
      const hours = parseFloat(record.total_hours || 0);
      perEmployee[record.employee_id].total_hours += hours;
    });
    
    // Calculate average late minutes
    Object.keys(perEmployee).forEach(empId => {
      const emp = perEmployee[empId];
      if (emp.late_count > 0) {
        emp.avg_late_minutes = (emp.total_late_minutes / emp.late_count).toFixed(1);
      } else {
        emp.avg_late_minutes = '0';
      }
      emp.unique_leave_types = [...new Set(emp.leave_types)];
    });
    
    setMonthlyStats(perEmployee);
  };

  // ============== GET LEAVE BALANCE FOR EMPLOYEE ==============
  const getLeaveBalance = async (employeeId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/leaves/balance/${employeeId}`);
      return response.data.available || '0';
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      return '0';
    }
  };

  // ============== NAVIGATION HANDLERS ==============
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
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);
  };

  // ============== GET GENDER DISPLAY ==============
  const getGender = (employee) => {
    // This would come from employee data - defaulting to 'Not Specified' if not available
    return employee.gender || 'Not Specified';
  };

  // ============== CALCULATE SALARY COMPONENTS ==============
  const calculateSalary = (employee, presentDays, halfDays, lateCount) => {
    const grossSalary = parseFloat(employee.gross_salary) || 0;
    const inHandSalary = parseFloat(employee.in_hand_salary) || 0;
    
    // Calculate per day salary
    const perDaySalary = grossSalary / 30; // Assuming 30 days month
    
    // Calculate actual salary based on attendance
    const totalWorkingDays = presentDays + (halfDays * 0.5);
    const actualSalary = totalWorkingDays * perDaySalary;
    
    // Professional Tax (fixed ₹200)
    const profTax = PROFESSIONAL_TAX;
    
    // Other deductions (can be customized based on late count, etc.)
    const otherDeductions = OTHER_DEDUCTIONS;
    
    // Total deductions
    const totalDeductions = profTax + otherDeductions;
    
    // Net salary to be paid
    const netSalaryToPay = actualSalary - totalDeductions;
    
    return {
      grossSalary: grossSalary.toFixed(2),
      inHandSalary: inHandSalary.toFixed(2),
      actualSalary: actualSalary.toFixed(2),
      profTax: profTax,
      otherDeductions: otherDeductions,
      totalDeductions: totalDeductions,
      netSalaryToPay: netSalaryToPay.toFixed(2)
    };
  };

  // ============== EXPORT TO EXCEL - COMPLETE FORMAT ==============
  const handleExportExcel = async () => {
    if (activeView === 'daily') {
      // Daily Export (keep existing format)
      const exportDate = new Date(selectedDate);
      const formattedDate = exportDate.toLocaleDateString();
      
      const exportData = dailyAttendance.map((record, index) => ({
        'Sr No': index + 1,
        'Date': formattedDate,
        'Employee ID': record.employee_id,
        'Employee Name': `${record.first_name} ${record.last_name}`,
        'Department': record.department,
        'Shift': record.shift_time_used || 'Not set',
        'Clock In': record.clock_in ? formatTime(record.clock_in) : '-',
        'Clock Out': record.clock_out ? formatTime(record.clock_out) : '-',
        'Total Hours': record.total_hours || '0.0',
        'Late Duration': record.late_display || '0',
        'Late (minutes)': record.late_minutes ? (record.late_minutes * 60).toFixed(0) : '0',
        'Status': record.status === 'present' ? 'Present' : 
                  record.status === 'half_day' ? 'Half Day' : 
                  record.status === 'working' ? 'Working' : 
                  record.status === 'on_leave' ? 'On Leave' : 
                  record.status === 'holiday' ? 'Holiday' : 'Absent'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      const colWidths = [
        { wch: 8 },   // Sr No
        { wch: 12 },  // Date
        { wch: 15 },  // Employee ID
        { wch: 25 },  // Employee Name
        { wch: 15 },  // Department
        { wch: 15 },  // Shift
        { wch: 10 },  // Clock In
        { wch: 10 },  // Clock Out
        { wch: 10 },  // Total Hours
        { wch: 12 },  // Late Duration
        { wch: 12 },  // Late (minutes)
        { wch: 12 }   // Status
      ];
      ws['!cols'] = colWidths;
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Attendance');
      XLSX.writeFile(wb, `Daily_Attendance_${selectedDate}.xlsx`);
      
    } else {
      // Monthly Export - COMPLETE FORMAT
      const currentMonthData = months.find(m => m.value === selectedMonth);
      const monthShort = currentMonthData?.short || 'Month';
      const monthName = currentMonthData?.label || 'Month';
      
      const exportData = [];
      
      // Sort employees
      const sortedEmployees = [...allEmployees].sort((a, b) => {
        if (department !== 'all') {
          if (a.department === department && b.department !== department) return -1;
          if (a.department !== department && b.department === department) return 1;
        }
        return (a.first_name || '').localeCompare(b.first_name || '');
      });

      for (const employee of sortedEmployees) {
        // Filter department if needed
        if (department !== 'all' && employee.department !== department) continue;
        
        const empRecords = monthlyAttendance.filter(r => r.employee_id === employee.employee_id);
        const empStats = monthlyStats[employee.employee_id] || {
          present: 0,
          half_day: 0,
          absent: 0,
          on_leave: 0,
          late_count: 0
        };
        
        // Get leave balance
        const leaveBalance = await getLeaveBalance(employee.employee_id);
        
        // Calculate salary components
        const salary = calculateSalary(employee, empStats.present, empStats.half_day, empStats.late_count);
        
        // Create row for this employee
        const row = {
          'Employee Name': `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
          'Date of Joining': employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : 'N/A',
          'Leave Balance': leaveBalance,
        };
        
        // Add each day's status with month and date
        for (let day = 1; day <= daysInMonth; day++) {
          const dayRecord = empRecords.find(r => r.day === day);
          let status = '';
          
          if (dayRecord) {
            if (dayRecord.status === 'present' || dayRecord.status === 'working') {
              status = 'P';
            } else if (dayRecord.status === 'half_day') {
              status = 'HD';
            } else if (dayRecord.status === 'on_leave') {
              status = 'L';
            } else if (dayRecord.status === 'holiday') {
              status = 'H';
            } else {
              status = 'A';
            }
          } else {
            status = 'A';
          }
          
          // Format: "Mar 1", "Mar 2", etc.
          row[`${monthShort} ${day}`] = status;
        }
        
        // Add all required columns
        row['Days of the Month'] = daysInMonth;
        row['Actual Present Days'] = (empStats.present + (empStats.half_day * 0.5)).toFixed(1);
        row['Present Days'] = empStats.present || 0;
        row['Half Days'] = empStats.half_day || 0;
        row['PL Leave'] = empStats.on_leave || 0;
        row['Absent'] = empStats.absent || 0;
        row['Late Coming'] = empStats.late_count || 0;
        row['Amount'] = salary.actualSalary;
        row['Gross Salary'] = salary.grossSalary;
        row['Net Salary'] = salary.inHandSalary;
        row['Actual Salary'] = salary.actualSalary;
        row['Professional Tax'] = salary.profTax;
        row['Deduction'] = salary.totalDeductions;
        row['Net Salary To be Pay'] = salary.netSalaryToPay;
        row['Gender'] = getGender(employee);
        row['Account Number'] = employee.account_number || 'N/A';
        row['IFSC Code'] = employee.ifsc_code || 'N/A';
        row['Bank Name'] = employee.bank_account_name || 'N/A';
        
        exportData.push(row);
      }

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Calculate column widths
      const colWidths = [
        { wch: 25 }, // Employee Name
        { wch: 15 }, // Date of Joining
        { wch: 12 }, // Leave Balance
      ];
      
      // Add widths for each day column
      for (let i = 1; i <= daysInMonth; i++) {
        colWidths.push({ wch: 8 }); // "Mar 1" style
      }
      
      // Add widths for summary columns
      colWidths.push(
        { wch: 15 }, // Days of the Month
        { wch: 15 }, // Actual Present Days
        { wch: 12 }, // Present Days
        { wch: 10 }, // Half Days
        { wch: 10 }, // PL Leave
        { wch: 10 }, // Absent
        { wch: 12 }, // Late Coming
        { wch: 12 }, // Amount
        { wch: 12 }, // Gross Salary
        { wch: 12 }, // Net Salary
        { wch: 12 }, // Actual Salary
        { wch: 15 }, // Professional Tax
        { wch: 12 }, // Deduction
        { wch: 18 }, // Net Salary To be Pay
        { wch: 20 }, // Account Number
        { wch: 15 }, // IFSC Code
        { wch: 20 }  // Bank Name
      );
      
      ws['!cols'] = colWidths;
      
      // Create workbook and save
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Attendance');
      XLSX.writeFile(wb, `Attendance_Report_${monthName}_${selectedYear}.xlsx`);
    }
  };

  // ============== UTILITY FUNCTIONS ==============
  const formatTime = (datetime) => {
    if (!datetime) return '—';
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatShortTime = (datetime) => {
    if (!datetime) return '-';
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatLateDisplay = (lateMinutes) => {
    const totalSeconds = Math.round(lateMinutes * 60);
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    } else {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return mins > 0 ? (secs > 0 ? `${mins}m ${secs}s` : `${mins}m`) : `${secs}s`;
    }
  };

  const getStatusBadge = (record) => {
    if (record.status === 'working') {
      return record.is_late ? 
        <Badge bg="warning" className="px-2 py-1" style={{ backgroundColor: '#fd7e14' }}>Working (Late)</Badge> : 
        <Badge bg="info" className="px-2 py-1">Working</Badge>;
    }
    if (record.status === 'present') {
      return record.is_late ? 
        <Badge bg="warning" className="px-2 py-1" style={{ backgroundColor: '#fd7e14' }}>Present (Late)</Badge> : 
        <Badge bg="success" className="px-2 py-1">Present</Badge>;
    }
    if (record.status === 'half_day') return <Badge bg="warning" className="px-2 py-1">Half Day</Badge>;
    if (record.status === 'on_leave') return <Badge bg="purple" className="px-2 py-1" style={{ backgroundColor: '#6f42c1' }}>On Leave</Badge>;
    if (record.status === 'holiday') return <Badge bg="warning" className="px-2 py-1" style={{ backgroundColor: '#ffc107' }}>Holiday</Badge>;
    return <Badge bg="secondary" className="px-2 py-1">Absent</Badge>;
  };

  const isCurrentDate = (day) => {
    return selectedMonth === currentMonth && 
           selectedYear === currentYear && 
           day === currentDay;
  };

  // ============== RENDER ==============
  return (
    <div className="p-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <FaCalendarAlt className="me-2 text-primary" />
          Attendance Reports
        </h5>
        <small className="text-muted">{activeView === 'daily' ? 'Daily View' : 'Monthly View'}</small>
      </div>

      {/* Message Alert */}
      {message && (
        <Alert variant="danger" onClose={() => setMessage('')} dismissible className="mb-3 py-2">
          <small>{message}</small>
        </Alert>
      )}

      {/* View Tabs */}
      <div className="mb-3 border-bottom">
        <Button 
          variant={activeView === 'daily' ? 'primary' : 'light'} 
          size="sm"
          onClick={() => setActiveView('daily')}
          className="me-2"
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
      </div>

      {/* Controls */}
      {activeView === 'daily' ? (
        <div className="d-flex mb-3">
          <Form.Control
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            size="sm"
            className="me-2"
            style={{ width: '200px' }}
          />
          <Button variant="success" size="sm" onClick={handleExportExcel}>
            <FaFileExcel className="me-2" size={12} /> Export
          </Button>
        </div>
      ) : (
        <div className="mb-3">
          <Row className="g-2">
            <Col md={8}>
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
                    style={{ width: '100px' }}
                  >
                    {months.map(m => <option key={m.value} value={m.value}>{m.short}</option>)}
                  </Form.Select>
                  <Form.Select 
                    size="sm" 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="me-1"
                    style={{ width: '80px' }}
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </Form.Select>
                  <Button variant="outline-secondary" size="sm" onClick={handleNextMonth}>
                    <FaArrowRight size={10} />
                  </Button>
                </div>
                
                <Button variant="outline-primary" size="sm" onClick={goToCurrentMonth}>
                  Current
                </Button>

                <Form.Select
                  size="sm"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  style={{ width: '120px' }}
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>
                      {dept === 'all' ? 'All Departments' : dept}
                    </option>
                  ))}
                </Form.Select>
              </div>
            </Col>
            
            <Col md={4}>
              <div className="d-flex gap-2 justify-content-end">
                <Button variant="success" size="sm" onClick={handleExportExcel}>
                  <FaFileExcel className="me-2" size={12} /> Export Complete Report
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      )}

      {/* Legend */}
      <div className="d-flex flex-wrap gap-3 mb-3 small justify-content-center">
        <span><Badge bg="success" pill>P</Badge> Present</span>
        <span><Badge bg="warning" pill>HD</Badge> Half Day</span>
        <span><Badge bg="info" pill>W</Badge> Working</span>
        <span><Badge bg="purple" pill style={{ backgroundColor: '#6f42c1' }}>L</Badge> On Leave</span>
        <span><Badge bg="warning" pill style={{ backgroundColor: '#ffc107' }}>H</Badge> Holiday</span>
        <span><Badge bg="secondary" pill>A</Badge> Absent</span>
        <span><Badge bg="warning" pill style={{ backgroundColor: '#fd7e14' }}>⚠️</Badge> Late Login</span>
        <span className="text-muted">|</span>
        <span><FaClock className="me-1 text-muted" size={12} /> Hover for details</span>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" size="sm" />
          <p className="mt-2 small text-muted">Loading attendance data...</p>
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-light py-2 d-flex justify-content-between align-items-center">
            <h6 className="mb-0 fw-semibold small">
              {activeView === 'daily' ? 'Daily Attendance' : 'Monthly Calendar'}
            </h6>
            <Badge bg="secondary" pill>
              {activeView === 'daily' ? dailyAttendance.length : daysInMonth} Records
            </Badge>
          </Card.Header>
          <Card.Body className="p-0">
            {/* Table with Vertical Scroll */}
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {activeView === 'daily' ? (
                /* Daily View Table */
                <Table size="sm" striped className="mb-0">
                  <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                    <tr>
                      <th className="text-dark fw-normal small text-center" style={{ width: '60px' }}>Sr No</th>
                      <th className="text-dark fw-normal small">Employee</th>
                      <th className="text-dark fw-normal small">Department</th>
                      <th className="text-dark fw-normal small">Shift</th>
                      <th className="text-dark fw-normal small">Clock In</th>
                      <th className="text-dark fw-normal small">Late</th>
                      <th className="text-dark fw-normal small">Clock Out</th>
                      <th className="text-dark fw-normal small">Hours</th>
                      <th className="text-dark fw-normal small">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyAttendance.length > 0 ? (
                      dailyAttendance.map((record, index) => (
                        <tr key={index} className={record.is_late ? 'table-warning' : ''}>
                          <td className="text-center">{index + 1}</td>
                          <td className="small">
                            <div className="text-truncate" style={{ maxWidth: '150px' }} title={`${record.first_name} ${record.last_name}`}>
                              {record.first_name} {record.last_name}
                            </div>
                            <small className="text-muted text-truncate d-block" style={{ maxWidth: '150px' }} title={record.employee_id}>
                              {record.employee_id}
                            </small>
                          </td>
                          <td className="small">
                            <span className="text-truncate d-inline-block" style={{ maxWidth: '100px' }} title={record.department}>
                              {record.department}
                            </span>
                          </td>
                          <td className="small">
                            <span className="text-nowrap">{record.shift_time_used || 'Not set'}</span>
                          </td>
                          <td className={`small ${record.clock_in ? 'text-success' : 'text-muted'}`}>
                            <span className="text-nowrap" title={formatShortTime(record.clock_in)}>
                              {formatShortTime(record.clock_in)}
                            </span>
                          </td>
                          <td className="small">
                            {record.late_display ? (
                              <Badge bg="warning" pill className="text-nowrap" style={{ backgroundColor: '#fd7e14' }}>
                                {record.late_display}
                              </Badge>
                            ) : '-'}
                          </td>
                          <td className={`small ${record.clock_out ? 'text-danger' : 'text-muted'}`}>
                            <span className="text-nowrap" title={formatShortTime(record.clock_out)}>
                              {formatShortTime(record.clock_out)}
                            </span>
                          </td>
                          <td className="small">
                            <span className="text-nowrap" title={`${record.total_hours || '0.0'} hrs`}>
                              {record.total_hours || '0.0'}
                            </span>
                          </td>
                          <td className="small">{getStatusBadge(record)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="9" className="text-center py-4">No attendance records for this date</td></tr>
                    )}
                  </tbody>
                </Table>
              ) : (
                /* Monthly Calendar Table */
                <Table size="sm" bordered className="mb-0">
                  <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                    <tr>
                      <th className="fw-normal small text-center" style={{ width: '50px' }}>#</th>
                      <th className="fw-normal small text-center" style={{ minWidth: '140px' }}>Employee</th>
                      {[...Array(daysInMonth)].map((_, i) => {
                        const day = i + 1;
                        const isCurrent = isCurrentDate(day);
                        const monthData = months.find(m => m.value === selectedMonth);
                        
                        return (
                          <th key={i} className={`fw-normal small text-center ${isCurrent ? 'bg-primary text-white' : ''}`} 
                              style={{ minWidth: '32px' }}>
                            {day}
                            <div className="small fw-normal">{monthData?.short}</div>
                          </th>
                        );
                      })}
                      <th className="text-center fw-normal small" style={{ minWidth: '32px' }}>P</th>
                      <th className="text-center fw-normal small" style={{ minWidth: '32px' }}>H</th>
                      <th className="text-center fw-normal small" style={{ minWidth: '32px' }}>L</th>
                      <th className="text-center fw-normal small" style={{ minWidth: '32px' }}>Hol</th>
                      <th className="text-center fw-normal small" style={{ minWidth: '32px' }}>A</th>
                      <th className="text-center fw-normal small" style={{ minWidth: '60px' }}>Late</th>
                      <th className="text-center fw-normal small" style={{ minWidth: '50px' }}>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(monthlyStats).length > 0 ? (
                      Object.keys(monthlyStats).map((empId, idx) => {
                        const empStats = monthlyStats[empId];
                        const empRecords = monthlyAttendance.filter(r => r.employee_id === empId);
                        
                        return (
                          <tr key={empId}>
                            <td className="text-center small">{idx + 1}</td>
                            <td className="small">
                              <div className="text-truncate" style={{ maxWidth: '130px' }} title={empStats.name}>
                                <span className="fw-semibold">{empStats.name}</span>
                              </div>
                              <small className="text-muted text-truncate d-block" style={{ maxWidth: '130px' }} title={empId}>
                                {empId}
                              </small>
                            </td>
                            {[...Array(daysInMonth)].map((_, day) => {
                              const dayNum = day + 1;
                              const dayRecord = empRecords.find(r => r.day === dayNum);
                              const isCurrent = isCurrentDate(dayNum);
                              
                              let statusIcon = '-';
                              let iconClass = 'text-muted';
                              let iconStyle = {};
                              
                              if (dayRecord) {
                                if (dayRecord.status === 'present' || dayRecord.status === 'working') {
                                  statusIcon = '✓';
                                  iconClass = 'text-success fw-bold';
                                  iconStyle = { fontSize: '14px' };
                                } else if (dayRecord.status === 'half_day') {
                                  statusIcon = '½';
                                  iconClass = 'text-warning fw-bold';
                                  iconStyle = { fontSize: '14px' };
                                } else if (dayRecord.status === 'on_leave') {
                                  statusIcon = '🏖️';
                                  iconClass = 'text-purple';
                                  iconStyle = { fontSize: '14px' };
                                } else if (dayRecord.status === 'holiday') {
                                  statusIcon = '🎉';
                                  iconClass = 'text-warning';
                                  iconStyle = { fontSize: '14px' };
                                } else if (dayRecord.status === 'absent') {
                                  statusIcon = '✗';
                                  iconClass = 'text-danger fw-bold';
                                  iconStyle = { fontSize: '14px' };
                                }
                              }
                              
                              return (
                                <td key={day} className={`small text-center align-middle ${isCurrent ? 'bg-primary bg-opacity-10' : ''}`}
                                    style={{ backgroundColor: dayRecord?.is_late ? '#fff3cd' : 'transparent' }}>
                                  {dayRecord ? (
                                    <span 
                                      title={dayRecord.tooltip} 
                                      className={iconClass}
                                      style={{ cursor: 'pointer', ...iconStyle }}
                                    >
                                      {statusIcon}
                                      {dayRecord.is_late && <sup className="text-warning fw-bold">*</sup>}
                                    </span>
                                  ) : '-'}
                                </td>
                              );
                            })}
                            <td className="text-center"><Badge bg="success" pill>{empStats.present}</Badge></td>
                            <td className="text-center"><Badge bg="warning" pill>{empStats.half_day}</Badge></td>
                            <td className="text-center"><Badge bg="purple" pill style={{ backgroundColor: '#6f42c1' }}>{empStats.on_leave || 0}</Badge></td>
                            <td className="text-center"><Badge bg="warning" pill style={{ backgroundColor: '#ffc107' }}>{empStats.holiday || 0}</Badge></td>
                            <td className="text-center"><Badge bg="danger" pill>{empStats.absent}</Badge></td>
                            <td className="text-center">
                              {empStats.late_count > 0 ? (
                                <Badge bg="warning" pill className="text-nowrap" style={{ backgroundColor: '#fd7e14' }}>
                                  ⚠️ {empStats.late_count}
                                </Badge>
                              ) : (
                                <Badge bg="secondary" pill className="text-nowrap">0</Badge>
                              )}
                            </td>
                            <td className="text-center"><strong>{empStats.total_hours.toFixed(1)}</strong></td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={daysInMonth + 10} className="text-center py-4">No attendance data</td></tr>
                    )}
                  </tbody>
                </Table>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center mt-3 text-muted small">
        <p className="mb-0">
          <FaClock className="me-1" /> Hover for details | <FaExclamationTriangle className="me-1 text-warning" size={10} /> * late login
        </p>
      </div>
    </div>
  );
};

export default AttendanceReports;