// src/components/Employee/OvertimeSummary.jsx
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Badge, Row, Col, Button,
  Spinner, Alert, Form
} from 'react-bootstrap';
import {
  FaClock,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaArrowLeft,
  FaArrowRight,
  FaTrophy
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

const OvertimeSummary = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overtimeData, setOvertimeData] = useState([]);
  const [summary, setSummary] = useState({
    total_days: 0,
    total_hours: 0,
    total_minutes: 0,
    total_amount: 0
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const years = [2024, 2025, 2026];

  useEffect(() => {
    fetchOvertimeData();
  }, [selectedMonth, selectedYear]);

  const fetchOvertimeData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_ENDPOINTS.ATTENDANCE}/overtime/${user.employeeId}/${selectedMonth}/${selectedYear}`
      );

      if (response.data.success) {
        setOvertimeData(response.data.overtime || []);
        setSummary(response.data.summary || {});
      }
    } catch (error) {
      console.error('Error fetching overtime data:', error);
      setError('Failed to load overtime data');
    } finally {
      setLoading(false);
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div className="p-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">
          <FaClock className="me-2 text-primary" />
          Overtime Summary
        </h4>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}

      {/* Month Navigation */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-3">
          <Row className="align-items-center">
            <Col md={4}>
              <div className="d-flex align-items-center">
                <Button variant="outline-secondary" size="sm" onClick={handlePreviousMonth}>
                  <FaArrowLeft size={12} />
                </Button>
                <Form.Select
                  size="sm"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="mx-2"
                  style={{ width: '120px' }}
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Form.Select>
                <Form.Select
                  size="sm"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="me-2"
                  style={{ width: '90px' }}
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Form.Select>
                <Button variant="outline-secondary" size="sm" onClick={handleNextMonth}>
                  <FaArrowRight size={12} />
                </Button>
              </div>
            </Col>
            <Col md={8}>
              <div className="d-flex justify-content-end gap-3">
                <Badge bg="success" className="p-2">
                  Total Hours: {summary.total_hours}h
                </Badge>
                <Badge bg="info" className="p-2">
                  Total Amount: ₹{summary.total_amount}
                </Badge>
                <Badge bg="primary" className="p-2">
                  Days with OT: {summary.total_days}
                </Badge>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Overtime Table */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h6 className="mb-0">Daily Overtime Details</h6>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table hover className="mb-0">
              <thead className="bg-light sticky-top" style={{ top: 0 }}>
                <tr>
                  <th className="small">Date</th>
                  <th className="small">Day</th>
                  <th className="small text-center">Overtime Hours</th>
                  <th className="small text-center">Overtime Minutes</th>
                  <th className="small text-end">Amount (₹)</th>
                  <th className="small text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {overtimeData.length > 0 ? (
                  overtimeData.map((record, index) => {
                    const date = new Date(record.attendance_date);
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                    
                    return (
                      <tr key={index}>
                        <td className="small">{formatDate(record.attendance_date)}</td>
                        <td className="small">{dayName}</td>
                        <td className="small text-center">
                          <Badge bg="success" pill>
                            {record.overtime_hours}h
                          </Badge>
                        </td>
                        <td className="small text-center">{record.overtime_minutes} min</td>
                        <td className="small text-end fw-bold text-success">
                          ₹{record.overtime_amount}
                        </td>
                        <td className="small text-center">
                          {record.is_paid ? (
                            <Badge bg="success" pill>Paid</Badge>
                          ) : (
                            <Badge bg="warning" pill>Pending</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <FaClock size={40} className="text-muted mb-3 opacity-50" />
                      <h6 className="text-muted">No overtime records found</h6>
                      <p className="text-muted small mb-0">
                        You haven't worked any overtime this month
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Summary Card */}
      {summary.total_hours > 0 && (
        <Card className="border-0 shadow-sm mt-4 bg-light">
          <Card.Body>
            <Row>
              <Col md={3}>
                <small className="text-muted d-block">Total Overtime Hours</small>
                <h4 className="text-success mb-0">{summary.total_hours} hours</h4>
              </Col>
              <Col md={3}>
                <small className="text-muted d-block">Total Overtime Minutes</small>
                <h4 className="text-primary mb-0">{summary.total_minutes} min</h4>
              </Col>
              <Col md={3}>
                <small className="text-muted d-block">Total Overtime Amount</small>
                <h4 className="text-info mb-0">₹{summary.total_amount}</h4>
              </Col>
              <Col md={3}>
                <small className="text-muted d-block">Rate per Hour</small>
                <h4 className="text-warning mb-0">₹150</h4>
              </Col>
            </Row>
            <Row className="mt-3">
              <Col md={12}>
                <small className="text-muted">
                  <FaTrophy className="me-1 text-warning" size={12} />
                  Overtime is calculated only for complete hours worked beyond your 9-hour shift.
                  Partial hours do not count towards overtime.
                </small>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default OvertimeSummary;