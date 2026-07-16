import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { CheckCircle, AlertTriangle, User, CreditCard, Building, Phone, ShieldCheck } from 'lucide-react';
import API_ENDPOINTS from '../config/api';

const GENDERS      = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const RELATIONS    = ['Father', 'Mother', 'Spouse', 'Sibling', 'Friend', 'Other'];

const TABS = [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'bank',     label: 'Bank',     icon: CreditCard },
    { key: 'ids',      label: 'IDs',      icon: ShieldCheck },
    { key: 'emergency',label: 'Emergency', icon: Phone },
];

export default function OnboardingFormPage() {
    const { token }  = useParams();
    const navigate   = useNavigate();

    const [offer, setOffer]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [offerErr, setOfferErr] = useState('');
    const [tab, setTab]         = useState('personal');
    const [form, setForm]       = useState({
        first_name: '', middle_name: '', last_name: '', email: '',
        phone: '', dob: '', gender: '', blood_group: '',
        address: '', city: '', state: '', pincode: '',
        joining_date: '',
        bank_account_name: '', account_number: '', ifsc_code: '', branch_name: '',
        pan_number: '', aadhar_number: '', uan: '',
        emergency_contact_name: '', emergency_contact: '', emergency_contact_relation: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitErr, setSubmitErr]   = useState('');
    const [done, setDone]             = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(API_ENDPOINTS.ONBOARDING_BY_TOKEN(token));
                const d   = await res.json();
                if (!d.success && !d.offer) { setOfferErr(d.message || 'Invalid link'); return; }
                const o = d.offer;
                if (!['pending', 'accepted'].includes(o.status)) {
                    setOfferErr(`This offer cannot accept a form submission (status: ${o.status})`);
                    return;
                }
                setOffer(o);
                // Pre-fill name fields from offer
                const parts = (o.employee_name || '').trim().split(/\s+/);
                setForm(f => ({
                    ...f,
                    first_name: parts[0] || '',
                    last_name:  parts.length > 1 ? parts[parts.length - 1] : '',
                    middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
                }));
            } catch {
                setOfferErr('Failed to load offer details. Please try again.');
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitErr(''); setSubmitting(true);
        try {
            const res = await fetch(API_ENDPOINTS.ONBOARDING_SUBMIT(token), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const d = await res.json();
            if (!d.success) throw new Error(d.message);
            setDone(true);
        } catch (err) {
            setSubmitErr(err.message);
            setTab('personal');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div style={pageStyle}>
            <Spinner animation="border" variant="primary" />
        </div>
    );

    if (offerErr) return (
        <div style={pageStyle}>
            <div style={cardStyle}>
                <div style={{ textAlign: 'center' }}>
                    <AlertTriangle size={48} color="#f97316" style={{ marginBottom: 12 }} />
                    <h5 style={{ fontWeight: 700 }}>Cannot Load Form</h5>
                    <p style={{ color: '#6b7280', fontSize: 14 }}>{offerErr}</p>
                    <button onClick={() => navigate(`/onboarding/${token}`)} style={{ marginTop: 12, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}>
                        Back to Offer
                    </button>
                </div>
            </div>
        </div>
    );

    if (done) return (
        <div style={pageStyle}>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
                <CheckCircle size={60} color="#10b981" style={{ marginBottom: 16 }} />
                <h4 style={{ fontWeight: 800, color: '#111827' }}>Onboarding Form Submitted!</h4>
                <p style={{ color: '#6b7280', fontSize: 14, marginTop: 8, maxWidth: 380, margin: '8px auto 0' }}>
                    Thank you! HR will review your information and create your account. You'll be contacted with your login credentials shortly.
                </p>
            </div>
        </div>
    );

    return (
        <div style={pageStyle}>
            <div style={{ ...cardStyle, maxWidth: 640 }}>
                {/* Header */}
                <div style={{ marginBottom: 24, borderBottom: '1px solid #f3f4f6', paddingBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>B2B InDemand — Employee Onboarding</div>
                    <h4 style={{ fontWeight: 800, color: '#111827', margin: 0 }}>Complete Your Onboarding</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0' }}>
                        {offer.designation} · {offer.department} · ₹{Number(offer.salary).toLocaleString('en-IN')}/month
                    </p>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
                    {TABS.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 4px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 500, background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#6366f1' : '#6b7280', boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                                <Icon size={14} /> {t.label}
                            </button>
                        );
                    })}
                </div>

                <Form onSubmit={handleSubmit}>
                    {submitErr && <Alert variant="danger" style={{ fontSize: 13 }}>{submitErr}</Alert>}

                    {/* Personal Info */}
                    {tab === 'personal' && (
                        <div style={gridStyle}>
                            <FieldGroup label="First Name" required><Form.Control size="sm" value={form.first_name} onChange={e => set('first_name', e.target.value)} required style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Middle Name"><Form.Control size="sm" value={form.middle_name} onChange={e => set('middle_name', e.target.value)} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Last Name" required><Form.Control size="sm" value={form.last_name} onChange={e => set('last_name', e.target.value)} required style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Email Address" required><Form.Control size="sm" type="email" value={form.email} onChange={e => set('email', e.target.value)} required style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Phone Number"><Form.Control size="sm" value={form.phone} onChange={e => set('phone', e.target.value)} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Date of Birth"><Form.Control size="sm" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Gender">
                                <Form.Select size="sm" value={form.gender} onChange={e => set('gender', e.target.value)} style={inputStyle}>
                                    <option value="">Select gender</option>
                                    {GENDERS.map(g => <option key={g}>{g}</option>)}
                                </Form.Select>
                            </FieldGroup>
                            <FieldGroup label="Blood Group">
                                <Form.Select size="sm" value={form.blood_group} onChange={e => set('blood_group', e.target.value)} style={inputStyle}>
                                    <option value="">Select blood group</option>
                                    {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                                </Form.Select>
                            </FieldGroup>
                            <FieldGroup label="Expected Joining Date"><Form.Control size="sm" type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} style={inputStyle} /></FieldGroup>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <FieldGroup label="Residential Address">
                                    <Form.Control as="textarea" rows={2} size="sm" value={form.address} onChange={e => set('address', e.target.value)} style={{ ...inputStyle, resize: 'none' }} />
                                </FieldGroup>
                            </div>
                            <FieldGroup label="City"><Form.Control size="sm" value={form.city} onChange={e => set('city', e.target.value)} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="State"><Form.Control size="sm" value={form.state} onChange={e => set('state', e.target.value)} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Pincode"><Form.Control size="sm" value={form.pincode} onChange={e => set('pincode', e.target.value)} style={inputStyle} /></FieldGroup>
                        </div>
                    )}

                    {/* Bank Details */}
                    {tab === 'bank' && (
                        <div style={gridStyle}>
                            <FieldGroup label="Account Holder Name"><Form.Control size="sm" value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Account Number"><Form.Control size="sm" value={form.account_number} onChange={e => set('account_number', e.target.value)} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="IFSC Code"><Form.Control size="sm" value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value)} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Branch Name"><Form.Control size="sm" value={form.branch_name} onChange={e => set('branch_name', e.target.value)} style={inputStyle} /></FieldGroup>
                            <p style={{ gridColumn: '1 / -1', fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Bank details are used for salary disbursement and kept securely encrypted.</p>
                        </div>
                    )}

                    {/* IDs */}
                    {tab === 'ids' && (
                        <div style={gridStyle}>
                            <FieldGroup label="PAN Number"><Form.Control size="sm" value={form.pan_number} onChange={e => set('pan_number', e.target.value.toUpperCase())} maxLength={10} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Aadhar Number"><Form.Control size="sm" value={form.aadhar_number} onChange={e => set('aadhar_number', e.target.value)} maxLength={12} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="UAN (PF Number)"><Form.Control size="sm" value={form.uan} onChange={e => set('uan', e.target.value)} style={inputStyle} /></FieldGroup>
                            <p style={{ gridColumn: '1 / -1', fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Government ID numbers are required for compliance, payroll, and PF deductions.</p>
                        </div>
                    )}

                    {/* Emergency Contact */}
                    {tab === 'emergency' && (
                        <div style={gridStyle}>
                            <FieldGroup label="Contact Person Name"><Form.Control size="sm" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Relationship">
                                <Form.Select size="sm" value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)} style={inputStyle}>
                                    <option value="">Select relation</option>
                                    {RELATIONS.map(r => <option key={r}>{r}</option>)}
                                </Form.Select>
                            </FieldGroup>
                            <FieldGroup label="Contact Number"><Form.Control size="sm" value={form.emergency_contact} onChange={e => set('emergency_contact', e.target.value)} style={inputStyle} /></FieldGroup>
                        </div>
                    )}

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
                        <button type="button" onClick={() => {
                            const idx = TABS.findIndex(t => t.key === tab);
                            if (idx > 0) setTab(TABS[idx - 1].key);
                        }} disabled={tab === TABS[0].key} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#374151', opacity: tab === TABS[0].key ? 0.4 : 1 }}>
                            ← Back
                        </button>

                        {tab !== TABS[TABS.length - 1].key ? (
                            <button type="button" onClick={() => {
                                const idx = TABS.findIndex(t => t.key === tab);
                                setTab(TABS[idx + 1].key);
                            }} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                                Next →
                            </button>
                        ) : (
                            <button type="submit" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                                {submitting ? <Spinner size="sm" animation="border" /> : <CheckCircle size={16} />}
                                {submitting ? 'Submitting…' : 'Submit Onboarding Form'}
                            </button>
                        )}
                    </div>
                </Form>
            </div>
        </div>
    );
}

function FieldGroup({ label, required, children }) {
    return (
        <Form.Group>
            <Form.Label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
            </Form.Label>
            {children}
        </Form.Group>
    );
}

const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '32px 16px',
};

const cardStyle = {
    background: '#fff',
    borderRadius: 20,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 10px 40px rgba(99,102,241,0.12)',
};

const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
};

const inputStyle = {
    borderRadius: 8,
};
