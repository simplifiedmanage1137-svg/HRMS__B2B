// components/Admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Badge, Spinner, Alert, Form, Button } from 'react-bootstrap';
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaCalendarAlt,
  FaBirthdayCake,
  FaTrophy,
  FaChartLine,
  FaBalanceScale,
  FaSearch,
  FaFilter,
  FaDownload,
  FaClock,
  FaFingerprint,
  FaMapMarkerAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaUserClock,
  FaUserGraduate,
  FaUserTie,
  FaUmbrellaBeach,
  FaSyncAlt
} from 'react-icons/fa';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { todayEvents, fetchTodayEvents } = useNotification();

  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    onLeave: 0,
    late: 0,
    early: 0,
    halfDay: 0,
    working: 0
  });

  const [recentEmployees, setRecentEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [employeeLeaveBalances, setEmployeeLeaveBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [departmentStats, setDepartmentStats] = useState({});
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);

  useEffect(() => {
    fetchDashboardData();
    fetchTodayEvents();

    const timer = setInterval(() => {
      if (autoRefresh) {
        refreshAttendanceData();
        refreshLeaveRequests();
        fetchTodayEvents();
      }
    }, 30000); // Increased to 30 seconds for better performance

    return () => clearInterval(timer);
  }, [autoRefresh]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const employeesRes = await axios.get(API_ENDPOINTS.EMPLOYEES);

      // Safely extract employees array
      let employees = [];
      if (employeesRes.data) {
        if (Array.isArray(employeesRes.data)) {
          employees = employeesRes.data;
        } else if (employeesRes.data.data && Array.isArray(employeesRes.data.data)) {
          employees = employeesRes.data.data;
        } else if (employeesRes.data.employees && Array.isArray(employeesRes.data.employees)) {
          employees = employeesRes.data.employees;
        } else {
          // Try to convert object to array if it's not empty
          const possibleArray = Object.values(employeesRes.data).filter(v => typeof v === 'object');
          if (possibleArray.length > 0 && possibleArray[0]?.id) {
            employees = possibleArray;
          }
        }
      }

      console.log('Employees fetched:', employees.length);
      setTotalEmployees(employees.length);

      setStats(prevStats => ({
        ...prevStats,
        total: employees.length
      }));

      // Fetch leave balances for each employee
      const balancesPromises = employees.map(async (emp) => {
        try {
          const balanceRes = await axios.get(API_ENDPOINTS.LEAVE_BALANCE(emp.employee_id));
          return {
            ...emp,
            leaveBalance: balanceRes.data
          };
        } catch (error) {
          console.warn(`Error fetching balance for ${emp.employee_id}:`, error);
          return {
            ...emp,
            leaveBalance: {
              available: '0',
              total_accrued: '0',
              used: '0',
              pending: '0'
            }
          };
        }
      });

      const employeesWithBalance = await Promise.all(balancesPromises);
      setEmployeeLeaveBalances(employeesWithBalance);

      await refreshLeaveRequests();
      await refreshAttendanceData();

      setRecentEmployees(employees.slice(-5));
      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to load dashboard data'
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAttendanceData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendanceRes = await axios.get(
        `${API_ENDPOINTS.ATTENDANCE_REPORT}?start=${today}&end=${today}`
      );

      const attendanceData = attendanceRes.data.attendance || [];
      setTodayAttendance(attendanceData);

      updateStats(attendanceData);

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing attendance:', error);
    }
  };

  const refreshLeaveRequests = async () => {
    try {
      const leavesRes = await axios.get(API_ENDPOINTS.LEAVES);
      setLeaveRequests(leavesRes.data.filter(leave => leave.status === 'pending'));
    } catch (error) {
      console.error('Error refreshing leave requests:', error);
    }
  };

  const updateStats = (attendanceData) => {
    const total = totalEmployees;

    const present = attendanceData.filter(a => a.status === 'present').length;
    const halfDay = attendanceData.filter(a => a.status === 'half_day').length;
    const working = attendanceData.filter(a => a.status === 'working' || (a.clock_in && !a.clock_out)).length;
    const late = attendanceData.filter(a => parseFloat(a.late_minutes) > 0).length;
    const onLeave = attendanceData.filter(a => a.is_on_leave || a.status === 'on_leave').length;

    const totalPresent = present + halfDay + working;

    let absent = total - totalPresent - onLeave;
    absent = absent < 0 ? 0 : absent;

    setStats(prevStats => ({
      ...prevStats,
      total: total,
      present: totalPresent,
      absent: absent,
      onLeave: onLeave,
      late: late,
      early: prevStats.early,
      halfDay: halfDay,
      working: working
    }));

    if (employeeLeaveBalances.length > 0) {
      const deptStats = {};
      employeeLeaveBalances.forEach(emp => {
        if (!deptStats[emp.department]) {
          deptStats[emp.department] = {
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            onLeave: 0
          };
        }
        deptStats[emp.department].total++;
      });

      attendanceData.forEach(record => {
        if (deptStats[record.department]) {
          if (record.status === 'present' || record.status === 'working' || record.status === 'half_day') {
            deptStats[record.department].present++;
          }
          if (record.late_minutes > 0) {
            deptStats[record.department].late++;
          }
          if (record.is_on_leave || record.status === 'on_leave') {
            deptStats[record.department].onLeave++;
          }
        }
      });

      Object.keys(deptStats).forEach(dept => {
        const deptTotal = deptStats[dept].total;
        const deptPresent = deptStats[dept].present || 0;
        const deptOnLeave = deptStats[dept].onLeave || 0;
        let deptAbsent = deptTotal - deptPresent - deptOnLeave;
        deptStats[dept].absent = deptAbsent < 0 ? 0 : deptAbsent;
      });

      setDepartmentStats(deptStats);
    }
  };

  const getFilteredEmployees = () => {
    let filtered = [...employeeLeaveBalances];

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(emp => emp.department === filterDepartment);
    }

    if (searchTerm) {
      filtered = filtered.filter(emp =>
        emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.first_name || '').localeCompare(b.first_name || '');
      } else if (sortBy === 'balance') {
        return (parseFloat(b.leaveBalance?.available) || 0) - (parseFloat(a.leaveBalance?.available) || 0);
      } else if (sortBy === 'department') {
        return (a.department || '').localeCompare(b.department || '');
      }
      return 0;
    });

    return filtered;
  };

  const departments = ['all', ...new Set(employeeLeaveBalances.map(emp => emp.department).filter(Boolean))];

  const totalLeavesAvailable = employeeLeaveBalances.reduce((sum, emp) =>
    sum + (parseFloat(emp.leaveBalance?.available) || 0), 0
  );

  const averageLeavesPerEmployee = employeeLeaveBalances.length > 0
    ? (totalLeavesAvailable / employeeLeaveBalances.length).toFixed(1)
    : 0;

  const employeesWithLowBalance = employeeLeaveBalances.filter(emp =>
    parseFloat(emp.leaveBalance?.available) < 3
  ).length;

  const formatTime = (datetime) => {
    if (!datetime) return '--:--';
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (record) => {
    if (record.is_on_leave || record.status === 'on_leave') {
      return (
        <Badge bg="purple" style={{ backgroundColor: '#6f42c1' }}>
          <FaUmbrellaBeach className="me-1" size={10} />
          On Leave
        </Badge>
      );
    }
    if (!record.clock_in) {
      return <Badge bg="secondary">Not Clocked</Badge>;
    }
    if (!record.clock_out) {
      return <Badge bg="info">Working</Badge>;
    }
    if (record.status === 'present') {
      return <Badge bg="success">Present</Badge>;
    }
    if (record.status === 'half_day') {
      return <Badge bg="warning">Half Day</Badge>;
    }
    return <Badge bg="danger">Absent</Badge>;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted small">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredEmployees = getFilteredEmployees();
  const hasCelebrations = todayEvents?.total > 0;

  return (
    <div className="p-2 p-md-3 p-lg-4">
      {/* Header - Responsive flex column on mobile */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h4 className="mb-1 d-flex align-items-center flex-wrap">
            <FaUsers className="me-2 text-dark" />
            <span>Admin Dashboard</span>
          </h4>
          <p className="text-muted mb-0 small d-flex align-items-center flex-wrap">
            <FaClock className="me-1" size={12} />
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            <Button
              variant="link"
              size="sm"
              className="ms-2 p-0 text-decoration-none"
              onClick={() => {
                refreshAttendanceData();
                refreshLeaveRequests();
                fetchTodayEvents();
              }}
            >
              <FaSyncAlt size={12} className="text-primary" />
            </Button>
          </p>
        </div>
        <Form.Check
          type="switch"
          id="auto-refresh"
          label="Auto-refresh"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
          className="mb-0 ms-0 ms-md-auto"
        />
      </div>

      {/* Message Alert */}
      {message.text && (
        <Alert
          variant={message.type}
          onClose={() => setMessage({ type: '', text: '' })}
          dismissible
          className="mb-4"
        >
          {message.text}
        </Alert>
      )}

      {/* ========== TODAY'S EVENTS WIDGET - SHOW ONLY WHEN THERE ARE CELEBRATIONS ========== */}
      {hasCelebrations && (
        <Card className="mb-4 border-0 shadow-sm">
          <Card.Header className="bg-gradient text-white py-2" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}>
            <h6 className="mb-0 d-flex align-items-center">
              <FaBirthdayCake className="me-2" size={14} />
              <FaTrophy className="me-2" size={14} />
              Today's Celebrations 🎉
            </h6>
          </Card.Header>
          <Card.Body className="p-3">
            <div className="d-flex flex-column flex-sm-row flex-wrap gap-2">
              {/* Birthdays */}
              {todayEvents.birthdays?.map(emp => (
                <Badge
                  key={`birthday-${emp.id}`}
                  bg="light"
                  text="dark"
                  className="p-2 d-flex align-items-center gap-2 shadow-sm w-100 w-sm-auto"
                  style={{
                    borderLeft: '4px solid #ff6b6b',
                    borderRadius: '8px',
                    minWidth: '250px',
                    maxWidth: '100%'
                  }}
                >
                  <div className="d-flex align-items-center gap-2 w-100">
                    <FaBirthdayCake color="#ff6b6b" size={24} className="flex-shrink-0" />
                    <div className="text-start flex-grow-1">
                      <span className="small fw-bold d-block text-truncate">
                        {emp.first_name} {emp.last_name}
                      </span>
                      <small className="text-muted d-block text-truncate">
                        {emp.department} • {emp.position}
                      </small>
                      <small className="text-danger d-block">
                        🎂 Birthday Today!
                      </small>
                    </div>
                  </div>
                </Badge>
              ))}

              {/* Anniversaries */}
              {todayEvents.anniversaries?.map(emp => (
                <Badge
                  key={`anniversary-${emp.id}`}
                  bg="light"
                  text="dark"
                  className="p-2 d-flex align-items-center gap-2 shadow-sm w-100 w-sm-auto"
                  style={{
                    borderLeft: '4px solid #ffd700',
                    borderRadius: '8px',
                    minWidth: '250px',
                    maxWidth: '100%'
                  }}
                >
                  <div className="d-flex align-items-center gap-2 w-100">
                    <FaTrophy color="#ffd700" size={24} className="flex-shrink-0" />
                    <div className="text-start flex-grow-1">
                      <span className="small fw-bold d-block text-truncate">
                        {emp.first_name} {emp.last_name}
                      </span>
                      <small className="text-muted d-block text-truncate">
                        {emp.department} • {emp.position}
                      </small>
                      <small className="text-warning d-block" style={{ color: '#b45f06' }}>
                        🏆 {emp.years} Year{emp.years > 1 ? 's' : ''} Anniversary!
                      </small>
                    </div>
                  </div>
                </Badge>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-3 pt-2 border-top small text-muted d-flex flex-wrap align-items-center gap-2">
              <span className="fw-semibold">Total Celebrations Today:</span>
              <Badge bg="success" pill className="ms-1" style={{ fontSize: '14px' }}>
                {todayEvents.total}
              </Badge>
              {todayEvents.birthdays?.length > 0 && (
                <Badge bg="danger" pill className="ms-0 ms-sm-2" style={{ backgroundColor: '#ff6b6b' }}>
                  🎂 {todayEvents.birthdays.length} Birthday
                </Badge>
              )}
              {todayEvents.anniversaries?.length > 0 && (
                <Badge bg="warning" pill className="ms-0 ms-sm-2" style={{ backgroundColor: '#ffd700', color: '#000' }}>
                  🏆 {todayEvents.anniversaries.length} Anniversary
                </Badge>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Quick Stats Cards - Responsive grid */}
      <Row className="mb-4 g-2 g-md-3">
        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm bg-white h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div className="overflow-hidden">
                  <h6 className="text-secondary mb-2 small">Total Employees</h6>
                  <h4 className="mb-0 fw-bold">{totalEmployees}</h4>
                  <small className="text-muted text-truncate d-block">Active employees</small>
                </div>
                <FaUsers size={30} className="text-secondary opacity-50 flex-shrink-0" />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm bg-white h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div className="overflow-hidden">
                  <h6 className="text-secondary mb-2 small">Present Today</h6>
                  <h4 className="mb-0 fw-bold">{stats.present}</h4>
                  <small className="text-muted text-truncate d-block">{stats.working} working now</small>
                </div>
                <FaUserCheck size={30} className="text-secondary opacity-50 flex-shrink-0" />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm bg-white h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div className="overflow-hidden">
                  <h6 className="text-secondary mb-2 small">On Leave / Half Day</h6>
                  <h4 className="mb-0 fw-bold">{stats.onLeave + stats.halfDay}</h4>
                  <small className="text-muted text-truncate d-block">{stats.halfDay} half day</small>
                </div>
                <FaUmbrellaBeach size={30} className="text-secondary opacity-50 flex-shrink-0" />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm bg-white h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div className="overflow-hidden">
                  <h6 className="text-secondary mb-2 small">Absent</h6>
                  <h4 className="mb-0 fw-bold">{stats.absent}</h4>
                  <small className="text-muted text-truncate d-block">{stats.late} late arrivals</small>
                </div>
                <FaUserTimes size={30} className="text-secondary opacity-50 flex-shrink-0" />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Live Attendance Feed */}
      <Card className="mb-5 border-0 shadow-sm">
        <Card.Header className="bg-light d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center py-3 gap-2">
          <h5 className="mb-0 text-dark d-flex align-items-center">
            <FaClock className="me-2 text-dark" />
            <span>Live Attendance Feed</span>
          </h5>
          <Badge bg="dark" className="px-3 py-2 ms-0 ms-sm-auto">
            {todayAttendance.length} Records
          </Badge>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <Table striped size="sm" className="mb-0 align-middle">
              <thead className="bg-light sticky-top text-dark fw-semibold">
                <tr className="small">
                  <th className="text-dark fw-normal text-center">Sr No</th>
                  <th className="text-dark fw-normal">Employee</th>
                  <th className="text-dark fw-normal d-none d-md-table-cell">Department</th>
                  <th className="text-dark fw-normal d-none d-lg-table-cell">Shift</th>
                  <th className="text-dark fw-normal">Clock In</th>
                  <th className="text-dark fw-normal d-none d-sm-table-cell">Clock Out</th>
                  <th className="text-dark fw-normal d-none d-xl-table-cell">Hours</th>
                  <th className="text-dark fw-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayAttendance && todayAttendance.length > 0 ? (
                  todayAttendance.map((att, index) => {
                    const isWorking = att.clock_in && !att.clock_out;

                    return (
                      <tr key={index} className={isWorking ? 'table-white' : ''}>
                        <td className="fw-normal text-center">{index + 1}</td>
                        <td>
                          <div className="small text-truncate" style={{ maxWidth: '120px' }}>
                            {att.first_name} {att.last_name}
                          </div>
                          <small className="text-muted d-block">{att.employee_id}</small>
                        </td>
                        <td className="small d-none d-md-table-cell text-truncate" style={{ maxWidth: '100px' }}>
                          {att.department}
                        </td>
                        <td className="small d-none d-lg-table-cell text-truncate" style={{ maxWidth: '80px' }}>
                          {att.shift_time_used || 'Not set'}
                        </td>
                        <td className={`small ${att.clock_in ? 'text-success' : 'text-muted'}`}>
                          {formatTime(att.clock_in)}
                          {att.late_minutes > 0 && (
                            <Badge bg="danger" className="ms-1" pill>
                              Late
                            </Badge>
                          )}
                        </td>
                        <td className={`small d-none d-sm-table-cell ${att.clock_out ? 'text-danger' : 'text-muted'}`}>
                          {formatTime(att.clock_out)}
                        </td>
                        <td className="small d-none d-xl-table-cell">
                          {att.total_hours || '0.0'} hrs
                        </td>
                        <td>{getStatusBadge(att)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center py-4">
                      <FaClock size={30} className="text-muted mb-2 opacity-50" />
                      <p className="text-muted mb-0">No attendance records for today</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Pending Leave Requests */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Header className="bg-light d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center py-3 gap-2">
          <h5 className="mb-0 text-dark d-flex align-items-center">
            <FaCalendarAlt className="me-2" />
            <span>Pending Leave Requests</span>
          </h5>
          <Badge bg="light" text="dark" className="px-3 py-2 ms-0 ms-sm-auto">
            {leaveRequests.length} Pending
          </Badge>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <Table striped size="sm" className="mb-0">
              <thead className="bg-light sticky-top text-dark">
                <tr>
                  <th className="text-dark small fw-normal text-center">Sr No</th>
                  <th className="text-dark small fw-normal">Employee</th>
                  <th className="text-dark small fw-normal d-none d-md-table-cell">Designation</th>
                  <th className="text-dark small fw-normal d-none d-sm-table-cell">Leave Type</th>
                  <th className="text-dark small fw-normal d-none d-lg-table-cell">Date Range</th>
                  <th className="text-dark small fw-normal d-none d-xl-table-cell">Days</th>
                  <th className="text-dark small fw-normal d-none d-xxl-table-cell">Reason</th>
                  <th className="text-dark small fw-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.length > 0 ? (
                  leaveRequests.map((leave, index) => (
                    <tr key={leave.id}>
                      <td className="fw-normal text-center">{index + 1}</td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '100px' }}>
                          {leave.first_name} {leave.last_name}
                        </div>
                        <small className="text-muted d-block">{leave.employee_id}</small>
                      </td>
                      <td className="d-none d-md-table-cell text-truncate" style={{ maxWidth: '100px' }}>
                        {leave.designation}
                      </td>
                      <td className="d-none d-sm-table-cell">
                        <Badge bg="secondary">{leave.leave_type}</Badge>
                      </td>
                      <td className="d-none d-lg-table-cell">
                        <span className="text-nowrap">{new Date(leave.start_date).toLocaleDateString()}</span>
                        {leave.start_date !== leave.end_date && (
                          <span className="text-nowrap d-block">- {new Date(leave.end_date).toLocaleDateString()}</span>
                        )}
                      </td>
                      <td className="d-none d-xl-table-cell">{leave.days_count || 1}</td>
                      <td className="d-none d-xxl-table-cell text-truncate" style={{ maxWidth: '150px' }}>
                        {leave.reason}
                      </td>
                      <td>
                        <Badge bg="warning">Pending</Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center py-4">
                      <FaCalendarAlt size={30} className="text-muted mb-2 opacity-50" />
                      <p className="text-muted mb-0">No pending leave requests</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Employee Leave Balances */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Header className="bg-white d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center py-3 gap-2">
          <h5 className="mb-0 d-flex align-items-center">
            <FaBalanceScale className="me-2 text-dark" />
            <span>Employee Leave Balances</span>
          </h5>
          <Badge bg="dark" className="px-3 py-2 ms-0 ms-sm-auto">
            Total: {filteredEmployees.length} Employees
          </Badge>
        </Card.Header>
        <Card.Body>
          {/* Filters - Responsive stack on mobile */}
          <Row className="mb-3 g-2">
            <Col xs={12} md={4}>
              <div className="d-flex align-items-center bg-light rounded-3 p-1">
                <FaSearch className="ms-2 text-muted" size={14} />
                <Form.Control
                  type="text"
                  placeholder="Search by name, ID, department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-0 bg-transparent"
                  size="sm"
                />
              </div>
            </Col>
            <Col xs={6} md={3}>
              <Form.Select size="sm" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
                <option value="all">All Departments</option>
                {departments.filter(d => d !== 'all').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={6} md={3}>
              <Form.Select size="sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">Sort by Name</option>
                <option value="balance">Sort by Balance</option>
                <option value="department">Sort by Department</option>
              </Form.Select>
            </Col>
          </Row>

          {/* Table with Scroll */}
          <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <Table striped size="sm" className="mb-0">
              <thead className="bg-light sticky-top text-dark fw-semibold">
                <tr className="small">
                  <th className="text-dark fw-normal text-center">Sr No</th>
                  <th className="text-dark fw-normal">Employee</th>
                  <th className="text-dark fw-normal d-none d-md-table-cell">Department</th>
                  <th className="text-dark fw-normal d-none d-lg-table-cell">Designation</th>
                  <th className="text-dark fw-normal d-none d-xl-table-cell">Total Accrued</th>
                  <th className="text-dark fw-normal d-none d-xl-table-cell">Used</th>
                  <th className="text-dark fw-normal d-none d-xl-table-cell">Pending</th>
                  <th className="text-dark fw-normal">Available</th>
                  <th className="text-dark fw-normal d-none d-sm-table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp, index) => {
                    const available = parseFloat(emp.leaveBalance?.available) || 0;
                    const statusColor = available <= 0 ? 'danger' : available < 3 ? 'warning' : 'success';

                    return (
                      <tr key={emp.id}>
                        <td className="small text-center">{index + 1}</td>
                        <td>
                          <div className="small text-truncate" style={{ maxWidth: '100px' }}>
                            {emp.first_name} {emp.last_name}
                          </div>
                          <small className="text-muted small d-block">{emp.employee_id}</small>
                        </td>
                        <td className="small d-none d-md-table-cell text-truncate" style={{ maxWidth: '100px' }}>
                          {emp.department}
                        </td>
                        <td className="small d-none d-lg-table-cell text-truncate" style={{ maxWidth: '100px' }}>
                          {emp.designation}
                        </td>
                        <td className="small d-none d-xl-table-cell">{emp.leaveBalance?.total_accrued || '0'}</td>
                        <td className="text-danger small d-none d-xl-table-cell">{emp.leaveBalance?.used || '0'}</td>
                        <td className="text-start small d-none d-xl-table-cell">
                          {(() => {
                            const total = parseFloat(emp.leaveBalance?.total_accrued) || 0;
                            const used = parseFloat(emp.leaveBalance?.used) || 0;
                            const pending = total - used;

                            if (pending > 0) {
                              return (
                                <Badge bg="warning" pill>
                                  {pending.toFixed(1)}
                                </Badge>
                              );
                            }
                            return (
                              <Badge bg="secondary" pill>
                                0
                              </Badge>
                            );
                          })()}
                        </td>
                        <td>
                          <Badge bg={statusColor} pill>
                            {emp.leaveBalance?.available || '0'}
                          </Badge>
                        </td>
                        <td className="d-none d-sm-table-cell">
                          {available <= 0 ? (
                            <Badge bg="danger" pill>No Leaves</Badge>
                          ) : available < 3 ? (
                            <Badge bg="warning" pill>Low</Badge>
                          ) : (
                            <Badge bg="success" pill>Good</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center py-4">
                      <p className="text-muted mb-0">No employees found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default AdminDashboard;