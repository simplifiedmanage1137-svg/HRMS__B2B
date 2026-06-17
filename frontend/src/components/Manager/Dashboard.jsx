// src/components/Manager/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Badge, Spinner, Table } from 'react-bootstrap';
import {
  FaUsers, FaCalendarAlt, FaClock, FaUserTie, FaArrowRight,
  FaSyncAlt, FaCheckCircle, FaTimesCircle, FaHourglassHalf,
  FaUserCheck, FaBriefcase, FaChartPie, FaChartBar
} from 'react-icons/fa';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const StatCard = ({ label, value, icon, colorClass, loading }) => (
  <Card className="border-0 shadow-sm h-100">
    <Card.Body className="d-flex align-items-center gap-3 p-3">
      <div className={`${colorClass} bg-opacity-10 p-3 rounded-circle flex-shrink-0`}>
        <span className={colorClass.replace('bg-', 'text-')}>{icon}</span>
      </div>
      <div>
        <div className="text-muted small">{label}</div>
        {loading
          ? <Spinner animation="border" size="sm" />
          : <div className="fw-bold fs-4 lh-1">{value}</div>
        }
      </div>
    </Card.Body>
  </Card>
);

const ManagerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teamRes, leavesRes] = await Promise.allSettled([
        axios.get(API_ENDPOINTS.MANAGER_TEAM),
        axios.get(`${API_ENDPOINTS.LEAVES}?reporting_manager=true`),
      ]);

      if (teamRes.status === 'fulfilled') {
        setTeam(teamRes.value.data?.team || []);
      }
      if (leavesRes.status === 'fulfilled') {
        setLeaveRequests(leavesRes.value.data || []);
      }
      setLastUpdated(new Date());
    } catch {
      // individual errors handled by allSettled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const pendingLeaves = leaveRequests.filter(l => l.status === 'pending');
  const approvedLeaves = leaveRequests.filter(l => l.status === 'approved');
  const rejectedLeaves = leaveRequests.filter(l => l.status === 'rejected');

  // Designation breakdown for bar chart
  const designationMap = {};
  team.forEach(m => {
    const key = m.designation || 'Unspecified';
    designationMap[key] = (designationMap[key] || 0) + 1;
  });
  const designationLabels = Object.keys(designationMap);
  const designationValues = Object.values(designationMap);

  const leaveChartData = {
    labels: ['Pending', 'Approved', 'Rejected'],
    datasets: [{
      data: [pendingLeaves.length, approvedLeaves.length, rejectedLeaves.length],
      backgroundColor: ['#ffc107', '#28a745', '#dc3545'],
      borderWidth: 0,
    }],
  };

  const teamChartData = {
    labels: designationLabels,
    datasets: [{
      label: 'Members',
      data: designationValues,
      backgroundColor: ['#0d6efd', '#6f42c1', '#0dcaf0', '#fd7e14', '#20c997', '#e83e8c'],
      borderRadius: 4,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
  };

  const quickActions = [
    { label: 'My Team', icon: <FaUsers />, path: '/manager/panel', variant: 'primary' },
    { label: 'Leave Approvals', icon: <FaCalendarAlt />, path: '/manager/panel', variant: 'success' },
    { label: 'Attendance', icon: <FaClock />, path: '/attendance', variant: 'info' },
  ];

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-3 p-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-2">
        <div className="d-flex align-items-center gap-2">
          <FaUserTie size={22} className="text-primary" />
          <div>
            <h5 className="mb-0">Manager Dashboard</h5>
            <small className="text-muted">
              Welcome, {user?.name || user?.employeeId} &nbsp;·&nbsp; ID: {user?.employeeId}
              {lastUpdated && (
                <> &nbsp;·&nbsp; Updated {lastUpdated.toLocaleTimeString()}</>
              )}
            </small>
          </div>
        </div>
        <Button variant="outline-secondary" size="sm" onClick={fetchData} disabled={loading}>
          <FaSyncAlt className={`me-1 ${loading ? 'fa-spin' : ''}`} size={12} />
          Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <Row className="g-3 mb-4">
        <Col xs={6} md={3}>
          <StatCard
            label="Team Members"
            value={team.length}
            icon={<FaUsers size={18} />}
            colorClass="bg-primary"
            loading={loading}
          />
        </Col>
        <Col xs={6} md={3}>
          <StatCard
            label="Pending Leaves"
            value={pendingLeaves.length}
            icon={<FaHourglassHalf size={18} />}
            colorClass="bg-warning"
            loading={loading}
          />
        </Col>
        <Col xs={6} md={3}>
          <StatCard
            label="Approved Leaves"
            value={approvedLeaves.length}
            icon={<FaCheckCircle size={18} />}
            colorClass="bg-success"
            loading={loading}
          />
        </Col>
        <Col xs={6} md={3}>
          <StatCard
            label="Rejected Leaves"
            value={rejectedLeaves.length}
            icon={<FaTimesCircle size={18} />}
            colorClass="bg-danger"
            loading={loading}
          />
        </Col>
      </Row>

      {/* Charts Row */}
      <Row className="g-3 mb-4">
        <Col xs={12} md={5}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center gap-2 mb-3">
                <FaChartPie className="text-primary" size={16} />
                <span className="fw-semibold small">Leave Request Status</span>
              </div>
              {loading ? (
                <div className="d-flex justify-content-center align-items-center" style={{ height: 200 }}>
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : leaveRequests.length === 0 ? (
                <div className="d-flex justify-content-center align-items-center text-muted small" style={{ height: 200 }}>
                  No leave requests yet
                </div>
              ) : (
                <div style={{ height: 220 }}>
                  <Doughnut data={leaveChartData} options={chartOptions} />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={7}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center gap-2 mb-3">
                <FaChartBar className="text-primary" size={16} />
                <span className="fw-semibold small">Team by Designation</span>
              </div>
              {loading ? (
                <div className="d-flex justify-content-center align-items-center" style={{ height: 200 }}>
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : team.length === 0 ? (
                <div className="d-flex justify-content-center align-items-center text-muted small" style={{ height: 200 }}>
                  No team members found
                </div>
              ) : (
                <div style={{ height: 220 }}>
                  <Bar data={teamChartData} options={barOptions} />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Team Members + Pending Leaves Row */}
      <Row className="g-3 mb-4">
        {/* Team Members */}
        <Col xs={12} md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-2">
                  <FaUsers className="text-primary" size={15} />
                  <span className="fw-semibold small">Team Members</span>
                </div>
                <Button variant="outline-primary" size="sm" onClick={() => navigate('/manager/panel')}>
                  View All <FaArrowRight size={10} className="ms-1" />
                </Button>
              </div>
              {loading ? (
                <div className="d-flex justify-content-center py-4">
                  <Spinner animation="border" variant="primary" size="sm" />
                </div>
              ) : team.length === 0 ? (
                <p className="text-muted small text-center py-3 mb-0">No team members assigned</p>
              ) : (
                <div className="table-responsive">
                  <Table size="sm" className="mb-0 align-middle">
                    <thead className="table-light">
                      <tr className="small text-muted">
                        <th className="fw-normal">Name</th>
                        <th className="fw-normal d-none d-sm-table-cell">Designation</th>
                        <th className="fw-normal">Shift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.slice(0, 6).map(m => (
                        <tr key={m.employee_id} className="small">
                          <td>
                            <div className="fw-semibold">{m.first_name} {m.last_name}</div>
                            <small className="text-muted">{m.employee_id}</small>
                          </td>
                          <td className="d-none d-sm-table-cell text-truncate" style={{ maxWidth: 120 }}>
                            {m.designation || '—'}
                          </td>
                          <td>
                            <Badge bg="light" text="dark" pill className="px-2">
                              {m.shift_timing || 'Default'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {team.length > 6 && (
                    <p className="text-muted small text-center mt-2 mb-0">
                      +{team.length - 6} more members
                    </p>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Pending Leave Requests */}
        <Col xs={12} md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-2">
                  <FaHourglassHalf className="text-warning" size={15} />
                  <span className="fw-semibold small">Pending Leave Approvals</span>
                  {pendingLeaves.length > 0 && (
                    <Badge bg="warning" text="dark" pill>{pendingLeaves.length}</Badge>
                  )}
                </div>
                <Button variant="outline-success" size="sm" onClick={() => navigate('/manager/panel')}>
                  Manage <FaArrowRight size={10} className="ms-1" />
                </Button>
              </div>
              {loading ? (
                <div className="d-flex justify-content-center py-4">
                  <Spinner animation="border" variant="warning" size="sm" />
                </div>
              ) : pendingLeaves.length === 0 ? (
                <div className="text-center py-3">
                  <FaCheckCircle size={28} className="text-success mb-2 opacity-75" />
                  <p className="text-muted small mb-0">No pending leave approvals</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table size="sm" className="mb-0 align-middle">
                    <thead className="table-light">
                      <tr className="small text-muted">
                        <th className="fw-normal">Employee</th>
                        <th className="fw-normal">Type</th>
                        <th className="fw-normal">From</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLeaves.slice(0, 6).map(l => (
                        <tr key={l.id} className="small">
                          <td>
                            <div className="fw-semibold">{l.first_name} {l.last_name}</div>
                            <small className="text-muted">{l.employee_id}</small>
                          </td>
                          <td>
                            <Badge bg="info" pill className="px-2 text-capitalize">
                              {l.leave_type || 'Leave'}
                            </Badge>
                          </td>
                          <td className="text-muted">{formatDate(l.start_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {pendingLeaves.length > 6 && (
                    <p className="text-muted small text-center mt-2 mb-0">
                      +{pendingLeaves.length - 6} more pending
                    </p>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <div className="mb-2">
        <p className="text-muted small fw-semibold mb-2 text-uppercase" style={{ letterSpacing: '0.5px' }}>
          Quick Actions
        </p>
        <Row className="g-3">
          {quickActions.map(({ label, icon, path, variant }) => (
            <Col xs={12} sm={6} md={4} key={label}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="d-flex flex-column align-items-start p-3">
                  <div className={`bg-${variant} bg-opacity-10 p-3 rounded-circle mb-3`}>
                    <span className={`text-${variant}`}>{icon}</span>
                  </div>
                  <h6 className="fw-semibold mb-auto">{label}</h6>
                  <Button
                    variant={`outline-${variant}`}
                    size="sm"
                    className="mt-3 d-flex align-items-center gap-2"
                    onClick={() => navigate(path)}
                  >
                    Go <FaArrowRight size={10} />
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default ManagerDashboard;
