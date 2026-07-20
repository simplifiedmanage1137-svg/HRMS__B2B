import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Badge, Spinner, Form, InputGroup, Button } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENTS = ['HR', 'IT'];

const ISSUE_TYPES = {
  IT: [
    'Internet / Network Issue',
    'System / PC Not Working',
    'Hardware Issue (Mouse, Keyboard, Monitor, Headset)',
    'Software / Application Error',
    'Email & Account Access Problem',
    'Printer / Scanner Issue',
    'Other',
  ],
  HR: [
    'Leave Related Query',
    'Salary / Payroll Issue',
    'Document Request (Offer Letter, Experience Letter, etc.)',
    'Policy Clarification',
    'Attendance Correction',
    'Onboarding / Offboarding',
    'Other',
  ],
};

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const STATUS_META = {
  open:             { label: 'Open',             color: '#3b82f6', bg: '#dbeafe' },
  in_progress:      { label: 'In Progress',      color: '#f59e0b', bg: '#fef3c7' },
  resolved_pending: { label: 'Pending Confirm',  color: '#8b5cf6', bg: '#ede9fe' },
  closed:           { label: 'Closed',           color: '#10b981', bg: '#d1fae5' },
  reopened:         { label: 'Reopened',         color: '#ef4444', bg: '#fee2e2' },
};

const PRIORITY_META = {
  low:    { color: '#10b981', label: 'Low' },
  medium: { color: '#f59e0b', label: 'Medium' },
  high:   { color: '#ef4444', label: 'High' },
  urgent: { color: '#7c3aed', label: 'Urgent' },
};

const DEPT_META = {
  HR: { color: '#6366f1', icon: '👥' },
  IT: { color: '#0ea5e9', icon: '💻' },
};

const ROLES_SEE_ALL = ['admin', 'sub_admin', 'hr'];
const ROLES_CAN_RESOLVE = ['admin', 'sub_admin', 'manager', 'hr'];

const fmtDate = iso => {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
};

// ─── TicketForm (modal) ───────────────────────────────────────────────────────

