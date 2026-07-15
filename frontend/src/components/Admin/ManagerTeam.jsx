import React, { useState, useEffect } from 'react';
import { Card, Badge, Spinner, Alert, Row, Col, Form } from 'react-bootstrap';
import { FaUsers, FaSyncAlt, FaUserTie, FaSearch } from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const Avatar = ({ name, size = 38 }) => {
    const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'];
    const initials = name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';
    const color = colors[name ? name.charCodeAt(0) % colors.length : 0];
    return (
        <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white fw-bold"
            style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
            {initials}
        </div>
    );
};

export default function ManagerTeam() {
    const { user } = useAuth();
    const [teams, setTeams]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');
    const [search, setSearch]   = useState('');
    const [openTeam, setOpenTeam] = useState(null);
    const [members, setMembers]   = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(API_ENDPOINTS.TEAMS);
            setTeams(res.data.teams || []);
        } catch {
            setError('Failed to load your teams.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openDetail = async (team) => {
        if (openTeam?.id === team.id) { setOpenTeam(null); return; }
        setOpenTeam(team);
        setLoadingMembers(true);
        try {
            const res = await axios.get(API_ENDPOINTS.TEAM_BY_ID(team.id));
            setMembers(res.data.team?.members || []);
        } catch {
            setMembers([]);
        } finally {
            setLoadingMembers(false);
        }
    };

    const filtered = teams.filter(t =>
        t.team_name?.toLowerCase().includes(search.toLowerCase())
    );

    const totalMembers = teams.reduce((s, t) => s + (t.member_count || 0), 0);

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: '#f0f2f5', minHeight: '100vh' }}>

            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                <div>
                    <h4 className="mb-0 fw-bold" style={{ color: '#1e3a5f' }}>My Team</h4>
                    <div className="text-muted small mt-1">Teams assigned to you as Manager</div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                    style={{ borderRadius: 8 }}
                >
                    <FaSyncAlt size={12} className={loading ? 'spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <Row className="g-3 mb-4">
                {[
                    { label: 'My Teams', value: teams.length, color: '#3b82f6', icon: <FaUserTie /> },
                    { label: 'Total Members', value: totalMembers, color: '#10b981', icon: <FaUsers /> },
                    { label: 'Active Teams', value: teams.filter(t => t.status === 'active').length, color: '#8b5cf6', icon: <FaUsers /> },
                ].map(s => (
                    <Col key={s.label} xs={12} md={4}>
                        <Card className="border-0 shadow-sm" style={{ borderRadius: 12, borderLeft: `4px solid ${s.color}` }}>
                            <Card.Body className="d-flex align-items-center gap-3 py-3">
                                <span style={{ fontSize: 26, color: s.color }}>{s.icon}</span>
                                <div>
                                    <div className="fw-bold fs-5">{s.value}</div>
                                    <div className="text-muted small">{s.label}</div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Search */}
            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
                <Card.Body className="py-2 px-3">
                    <div className="position-relative">
                        <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
                        <Form.Control
                            placeholder="Search teams…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 34, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
                        />
                    </div>
                </Card.Body>
            </Card>

            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

            {loading ? (
                <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
            ) : filtered.length === 0 ? (
                <Card className="border-0 shadow-sm text-center py-5" style={{ borderRadius: 14 }}>
                    <FaUsers size={40} className="text-muted mb-3 mx-auto" />
                    <div className="text-muted">No teams assigned to you yet.</div>
                    <div className="text-muted small mt-1">Ask an admin to create a team and assign you as the manager.</div>
                </Card>
            ) : (
                <div className="d-flex flex-column gap-3">
                    {filtered.map(team => (
                        <Card key={team.id} className="border-0 shadow-sm" style={{ borderRadius: 14, overflow: 'hidden' }}>
                            {/* Team header row */}
                            <div
                                className="d-flex align-items-center gap-3 p-3 p-md-4"
                                style={{ cursor: 'pointer', background: '#fff' }}
                                onClick={() => openDetail(team)}
                            >
                                <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                    style={{ width: 44, height: 44, background: '#eff6ff', color: '#3b82f6' }}>
                                    <FaUsers size={18} />
                                </div>
                                <div className="flex-grow-1 min-w-0">
                                    <div className="fw-semibold" style={{ fontSize: 15, color: '#1e293b' }}>{team.team_name}</div>
                                    {team.description && (
                                        <div className="text-muted small text-truncate">{team.description}</div>
                                    )}
                                </div>
                                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                    <Badge bg={team.status === 'active' ? 'success' : 'secondary'} style={{ fontSize: 11 }}>
                                        {team.status || 'active'}
                                    </Badge>
                                    <Badge bg="light" text="dark" style={{ fontSize: 11 }}>
                                        {team.member_count || 0} members
                                    </Badge>
                                    <span className="text-muted" style={{ fontSize: 18 }}>
                                        {openTeam?.id === team.id ? '▲' : '▼'}
                                    </span>
                                </div>
                            </div>

                            {/* Expanded member list */}
                            {openTeam?.id === team.id && (
                                <div style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                    {loadingMembers ? (
                                        <div className="text-center py-4">
                                            <Spinner size="sm" animation="border" variant="primary" />
                                        </div>
                                    ) : members.length === 0 ? (
                                        <div className="text-center text-muted py-4 small">No members in this team yet.</div>
                                    ) : (
                                        <div className="p-3">
                                            <div className="small fw-semibold text-muted mb-3 text-uppercase" style={{ letterSpacing: 1, fontSize: 10 }}>
                                                Team Members ({members.length})
                                            </div>
                                            <Row className="g-2">
                                                {members.map(m => (
                                                    <Col key={m.employee_id} xs={12} sm={6} md={4} lg={3}>
                                                        <div className="d-flex align-items-center gap-2 p-2 bg-white rounded-3 shadow-sm">
                                                            <Avatar name={`${m.first_name} ${m.last_name}`} size={36} />
                                                            <div className="min-w-0">
                                                                <div className="fw-semibold text-truncate" style={{ fontSize: 13, color: '#1e293b' }}>
                                                                    {m.first_name} {m.last_name}
                                                                </div>
                                                                <div className="text-muted text-truncate" style={{ fontSize: 11 }}>
                                                                    {m.designation || m.department || m.employee_id}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Col>
                                                ))}
                                            </Row>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
