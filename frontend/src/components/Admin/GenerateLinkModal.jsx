import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Spinner, Alert } from 'react-bootstrap';
import { CheckCircle, Copy, Link, X } from 'lucide-react';
import API_ENDPOINTS from '../../config/api';

const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 'Administration', 'Legal'];
const EMP_TYPES   = ['Full Time', 'Part Time', 'Freelancer', 'Contract Based', 'Intern', 'Probation'];

const today = () => new Date().toISOString().split('T')[0];
const minExpiry = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
};

export default function GenerateLinkModal({ show, onHide, onGenerated }) {
    const [form, setForm]       = useState({ employee_name: '', designation: '', department: '', employment_type: '', salary: '', reporting_manager: '', reporting_manager_id: '', expiry_date: '', notes: '' });
    const [managers, setManagers] = useState([]);
    const [saving, setSaving]   = useState(false);
    const [error, setError]     = useState('');
    const [generated, setGenerated] = useState(null); // { link }
    const [copied, setCopied]   = useState(false);

    useEffect(() => {
        if (!show) return;
        setForm({ employee_name: '', designation: '', department: '', employment_type: '', salary: '', reporting_manager: '', reporting_manager_id: '', expiry_date: '', notes: '' });
        setError('');
        setGenerated(null);
        setCopied(false);
        fetch(API_ENDPOINTS.TEAMS_MANAGERS_LIST, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(r => r.json())
            .then(d => { if (d.success) setManagers(d.managers || []); })
            .catch(() => {});
    }, [show]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleManagerChange = (e) => {
        const id = e.target.value;
        const mgr = managers.find(m => m.id === id);
        setForm(f => ({ ...f, reporting_manager_id: id, reporting_manager: mgr ? `${mgr.first_name} ${mgr.last_name}`.trim() : '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const res = await fetch(API_ENDPOINTS.ONBOARDING_GENERATE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            setGenerated({ link: data.link });
            if (onGenerated) onGenerated(data.offer);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(generated.link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none' }}>
                <Modal.Title style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link size={20} /> Generate Employee Offer Link
                </Modal.Title>
                <button onClick={onHide} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
                    <X size={20} />
                </button>
            </Modal.Header>

            <Modal.Body style={{ padding: '1.5rem' }}>
                {generated ? (
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <CheckCircle size={36} color="#10b981" />
                        </div>
                        <h5 style={{ fontWeight: 700, color: '#111827', marginBottom: 8 }}>Offer Link Generated!</h5>
                        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                            Share this secure link with the candidate. It will guide them through the onboarding process.
                        </p>
                        <div style={{ background: '#f8f9ff', border: '1px solid #e0e7ff', borderRadius: 10, padding: '12px 16px', marginBottom: 16, wordBreak: 'break-all', fontSize: 13, color: '#4338ca', textAlign: 'left' }}>
                            {generated.link}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: copied ? '#d1fae5' : '#6366f1', color: copied ? '#065f46' : '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, transition: 'background 0.2s' }}>
                                {copied ? <><CheckCircle size={16} /> Copied!</> : <><Copy size={16} /> Copy Link</>}
                            </button>
                            <button onClick={() => { setGenerated(null); }} style={{ padding: '8px 18px', borderRadius: 8, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                                Generate Another
                            </button>
                        </div>
                    </div>
                ) : (
                    <Form onSubmit={handleSubmit}>
                        {error && <Alert variant="danger" className="py-2" style={{ fontSize: 13 }}>{error}</Alert>}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <Form.Group>
                                <Form.Label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Candidate Full Name <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                                <Form.Control size="sm" value={form.employee_name} onChange={e => set('employee_name', e.target.value)} placeholder="e.g. Rahul Sharma" required style={{ borderRadius: 8 }} />
                            </Form.Group>
                            <Form.Group>
                                <Form.Label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Position / Designation <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                                <Form.Control size="sm" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Software Engineer" required style={{ borderRadius: 8 }} />
                            </Form.Group>
                            <Form.Group>
                                <Form.Label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Department <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                                <Form.Control
                                    list="gen-link-dept-list"
                                    size="sm"
                                    value={form.department}
                                    onChange={e => set('department', e.target.value)}
                                    placeholder="Select or type a department…"
                                    required
                                    style={{ borderRadius: 8 }}
                                />
                                <datalist id="gen-link-dept-list">
                                    {DEPARTMENTS.map(d => <option key={d} value={d} />)}
                                </datalist>
                            </Form.Group>
                            <Form.Group>
                                <Form.Label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Employment Type <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                                <Form.Select size="sm" value={form.employment_type} onChange={e => set('employment_type', e.target.value)} required style={{ borderRadius: 8 }}>
                                    <option value="">Select type</option>
                                    {EMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </Form.Select>
                            </Form.Group>
                            <Form.Group>
                                <Form.Label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Offered Salary (₹/month) <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                                <Form.Control size="sm" type="number" min="1" value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="e.g. 45000" required style={{ borderRadius: 8 }} />
                            </Form.Group>
                            <Form.Group>
                                <Form.Label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Offer Expiry Date <span style={{ color: '#ef4444' }}>*</span></Form.Label>
                                <Form.Control size="sm" type="date" min={minExpiry()} value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} required style={{ borderRadius: 8 }} />
                            </Form.Group>
                            <Form.Group>
                                <Form.Label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Reporting Manager</Form.Label>
                                <Form.Select size="sm" value={form.reporting_manager_id} onChange={handleManagerChange} style={{ borderRadius: 8 }}>
                                    <option value="">Select manager (optional)</option>
                                    {managers.map(m => (
                                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name} — {m.designation || m.role}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                            <Form.Group style={{ gridColumn: '1 / -1' }}>
                                <Form.Label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Notes / Message to Candidate</Form.Label>
                                <Form.Control as="textarea" rows={2} size="sm" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional — welcome message or any additional info" style={{ borderRadius: 8, resize: 'none' }} />
                            </Form.Group>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                            <Button variant="light" onClick={onHide} style={{ borderRadius: 8, fontWeight: 600 }}>Cancel</Button>
                            <Button type="submit" disabled={saving} style={{ borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600, padding: '8px 24px' }}>
                                {saving ? <><Spinner size="sm" animation="border" className="me-2" />Generating…</> : 'Generate Link'}
                            </Button>
                        </div>
                    </Form>
                )}
            </Modal.Body>
        </Modal>
    );
}