function TicketForm({ show, onHide, onCreated, userEmail, userName }) {
  const [dept,        setDept]        = useState('');
  const [issueType,   setIssueType]   = useState('');
  const [subject,     setSubject]     = useState('');
  const [description, setDescription] = useState('');
  const [priority,    setPriority]    = useState('medium');
  const [tagInput,    setTagInput]    = useState('');
  const [taggedEmps,  setTaggedEmps]  = useState([]);
  const [deptEmps,    setDeptEmps]    = useState([]);
  const [showTagDD,   setShowTagDD]   = useState(false);
  const [attachment,  setAttachment]  = useState(null);
  const [attName,     setAttName]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const tagRef = useRef(null);

  // Load dept employees when dept changes
  useEffect(() => {
    if (!dept) { setDeptEmps([]); setTaggedEmps([]); return; }
    axios.get(API_ENDPOINTS.TICKET_DEPT_EMPLOYEES(dept))
      .then(r => setDeptEmps(r.data.employees || []))
      .catch(() => setDeptEmps([]));
    setIssueType('');
    setTaggedEmps([]);
  }, [dept]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = e => { if (tagRef.current && !tagRef.current.contains(e.target)) setShowTagDD(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleTagInput = e => {
    const v = e.target.value;
    setTagInput(v);
    setShowTagDD(v.includes('@'));
  };

  const addTag = emp => {
    if (!taggedEmps.find(t => t.employee_id === emp.employee_id)) {
      setTaggedEmps(p => [...p, emp]);
    }
    setTagInput('');
    setShowTagDD(false);
  };

  const removeTag = id => setTaggedEmps(p => p.filter(t => t.employee_id !== id));

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setAttName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setAttachment(ev.target.result);
    reader.readAsDataURL(file);
  };

  const tagSearch = tagInput.replace('@', '').toLowerCase();
  const filteredDeptEmps = deptEmps.filter(e =>
    !taggedEmps.find(t => t.employee_id === e.employee_id) &&
    (`${e.first_name} ${e.last_name}`.toLowerCase().includes(tagSearch) || e.email?.toLowerCase().includes(tagSearch))
  );

  const reset = () => {
    setDept(''); setIssueType(''); setSubject(''); setDescription('');
    setPriority('medium'); setTagInput(''); setTaggedEmps([]); setDeptEmps([]);
    setAttachment(null); setAttName(''); setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!dept || !issueType || !subject.trim() || !description.trim()) {
      setError('Please fill all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await axios.post(API_ENDPOINTS.TICKETS, {
        department:        dept,
        issue_type:        issueType,
        subject:           subject.trim(),
        description:       description.trim(),
        priority,
        tagged_employees:  taggedEmps.map(e => ({ employee_id: e.employee_id, name: `${e.first_name} ${e.last_name}`, email: e.email })),
        attachment_url:    attachment || null,
        attachment_name:   attName || null,
      });
      if (res.data.success) {
        reset();
        onHide();
        onCreated(res.data.ticket);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={() => { reset(); onHide(); }} size="lg" centered>
      <Modal.Header closeButton style={{ background: '#1e2a3e', border: 'none' }}>
        <Modal.Title style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
          🎫 Raise a Support Ticket
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: '24px 28px' }}>
        <form onSubmit={handleSubmit}>
          {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

          {/* Email — read only */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Your Email <span style={{ color: '#9ca3af', fontWeight: 400 }}>(auto-filled)</span></label>
            <input value={userEmail} disabled style={{ ...inputStyle, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Department */}
            <div>
              <label style={labelStyle}>Department <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={dept} onChange={e => setDept(e.target.value)} style={inputStyle} required>
                <option value="">Select Department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_META[d]?.icon} {d}</option>)}
              </select>
            </div>
            {/* Issue Type */}
            <div>
              <label style={labelStyle}>Issue Type <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={issueType} onChange={e => setIssueType(e.target.value)} style={inputStyle} required disabled={!dept}>
                <option value="">{dept ? 'Select Issue' : 'Select dept first'}</option>
                {(ISSUE_TYPES[dept] || []).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Priority */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIORITIES.map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)} style={{
                  padding: '5px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: priority === p ? PRIORITY_META[p].color : '#f3f4f6',
                  color: priority === p ? '#fff' : '#374151',
                  transition: 'all 0.15s',
                }}>
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Subject <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary of your issue" style={inputStyle} maxLength={200} required />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Description <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your issue in detail..." rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }} required />
          </div>

          {/* Tag Employees */}
          {dept && (
            <div style={{ marginBottom: 16 }} ref={tagRef}>
              <label style={labelStyle}>Tag Employees <span style={{ color: '#9ca3af', fontWeight: 400 }}>(type @ to search {dept} team)</span></label>
              <div style={{ position: 'relative' }}>
                <input
                  value={tagInput}
                  onChange={handleTagInput}
                  onFocus={() => tagInput.includes('@') && setShowTagDD(true)}
                  placeholder={`Type @ to tag ${dept} employees`}
                  style={inputStyle}
                />
                {showTagDD && filteredDeptEmps.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 180, overflowY: 'auto' }}>
                    {filteredDeptEmps.map(emp => (
                      <div key={emp.employee_id} onMouseDown={() => addTag(emp)} style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {(emp.first_name?.[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{emp.first_name} {emp.last_name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{emp.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {taggedEmps.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {taggedEmps.map(emp => (
                    <span key={emp.employee_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ede9fe', color: '#6d28d9', borderRadius: 99, padding: '3px 10px 3px 8px', fontSize: 12, fontWeight: 600 }}>
                      @{emp.first_name} {emp.last_name}
                      <button type="button" onClick={() => removeTag(emp.employee_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6d28d9', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Attachment */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Attachment <span style={{ color: '#9ca3af', fontWeight: 400 }}>(screenshot, optional)</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', border: '1.5px dashed #d1d5db', borderRadius: 8, background: '#fafafa' }}>
              <span style={{ fontSize: 20 }}>📎</span>
              <span style={{ fontSize: 13, color: attName ? '#111827' : '#9ca3af' }}>{attName || 'Click to attach a file (image, PDF)'}</span>
              <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFile} style={{ display: 'none' }} />
            </label>
            {attName && (
              <button type="button" onClick={() => { setAttachment(null); setAttName(''); }} style={{ marginTop: 4, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                Remove attachment
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { reset(); onHide(); }} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" disabled={submitting} style={submitBtnStyle}>
              {submitting ? 'Submitting…' : '🎫 Submit Ticket'}
            </button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
}

// ─── TicketDetail (modal) ─────────────────────────────────────────────────────

function TicketDetail({ ticketId, show, onHide, onUpdated, userRole, userEmployeeId }) {
  const [ticket,      setTicket]      = useState(null);
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [comment,     setComment]     = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [declineNote, setDeclineNote] = useState('');
  const [acting,      setActing]      = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  const fetch = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await axios.get(API_ENDPOINTS.TICKET_BY_ID(ticketId));
      if (res.data.success) { setTicket(res.data.ticket); setHistory(res.data.history || []); }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { if (show && ticketId) fetch(); }, [show, ticketId, fetch]);

  const act = async (type, payload = {}) => {
    setActing(type);
    try {
      const map = {
        comment:     () => axios.post(API_ENDPOINTS.TICKET_COMMENT(ticketId), { message: comment }),
        inprogress:  () => axios.patch(API_ENDPOINTS.TICKET_IN_PROGRESS(ticketId)),
        resolve:     () => axios.patch(API_ENDPOINTS.TICKET_RESOLVE(ticketId), { resolve_note: resolveNote }),
        accept:      () => axios.patch(API_ENDPOINTS.TICKET_ACCEPT(ticketId)),
        decline:     () => axios.patch(API_ENDPOINTS.TICKET_DECLINE(ticketId), { reason: declineNote }),
      };
      await map[type]();
      setComment(''); setResolveNote(''); setDeclineNote('');
      setShowResolve(false); setShowDecline(false);
      await fetch();
      onUpdated();
    } catch (err) { alert(err.response?.data?.message || 'Action failed'); }
    finally { setActing(''); }
  };

  const t = ticket;
  const isRaiser   = t?.raised_by === userEmployeeId;
  const canResolve  = ROLES_CAN_RESOLVE.includes(userRole);
  const actionable  = t?.status !== 'closed';

  const ACTION_HISTORY_LABELS = {
    created: { icon: '🎫', color: '#3b82f6' },
    comment: { icon: '💬', color: '#6366f1' },
    status_changed: { icon: '🔄', color: '#f59e0b' },
    resolved: { icon: '✅', color: '#8b5cf6' },
    closed: { icon: '🔒', color: '#10b981' },
    reopened: { icon: '🔓', color: '#ef4444' },
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton style={{ background: '#1e2a3e', border: 'none' }}>
        <Modal.Title style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
          {t ? `#${t.ticket_number} — ${t.subject}` : 'Ticket Detail'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 0 }}>
        {loading && !t ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner animation="border" size="sm" /></div>
        ) : t ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px' }}>
            {/* LEFT — main */}
            <div style={{ padding: '20px 24px', borderRight: '1px solid #f3f4f6', maxHeight: '80vh', overflowY: 'auto' }}>
              {/* Status row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <StatusBadge status={t.status} />
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: DEPT_META[t.department]?.color + '20', color: DEPT_META[t.department]?.color }}>
                  {DEPT_META[t.department]?.icon} {t.department}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: PRIORITY_META[t.priority]?.color + '20', color: PRIORITY_META[t.priority]?.color }}>
                  {PRIORITY_META[t.priority]?.label} Priority
                </span>
              </div>

              <div style={{ fontSize: 13, color: '#374151', marginBottom: 14, lineHeight: 1.6 }}>
                <strong style={{ color: '#111827' }}>Issue:</strong> {t.issue_type}
              </div>

              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 13, color: '#374151', lineHeight: 1.7, borderLeft: '3px solid #6366f1' }}>
                {t.description}
              </div>

              {t.attachment_url && (
                <div style={{ marginBottom: 16 }}>
                  <a href={t.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    📎 {t.attachment_name || 'View Attachment'}
                  </a>
                </div>
              )}

              {/* Resolve confirmation banner */}
              {t.status === 'resolved_pending' && isRaiser && (
                <div style={{ background: '#ede9fe', borderRadius: 12, padding: '14px 16px', marginBottom: 16, border: '1.5px solid #c4b5fd' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#5b21b6', marginBottom: 4 }}>✅ Your issue has been resolved</div>
                  {t.resolve_note && <div style={{ fontSize: 13, color: '#6d28d9', marginBottom: 12 }}>{t.resolve_note}</div>}
                  <div style={{ fontSize: 13, color: '#7c3aed', marginBottom: 12 }}>Is your issue resolved? Please confirm.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => act('accept')} disabled={!!acting} style={{ padding: '8px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {acting === 'accept' ? 'Processing…' : '✓ Yes, Close Ticket'}
                    </button>
                    <button onClick={() => setShowDecline(true)} disabled={!!acting} style={{ padding: '8px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      ✕ Not Resolved
                    </button>
                  </div>
                  {showDecline && (
                    <div style={{ marginTop: 12 }}>
                      <textarea value={declineNote} onChange={e => setDeclineNote(e.target.value)} placeholder="Why is it not resolved? (optional)" rows={2} style={{ ...inputStyle, fontSize: 12 }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => act('decline')} disabled={!!acting} style={{ padding: '6px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {acting === 'decline' ? 'Sending…' : 'Confirm Decline'}
                        </button>
                        <button onClick={() => setShowDecline(false)} style={{ padding: '6px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* History / Timeline */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Activity Timeline</div>
                {history.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>No activity yet</div>
                ) : history.map(h => {
                  const meta = ACTION_HISTORY_LABELS[h.action] || { icon: '•', color: '#9ca3af' };
                  return (
                    <div key={h.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: meta.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                        {meta.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{h.performed_by_name || 'System'}</span>
                          {h.new_status && <span> → <StatusBadge status={h.new_status} /></span>}
                        </div>
                        {h.message && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, background: '#f9fafb', borderRadius: 6, padding: '5px 8px' }}>{h.message}</div>}
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{fmtDate(h.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comment box */}
              {actionable && (
                <div>
                  <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment…" rows={2} style={{ ...inputStyle, fontSize: 12, marginBottom: 6 }} />
                  <button onClick={() => comment.trim() && act('comment')} disabled={!comment.trim() || !!acting} style={{ ...submitBtnStyle, fontSize: 12, padding: '7px 16px' }}>
                    {acting === 'comment' ? 'Posting…' : 'Post Comment'}
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT — meta */}
            <div style={{ padding: '20px 18px', background: '#fafafa', fontSize: 12 }}>
              <InfoRow label="Ticket #" value={t.ticket_number} mono />
              <InfoRow label="Raised by" value={t.raised_by_name} />
              <InfoRow label="Email" value={t.raised_by_email} />
              <InfoRow label="Assigned to" value={t.assigned_to_name || '—'} />
              <InfoRow label="Created" value={fmtDate(t.created_at)} />
              {t.resolved_at && <InfoRow label="Resolved at" value={fmtDate(t.resolved_at)} />}
              {t.closed_at   && <InfoRow label="Closed at"   value={fmtDate(t.closed_at)} />}

              {t.tagged_employees?.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>Tagged</div>
                  {t.tagged_employees.map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 3 }}>@{e.name}</div>
                  ))}
                </div>
              )}

              {/* TL/Admin actions */}
              {canResolve && actionable && t.status !== 'resolved_pending' && t.status !== 'closed' && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Actions</div>
                  {t.status === 'open' || t.status === 'reopened' ? (
                    <button onClick={() => act('inprogress')} disabled={!!acting} style={{ width: '100%', marginBottom: 8, padding: '8px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {acting === 'inprogress' ? '…' : '🔄 Mark In Progress'}
                    </button>
                  ) : null}
                  {!showResolve ? (
                    <button onClick={() => setShowResolve(true)} style={{ width: '100%', padding: '8px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      ✅ Mark as Resolved
                    </button>
                  ) : (
                    <div>
                      <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="Resolution note (optional)" rows={2} style={{ ...inputStyle, fontSize: 11, marginBottom: 6 }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => act('resolve')} disabled={!!acting} style={{ flex: 1, padding: '7px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {acting === 'resolve' ? '…' : 'Confirm'}
                        </button>
                        <button onClick={() => setShowResolve(false)} style={{ padding: '7px 10px', background: '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal.Body>
    </Modal>
  );
}

const InfoRow = ({ label, value, mono }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 12, color: '#111827', fontFamily: mono ? 'monospace' : undefined, fontWeight: mono ? 700 : 500, wordBreak: 'break-all' }}>{value}</div>
  </div>
);

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb',
  fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', background: '#fff',
};
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 };
const submitBtnStyle = { padding: '9px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const cancelBtnStyle = { padding: '9px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' };

// ─── TicketList (main page) ───────────────────────────────────────────────────

export default function TicketList() {
  const { user } = useAuth();
  const [tickets,     setTickets]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [detailId,    setDetailId]    = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDept,   setFilterDept]   = useState('all');
  const [search,       setSearch]       = useState('');

  const userEmail = user?.email || '';
  const userName  = user?.name  || user?.employeeId || '';

  const fetchTickets = useCallback(async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.TICKETS);
      setTickets(res.data.tickets || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const canSeeAll    = ROLES_SEE_ALL.includes(user?.role);
  const canResolve   = ROLES_CAN_RESOLVE.includes(user?.role);

  const filtered = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterDept   !== 'all' && t.department !== filterDept) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.ticket_number?.toLowerCase().includes(q) ||
             t.subject?.toLowerCase().includes(q)       ||
             t.raised_by_name?.toLowerCase().includes(q);
    }
    return true;
  });

  // Stats
  const stats = {
    total:     tickets.length,
    open:      tickets.filter(t => t.status === 'open').length,
    inProg:    tickets.filter(t => t.status === 'in_progress').length,
    pending:   tickets.filter(t => t.status === 'resolved_pending').length,
    closed:    tickets.filter(t => t.status === 'closed').length,
    reopened:  tickets.filter(t => t.status === 'reopened').length,
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h4 style={{ fontWeight: 800, color: '#111827', margin: 0, fontSize: 22 }}>🎫 Support Tickets</h4>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 13 }}>
            {canSeeAll ? 'All team tickets' : canResolve ? 'Tickets assigned to you' : 'Your raised tickets'}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ ...submitBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          + Raise a Ticket
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total',      count: stats.total,    color: '#374151', bg: '#f9fafb' },
          { label: 'Open',       count: stats.open,     color: '#3b82f6', bg: '#dbeafe' },
          { label: 'In Progress',count: stats.inProg,   color: '#f59e0b', bg: '#fef3c7' },
          { label: 'Pending',    count: stats.pending,  color: '#8b5cf6', bg: '#ede9fe' },
          { label: 'Reopened',   count: stats.reopened, color: '#ef4444', bg: '#fee2e2' },
          { label: 'Closed',     count: stats.closed,   color: '#10b981', bg: '#d1fae5' },
        ].map(s => (
          <div key={s.label} onClick={() => setFilterStatus(s.label === 'Total' ? 'all' : s.label.toLowerCase().replace(' ', '_'))}
            style={{ background: s.bg, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search tickets…" style={{ ...inputStyle, maxWidth: 260 }} />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ ...inputStyle, maxWidth: 140 }}>
          <option value="all">All Depts</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }}>
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filterStatus !== 'all' || filterDept !== 'all' || search) && (
          <button onClick={() => { setFilterStatus('all'); setFilterDept('all'); setSearch(''); }} style={cancelBtnStyle}>Clear</button>
        )}
      </div>

      {/* ── Ticket list ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner animation="border" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎫</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No tickets found</div>
          <div style={{ fontSize: 13 }}>
            {tickets.length === 0 ? 'No tickets have been raised yet.' : 'No tickets match your filters.'}
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 110px 130px 80px', gap: 12, padding: '10px 18px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
            <span>Ticket #</span>
            <span>Subject</span>
            <span>Dept</span>
            <span>Status</span>
            <span>Raised By</span>
            <span>Date</span>
          </div>
          {filtered.map(t => {
            const deptM  = DEPT_META[t.department] || { color: '#6b7280', icon: '•' };
            const priM   = PRIORITY_META[t.priority] || PRIORITY_META.medium;
            const isPending = t.status === 'resolved_pending' && t.raised_by === user?.employeeId;
            return (
              <div key={t.id}
                onClick={() => setDetailId(t.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 80px 110px 130px 80px', gap: 12,
                  padding: '14px 18px', cursor: 'pointer', borderBottom: '1px solid #f9fafb',
                  background: isPending ? '#faf5ff' : '#fff', transition: 'background 0.12s',
                  alignItems: 'center',
                }}
                onMouseEnter={e => !isPending && (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => !isPending && (e.currentTarget.style.background = '#fff')}
              >
                <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>{t.ticket_number}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{t.subject}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{t.issue_type}</div>
                  {isPending && <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', borderRadius: 99, padding: '1px 7px' }}>⚠ Your confirmation needed</span>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: deptM.color }}>{deptM.icon} {t.department}</span>
                <StatusBadge status={t.status} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{t.raised_by_name}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{t.assigned_to_name ? `→ ${t.assigned_to_name}` : 'Unassigned'}</div>
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      <TicketForm
        show={showForm}
        onHide={() => setShowForm(false)}
        onCreated={ticket => { setTickets(p => [ticket, ...p]); }}
        userEmail={userEmail}
        userName={userName}
      />
      <TicketDetail
        show={!!detailId}
        ticketId={detailId}
        onHide={() => setDetailId(null)}
        onUpdated={fetchTickets}
        userRole={user?.role}
        userEmployeeId={user?.employeeId}
      />
    </div>
  );
}
