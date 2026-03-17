// src/components/Admin/AttendanceReports.jsx
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Badge, Form, Row, Col, Button,
  Spinner, Alert, InputGroup
} from 'react-bootstrap';
import {
  FaCalendarAlt, FaDownload, FaPrint, FaEye,
  FaSearch, FaFilter, FaFileExcel,
  FaTimes, FaCheck, FaExclamationTriangle,
  FaTrophy
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import * as XLSX from 'xlsx';

const AttendanceReports = () => {
  const [attendance, setAttendance] = useState([]);
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of current month
    end: new Date().toISOString().split('T')[0] // Today
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    half_day: 0,
    late: 0,
    comp_off_earned: 0 // Added comp-off stats
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchAttendance();
  }, [dateRange]);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, departmentFilter, attendance]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      console.log('Fetching attendance for date range:', dateRange);

      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_REPORT, {
        params: {
          start: dateRange.start,
          end: dateRange.end
        }
      });

      console.log('Attendance data received:', response.data);

      if (response.data.success) {
        setAttendance(response.data.attendance || []);
        setFilteredAttendance(response.data.attendance || []);
        
        // Calculate stats - added comp_off_earned
        const att = response.data.attendance || [];
        const total = att.length;
        const present = att.filter(a => a.status === 'present').length;
        const absent = att.filter(a => a.status === 'absent').length;
        const half_day = att.filter(a => a.status === 'half_day').length;
        const late = att.filter(a => parseFloat(a.late_minutes) > 0).length;
        const comp_off_earned = att.filter(a => a.comp_off_awarded).length; // Added

        setStats({ total, present, absent, half_day, late, comp_off_earned });

        // Extract unique departments
        const uniqueDepts = [...new Set(att.map(a => a.department).filter(Boolean))];
        setDepartments(uniqueDepts);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to load attendance data'
      });
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...attendance];

    // Apply search filter
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(record => {
        const fullName = `${record.first_name || ''} ${record.last_name || ''}`.toLowerCase();
        const employeeId = (record.employee_id || '').toLowerCase();
        return fullName.includes(term) || employeeId.includes(term);
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.status === statusFilter);
    }

    // Apply department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(record => record.department === departmentFilter);
    }

    setFilteredAttendance(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDepartmentFilter('all');
  };

  const handleExportExcel = () => {
    try {
      // Added comp-off fields to export
      const data = filteredAttendance.map((record, index) => ({
        'Sr No': index + 1,
        'Employee ID': record.employee_id,
        'Employee Name': `${record.first_name || ''} ${record.last_name || ''}`.trim(),
        'Department': record.department || 'N/A',
        'Date': record.attendance_date,
        'Clock In': record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : '-',
        'Clock Out': record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : '-',
        'Total Hours': record.total_hours ? record.total_hours.toFixed(2) : '-',
        'Status': record.status || 'N/A',
        'Late Minutes': record.late_minutes || 0,
        'Holiday': record.is_holiday ? (record.holiday_name || 'Yes') : 'No', // Added
        'Comp-Off Earned': record.comp_off_awarded ? 'Yes' : 'No', // Added
        'Comp-Off Days': record.comp_off_days || 0 // Added
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
      XLSX.writeFile(wb, `Attendance_Report_${dateRange.start}_to_${dateRange.end}.xlsx`);

      setMessage({
        type: 'success',
        text: 'Excel file downloaded successfully!'
      });

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setMessage({
        type: 'danger',
        text: 'Failed to export data. Please try again.'
      });
    }
  };

  // Modified to show comp-off badge
  const getStatusBadge = (record) => {
    if (record.comp_off_awarded) {
      return <Badge bg="purple" className="px-2 py-1">🎉 Comp-Off Earned</Badge>;
    }
    
    if (record.is_holiday) {
      return <Badge bg="info" className="px-2 py-1">🏖️ {record.holiday_name || 'Holiday'}</Badge>;
    }

    switch(record.status) {
      case 'present':
        return <Badge bg="success" className="px-2 py-1">Present</Badge>;
      case 'absent':
        return <Badge bg="danger" className="px-2 py-1">Absent</Badge>;
      case 'half_day':
        return <Badge bg="warning" className="px-2 py-1">Half Day</Badge>;
      default:
        return <Badge bg="secondary" className="px-2 py-1">{record.status || 'N/A'}</Badge>;
    }
  };

  const formatTime = (datetime) => {
    if (!datetime) return '-';
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted small">Loading attendance reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h5 className="mb-4 h4">
        <FaCalendarAlt className="me-2 text-dark" />
        Attendance Reports
      </h5>

      {/* Message Alert */}
      {message.text && (
        <Alert
          variant={message.type}
          onClose={() => setMessage({ type: '', text: '' })}
          dismissible
          className="mb-4 shadow-sm"
        >
          {message.type === 'success' && <FaCheck className="me-2" size={14} />}
          {message.type === 'danger' && <FaExclamationTriangle className="me-2" size={14} />}
          {message.text}
        </Alert>
      )}

      {/* Date Range and Filters - EXACTLY as original */}
      <Card className="mb-4 shadow-sm border-0">
        <Card.Body className="p-3">
          <Row className="g-3">
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small text-muted">Start Date</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="bg-light border-0"
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small text-muted">End Date</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="bg-light border-0"
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-muted">Search</Form.Label>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-light border-0">
                    <FaSearch size={10} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-0 bg-light"
                  />
                  {searchTerm && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setSearchTerm('')}
                      className="border-0"
                    >
                      <FaTimes size={10} />
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small text-muted">Status</Form.Label>
                <Form.Select
                  size="sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-light border-0"
                >
                  <option value="all">All Status</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half_day">Half Day</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small text-muted">Department</Form.Label>
                <Form.Select
                  size="sm"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="bg-light border-0"
                >
                  <option value="all">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={1} className="d-flex align-items-end">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={clearFilters}
                className="w-100"
                disabled={!searchTerm && statusFilter === 'all' && departmentFilter === 'all'}
              >
                Clear
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Statistics Cards - Added Comp-Off card */}
      <Row className="mb-4 g-3">
        <Col md={2}>
          <Card className="border-0 shadow-sm bg-primary text-white">
            <Card.Body className="p-2 text-center">
              <small>Total</small>
              <h5 className="mb-0">{stats.total}</h5>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="border-0 shadow-sm bg-success text-white">
            <Card.Body className="p-2 text-center">
              <small>Present</small>
              <h5 className="mb-0">{stats.present}</h5>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="border-0 shadow-sm bg-danger text-white">
            <Card.Body className="p-2 text-center">
              <small>Absent</small>
              <h5 className="mb-0">{stats.absent}</h5>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="border-0 shadow-sm bg-warning text-white">
            <Card.Body className="p-2 text-center">
              <small>Half Day</small>
              <h5 className="mb-0">{stats.half_day}</h5>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="border-0 shadow-sm bg-info text-white">
            <Card.Body className="p-2 text-center">
              <small>Late</small>
              <h5 className="mb-0">{stats.late}</h5>
            </Card.Body>
          </Card>
        </Col>
        {/* Added Comp-Off Card */}
        <Col md={2}>
          <Card className="border-0 shadow-sm bg-purple text-white">
            <Card.Body className="p-2 text-center">
              <small>Comp-Off</small>
              <h5 className="mb-0">{stats.comp_off_earned}</h5>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Attendance Table - Added Comp-Off column */}
      <Card className="shadow-sm border-0">
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center border-0">
          <h5 className="mb-0 medium fw-semibold">
            <FaCalendarAlt className="me-2 text-dark" size={20} />
            Attendance Records
          </h5>
          <div className="d-flex gap-2">
            <Badge bg="secondary" className="px-3 py-2">
              Showing: {filteredAttendance.length} of {attendance.length} Records
            </Badge>
            <Button
              variant="success"
              size="sm"
              onClick={handleExportExcel}
              disabled={filteredAttendance.length === 0}
            >
              <FaFileExcel className="me-1" size={12} />
              Export Excel
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table hover className="mb-0" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                <tr>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '50px' }}>#</th>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '100px' }}>Emp ID</th>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '150px' }}>Employee</th>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '100px' }}>Department</th>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '100px' }}>Date</th>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '80px' }}>Clock In</th>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '80px' }}>Clock Out</th>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '80px' }}>Hours</th>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '100px' }}>Status</th>
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '60px' }}>Late</th>
                  {/* Added Comp-Off column */}
                  <th className="small text-dark fw-normal text-nowrap" style={{ width: '80px' }}>Comp-Off</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length > 0 ? (
                  filteredAttendance.map((record, index) => (
                    <tr key={record.id || index}>
                      <td className="small text-start">{index + 1}</td>
                      <td className="small text-start">{record.employee_id}</td>
                      <td className="small text-start">
                        <div>
                          <div className="fw-normal text-truncate" style={{ maxWidth: '140px' }}>
                            {record.first_name} {record.last_name}
                          </div>
                        </div>
                      </td>
                      <td className="small text-start">{record.department}</td>
                      <td className="small text-start">{formatDate(record.attendance_date)}</td>
                      <td className="small text-start">{formatTime(record.clock_in)}</td>
                      <td className="small text-start">{formatTime(record.clock_out)}</td>
                      <td className="small text-start">{record.total_hours?.toFixed(1) || '-'}</td>
                      <td className="small text-start">{getStatusBadge(record)}</td>
                      <td className="small text-start">
                        {record.late_minutes > 0 ? (
                          <Badge bg="warning" pill>
                            {Math.round(record.late_minutes)}m
                          </Badge>
                        ) : '-'}
                      </td>
                      {/* Added Comp-Off cell */}
                      <td className="small text-start">
                        {record.comp_off_awarded ? (
                          <Badge bg="purple" pill>
                            <FaTrophy className="me-1" size={8} />
                            {record.comp_off_days} day
                          </Badge>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11" className="text-center py-5">
                      <FaCalendarAlt size={40} className="text-muted mb-3 opacity-50" />
                      <h6 className="text-muted">No attendance records found</h6>
                      <p className="text-muted mb-0 small">
                        Try adjusting your filters or date range
                      </p>
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

export default AttendanceReports;