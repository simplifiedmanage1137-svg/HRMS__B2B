// src/components/Employee/TeamAttendanceReport.jsx
import React, { useState, useEffect } from 'react';
import {
    Card, Table, Badge, Form, Row, Col,
    Button, Spinner, Alert, ButtonGroup, InputGroup
} from 'react-bootstrap';
import {
    FaCalendarAlt,
    FaFileExcel,
    FaArrowLeft,
    FaArrowRight,
    FaUsers,
    FaCheckCircle,
    FaTimesCircle,
    FaClock,
    FaUmbrellaBeach,
    FaExclamationTriangle,
    FaTrophy,
    FaSearch,
    FaEye,
    FaEyeSlash,
    FaChartBar,
    FaUserTie,
    FaMoon,
    FaSun,
    FaInfoCircle,
    FaSyncAlt,
    FaDownload
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';

const TeamAttendanceReport = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeView, setActiveView] = useState('daily');
    const [teamMembers, setTeamMembers] = useState([]);
    const [attendanceData, setAttendanceData] = useState([]);
    const [employeeSummary, setEmployeeSummary] = useState([]);
    const [dailyStats, setDailyStats] = useState(null);
    const [teamSummary, setTeamSummary] = useState(null);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedEmployee, setSelectedEmployee] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showDetails, setShowDetails] = useState({});
    const [error, setError] = useState('');
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

    const years = [];
    for (let i = 2020; i <= new Date().getFullYear() + 1; i++) {
        years.push(i);
    }

    const getSalaryCycleDates = (month, year) => {
        const cycleStart = new Date(year, month - 1, 26);
        let cycleEnd;
        if (month === 12) {
            cycleEnd = new Date(year + 1, 0, 25);
        } else {
            cycleEnd = new Date(year, month, 25);
        }
        return {
            start: cycleStart.toISOString().split('T')[0],
            end: cycleEnd.toISOString().split('T')[0]
        };
    };

    const fetchTeamAttendance = async () => {
        try {
            setLoading(true);
            setError('');

            const cycleDates = getSalaryCycleDates(selectedMonth, selectedYear);
            let url = `${API_ENDPOINTS.ATTENDANCE}/team-report?view_type=${activeView}`;

            if (activeView === 'daily') {
                url += `&start=${selectedDate}&end=${selectedDate}`;
            } else {
                url += `&start=${cycleDates.start}&end=${cycleDates.end}`;
                setDateRange(cycleDates);
            }

            if (selectedEmployee !== 'all') {
                url += `&employee_id=${selectedEmployee}`;
            }

            const response = await axios.get(url);

            if (response.data.success) {
                setTeamMembers(response.data.team_members || []);
                setAttendanceData(response.data.attendance || []);
                setEmployeeSummary(response.data.employee_summary || []);

                if (response.data.daily_stats) {
                    setDailyStats(response.data.daily_stats);
                } else if (response.data.summary) {
                    const summary = response.data.summary;
                    setDailyStats({
                        total_employees: summary.total_team_members || teamMembers.length,
                        present: summary.total_present_today || 0,
                        absent: summary.total_absent_today || 0,
                        on_leave: summary.total_on_leave_today || 0,
                        half_day: summary.total_half_day_today || 0,
                        late_count: summary.total_late_today || 0,
                        working: summary.total_working_today || 0,
                        present_count: summary.total_present_today || 0
                    });
                }

                setTeamSummary(response.data.summary);

                if (activeView === 'monthly') {
                    setDateRange(response.data.date_range);
                }
            }
        } catch (error) {
            console.error('Error fetching team attendance:', error);
            setError(error.response?.data?.message || 'Failed to fetch attendance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeamAttendance();
    }, [activeView, selectedDate, selectedMonth, selectedYear, selectedEmployee]);

    const refreshData = async () => {
        setRefreshing(true);
        await fetchTeamAttendance();
        setRefreshing(false);
        setMessage('Data refreshed successfully!');
        setTimeout(() => setMessage(''), 3000);
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
        const today = new Date();
        setSelectedMonth(today.getMonth() + 1);
        setSelectedYear(today.getFullYear());
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatTime = (datetime) => {
        if (!datetime) return '--:--';
        return new Date(datetime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
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

    const getStatusBadge = (status, isLate = false, lateDisplay = null, overtimeHours = 0, compOff = false, totalHours = 0) => {
        if (overtimeHours > 0) {
            return <Badge bg="success" className="px-2 py-1 text-nowrap"><FaClock className="me-1" size={10} /> OT +{overtimeHours}h</Badge>;
        }
        if (compOff) {
            return <Badge bg="purple" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#9b59b6' }}><FaTrophy className="me-1" size={10} /> Comp-Off</Badge>;
        }
        if (status === 'present') {
            if (isLate) {
                return <Badge bg="warning" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#fd7e14' }}><FaExclamationTriangle className="me-1" size={10} /> Late {lateDisplay}</Badge>;
            }
            return <Badge bg="success" className="px-2 py-1 text-nowrap"><FaCheckCircle className="me-1" size={10} /> Present</Badge>;
        }
        if (status === 'half_day') {
            if (isLate) {
                return <Badge bg="warning" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#fd7e14' }}><FaSun className="me-1" size={10} /> Half Day (Late)</Badge>;
            }
            return <Badge bg="warning" className="px-2 py-1 text-nowrap"><FaSun className="me-1" size={10} /> Half Day</Badge>;
        }
        if (status === 'on_leave') return <Badge bg="purple" className="px-2 py-1 text-nowrap" style={{ backgroundColor: '#6f42c1' }}><FaUmbrellaBeach className="me-1" size={10} /> On Leave</Badge>;
        if (status === 'working') return <Badge bg="info" className="px-2 py-1 text-nowrap"><FaClock className="me-1" size={10} /> Working</Badge>;
        if (status === 'weekend') return <Badge bg="secondary" className="px-2 py-1 text-nowrap"><FaMoon className="me-1" size={10} /> W-OFF</Badge>;
        return <Badge bg="secondary" className="px-2 py-1 text-nowrap"><FaTimesCircle className="me-1" size={10} /> Absent</Badge>;
    };

    const exportToExcel = () => {
        try {
            const exportData = attendanceData.map(record => ({
                'Date': formatDate(record.attendance_date),
                'Employee Name': record.employee_name,
                'Employee ID': record.employee_id,
                'Department': record.department,
                'Clock In': formatTime(record.clock_in),
                'Clock Out': formatTime(record.clock_out),
                'Total Hours': record.total_hours,
                'Status': record.status === 'present' ? 'Present' :
                    record.status === 'half_day' ? 'Half Day' :
                        record.status === 'on_leave' ? 'On Leave' :
                            record.status === 'working' ? 'Working' :
                                record.status === 'weekend' ? 'Weekend Off' : 'Absent',
                'Late': record.is_late ? formatLateDisplay(record.late_minutes) || 'Yes' : 'No',
                'Overtime Hours': record.overtime_hours || 0
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Team Attendance');

            const fileName = activeView === 'daily'
                ? `Team_Attendance_${selectedDate}.xlsx`
                : `Team_Attendance_${months.find(m => m.value === selectedMonth)?.label}_${selectedYear}.xlsx`;

            XLSX.writeFile(wb, fileName);
            setMessage('Report exported successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Export error:', error);
            setError('Failed to export data');
        }
    };

    const filteredAttendance = attendanceData.filter(record => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return record.employee_name.toLowerCase().includes(term) ||
            record.employee_id.toLowerCase().includes(term) ||
            record.department?.toLowerCase().includes(term);
    });

    const uniqueDates = [...new Set(attendanceData.map(a => a.attendance_date))].sort();

    const getCalendarData = () => {
        const calendarMap = {};
        attendanceData.forEach(record => {
            if (!calendarMap[record.employee_id]) {
                calendarMap[record.employee_id] = {
                    employee_name: record.employee_name,
                    employee_id: record.employee_id,
                    department: record.department,
                    records: {}
                };
            }
            calendarMap[record.employee_id].records[record.attendance_date] = record;
        });
        return Object.values(calendarMap);
    };

    // Add this helper function at the top of your TeamAttendanceReport.jsx
    const formatDecimalHoursToHMS = (decimalHours) => {
        if (!decimalHours || decimalHours <= 0) return '-';

        const totalMinutes = Math.round(decimalHours * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    };

    // Today's Stats Card Component - Matching main website design
    const TodayStatsCard = () => {
        const total = teamMembers.length;

        let present = 0, absent = 0, onLeave = 0, halfDay = 0, late = 0, working = 0;

        if (dailyStats) {
            present = dailyStats.present || 0;
            absent = dailyStats.absent || 0;
            onLeave = dailyStats.on_leave || 0;
            halfDay = dailyStats.half_day || 0;
            late = dailyStats.late_count || 0;
            working = dailyStats.working || 0;
        } else {
            const todayStr = selectedDate;
            const todayRecords = attendanceData.filter(r => r.attendance_date === todayStr);
            present = todayRecords.filter(r => r.status === 'present').length;
            absent = todayRecords.filter(r => r.status === 'absent').length;
            onLeave = todayRecords.filter(r => r.status === 'on_leave').length;
            halfDay = todayRecords.filter(r => r.status === 'half_day').length;
            late = todayRecords.filter(r => r.is_late).length;
            working = todayRecords.filter(r => r.status === 'working').length;
        }

        const attendanceRate = total > 0 ? ((present + halfDay) / total * 100).toFixed(1) : 0;

        if (activeView !== 'daily') return null;

        if (total === 0 && present === 0 && absent === 0 && onLeave === 0 && halfDay === 0 && late === 0) {
            return (
                <Card className="border-0 shadow-sm mb-4 bg-light">
                    <Card.Body className="p-3 text-center">
                        <FaInfoCircle className="text-muted mb-2" size={24} />
                        <p className="text-muted mb-0">No attendance data available for {formatDate(selectedDate)}</p>
                    </Card.Body>
                </Card>
            );
        }

        return (
            <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0 text-dark fw-semibold">
                            <FaChartBar className="me-2 text-primary" />
                            Today's Team Summary - {formatDate(selectedDate)}
                        </h6>
                        <Badge bg="secondary" pill>Total: {total} members</Badge>
                    </div>
                    <Row className="g-3">
                        <Col xs={6} sm={4} md={2}>
                            <div className="bg-primary bg-opacity-10 rounded p-3 text-center">
                                <FaUsers className="mb-2 text-primary" size={20} />
                                <div className="h4 mb-0 fw-bold text-primary">{total}</div>
                                <small className="text-muted">Total</small>
                            </div>
                        </Col>
                        <Col xs={6} sm={4} md={2}>
                            <div className="bg-success bg-opacity-10 rounded p-3 text-center">
                                <FaCheckCircle className="mb-2 text-success" size={20} />
                                <div className="h4 mb-0 fw-bold text-success">{present + halfDay}</div>
                                <small className="text-muted">Present</small>
                            </div>
                        </Col>
                        <Col xs={6} sm={4} md={2}>
                            <div className="bg-danger bg-opacity-10 rounded p-3 text-center">
                                <FaTimesCircle className="mb-2 text-danger" size={20} />
                                <div className="h4 mb-0 fw-bold text-danger">{absent}</div>
                                <small className="text-muted">Absent</small>
                            </div>
                        </Col>
                        <Col xs={6} sm={4} md={2}>
                            <div className="bg-purple bg-opacity-10 rounded p-3 text-center" style={{ backgroundColor: '#f3e8ff' }}>
                                <FaUmbrellaBeach className="mb-2" style={{ color: '#6f42c1' }} size={20} />
                                <div className="h4 mb-0 fw-bold" style={{ color: '#6f42c1' }}>{onLeave}</div>
                                <small className="text-muted">On Leave</small>
                            </div>
                        </Col>
                        <Col xs={6} sm={4} md={2}>
                            <div className="bg-warning bg-opacity-10 rounded p-3 text-center">
                                <FaSun className="mb-2 text-warning" size={20} />
                                <div className="h4 mb-0 fw-bold text-warning">{halfDay}</div>
                                <small className="text-muted">Half Day</small>
                            </div>
                        </Col>
                        <Col xs={6} sm={4} md={2}>
                            <div className="bg-orange bg-opacity-10 rounded p-3 text-center" style={{ backgroundColor: '#fff3e0' }}>
                                <FaExclamationTriangle className="mb-2" style={{ color: '#fd7e14' }} size={20} />
                                <div className="h4 mb-0 fw-bold" style={{ color: '#fd7e14' }}>{late}</div>
                                <small className="text-muted">Late Login</small>
                            </div>
                        </Col>
                    </Row>
                    <div className="mt-3 text-center">
                        <Badge bg="light" text="dark" className="px-3 py-2">
                            Attendance Rate: {attendanceRate}%
                        </Badge>
                        {working > 0 && (
                            <Badge bg="info" className="ms-2 px-3 py-2">
                                Currently Working: {working}
                            </Badge>
                        )}
                    </div>
                </Card.Body>
            </Card>
        );
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    return (
        <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                <div>
                    <h5 className="mb-1 d-flex align-items-center">
                        <FaUserTie className="me-2 text-primary" />
                        Team Attendance Report
                    </h5>
                    <p className="text-muted mb-0 small">
                        Track attendance of your team members with daily and monthly views
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <Button variant="outline-primary" size="sm" onClick={refreshData} disabled={refreshing}>
                        <FaSyncAlt className={`me-1 ${refreshing ? 'fa-spin' : ''}`} size={12} />
                        Refresh
                    </Button>
                    <Button variant="success" size="sm" onClick={exportToExcel}>
                        <FaDownload className="me-1" size={12} /> Export
                    </Button>
                </div>
            </div>

            {message && <Alert variant="success" className="mb-3 py-2" dismissible onClose={() => setMessage('')}>{message}</Alert>}
            {error && <Alert variant="danger" className="mb-3 py-2" dismissible onClose={() => setError('')}>{error}</Alert>}

            {/* View Toggle */}
            <div className="mb-3 border-bottom pb-2">
                <ButtonGroup size="sm">
                    <Button
                        variant={activeView === 'daily' ? 'primary' : 'light'}
                        onClick={() => setActiveView('daily')}
                    >
                        <FaSun className="me-1" size={12} /> Daily View
                    </Button>
                    <Button
                        variant={activeView === 'monthly' ? 'primary' : 'light'}
                        onClick={() => setActiveView('monthly')}
                    >
                        <FaCalendarAlt className="me-1" size={12} /> Monthly Calendar
                    </Button>
                </ButtonGroup>
            </div>

            {/* Today's Stats Card */}
            <TodayStatsCard />

            {/* Filters */}
            <Card className="border-0 shadow-sm mb-3">
                <Card.Body className="p-3">
                    <Row className="g-2 align-items-end">
                        {activeView === 'daily' ? (
                            <Col xs={12} md={4}>
                                <Form.Label className="small text-muted mb-1">Select Date</Form.Label>
                                <Form.Control
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    size="sm"
                                />
                            </Col>
                        ) : (
                            <>
                                <Col xs={6} md={3}>
                                    <Form.Label className="small text-muted mb-1">Month</Form.Label>
                                    <div className="d-flex gap-1">
                                        <Button variant="outline-secondary" size="sm" onClick={handlePreviousMonth}>
                                            <FaArrowLeft size={10} />
                                        </Button>
                                        <Form.Select
                                            size="sm"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                            className="flex-grow-1"
                                        >
                                            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </Form.Select>
                                        <Button variant="outline-secondary" size="sm" onClick={handleNextMonth}>
                                            <FaArrowRight size={10} />
                                        </Button>
                                    </div>
                                </Col>
                                <Col xs={6} md={2}>
                                    <Form.Label className="small text-muted mb-1">Year</Form.Label>
                                    <Form.Select size="sm" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </Form.Select>
                                </Col>
                                <Col xs={12} md={2}>
                                    <Button variant="outline-primary" size="sm" onClick={goToCurrentMonth} className="w-100">
                                        Current Month
                                    </Button>
                                </Col>
                            </>
                        )}
                        <Col xs={12} md={activeView === 'daily' ? 5 : 3}>
                            <Form.Label className="small text-muted mb-1">Employee</Form.Label>
                            <Form.Select size="sm" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
                                <option value="all">All Team Members ({teamMembers.length})</option>
                                {teamMembers.map(emp => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.first_name} {emp.last_name} ({emp.employee_id})
                                    </option>
                                ))}
                            </Form.Select>
                        </Col>
                        <Col xs={12} md={activeView === 'daily' ? 3 : 2}>
                            <Form.Label className="small text-muted mb-1">Search</Form.Label>
                            <InputGroup size="sm">
                                <InputGroup.Text><FaSearch size={10} /></InputGroup.Text>
                                <Form.Control
                                    placeholder="Name, ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </InputGroup>
                        </Col>
                    </Row>
                    {dateRange.start && dateRange.end && activeView === 'monthly' && (
                        <div className="mt-2 text-muted small">
                            <FaInfoCircle className="me-1" size={10} />
                            Salary Cycle: {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Main Content */}
            <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h6 className="mb-0 small fw-semibold">
                        {activeView === 'daily' ? 'Daily Attendance Records' : 'Monthly Attendance Calendar'}
                        {activeView === 'monthly' && dateRange.start && dateRange.end && (
                            <span className="text-muted ms-2 fw-normal">({formatDate(dateRange.start)} - {formatDate(dateRange.end)})</span>
                        )}
                    </h6>
                    <Badge bg="secondary" pill>{filteredAttendance.length} Records</Badge>
                </Card.Header>
                <Card.Body className="p-0">
                    {activeView === 'daily' ? (
                        <div className="table-responsive" style={{ maxHeight: '500px', overflow: 'auto' }}>
                            <Table hover className="mb-0" size="sm">
                                <thead className="bg-light sticky-top">
                                    <tr className="small">
                                        <th className="fw-normal">#</th>
                                        <th className="fw-normal">Employee</th>
                                        <th className="fw-normal d-none d-md-table-cell">Department</th>
                                        <th className="fw-normal">Clock In</th>
                                        <th className="fw-normal d-none d-sm-table-cell">Clock Out</th>
                                        <th className="fw-normal d-none d-lg-table-cell">Hours</th>
                                        <th className="fw-normal">Status</th>
                                        <th className="fw-normal text-center">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAttendance.length > 0 ? (
                                        filteredAttendance.map((record, index) => (
                                            <React.Fragment key={index}>
                                                <tr className={record.is_late ? 'table-warning' : ''}>
                                                    <td className="small text-center">{index + 1}</td>
                                                    <td className="small">
                                                        <div className="fw-semibold">{record.employee_name}</div>
                                                        <small className="text-muted">{record.employee_id}</small>
                                                    </td>
                                                    <td className="small d-none d-md-table-cell">{record.department || '-'}</td>
                                                    <td className="small">
                                                        <span className="text-nowrap text-success">{formatTime(record.clock_in) || '--:--'}</span>
                                                        {record.is_late && record.late_display && (
                                                            <div><small className="text-warning">Late: {record.late_display}</small></div>
                                                        )}
                                                    </td>
                                                    <td className="small text-danger d-none d-sm-table-cell">
                                                        {formatTime(record.clock_out) || '--:--'}
                                                    </td>
                                                    <td className="small d-none d-lg-table-cell">
                                                        {record.total_hours > 0 ? formatDecimalHoursToHMS(parseFloat(record.total_hours)) : '-'}
                                                    </td>
                                                    <td>
                                                        {getStatusBadge(record.status, record.is_late, record.late_display, record.overtime_hours)}
                                                    </td>
                                                    <td className="text-center">
                                                        <Button variant="outline-secondary" size="sm" onClick={() => setShowDetails(prev => ({ ...prev, [index]: !prev[index] }))}>
                                                            {showDetails[index] ? <FaEyeSlash size={10} /> : <FaEye size={10} />}
                                                        </Button>
                                                    </td>
                                                </tr>
                                                {showDetails[index] && (
                                                    <tr className="bg-light">
                                                        <td colSpan="8" className="p-3">
                                                            <Row className="g-2 small">
                                                                <Col xs={12} md={4}><strong>Employee:</strong> {record.employee_name}</Col>
                                                                <Col xs={12} md={4}><strong>ID:</strong> {record.employee_id}</Col>
                                                                <Col xs={12} md={4}><strong>Department:</strong> {record.department || 'N/A'}</Col>
                                                                <Col xs={12} md={4}><strong>Date:</strong> {formatDate(record.attendance_date)}</Col>
                                                                <Col xs={12} md={4}><strong>Clock In:</strong> {formatTime(record.clock_in) || '--:--'}</Col>
                                                                <Col xs={12} md={4}><strong>Clock Out:</strong> {formatTime(record.clock_out) || '--:--'}</Col>
                                                                <Col xs={12} md={4}><strong>Total Hours:</strong> {record.total_hours || 0}h</Col>
                                                                {record.is_late && <Col xs={12} md={4}><strong className="text-warning">Late Duration:</strong> {record.late_display}</Col>}
                                                                {record.overtime_hours > 0 && <Col xs={12} md={4}><strong className="text-success">Overtime:</strong> +{record.overtime_hours}h</Col>}
                                                                {record.leave_type && <Col xs={12}><strong>Leave Type:</strong> {record.leave_type}</Col>}
                                                            </Row>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <tr><td colSpan="8" className="text-center py-4"><FaCalendarAlt size={30} className="text-muted mb-2 opacity-50" /><p className="text-muted mb-0">No attendance records found</p></td></tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    ) : (
                        <div className="table-responsive" style={{ maxHeight: '500px', overflow: 'auto' }}>
                            <Table className="mb-0" size="sm" bordered>
                                <thead className="bg-light sticky-top">
                                    <tr className="small text-center">
                                        <th className="fw-normal" style={{ position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 20, minWidth: '120px' }}>Employee</th>
                                        {uniqueDates.map(date => (
                                            <th key={date} className="fw-normal" style={{ minWidth: '40px' }}>
                                                {new Date(date).getDate()}
                                                <br /><small className="text-muted">{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</small>
                                            </th>
                                        ))}
                                        <th className="fw-normal">P</th>
                                        <th className="fw-normal">H</th>
                                        <th className="fw-normal">L</th>
                                        <th className="fw-normal">A</th>
                                        <th className="fw-normal">OT</th>
                                        <th className="fw-normal">Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getCalendarData().map((employee, idx) => {
                                        const empStats = employeeSummary.find(e => e.employee_id === employee.employee_id);
                                        return (
                                            <tr key={employee.employee_id}>
                                                <td className="small" style={{ position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 10, minWidth: '120px' }}>
                                                    <div className="fw-semibold text-truncate" style={{ maxWidth: '110px' }} title={employee.employee_name}>
                                                        {employee.employee_name}
                                                    </div>
                                                    <small className="text-muted">{employee.employee_id}</small>
                                                </td>
                                                {uniqueDates.map(date => {
                                                    const record = employee.records[date];
                                                    let statusDisplay = '•';
                                                    let statusColor = 'text-secondary';
                                                    if (record) {
                                                        if (record.status === 'present' || record.status === 'working') {
                                                            statusDisplay = '✓';
                                                            statusColor = record.is_late ? 'text-warning' : 'text-success';
                                                        } else if (record.status === 'half_day') {
                                                            statusDisplay = '½';
                                                            statusColor = 'text-warning';
                                                        } else if (record.status === 'on_leave') {
                                                            statusDisplay = 'L';
                                                            statusColor = 'text-purple';
                                                        } else if (record.status === 'weekend') {
                                                            statusDisplay = 'W';
                                                            statusColor = 'text-secondary';
                                                        } else {
                                                            statusDisplay = '✗';
                                                            statusColor = 'text-danger';
                                                        }
                                                    }
                                                    return (
                                                        <td key={date} className={`small text-center align-middle ${statusColor}`} title={record ? `${record.status}${record.is_late ? ' (Late)' : ''}` : 'No data'}>
                                                            <span className="fw-bold">{statusDisplay}</span>
                                                            {record?.overtime_hours > 0 && <sup className="text-success">+</sup>}
                                                            {record?.is_late && <sup className="text-warning">*</sup>}
                                                        </td>
                                                    );
                                                })}
                                                <td className="text-center"><Badge bg="success" pill>{empStats?.total_present || 0}</Badge></td>
                                                <td className="text-center"><Badge bg="warning" pill>{empStats?.total_half_day || 0}</Badge></td>
                                                <td className="text-center"><Badge bg="purple" pill style={{ backgroundColor: '#6f42c1' }}>{empStats?.total_on_leave || 0}</Badge></td>
                                                <td className="text-center"><Badge bg="danger" pill>{empStats?.total_absent || 0}</Badge></td>
                                                <td className="text-center">{empStats?.total_overtime_hours > 0 && <Badge bg="success" pill>+{empStats.total_overtime_hours}h</Badge>}</td>
                                                <td className="text-center fw-bold">{empStats?.attendance_rate || 0}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Legend */}
            <div className="mt-3 d-flex flex-wrap justify-content-center gap-3 small text-muted">
                <span><Badge bg="success" pill className="me-1">✓</Badge> Present</span>
                <span><Badge bg="warning" pill className="me-1">½</Badge> Half Day</span>
                <span><Badge bg="purple" pill className="me-1" style={{ backgroundColor: '#6f42c1' }}>L</Badge> On Leave</span>
                <span><Badge bg="secondary" pill className="me-1">W</Badge> Weekend</span>
                <span><Badge bg="danger" pill className="me-1">✗</Badge> Absent</span>
                <span className="text-warning"><FaExclamationTriangle className="me-1" size={10} /> Late Login (*)</span>
                <span className="text-success"><FaClock className="me-1" size={10} /> Overtime (+)</span>
            </div>
        </div>
    );
};

export default TeamAttendanceReport;