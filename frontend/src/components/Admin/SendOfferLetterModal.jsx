// components/Admin/SendOfferLetterModal.jsx
// Flow A — "Send Offer Letter" from /admin/employees. 3-step modal: Details (auto-filled
// from the employee record, missing fields highlighted) -> Preview (generated PDF) -> Send.
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Button, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { FaFilePdf, FaPaperPlane, FaExclamationTriangle, FaCheckCircle, FaHistory } from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
    designation: '', department: '', employmentType: '', dateOfJoining: '',
    workLocation: '', reportingManager: '',
    annualCTC: '', probationPeriod: '', noticePeriod: '',
    pfAmount: '', professionalTaxAmount: '',
    signatoryName: '', signatoryDesignation: '',
    additionalEmail: '',
};

const fmtDateTime = (v) => v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const toDateInput = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
};

export default function SendOfferLetterModal({ show, employee, onHide, onSent }) {
    const [step, setStep] = useState('details'); // details | preview | sent
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [history, setHistory] = useState([]);

    const [generating, setGenerating] = useState(false);
    const [offerLetterId, setOfferLetterId] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);

    const [confirming, setConfirming] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null); // { success, message }

    useEffect(() => {
        if (!show || !employee) return;
        setStep('details');
        setError('');
        setForm(EMPTY_FORM);
        setOfferLetterId(null);
        setPdfUrl(null);
        setSendResult(null);
        setConfirming(false);
        setLoading(true);

        axios.get(API_ENDPOINTS.OFFER_LETTER_DATA(employee.employee_id))
            .then(({ data }) => {
                if (!data.success) { setError(data.message || 'Failed to load offer letter data'); return; }
                const d = data.defaults || {};
                setHistory(data.history || []);
                setForm({
                    designation: d.designation || '',
                    department: d.department || '',
                    employmentType: d.employmentType || '',
                    dateOfJoining: toDateInput(employee.joining_date),
                    workLocation: d.workLocation || '',
                    reportingManager: d.reportingManager || '',
                    annualCTC: d.annualCTC || '',
                    probationPeriod: d.probationPeriod || (data.company?.defaultProbationPeriod || ''),
                    noticePeriod: d.noticePeriod || (data.company?.defaultNoticePeriod || ''),
                    pfAmount: d.pfAmount ?? '',
                    professionalTaxAmount: d.professionalTaxAmount ?? '',
                    signatoryName: data.company?.signatoryName || '',
                    signatoryDesignation: data.company?.signatoryDesignation || '',
                    additionalEmail: '',
                });
            })
            .catch(err => setError(err.response?.data?.message || err.message || 'Failed to load offer letter data'))
            .finally(() => setLoading(false));
    }, [show, employee]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const missingFields = useMemo(() => {
        const missing = [];
        if (!employee?.first_name && !employee?.last_name) missing.push('Employee name');
        if (!employee?.email) missing.push('Employee email');
        if (!form.designation?.trim()) missing.push('Designation');
        if (!form.dateOfJoining) missing.push('Date of Joining');
        if (!form.workLocation?.trim()) missing.push('Work Location');
        if (!form.annualCTC || Number(form.annualCTC) <= 0) missing.push('Annual CTC');
        return missing;
    }, [employee, form]);

    const additionalEmailError = form.additionalEmail && !EMAIL_REGEX.test(form.additionalEmail.trim())
        ? 'Enter a valid email address' : '';

    const handlePreview = async () => {
        if (missingFields.length || additionalEmailError) return;
        setGenerating(true);
        setError('');
        try {
            const payload = {
                ...form,
                annualCTC: Number(form.annualCTC),
                pfAmount: form.pfAmount === '' ? undefined : Number(form.pfAmount),
                professionalTaxAmount: form.professionalTaxAmount === '' ? undefined : Number(form.professionalTaxAmount),
                additionalEmail: form.additionalEmail?.trim() || undefined,
            };
            const { data } = await axios.post(API_ENDPOINTS.OFFER_LETTER_PREVIEW(employee.employee_id), payload);
            if (!data.success) { setError(data.message || 'Failed to generate preview'); return; }
            setOfferLetterId(data.offerLetterId);
            setPdfUrl(data.pdfUrl);
            setStep('preview');
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to generate preview');
        } finally {
            setGenerating(false);
        }
    };

    const handleSend = async () => {
        setSending(true);
        setSendResult(null);
        try {
            const { data } = await axios.post(API_ENDPOINTS.OFFER_LETTER_SEND(offerLetterId), {
                primaryEmail: employee.email,
                additionalEmail: form.additionalEmail?.trim() || undefined,
            });
            setSendResult({ success: !!data.success, message: data.message || (data.success ? 'Offer letter sent successfully.' : 'Failed to send offer letter.') });
            if (data.success) {
                setStep('sent');
                onSent?.();
            }
        } catch (err) {
            setSendResult({ success: false, message: err.response?.data?.message || err.message || 'Failed to send offer letter.' });
        } finally {
            setSending(false);
            setConfirming(false);
        }
    };

    const latest = history[0];

    return (
        <Modal show={show} onHide={onHide} size="lg" centered backdrop={sending ? 'static' : true}>
            <Modal.Header closeButton className="py-2">
                <Modal.Title as="h6" className="mb-0 fw-semibold">
                    <FaFilePdf className="me-2 text-danger" />
                    Send Offer Letter — {employee?.first_name} {employee?.last_name}
                </Modal.Title>
            </Modal.Header>

            <Modal.Body>
                {loading ? (
                    <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
                ) : (
                    <>
                        {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

                        {latest && step === 'details' && (
                            <Alert variant={latest.status === 'sent' ? 'info' : latest.status === 'failed' ? 'warning' : 'secondary'} className="py-2 small d-flex align-items-center gap-2">
                                <FaHistory />
                                Last offer letter {latest.status} to <strong>{latest.primary_email}</strong>
                                {latest.additional_email ? ` (and ${latest.additional_email})` : ''} on {fmtDateTime(latest.sent_at || latest.created_at)}.
                            </Alert>
                        )}

                        {step === 'details' && (
                            <Form>
                                <div className="fw-bold small text-uppercase text-muted mb-2">Employee Information</div>
                                <Row className="mb-3 g-2">
                                    <Col md={6}><Form.Label className="small mb-0">Full Name</Form.Label>
                                        <Form.Control size="sm" disabled value={`${employee?.first_name || ''} ${employee?.last_name || ''}`.trim()} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Email</Form.Label>
                                        <Form.Control size="sm" disabled value={employee?.email || ''} /></Col>
                                </Row>

                                <div className="fw-bold small text-uppercase text-muted mb-2">Employment Information</div>
                                <Row className="mb-3 g-2">
                                    <Col md={6}><Form.Label className="small mb-0">Designation *</Form.Label>
                                        <Form.Control size="sm" value={form.designation} onChange={e => set('designation', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Department</Form.Label>
                                        <Form.Control size="sm" value={form.department} onChange={e => set('department', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Date of Joining *</Form.Label>
                                        <Form.Control size="sm" type="date" value={form.dateOfJoining} onChange={e => set('dateOfJoining', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Work Location *</Form.Label>
                                        <Form.Control size="sm" value={form.workLocation} onChange={e => set('workLocation', e.target.value)} placeholder="e.g. Pune" /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Reporting Manager</Form.Label>
                                        <Form.Control size="sm" value={form.reportingManager} onChange={e => set('reportingManager', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Employment Type</Form.Label>
                                        <Form.Control size="sm" value={form.employmentType} onChange={e => set('employmentType', e.target.value)} /></Col>
                                </Row>

                                <div className="fw-bold small text-uppercase text-muted mb-2">Offer Letter Configuration</div>
                                <Row className="mb-3 g-2">
                                    <Col md={6}><Form.Label className="small mb-0">Annual CTC (₹) *</Form.Label>
                                        <Form.Control size="sm" type="number" min="1" value={form.annualCTC} onChange={e => set('annualCTC', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Monthly Gross (auto)</Form.Label>
                                        <Form.Control size="sm" disabled value={form.annualCTC ? `Rs. ${Math.round(Number(form.annualCTC) / 12).toLocaleString('en-IN')}` : ''} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Probation Period</Form.Label>
                                        <Form.Control size="sm" value={form.probationPeriod} onChange={e => set('probationPeriod', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Notice Period</Form.Label>
                                        <Form.Control size="sm" value={form.noticePeriod} onChange={e => set('noticePeriod', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">PF (₹/month)</Form.Label>
                                        <Form.Control size="sm" type="number" min="0" value={form.pfAmount} onChange={e => set('pfAmount', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Professional Tax (₹/month)</Form.Label>
                                        <Form.Control size="sm" type="number" min="0" value={form.professionalTaxAmount} onChange={e => set('professionalTaxAmount', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Authorized Signatory</Form.Label>
                                        <Form.Control size="sm" value={form.signatoryName} onChange={e => set('signatoryName', e.target.value)} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Signatory Designation</Form.Label>
                                        <Form.Control size="sm" value={form.signatoryDesignation} onChange={e => set('signatoryDesignation', e.target.value)} /></Col>
                                </Row>

                                <div className="fw-bold small text-uppercase text-muted mb-2">Recipients</div>
                                <Row className="mb-2 g-2">
                                    <Col md={6}><Form.Label className="small mb-0">Primary Email</Form.Label>
                                        <Form.Control size="sm" disabled value={employee?.email || ''} /></Col>
                                    <Col md={6}><Form.Label className="small mb-0">Additional Email (optional)</Form.Label>
                                        <Form.Control size="sm" type="email" value={form.additionalEmail}
                                            isInvalid={!!additionalEmailError}
                                            onChange={e => set('additionalEmail', e.target.value)} />
                                        {additionalEmailError && <Form.Control.Feedback type="invalid">{additionalEmailError}</Form.Control.Feedback>}
                                    </Col>
                                </Row>

                                {missingFields.length > 0 && (
                                    <Alert variant="warning" className="py-2 small mt-2 mb-0">
                                        <FaExclamationTriangle className="me-1" />
                                        <strong>Required information missing:</strong> {missingFields.join(', ')}. Please complete the above information before generating the offer letter.
                                    </Alert>
                                )}
                            </Form>
                        )}

                        {step === 'preview' && (
                            <div>
                                <Alert variant="info" className="py-2 small">
                                    Review the generated offer letter below before sending.
                                </Alert>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                                    <iframe title="Offer Letter Preview" src={pdfUrl} style={{ width: '100%', height: '60vh', border: 'none' }} />
                                </div>
                                <div className="text-center mt-2">
                                    <a href={pdfUrl} target="_blank" rel="noreferrer" className="small">Open PDF in new tab</a>
                                </div>

                                {confirming && (
                                    <Alert variant="warning" className="py-2 small mt-3">
                                        Are you sure you want to send this offer letter to <strong>{employee?.email}</strong>?
                                        {form.additionalEmail?.trim() && <> The offer letter will also be sent to <strong>{form.additionalEmail.trim()}</strong>.</>}
                                    </Alert>
                                )}
                                {sendResult && !sendResult.success && (
                                    <Alert variant="danger" className="py-2 small mt-2">{sendResult.message}</Alert>
                                )}
                            </div>
                        )}

                        {step === 'sent' && sendResult?.success && (
                            <Alert variant="success" className="py-3 small d-flex align-items-center gap-2">
                                <FaCheckCircle size={18} />
                                {sendResult.message}
                            </Alert>
                        )}
                    </>
                )}
            </Modal.Body>

            <Modal.Footer className="py-2">
                {step === 'details' && (
                    <>
                        <Button variant="outline-secondary" size="sm" onClick={onHide}>Cancel</Button>
                        <Button variant="primary" size="sm" disabled={missingFields.length > 0 || !!additionalEmailError || generating} onClick={handlePreview}>
                            {generating ? <><Spinner animation="border" size="sm" className="me-1" />Generating Offer Letter...</> : 'Preview Offer Letter'}
                        </Button>
                    </>
                )}
                {step === 'preview' && !confirming && (
                    <>
                        <Button variant="outline-secondary" size="sm" onClick={() => setStep('details')} disabled={sending}>Back</Button>
                        <Button variant="success" size="sm" onClick={() => setConfirming(true)} disabled={sending}>
                            <FaPaperPlane className="me-1" /> Send Offer Letter
                        </Button>
                    </>
                )}
                {step === 'preview' && confirming && (
                    <>
                        <Button variant="outline-secondary" size="sm" onClick={() => setConfirming(false)} disabled={sending}>Cancel</Button>
                        <Button variant="success" size="sm" onClick={handleSend} disabled={sending}>
                            {sending ? <><Spinner animation="border" size="sm" className="me-1" />Sending Offer Letter...</> : 'Confirm & Send'}
                        </Button>
                    </>
                )}
                {step === 'sent' && (
                    <Button variant="primary" size="sm" onClick={onHide}>Close</Button>
                )}
            </Modal.Footer>
        </Modal>
    );
}
