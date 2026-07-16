import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Spinner, Alert, Modal, Button, Form } from 'react-bootstrap';
import { Copy, RefreshCw, CheckCircle, XCircle, Clock, FileText, Trash2, UserPlus, Eye, Search } from 'lucide-react';
import API_ENDPOINTS from '../../config/api';

const STATUS_CFG = {
    pending:   { label: 'Pending',   bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
    accepted:  { label: 'Accepted',  bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
    rejected:  { label: 'Rejected',  bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
    submitted: { label: 'Submitted', bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
    approved:  { label: 'Approved',  bg: '#ede9fe', color: '#4c1d95', dot: '#8b5cf6' },
    expired:   { label: 'Expired',   bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
};

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
            {cfg.label}
        </span>
    );
};

const fmtDate = (s) => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n) => n ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

export default function OfferLinksManager() {
    const [links, setLinks]         = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [filter, setFilter]       = useState('all');
    const [search, setSearch]       = useState('');
    const [copied, setCopied]       = useState(null);
    const [actioning, setActioning] = useState(null);

    // Approve modal
    const [approveModal, setApproveModal]   = useState(null); // link obj
    const [approveResult, setApproveResult] = useState(null);
    const [approving, setApproving]         = useState(false);

    // Submission viewer modal
    const [subModal, setSubModal] = useState(null);
    const [subData, setSubData]   = useState(null);
    const [subLoading, setSubLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await fetch(API_ENDPOINTS.ONBOARDING_LINKS, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const d = await res.json();
            if (!d.success) throw new Error(d.message);
            setLinks(d.links || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const getBaseUrl = () => {
        const ep = API_ENDPOINTS.ONBOARDING_BY_TOKEN('__TOKEN__');
        try {
            const url = new URL(ep);
            return `${url.protocol}//${url.host}`;
        } catch {
            return window.location.origin;
        }
    };

    const copyLink = (token) => {
        const baseUrl = getBaseUrl();
        const link = `${baseUrl}/onboarding/${token}`;
        navigator.clipboard.writeText(link).then(() => {
            setCopied(token);
            setTimeout(() => setCopied(null), 2000);
        });
    };

    const doExpire = async (link) => {
        if (!window.confirm(`Expire link for "${link.employee_name}"? They won't be able to use it.`)) return;
        setActioning(link.id);
        try {
            const res = await fetch(API_ENDPOINTS.ONBOARDING_LINK_EXPIRE(link.id), {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const d = await res.json();
            if (!d.success) throw new Error(d.message);
            await load();
        } catch (err) {
            alert(err.message);
        } finally {
            setActioning(null);
        }
    };

    const doDelete = async (link) => {
        if (!window.confirm(`Permanently delete offer link for "${link.employee_name}"? This cannot be undone.`)) return;
        setActioning(link.id);
        try {
            const res = await fetch(API_ENDPOINTS.ONBOARDING_LINK_DELETE(link.id), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const d = await res.json();
            if (!d.success) throw new Error(d.message);
            await load();
        } catch (err) {
            alert(err.message);
        } finally {
            setActioning(null);
        }
    };

    const openSubmission = async (link) => {
        setSubModal(link); setSubData(null); setSubLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.ONBOARDING_LINK_SUBMISSION(link.id), {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const d = await res.json();
            if (!d.success) throw new Error(d.message);
            setSubData(d.submission);
        } catch (err) {
            setSubData({ _error: err.message });
        } finally {
            setSubLoading(false);
        }
    };

    const doApprove = async () => {
        if (!approveModal) return;
        setApproving(true);
        try {
            const res = await fetch(API_ENDPOINTS.ONBOARDING_LINK_APPROVE(approveModal.id), {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const d = await res.json();
            if (!d.success) throw new Error(d.message);
            setApproveResult(d);
            await load();
        } catch (err) {
            setApproveResult({ success: false, message: err.message });
        } finally {
            setApproving(false);
        }
    };

    const filtered = links.filter(l => {
        const st = filter === 'all' ? true : (l.effective_status || l.status) === filter;
        const q  = search.trim().toLowerCase();
        const mt = !q || l.employee_name.toLowerCase().includes(q) || l.designation?.toLowerCase().includes(q) || l.department?.toLowerCase().includes(q);
        return st && mt;
    });

    const counts = {};
    links.forEach(l => { const s = l.effective_status || l.status; counts[s] = (counts[s] || 0) + 1; });

    const tabs = [
        { key: 'all', label: 'All', count: links.length },
        { key: 'pending', label: 'Pending', count: counts.pending || 0 },
        { key: 'submitted', label: 'Submitted', count: counts.submitted || 0 },
        { key: 'accepted', label: 'Accepted', count: counts.accepted || 0 },
        { key: 'approved', label: 'Approved', count: counts.approved || 0 },
        { key: 'rejected', label: 'Rejected', count: counts.rejected || 0 },
        { key: 'expired', label: 'Expired', count: counts.expired || 0 },
    ];

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, role, department…" style={{ width: '100%', paddingLeft: 32, paddingRight: 10, height: 34, border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                </div>
                <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 500 }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Status tabs */}
            <div style={{ padding: '0 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0 }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setFilter(t.key)} style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: filter === t.key ? 700 : 500, color: filter === t.key ? '#6366f1' : '#6b7280', borderBottom: filter === t.key ? '2px solid #6366f1' : '2px solid transparent', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
                        {t.label} {t.count > 0 && <span style={{ background: filter === t.key ? '#e0e7ff' : '#f3f4f6', color: filter === t.key ? '#4338ca' : '#6b7280', borderRadius: 10, padding: '1px 6px', fontSize: 11, marginLeft: 4 }}>{t.count}</span>}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner animation="border" variant="primary" /></div>
                ) : error ? (
                    <Alert variant="danger" style={{ margin: '12px 0' }}>{error}</Alert>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                        <FileText size={40} strokeWidth={1} style={{ marginBottom: 12 }} />
                        <div style={{ fontWeight: 600, color: '#374151' }}>No offer links found</div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>Generate links from the Employee Management page</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filtered.map(l => {
                            const st = l.effective_status || l.status;
                            const busy = actioning === l.id;
                            return (
                                <div key={l.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                    {/* Avatar */}
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#4338ca', fontSize: 15, flexShrink: 0 }}>
                                        {(l.employee_name || 'X')[0].toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: '#111827', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.employee_name}</div>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{l.designation} · {l.department} · {l.employment_type}</div>
                                    </div>

                                    {/* Salary */}
                                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                                        <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>{fmtMoney(l.salary)}</div>
                                        <div style={{ fontSize: 11, color: '#9ca3af' }}>/ month</div>
                                    </div>

                                    {/* Expiry */}
                                    <div style={{ textAlign: 'center', minWidth: 90 }}>
                                        <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{fmtDate(l.expiry_date)}</div>
                                        <div style={{ fontSize: 11, color: '#9ca3af' }}>Expiry</div>
                                    </div>

                                    {/* Status */}
                                    <div style={{ minWidth: 90 }}>
                                        <StatusBadge status={st} />
                                    </div>

                                    {/* Generated by */}
                                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                                        <div style={{ fontSize: 11, color: '#9ca3af' }}>by {l.generated_by_name || l.generated_by}</div>
                                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(l.created_at)}</div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                        {['pending', 'accepted'].includes(st) && (
                                            <button onClick={() => copyLink(l.token)} title="Copy link" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e5e7eb', background: copied === l.token ? '#d1fae5' : '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copied === l.token ? '#065f46' : '#6b7280' }}>
                                                {copied === l.token ? <CheckCircle size={14} /> : <Copy size={14} />}
                                            </button>
                                        )}
                                        {st === 'submitted' && (
                                            <>
                                                <button onClick={() => openSubmission(l)} title="View submission" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                                                    <Eye size={14} />
                                                </button>
                                                <button onClick={() => { setApproveModal(l); setApproveResult(null); }} title="Approve & create account" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #d1fae5', background: '#d1fae5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#065f46' }}>
                                                    <UserPlus size={14} />
                                                </button>
                                            </>
                                        )}
                                        {st === 'approved' && (
                                            <button onClick={() => openSubmission(l)} title="View submission" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                                                <Eye size={14} />
                                            </button>
                                        )}
                                        {['pending', 'accepted'].includes(st) && (
                                            <button onClick={() => doExpire(l)} title="Expire link" disabled={busy} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', opacity: busy ? 0.5 : 1 }}>
                                                {busy ? <Spinner size="sm" animation="border" /> : <XCircle size={14} />}
                                            </button>
                                        )}
                                        {['rejected', 'expired', 'approved'].includes(st) && (
                                            <button onClick={() => doDelete(l)} title="Delete" disabled={busy} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', opacity: busy ? 0.5 : 1 }}>
                                                {busy ? <Spinner size="sm" animation="border" /> : <Trash2 size={14} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Submission Viewer Modal */}
            <Modal show={!!subModal} onHide={() => setSubModal(null)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: 16, fontWeight: 700 }}>
                        Onboarding Submission — {subModal?.employee_name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {subLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}><Spinner animation="border" variant="primary" /></div>
                    ) : subData?._error ? (
                        <Alert variant="danger">{subData._error}</Alert>
                    ) : subData ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 13 }}>
                            {Object.entries(subData).filter(([k]) => !['id', 'offer_id', 'created_at'].includes(k)).map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', flexDirection: 'column', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.replace(/_/g, ' ')}</span>
                                    <span style={{ fontWeight: 600, color: '#111827', marginTop: 2 }}>{v || '—'}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setSubModal(null)}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Approve Modal */}
            <Modal show={!!approveModal} onHide={() => { setApproveModal(null); setApproveResult(null); }} centered>
                <Modal.Header closeButton style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <Modal.Title style={{ fontSize: 16, fontWeight: 700, color: '#14532d' }}>
                        <UserPlus size={18} style={{ marginRight: 8 }} />
                        Approve & Create Account
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {approveResult ? (
                        approveResult.success ? (
                            <div style={{ textAlign: 'center', padding: '12px 0' }}>
                                <CheckCircle size={44} color="#10b981" style={{ marginBottom: 12 }} />
                                <h6 style={{ fontWeight: 700, color: '#065f46' }}>Account Created!</h6>
                                <p style={{ fontSize: 13, color: '#374151' }}>
                                    Employee ID: <strong>{approveResult.employee_id}</strong>
                                </p>
                                <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: 12, fontSize: 13, textAlign: 'left' }}>
                                    <strong>Temporary Password:</strong>
                                    <div style={{ fontFamily: 'monospace', fontSize: 15, marginTop: 4, color: '#92400e' }}>{approveResult.temp_password}</div>
                                    <div style={{ fontSize: 11, color: '#92400e', marginTop: 6 }}>Share this securely with the employee. They can change it after first login.</div>
                                </div>
                            </div>
                        ) : (
                            <Alert variant="danger">{approveResult.message}</Alert>
                        )
                    ) : (
                        <>
                            <p style={{ fontSize: 14, color: '#374151' }}>
                                This will create an employee account for <strong>{approveModal?.employee_name}</strong> using their submitted information.
                            </p>
                            <ul style={{ fontSize: 13, color: '#6b7280', paddingLeft: 20 }}>
                                <li>A unique Employee ID will be generated automatically</li>
                                <li>A temporary password will be generated — share it securely</li>
                                <li>The employee can log in and change their password after first sign-in</li>
                            </ul>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => { setApproveModal(null); setApproveResult(null); }}>
                        {approveResult?.success ? 'Close' : 'Cancel'}
                    </Button>
                    {!approveResult && (
                        <Button onClick={doApprove} disabled={approving} style={{ background: '#10b981', border: 'none', fontWeight: 600 }}>
                            {approving ? <><Spinner size="sm" animation="border" className="me-2" />Creating…</> : 'Approve & Create Account'}
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
        </div>
    );
}
