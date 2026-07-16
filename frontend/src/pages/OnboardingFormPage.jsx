import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Spinner, Alert } from 'react-bootstrap';
import {
    CheckCircle, AlertTriangle, User, CreditCard, ShieldCheck, Phone, FileUp, Upload, X,
} from 'lucide-react';
import API_ENDPOINTS from '../config/api';

const GENDERS      = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const RELATIONS    = ['Father', 'Mother', 'Spouse', 'Sibling', 'Friend', 'Other'];

const TABS = [
    { key: 'personal',  label: 'Personal',  icon: User },
    { key: 'bank',      label: 'Bank',       icon: CreditCard },
    { key: 'ids',       label: 'IDs',        icon: ShieldCheck },
    { key: 'emergency', label: 'Emergency',  icon: Phone },
    { key: 'documents', label: 'Documents',  icon: FileUp },
];

const DOC_FIELDS = [
    {
        key: 'passport_photo',
        label: 'Passport Size Photo',
        required: true,
        accept: 'image/jpeg,image/jpg,image/png',
        hint: 'Clear front-facing photo · JPG or PNG · max 10 MB',
    },
    {
        key: 'aadhar_card_doc',
        label: 'Aadhar Card',
        required: true,
        accept: 'image/jpeg,image/jpg,image/png,application/pdf',
        hint: 'Both sides on one file · JPG, PNG or PDF · max 10 MB',
    },
    {
        key: 'pan_card_doc',
        label: 'PAN Card',
        required: true,
        accept: 'image/jpeg,image/jpg,image/png,application/pdf',
        hint: 'Clear scan or photo · JPG, PNG or PDF · max 10 MB',
    },
    {
        key: 'offer_letter_doc',
        label: 'Offer Letter / Experience Letter',
        required: false,
        accept: 'image/jpeg,image/jpg,image/png,application/pdf,.doc,.docx',
        hint: 'Previous experience letter if applicable · optional · max 10 MB',
    },
];

