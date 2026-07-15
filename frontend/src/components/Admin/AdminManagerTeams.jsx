import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Modal, Form, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { FaUsers, FaPlus, FaEdit, FaTrash, FaUserTie, FaSyncAlt, FaSearch, FaCheck, FaTimes } from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNotification } from '../../context/NotificationContext';

const Avatar = ({ name, size = 36 }) => {
    const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];
    const initials = name ? name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase() : '?';
    const color = colors[(name || '').split('').reduce((a,c) => a + c.charCodeAt(0), 0) % colors.length];
    return (
        <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white fw-bold"
            style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
            {initials}
        </div>
    );
};

const EMPTY_FORM = { team_name: '', description: '', manager_id: '', status: 'active', member_ids: [] };

export default function AdminManagerTeams() {
    const { showNotification } = useNotification();

    const [teams,      setTeams]      = useState([]);
    const [managers,   setManagers]   = useState([]);   // sub_admins
    const [employees,  setEmployees]  = useState([]);   // all active employees
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(false);
    const [deleting,   setDeleting]   = useState(null);
    const [openTeam,   setOpenTeam]   = useState(null); // expanded detail
    const [members,    setMembers]    = useState([]);
    const [loadingMem, setLoadingMem] = useState(false);

    // Modal state
    const [showModal,  setShowModal]  = useState(false);
    const [editId,     setEditId]     = useState(null);
    const [form,       setForm]       = useState(EMPTY_FORM);
    const [formErr,    setFormErr]    = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [search,     setSearch]     = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [teamsRes, mgrRes, empRes] = await Promise.all([
                axios.get(API_ENDPOINTS.TEAMS),
                axios.get(API_ENDPOINTS.TEAMS_SUB_ADMINS_LIST),
                axios.get(API_ENDPOINTS.EMPLOYEES),
            ]);

            // All teams — filter to those managed by sub_admins
            const mgrIds = new Set((mgrRes.data.managers || []).map(m => m.employee_id));
            const managerTeams = (teamsRes.data.teams || []).filter(t => mgrIds.has(t.manager_id));

            setTeams(managerTeams);
            setManagers(mgrRes.data.managers || []);
            setEmployees((empRes.data || []).filter(e => e.is_active !== false && e.role === 'employee'));
        } catch {
            showNotification('Failed to load data', 'danger');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setEditId(null);
        setForm(EMPTY_FORM);
        setFormErr('');
        setMemberSearch('');
        setShowModal(true);
    };

    const openEdit = async (team) => {
        setEditId(team.id);
        setFormErr('');
        setMemberSearch('');
        try {
            const res = await axios.get(API_ENDPOINTS.TEAM_BY_ID(team.id));
            const t = res.data.team;
            setForm({
                team_name:   t.team_name || '',
                description: t.description || '',
                manager_id:  t.manager_id || '',
                status:      t.status || 'active',
                member_ids:  (t.members || []).map(m => m.employee_id),
            });
        } catch {
            setForm({ team_name: team.team_name, description: team.description || '', manager_id: team.manager_id, status: team.status, member_ids: [] });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.team_name.trim()) return setFormErr('Team name is required');
        if (!form.manager_id) return setFormErr('Select a Manager');
        setFormErr('');
        setSaving(true);
        try {
            if (editId) {
                await axios.put(API_ENDPOINTS.TEAM_BY_ID(editId), form);
                showNotification('Team updated', 'success');
            } else {
                await axios.post(API_ENDPOINTS.TEAMS, form);
                showNotification('Team created', 'success');
            }
            setShowModal(false);
            load();
        } catch (err) {
            setFormErr(err.response?.data?.message || 'Failed to save team');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this team? This cannot be undone.')) return;
        setDeleting(id);
        try {
            await axios.delete(API_ENDPOINTS.TEAM_BY_ID(id));
            showNotification('Team deleted', 'success');
            load();
        } catch {
            showNotification('Failed to delete team', 'danger');
        } finally {
            setDeleting(null);
        }
    };

    const openDetail = async (team) => {
        if (openTeam?.id === team.id) { setOpenTeam(null); return; }
        setOpenTeam(team);
        setLoadingMem(true);
        try {
            const res = await axios.get(API_ENDPOINTS.TEAM_BY_ID(team.id));
            setMembers(res.data.team?.members || []);
        } catch { setMembers([]); } finally { setLoadingMem(false); }
    };

    const toggleMember = (eid) => {
        setForm(f => ({
            ...f,
            member_ids: f.member_ids.includes(eid)
                ? f.member_ids.filter(id => id !== eid)
                : [...f.member_ids, eid],
        }));
    };

    const mgrName = (eid) => {
        const m = managers.find(m => m.employee_id === eid);
        return m ? `${m.first_name} ${m.last_name}` : eid;
    };

    const filteredEmps = employees.filter(e => {
        const name = `${e.first_name} ${e.last_name} ${e.employee_id} ${e.designation || ''} ${e.department || ''}`.toLowerCase();
        return name.includes(memberSearch.toLowerCase());
    });

    const filteredTeams = teams.filter(t =>
        `${t.team_name} ${t.manager_id}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: '#f0f2f5', minHeight: '100vh' }}>

            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
                <div>
                    <h4 className="mb-0 fw-bold" style={{ color: '#1e3a5f' }}>Manager Teams</h4>
                    <div className="text-muted small mt-1">Create and manage teams led by Managers</div>
                </div>
                <div className="d-flex gap-2">
                    <Button variant="outline-primary" size="sm" onClick={load} disabled={loading} style={{ borderRadius: 8 }}>
                        <FaSyncAlt size={12} className={loading ? 'spin' : ''} />
                    </Button>
                    <Button variant="primary" onClick={openCreate} style={{ borderRadius: 8, fontWeight: 600 }}>
                        <FaPlus size={12} className="me-2" /> New Team
                    </Button>
                </div>
            </div>

            {/* Summary */}
            <Row className="g-3 mb-4">
                {[
                    { label: 'Total Teams', value: teams.length, color: '#3b82f6' },
                    { label: 'Total Members', value: teams.reduce((s, t) => s + (t.member_count || 0), 0), color: '#10b981' },
                    { label: 'Managers', value: managers.length, color: '#8b5cf6' },
                ].map(s => (
                    <Col key={s.label} xs={12} md={4}>
                        <Card className="border-0 shadow-sm" style={{ borderRadius: 12, borderLeft: `4px solid ${s.color}` }}>
                            <Card.Body className="py-3">
                                <div className="fw-bold fs-5">{s.value}</div>
                                <div className="text-muted small">{s.label}</div>
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
                        <Form.Control placeholder="Search teams…" value={search} onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 34, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }} />
                    </div>
                </Card.Body>
            </Card>

            {/* Teams list */}
            {loading ? (
                <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
            ) : filteredTeams.length === 0 ? (
                <Card className="border-0 shadow-sm text-center py-5" style={{ borderRadius: 14 }}>
                    <FaUsers size={40} className="text-muted mb-3 mx-auto" />
                    <div className="text-muted">No Manager teams yet.</div>
                    <Button variant="primary" size="sm" className="mt-3 mx-auto" onClick={openCreate} style={{ width: 'fit-content' }}>
                        <FaPlus size={12} className="me-1" /> Create First Team
                    </Button>
                </Card>
            ) : (
                <div className="d-flex flex-column gap-3">
                    {filteredTeams.map(team => (
                        <Card key={team.id} className="border-0 shadow-sm" style={{ borderRadius: 14, overflow: 'hidden' }}>
                            <div className="d-flex align-items-center gap-3 p-3 p-md-4 bg-white" style={{ cursor: 'pointer' }}
                                onClick={() => openDetail(team)}>
                                <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                    style={{ width: 44, height: 44, background: '#f0f9ff', color: '#0ea5e9' }}>
                                    <FaUserTie size={18} />
                                </div>
                                <div className="flex-grow-1 min-w-0">
                                    <div className="fw-semibold" style={{ fontSize: 15, color: '#1e293b' }}>{team.team_name}</div>
                                    <div className="text-muted small">Manager: {mgrName(team.manager_id)}</div>
                                    {team.description && <div className="text-muted text-truncate" style={{ fontSize: 12 }}>{team.description}</div>}
                                </div>
                                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                    <Badge bg={team.status === 'active' ? 'success' : 'secondary'} style={{ fontSize: 11 }}>{team.status}</Badge>
                                    <Badge bg="light" text="dark" style={{ fontSize: 11 }}>{team.member_count || 0} members</Badge>
                                    <Button variant="outline-primary" size="sm" style={{ padding: '3px 8px', borderRadius: 6 }}
                                        onClick={e => { e.stopPropagation(); openEdit(team); }}>
                                        <FaEdit size={11} />
                                    </Button>
                                    <Button variant="outline-danger" size="sm" style={{ padding: '3px 8px', borderRadius: 6 }}
                                        disabled={deleting === team.id}
                                        onClick={e => { e.stopPropagation(); handleDelete(team.id); }}>
                                        {deleting === team.id ? <Spinner size="sm" animation="border" /> : <FaTrash size={11} />}
                                    </Button>
                                    <span className="text-muted ms-1">{openTeam?.id === team.id ? '▲' : '▼'}</span>
                                </div>
                            </div>

                            {openTeam?.id === team.id && (
                                <div style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                    {loadingMem ? (
                                        <div className="text-center py-4"><Spinner size="sm" animation="border" /></div>
                                    ) : members.length === 0 ? (
                                        <div className="text-center text-muted py-4 small">No members yet. Click Edit to add employees.</div>
                                    ) : (
                                        <div className="p-3">
                                            <div className="small fw-semibold text-muted mb-3 text-uppercase" style={{ letterSpacing: 1, fontSize: 10 }}>
                                                Team Members ({members.length})
                                            </div>
                                            <Row className="g-2">
                                                {members.map(m => (
                                                    <Col key={m.employee_id} xs={12} sm={6} md={4} lg={3}>
                                                        <div className="d-flex align-items-center gap-2 p-2 bg-white rounded-3 shadow-sm">
                                                            <Avatar name={`${m.first_name} ${m.last_name}`} size={34} />
                                                            <div className="min-w-0">
                                                                <div className="fw-semibold text-truncate" style={{ fontSize: 13 }}>{m.first_name} {m.last_name}</div>
                                                                <div className="text-muted text-truncate" style={{ fontSize: 11 }}>{m.designation || m.department || m.employee_id}</div>
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

            {/* Create / Edit Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold" style={{ fontSize: 17 }}>
                        {editId ? 'Edit Manager Team' : 'Create Manager Team'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    {formErr && <Alert variant="danger" className="py-2 small">{formErr}</Alert>}

                    <Row className="g-3 mb-3">
                        <Col md={6}>
                            <Form.Label className="small fw-semibold">Team Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control value={form.team_name} onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))}
                                placeholder="e.g. Operations Team" style={{ borderRadius: 8 }} />
                        </Col>
                        <Col md={6}>
                            <Form.Label className="small fw-semibold">Manager <span className="text-danger">*</span></Form.Label>
                            <Form.Select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}
                                style={{ borderRadius: 8 }}>
                                <option value="">— Select Manager —</option>
                                {managers.map(m => (
                                    <option key={m.employee_id} value={m.employee_id}>
                                        {m.first_name} {m.last_name}{m.designation ? ` (${m.designation})` : ''}
                                    </option>
                                ))}
                            </Form.Select>
                        </Col>
                        <Col md={8}>
                            <Form.Label className="small fw-semibold">Description</Form.Label>
                            <Form.Control value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Optional description" style={{ borderRadius: 8 }} />
                        </Col>
                        <Col md={4}>
                            <Form.Label className="small fw-semibold">Status</Form.Label>
                            <Form.Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                style={{ borderRadius: 8 }}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </Form.Select>
                        </Col>
                    </Row>

                    {/* Member selection */}
                    <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
                        Add Employees <Badge bg="primary" style={{ fontSize: 11 }}>{form.member_ids.length} selected</Badge>
                    </div>
                    <div className="position-relative mb-2">
                        <FaSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 12 }} />
                        <Form.Control size="sm" placeholder="Search employees…" value={memberSearch}
                            onChange={e => setMemberSearch(e.target.value)}
                            style={{ paddingLeft: 30, borderRadius: 8 }} />
                    </div>
                    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                        {filteredEmps.length === 0 ? (
                            <div className="text-center text-muted py-4 small">No employees found</div>
                        ) : filteredEmps.map((emp, i) => {
                            const selected = form.member_ids.includes(emp.employee_id);
                            return (
                                <div key={emp.employee_id}
                                    onClick={() => toggleMember(emp.employee_id)}
                                    className="d-flex align-items-center gap-3 px-3 py-2"
                                    style={{
                                        cursor: 'pointer',
                                        background: selected ? '#eff6ff' : (i % 2 === 0 ? '#fff' : '#fafbfc'),
                                        borderBottom: i < filteredEmps.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        transition: 'background 0.15s',
                                    }}>
                                    <Avatar name={`${emp.first_name} ${emp.last_name}`} size={32} />
                                    <div className="flex-grow-1 min-w-0">
                                        <div className="fw-semibold" style={{ fontSize: 13 }}>{emp.first_name} {emp.last_name}</div>
                                        <div className="text-muted" style={{ fontSize: 11 }}>{emp.employee_id}{emp.designation ? ` · ${emp.designation}` : ''}{emp.department ? ` · ${emp.department}` : ''}</div>
                                    </div>
                                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${selected ? '#3b82f6' : '#cbd5e1'}`,
                                        background: selected ? '#3b82f6' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {selected && <FaCheck size={11} color="#fff" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0">
                    <Button variant="outline-secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={saving} style={{ minWidth: 100 }}>
                        {saving ? <Spinner size="sm" animation="border" /> : (editId ? 'Save Changes' : 'Create Team')}
                    </Button>
                </Modal.Footer>
            </Modal>

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
