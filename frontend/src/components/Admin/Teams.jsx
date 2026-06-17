// components/Admin/Teams.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Badge, Modal, Form, Spinner, Alert } from 'react-bootstrap';
import {
    FaUserTie, FaUsers, FaSearch, FaChevronDown, FaChevronUp,
    FaEye, FaEdit, FaExchangeAlt, FaTimesCircle, FaUserMinus,
    FaFilter, FaSyncAlt, FaClock, FaCalendarAlt, FaCheck,
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// ── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 36, bg = '#3b82f6' }) => {
    const initials = name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';
    return (
        <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white fw-bold"
            style={{ width: size, height: size, background: bg, fontSize: size * 0.35 }}>
            {initials}
        </div>
    );
};

// ── Manager avatars palette ──────────────────────────────────────────────────
const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];
const mgrColor = (id) => COLORS[(id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ── LoginSettings ─────────────────────────────────────────────────────────────
const LoginSettings = ({ mgr, color }) => {
    const init = mgr.settings;
    const [loginTime, setLoginTime]   = useState(init?.login_time?.slice(0,5) || '09:00');
    const [workDays, setWorkDays]     = useState(init?.working_days || ['Monday','Tuesday','Wednesday','Thursday','Friday']);
    const [saving, setSaving]         = useState(false);
    const [saved, setSaved]           = useState(false);
    const [error, setError]           = useState('');

    const toggleDay = (day) =>
        setWorkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

    const handleSave = async () => {
        setError('');
        setSaving(true);
        try {
            await axios.put(API_ENDPOINTS.TEAMS_MANAGER_SETTINGS(mgr.employee_id), {
                login_time: loginTime + ':00',
                working_days: workDays,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="px-3 pb-3" style={{ borderTop: `1px solid ${color}22` }}>
            <div className="d-flex align-items-center gap-2 py-2 mb-2">
                <FaClock size={12} style={{ color }} />
                <span className="small fw-semibold" style={{ color }}>Login Time Settings</span>
                {init?.login_time && (
                    <Badge bg="light" text="dark" style={{ fontSize: 10, marginLeft: 'auto' }}>
                        Current: {init.login_time.slice(0,5)}
                    </Badge>
                )}
            </div>

            {error && <Alert variant="danger" className="py-1 px-2 small mb-2">{error}</Alert>}

            {/* Working days */}
            <div className="mb-3">
                <div className="text-muted small mb-2" style={{ fontSize: 11 }}>
                    <FaCalendarAlt size={10} className="me-1" />Working Days
                </div>
                <div className="d-flex flex-wrap gap-1">
                    {DAYS.map(day => {
                        const active = workDays.includes(day);
                        return (
                            <button key={day}
                                onClick={() => toggleDay(day)}
                                style={{
                                    padding: '2px 8px', fontSize: 11, border: 'none', borderRadius: 20, cursor: 'pointer',
                                    background: active ? color : '#f1f5f9',
                                    color: active ? '#fff' : '#64748b',
                                    fontWeight: active ? 600 : 400,
                                    transition: 'all 0.15s',
                                }}>
                                {day.slice(0, 3)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Login time + save */}
            <div className="d-flex align-items-center gap-2">
                <FaClock size={11} className="text-muted" />
                <span className="small text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Login Time</span>
                <Form.Control
                    type="time" size="sm" value={loginTime}
                    onChange={e => setLoginTime(e.target.value)}
                    style={{ width: 110, fontSize: 12 }}
                />
                <Button size="sm" variant={saved ? 'success' : 'primary'}
                    onClick={handleSave} disabled={saving || workDays.length === 0}
                    className="d-flex align-items-center gap-1 ms-auto"
                    style={{ fontSize: 12 }}>
                    {saving ? <Spinner size="sm" animation="border" /> :
                     saved   ? <><FaCheck size={10} /> Saved</> :
                               'Save'}
                </Button>
            </div>
        </div>
    );
};

// ── ManagerCard ──────────────────────────────────────────────────────────────
const ManagerCard = ({ mgr, managers, onAssign, onRemove, onRefresh, navigate }) => {
    const [open, setOpen] = useState(false);
    const color = mgrColor(mgr.employee_id);

    return (
        <Card className="shadow-sm mb-3" style={{ border: `1.5px solid ${color}22` }}>
            {/* Manager header */}
            <div
                className="d-flex align-items-center gap-3 p-3 rounded-top"
                style={{ background: `${color}0d`, cursor: 'pointer' }}
                onClick={() => setOpen(o => !o)}
            >
                <Avatar name={`${mgr.first_name} ${mgr.last_name}`} size={42} bg={color} />
                <div className="flex-grow-1 min-width-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="fw-semibold">{mgr.first_name} {mgr.last_name}</span>
                        <Badge bg="primary" className="small" style={{ fontSize: 10 }}>Manager</Badge>
                        {!mgr.is_active && <Badge bg="secondary" style={{ fontSize: 10 }}>Inactive</Badge>}
                        {mgr.settings?.login_time && (
                            <Badge bg="light" text="dark" className="d-flex align-items-center gap-1" style={{ fontSize: 10 }}>
                                <FaClock size={8} />{mgr.settings.login_time.slice(0,5)}
                            </Badge>
                        )}
                    </div>
                    <div className="text-muted small mt-1">
                        {mgr.employee_id}
                        {mgr.designation && <> · {mgr.designation}</>}
                        {mgr.department && <> · {mgr.department}</>}
                    </div>
                </div>
                <div className="d-flex align-items-center gap-3 flex-shrink-0">
                    <div className="text-center d-none d-sm-block">
                        <div className="fw-bold" style={{ color }}>{mgr.total_employees}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>Employees</div>
                    </div>
                    <div className="d-flex gap-1">
                        <Button variant="outline-secondary" size="sm" className="p-1"
                            title="Edit Manager"
                            onClick={e => { e.stopPropagation(); navigate(`/admin/edit-employee/${mgr.id}`); }}>
                            <FaEdit size={11} />
                        </Button>
                        <Button variant="outline-info" size="sm" className="p-1"
                            title="View Manager"
                            onClick={e => { e.stopPropagation(); navigate(`/admin/employees/${mgr.id}`); }}>
                            <FaEye size={11} />
                        </Button>
                    </div>
                    {open ? <FaChevronUp size={13} className="text-muted" /> : <FaChevronDown size={13} className="text-muted" />}
                </div>
            </div>

            {/* Expanded employee list + login settings */}
            {open && (
                <div className="pt-2">
                    <div className="px-3 pb-3">
                    <div className="d-sm-none text-muted small mb-2">
                        {mgr.total_employees} employee{mgr.total_employees !== 1 ? 's' : ''}
                    </div>
                    {mgr.employees.length === 0 ? (
                        <div className="text-center text-muted small py-3" style={{ background: '#f8fafc', borderRadius: 8 }}>
                            No employees assigned to this manager yet.
                        </div>
                    ) : (
                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            {mgr.employees.map((emp, i) => (
                                <div key={emp.employee_id}
                                    className="d-flex align-items-center gap-2 px-3 py-2"
                                    style={{
                                        borderBottom: i < mgr.employees.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        background: i % 2 === 0 ? '#fff' : '#fafbfc',
                                    }}>
                                    <Avatar name={`${emp.first_name} ${emp.last_name}`} size={30} bg={color} />
                                    <div className="flex-grow-1 min-width-0">
                                        <div className="small fw-semibold">{emp.first_name} {emp.last_name}</div>
                                        <div className="text-muted" style={{ fontSize: 11 }}>
                                            {emp.employee_id}
                                            {emp.designation && <> · {emp.designation}</>}
                                        </div>
                                    </div>
                                    <Badge bg={emp.is_active ? 'success' : 'secondary'} style={{ fontSize: 10 }}>
                                        {emp.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                    <div className="d-flex gap-1 ms-1">
                                        <Button variant="outline-primary" size="sm" className="p-1"
                                            title="Change Manager"
                                            onClick={() => onAssign(emp, mgr)}>
                                            <FaExchangeAlt size={10} />
                                        </Button>
                                        <Button variant="outline-danger" size="sm" className="p-1"
                                            title="Remove Manager Assignment"
                                            onClick={() => onRemove(emp)}>
                                            <FaUserMinus size={10} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    </div>
                    <LoginSettings mgr={mgr} color={color} />
                </div>
            )}
        </Card>
    );
};

// ── Main Component ───────────────────────────────────────────────────────────
const Teams = () => {
    const { showNotification } = useNotification();
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.role === 'admin';

    const [hierarchy, setHierarchy]     = useState([]);
    const [unassigned, setUnassigned]   = useState([]);
    const [managers, setManagers]       = useState([]);
    const [loading, setLoading]         = useState(true);
    const [saving, setSaving]           = useState(false);

    // Search & filter
    const [search, setSearch]           = useState('');
    const [filter, setFilter]           = useState('all');

    // Assign modal
    const [assignModal, setAssignModal] = useState(false);
    const [assignEmp, setAssignEmp]     = useState(null);
    const [newMgrId, setNewMgrId]       = useState('');
    const [assignError, setAssignError] = useState('');

    const fetchHierarchy = useCallback(async () => {
        setLoading(true);
        try {
            const [hierRes, mgrRes] = await Promise.all([
                axios.get(API_ENDPOINTS.TEAMS_HIERARCHY),
                axios.get(API_ENDPOINTS.TEAMS_MANAGERS_LIST),
            ]);
            setHierarchy(hierRes.data.hierarchy || []);
            setUnassigned(hierRes.data.unassigned || []);
            setManagers(mgrRes.data.managers || []);
        } catch {
            showNotification('Failed to load manager hierarchy', 'danger');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHierarchy(); }, [fetchHierarchy]);

    // ── Assign / Change manager ──────────────────────────────────────────────
    const openAssign = (emp, currentMgr = null) => {
        setAssignEmp(emp);
        setNewMgrId(currentMgr?.employee_id || '');
        setAssignError('');
        setAssignModal(true);
    };

    const handleAssignSave = async () => {
        if (!newMgrId) return setAssignError('Please select a manager');
        const mgr = managers.find(m => m.employee_id === newMgrId);
        if (!mgr) return;
        setSaving(true);
        try {
            // Use numeric id — the PUT /:id route matches by database id, not employee_id string
            await axios.put(API_ENDPOINTS.EMPLOYEE_BY_ID(assignEmp.id), {
                reporting_manager: `${mgr.first_name} ${mgr.last_name}`.trim(),
            });
            showNotification('Reporting manager updated', 'success');
            setAssignModal(false);
            fetchHierarchy();
        } catch (err) {
            setAssignError(err.response?.data?.message || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (emp) => {
        if (!window.confirm(`Remove manager assignment for ${emp.first_name} ${emp.last_name}?`)) return;
        try {
            // Use numeric id — the PUT /:id route matches by database id, not employee_id string
            await axios.put(API_ENDPOINTS.EMPLOYEE_BY_ID(emp.id), { reporting_manager: null });
            showNotification('Manager assignment removed', 'success');
            fetchHierarchy();
        } catch (err) {
            showNotification(err.response?.data?.message || 'Failed to remove', 'danger');
        }
    };

    // ── Filtered data ────────────────────────────────────────────────────────
    const q = search.trim().toLowerCase();

    const filteredHierarchy = useMemo(() => {
        let list = hierarchy;
        if (filter === 'active')       list = list.filter(m => m.is_active);
        if (filter === 'no_employees') list = list.filter(m => m.total_employees === 0);
        if (!q) return list;
        return list
            .map(m => {
                const mgrMatch = `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
                    m.employee_id.toLowerCase().includes(q) ||
                    (m.designation || '').toLowerCase().includes(q);
                const matchedEmps = m.employees.filter(e =>
                    `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
                    e.employee_id.toLowerCase().includes(q) ||
                    (e.designation || '').toLowerCase().includes(q)
                );
                if (mgrMatch) return m;               // show whole card if manager matches
                if (matchedEmps.length) return { ...m, employees: matchedEmps }; // show filtered employees
                return null;
            })
            .filter(Boolean);
    }, [hierarchy, filter, q]);

    const filteredUnassigned = useMemo(() => {
        if (filter === 'active' || filter === 'no_employees') return [];
        if (!q) return unassigned;
        return unassigned.filter(e =>
            `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
            e.employee_id.toLowerCase().includes(q) ||
            (e.designation || '').toLowerCase().includes(q)
        );
    }, [unassigned, filter, q]);

    const showUnassigned = filter === 'no_manager' || (filter === 'all' && unassigned.length > 0);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid p-3 p-md-4">

            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2">
                    <FaUserTie size={18} className="text-primary" />
                    <h5 className="mb-0">Manager Hierarchy</h5>
                    <Badge bg="light" text="dark" className="ms-1">{hierarchy.length} managers</Badge>
                </div>
                <Button variant="outline-secondary" size="sm" onClick={fetchHierarchy}
                    className="d-flex align-items-center gap-1">
                    <FaSyncAlt size={11} /> Refresh
                </Button>
            </div>

            {/* Search & Filter bar */}
            <div className="d-flex flex-wrap gap-2 mb-4 align-items-center">
                <div className="position-relative" style={{ flex: '1 1 220px', maxWidth: 360 }}>
                    <FaSearch style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 11 }} />
                    <Form.Control size="sm" placeholder="Search manager, employee, ID, designation…"
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: 28 }} />
                </div>
                <div className="d-flex align-items-center gap-1">
                    <FaFilter size={11} className="text-muted" />
                    <Form.Select size="sm" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}>
                        <option value="all">All Managers</option>
                        <option value="active">Active Managers</option>
                        <option value="no_employees">No Employees Assigned</option>
                        <option value="no_manager">Employees Without Manager</option>
                    </Form.Select>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
            ) : (
                <>
                    {/* Stats row */}
                    <div className="d-flex gap-3 flex-wrap mb-4">
                        {[
                            { label: 'Total Managers', value: hierarchy.length, color: '#3b82f6' },
                            { label: 'Total Employees', value: hierarchy.reduce((s, m) => s + m.total_employees, 0), color: '#10b981' },
                            { label: 'Without Manager', value: unassigned.length, color: '#f59e0b' },
                        ].map(s => (
                            <div key={s.label} className="px-3 py-2 rounded"
                                style={{ background: `${s.color}12`, border: `1px solid ${s.color}30`, minWidth: 130 }}>
                                <div className="fw-bold fs-5" style={{ color: s.color }}>{s.value}</div>
                                <div className="text-muted" style={{ fontSize: 12 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Manager cards */}
                    {filter !== 'no_manager' && (
                        filteredHierarchy.length === 0 ? (
                            <Card className="shadow-sm text-center py-5 mb-3">
                                <FaUsers size={36} className="text-muted mx-auto mb-2 opacity-50" />
                                <p className="text-muted mb-0 small">No managers match your filters.</p>
                            </Card>
                        ) : (
                            filteredHierarchy.map(mgr => (
                                <ManagerCard
                                    key={mgr.employee_id}
                                    mgr={mgr}
                                    managers={managers}
                                    onAssign={openAssign}
                                    onRemove={handleRemove}
                                    onRefresh={fetchHierarchy}
                                    navigate={navigate}
                                />
                            ))
                        )
                    )}

                    {/* Unassigned employees section */}
                    {showUnassigned && (
                        <Card className="shadow-sm mb-3" style={{ border: '1.5px solid #f59e0b33' }}>
                            <div className="p-3" style={{ background: '#f59e0b0d', borderRadius: '0.375rem 0.375rem 0 0' }}>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <FaTimesCircle size={15} className="text-warning" />
                                    <span className="fw-semibold">Employees Without Manager</span>
                                    <Badge bg="warning" text="dark" pill>{unassigned.length}</Badge>
                                </div>
                            </div>
                            <div className="px-3 pb-3 pt-2">
                                {filteredUnassigned.length === 0 && (
                                    <p className="text-muted small text-center py-2 mb-1">
                                        {q ? `No results for "${search}"` : 'All employees are assigned to a manager.'}
                                    </p>
                                )}
                                {filteredUnassigned.length > 0 && (
                                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                    {filteredUnassigned.map((emp, i) => (
                                        <div key={emp.employee_id}
                                            className="d-flex align-items-center gap-2 px-3 py-2"
                                            style={{
                                                borderBottom: i < filteredUnassigned.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                background: i % 2 === 0 ? '#fff' : '#fafbfc',
                                            }}>
                                            <Avatar name={`${emp.first_name} ${emp.last_name}`} size={30} bg="#94a3b8" />
                                            <div className="flex-grow-1 min-width-0">
                                                <div className="small fw-semibold">{emp.first_name} {emp.last_name}</div>
                                                <div className="text-muted" style={{ fontSize: 11 }}>
                                                    {emp.employee_id}
                                                    {emp.designation && <> · {emp.designation}</>}
                                                </div>
                                            </div>
                                            <Badge bg={emp.is_active ? 'success' : 'secondary'} style={{ fontSize: 10 }}>
                                                {emp.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                            {isAdmin && (
                                                <Button variant="outline-primary" size="sm" className="p-1 ms-1"
                                                    title="Assign Manager"
                                                    onClick={() => openAssign(emp, null)}>
                                                    <FaUserTie size={10} />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                )}
                            </div>
                        </Card>
                    )}
                </>
            )}

            {/* ── Assign Manager Modal ── */}
            <Modal show={assignModal} onHide={() => setAssignModal(false)} centered size="sm">
                <Modal.Header closeButton className="py-2">
                    <Modal.Title as="h6" className="fw-semibold">
                        {assignEmp ? `Assign Manager — ${assignEmp.first_name} ${assignEmp.last_name}` : 'Assign Manager'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    {assignError && <Alert variant="danger" className="py-2 small mb-2">{assignError}</Alert>}
                    <Form.Group>
                        <Form.Label className="small fw-semibold">Reporting Manager</Form.Label>
                        <Form.Select size="sm" value={newMgrId} onChange={e => setNewMgrId(e.target.value)}>
                            <option value="">-- Select Manager --</option>
                            {managers.map(m => (
                                <option key={m.employee_id} value={m.employee_id}>
                                    {m.first_name} {m.last_name}{m.designation ? ` (${m.designation})` : ''}
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="py-2">
                    <Button variant="secondary" size="sm" onClick={() => setAssignModal(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleAssignSave} disabled={saving}>
                        {saving ? <Spinner size="sm" animation="border" /> : 'Save'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default Teams;