// ── File upload field component ───────────────────────────────────────────────
function FileField({ label, required, accept, hint, file, onChange }) {
    const inputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) onChange(f);
    };

    const fmtSize = (bytes) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    return (
        <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {label}
                {required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
            </div>
            <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                style={{
                    border: `2px dashed ${file ? '#10b981' : '#c7d2fe'}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    background: file ? '#f0fdf4' : '#f8f9ff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'border-color 0.15s, background 0.15s',
                }}
            >
                <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: file ? '#d1fae5' : '#e0e7ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {file ? <CheckCircle size={18} color="#10b981" /> : <Upload size={18} color="#6366f1" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {file ? (
                        <>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {file.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{fmtSize(file.size)}</div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#4338ca' }}>Click to upload or drag &amp; drop</div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{hint}</div>
                        </>
                    )}
                </div>
                {file && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onChange(null); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', flexShrink: 0 }}
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                style={{ display: 'none' }}
                onChange={e => onChange(e.target.files[0] || null)}
            />
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OnboardingFormPage() {
    const { token } = useParams();
    const navigate  = useNavigate();

    const [offer, setOffer]       = useState(null);
    const [loading, setLoading]   = useState(true);
    const [offerErr, setOfferErr] = useState('');
    const [tab, setTab]           = useState('personal');

    const [form, setForm] = useState({
        first_name: '', middle_name: '', last_name: '', email: '',
        phone: '', dob: '', gender: '', blood_group: '',
        address: '', city: '', state: '', pincode: '',
        joining_date: '',
        bank_account_name: '', account_number: '', ifsc_code: '', branch_name: '',
        pan_number: '', aadhar_number: '', uan: '',
        emergency_contact_name: '', emergency_contact: '', emergency_contact_relation: '',
    });

    const [files, setFiles] = useState({
        passport_photo: null, aadhar_card_doc: null, pan_card_doc: null, offer_letter_doc: null,
    });

    const [submitting, setSubmitting]         = useState(false);
    const [submitErr, setSubmitErr]           = useState('');
    const [done, setDone]                     = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

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
                const parts = (o.employee_name || '').trim().split(/\s+/);
                setForm(f => ({
                    ...f,
                    first_name:  parts[0] || '',
                    last_name:   parts.length > 1 ? parts[parts.length - 1] : '',
                    middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
                }));
            } catch {
                setOfferErr('Failed to load offer details. Please try again.');
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    const set     = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const setFile = (k, v) => setFiles(f => ({ ...f, [k]: v }));

    // Upload one file directly to Supabase Storage via a backend-issued signed URL.
    // The file never passes through Vercel — only a small JSON presign request does.
    const uploadFileDirect = async (fieldKey, file) => {
        const presignRes = await fetch(API_ENDPOINTS.ONBOARDING_PRESIGN(token), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field: fieldKey, filename: file.name, mimeType: file.type }),
        });
        const raw1 = await presignRes.text();
        let presignData;
        try { presignData = JSON.parse(raw1); } catch {
            throw new Error(`Could not prepare upload (${presignRes.status})`);
        }
        if (!presignData.success) throw new Error(`Upload prepare failed: ${presignData.message}`);

        const uploadRes = await fetch(presignData.signedUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!uploadRes.ok) {
            const errText = await uploadRes.text().catch(() => '');
            throw new Error(`Upload failed for ${fieldKey}: HTTP ${uploadRes.status}${errText ? ' — ' + errText.substring(0, 80) : ''}`);
        }
        return presignData.publicUrl;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitErr('');

        if (!files.passport_photo)  { setSubmitErr('Passport size photo is required — go to Documents tab.'); setTab('documents'); return; }
        if (!files.aadhar_card_doc) { setSubmitErr('Aadhar card is required — go to Documents tab.'); setTab('documents'); return; }
        if (!files.pan_card_doc)    { setSubmitErr('PAN card is required — go to Documents tab.'); setTab('documents'); return; }

        setSubmitting(true);

        try {
            // Step 1: upload each file directly to Supabase (bypasses Vercel 4.5 MB limit)
            const docUrls  = {};
            const required = [
                { key: 'passport_photo',  label: 'Passport Photo' },
                { key: 'aadhar_card_doc', label: 'Aadhar Card' },
                { key: 'pan_card_doc',    label: 'PAN Card' },
            ];
            const optional = [{ key: 'offer_letter_doc', label: 'Offer / Experience Letter' }];
            const total = required.length + optional.filter(o => files[o.key]).length;
            let count = 0;

            for (const { key, label } of required) {
                count++;
                setUploadProgress(`Uploading ${label}… (${count}/${total})`);
                docUrls[key] = await uploadFileDirect(key, files[key]);
            }
            for (const { key, label } of optional) {
                if (files[key]) {
                    count++;
                    setUploadProgress(`Uploading ${label}… (${count}/${total})`);
                    docUrls[key] = await uploadFileDirect(key, files[key]);
                }
            }

            // Step 2: submit form fields + public URLs as JSON (tiny payload, Vercel-safe)
            setUploadProgress('Saving your details…');
            const res = await fetch(API_ENDPOINTS.ONBOARDING_SUBMIT(token), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, ...docUrls }),
            });

            const raw = await res.text();
            let d;
            try { d = JSON.parse(raw); } catch {
                const preview = raw.replace(/<[^>]*>/g, '').trim().substring(0, 180);
                throw new Error(`Server error (${res.status}): ${preview || 'Unexpected response'}`);
            }
            if (!d.success) throw new Error(d.message);
            setDone(true);
        } catch (err) {
            setSubmitErr(err.message);
        } finally {
            setSubmitting(false);
            setUploadProgress('');
        }
    };

    // ── States ────────────────────────────────────────────────────────────────
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
                    Thank you! HR will review your information and documents, then create your employee account. You'll be contacted with your login credentials shortly.
                </p>
            </div>
        </div>
    );

    const docsDone = DOC_FIELDS.filter(d => d.required && !files[d.key]).length === 0;

    return (
        <div style={pageStyle}>
            <div style={{ ...cardStyle, maxWidth: 660 }}>

                {/* Header */}
                <div style={{ marginBottom: 20, borderBottom: '1px solid #f3f4f6', paddingBottom: 14 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>B2B InDemand — Employee Onboarding</div>
                    <h4 style={{ fontWeight: 800, color: '#111827', margin: 0 }}>Complete Your Onboarding</h4>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '5px 0 0' }}>
                        {offer.designation} · {offer.department} · ₹{Number(offer.salary).toLocaleString('en-IN')}/month
                    </p>
                </div>

                {/* Progress chips */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto' }}>
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const isActive = tab === t.key;
                        const isDone = (() => {
                            if (t.key === 'documents') return docsDone;
                            if (t.key === 'bank') return !!(form.bank_account_name && form.account_number && form.ifsc_code);
                            if (t.key === 'personal') return !!(form.first_name && form.last_name && form.email);
                            return false;
                        })();
                        return (
                            <button
                                key={t.key} type="button" onClick={() => setTab(t.key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                                    border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 12,
                                    fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap',
                                    background: isActive ? '#6366f1' : isDone ? '#d1fae5' : '#f3f4f6',
                                    color: isActive ? '#fff' : isDone ? '#065f46' : '#6b7280',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {isDone && !isActive ? <CheckCircle size={12} /> : <Icon size={12} />}
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                <Form onSubmit={handleSubmit}>
                    {submitErr && (
                        <Alert variant="danger" style={{ fontSize: 13, marginBottom: 16 }} dismissible onClose={() => setSubmitErr('')}>
                            {submitErr}
                        </Alert>
                    )}

                    {/* ── Personal Info ── */}
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

                    {/* ── Bank Details ── */}
                    {tab === 'bank' && (
                        <div style={gridStyle}>
                            <div style={{ gridColumn: '1 / -1', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 4 }}>
                                Bank details are mandatory for salary disbursement and are kept securely.
                            </div>
                            <FieldGroup label="Account Holder Name" required><Form.Control size="sm" value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} required style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Account Number" required><Form.Control size="sm" value={form.account_number} onChange={e => set('account_number', e.target.value)} required style={inputStyle} /></FieldGroup>
                            <FieldGroup label="IFSC Code" required><Form.Control size="sm" value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value.toUpperCase())} required maxLength={11} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Branch Name"><Form.Control size="sm" value={form.branch_name} onChange={e => set('branch_name', e.target.value)} style={inputStyle} /></FieldGroup>
                        </div>
                    )}

                    {/* ── IDs ── */}
                    {tab === 'ids' && (
                        <div style={gridStyle}>
                            <FieldGroup label="PAN Number"><Form.Control size="sm" value={form.pan_number} onChange={e => set('pan_number', e.target.value.toUpperCase())} maxLength={10} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="Aadhar Number"><Form.Control size="sm" value={form.aadhar_number} onChange={e => set('aadhar_number', e.target.value)} maxLength={12} style={inputStyle} /></FieldGroup>
                            <FieldGroup label="UAN (PF Number)"><Form.Control size="sm" value={form.uan} onChange={e => set('uan', e.target.value)} style={inputStyle} /></FieldGroup>
                        </div>
                    )}

                    {/* ── Emergency Contact ── */}
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

                    {/* ── Documents ── */}
                    {tab === 'documents' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                                Upload clear scans or photos. Files go directly to secure storage — not through the server.
                            </p>
                            {DOC_FIELDS.map(d => (
                                <FileField
                                    key={d.key}
                                    fieldKey={d.key}
                                    label={d.label}
                                    required={d.required}
                                    accept={d.accept}
                                    hint={d.hint}
                                    file={files[d.key]}
                                    onChange={f => setFile(d.key, f)}
                                />
                            ))}
                        </div>
                    )}

                    {/* ── Navigation ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={() => {
                                const idx = TABS.findIndex(t => t.key === tab);
                                if (idx > 0) setTab(TABS[idx - 1].key);
                            }}
                            disabled={tab === TABS[0].key}
                            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#374151', opacity: tab === TABS[0].key ? 0.4 : 1 }}
                        >
                            ← Back
                        </button>

                        {tab !== TABS[TABS.length - 1].key ? (
                            <button
                                type="button"
                                onClick={() => {
                                    const idx = TABS.findIndex(t => t.key === tab);
                                    setTab(TABS[idx + 1].key);
                                }}
                                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                            >
                                Next →
                            </button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                {uploadProgress && (
                                    <div style={{ fontSize: 12, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Spinner size="sm" animation="border" style={{ width: 14, height: 14 }} />
                                        {uploadProgress}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 8, border: 'none', background: submitting ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                                >
                                    {submitting ? <Spinner size="sm" animation="border" /> : <CheckCircle size={16} />}
                                    {submitting ? 'Submitting…' : 'Submit Onboarding Form'}
                                </button>
                            </div>
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

const inputStyle = { borderRadius: 8 };
