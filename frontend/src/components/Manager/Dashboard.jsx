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

  const totalLeaves = leaveRequests.length;

  const leaveChartData = {
    labels: ['Pending', 'Approved', 'Rejected'],
    datasets: [{
      data: [pendingLeaves.length, approvedLeaves.length, rejectedLeaves.length],
      backgroundColor: ['#F97316', '#22C55E', '#EF4444'],
      borderColor: ['#EA580C', '#16A34A', '#DC2626'],
      borderWidth: 2,
      hoverOffset: 14,
      borderRadius: 4,
    }],
  };

  const teamChartData = {
    labels: designationLabels,
    datasets: [{
      label: 'Members',
      data: designationValues,
      backgroundColor: ['#3B82F6', '#8B5CF6', '#22C55E', '#F97316', '#EF4444', '#0EA5E9'],
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const leaveCenterPlugin = {
    id: 'leaveCenterText',
    beforeDraw(chart) {
      if (chart.config.type !== 'doughnut') return;
      const { width, height, ctx } = chart;
      ctx.save();
      const cx = width / 2;
      const cy = height / 2 - 10;
      ctx.font = 'bold 26px Inter,system-ui,sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(totalLeaves > 0 ? totalLeaves : '—', cx, cy);
      ctx.font = '500 9.5px Inter,system-ui,sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('TOTAL REQUESTS', cx, cy + 18);
      ctx.restore();
    },
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    animation: { animateRotate: true, duration: 900 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,.93)',
        padding: 10,
        cornerRadius: 8,
        borderColor: 'rgba(255,255,255,.1)',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => {
            const pct = totalLeaves > 0 ? Math.round((ctx.parsed / totalLeaves) * 100) : 0;
            return \  \: \  (\%)\;
          },
        },
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,.93)',
        padding: 10,
        cornerRadius: 8,
        borderColor: 'rgba(255,255,255,.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#64748B' } },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 }, color: '#64748B' },
        grid: { color: '#F1F5F9' },
      },
    },
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

        {/* Leave Request Status – premium doughnut */}
        <Col xs={12} md={5}>
          <Card className="border-0 h-100" style={{ borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06),0 4px 20px rgba(0,0,0,.07)', overflow: 'hidden' }}>
            <Card.Body className="p-0">
              {/* Header */}
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#F97316,#EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FaChartPie size={15} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>Leave Request Status</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>All-time breakdown</div>
                </div>
              </div>

              {/* Chart */}
              <div style={{ padding: '16px 20px 0' }}>
                {loading ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ height: 210 }}>
                    <Spinner animation="border" variant="primary" />
                  </div>
                ) : leaveRequests.length === 0 ? (
                  <div className="d-flex flex-column justify-content-center align-items-center text-muted" style={{ height: 210, gap: 8 }}>
                    <FaCalendarAlt size={28} opacity={0.4} />
                    <small>No leave requests yet</small>
                  </div>
                ) : (
                  <div style={{ height: 210 }}>
                    <Doughnut data={leaveChartData} options={chartOptions} plugins={[leaveCenterPlugin]} />
                  </div>
                )}
              </div>

              {/* Badge legend */}
              {!loading && leaveRequests.length > 0 && (
                <div style={{ padding: '14px 20px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Pending',  count: pendingLeaves.length,  color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', tc: '#C2410C' },
                    { label: 'Approved', count: approvedLeaves.length, color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', tc: '#15803D' },
                    { label: 'Rejected', count: rejectedLeaves.length, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', tc: '#B91C1C' },
                  ].map(item => (
                    <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, boxShadow: `0 0 0 2px ${item.border}`, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: item.tc, fontWeight: 600 }}>{item.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
                          {item.count}
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#94A3B8', marginLeft: 4 }}>
                            {totalLeaves > 0 ? `${Math.round((item.count / totalLeaves) * 100)}%` : '0%'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Team by Designation – premium bar */}
        <Col xs={12} md={7}>
          <Card className="border-0 h-100" style={{ borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06),0 4px 20px rgba(0,0,0,.07)', overflow: 'hidden' }}>
            <Card.Body className="p-0">
              {/* Header */}
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#3B82F6,#2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaChartBar size={15} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>Team by Designation</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Member distribution</div>
                  </div>
                </div>
                <span style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                  {team.length} members
                </span>
              </div>

              {/* Chart */}
              <div style={{ padding: '16px 20px 20px' }}>
                {loading ? (
                  <div className="d-flex justify-content-center align-items-center" style={{ height: 240 }}>
                    <Spinner animation="border" variant="primary" />
                  </div>
                ) : team.length === 0 ? (
                  <div className="d-flex flex-column justify-content-center align-items-center text-muted" style={{ height: 240, gap: 8 }}>
                    <FaUsers size={28} opacity={0.4} />
                    <small>No team members found</small>
                  </div>
                ) : (
                  <div style={{ height: 240 }}>
                    <Bar data={teamChartData} options={barOptions} />
                  </div>
                )}
              </div>
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
