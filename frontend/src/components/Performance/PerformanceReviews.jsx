// src/components/Performance/PerformanceReviews.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Card, Badge, Spinner, Button, Modal,
  Form, Alert, Tab, Tabs,
} from 'react-bootstrap';
import {
  FaStar, FaRegStar, FaUserTie, FaCheckCircle,
  FaClock, FaChartLine, FaUsers, FaExclamationTriangle,
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../config/roles';

// ── Rating helpers ────────────────────────────────────────────────────────────
const RATING_LABELS = {
  5: 'Excellent Performer',
  4: 'Very Good Performer',
  3: 'Meets Expectations',
  2: 'Performance Improvement Plan (PIP)',
  1: 'Termination Recommended',
};

const RATING_COLORS = {
  5: '#22c55e',
  4: '#4ade80',
  3: '#eab308',
  2: '#f97316',
  1: '#ef4444',
};

const getRatingLabel = (r) => RATING_LABELS[r] || '—';
const getRatingColor = (r) => RATING_COLORS[r] || '#94a3b8';

const Stars = ({ rating, size = 18, interactive = false, onSelect }) => (
  <span style={{ display: 'inline-flex', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(n => {
      const filled = n <= rating;
      return (
        <span
          key={n}
          onClick={() => interactive && onSelect && onSelect(n)}
          style={{
            cursor: interactive ? 'pointer' : 'default',
            color:  filled ? (getRatingColor(rating) || '#eab308') : '#d1d5db',
            fontSize: size,
            transition: 'transform 0.1s',
          }}
          onMouseEnter={e => { if (interactive) e.currentTarget.style.transform = 'scale(1.2)'; }}
          onMouseLeave={e => { if (interactive) e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {filled ? <FaStar /> : <FaRegStar />}
        </span>
      );
    })}
  </span>
);

// ── Main component ────────────────────────────────────────────────────────────
const PerformanceReviews = () => {
  const { user } = useAuth();
  const role     = user?.role;

  const [employees,   setEmployees]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [activeTab,   setActiveTab]   = useState('pending');

  // Modal state
  const [showModal,     setShowModal]     = useState(false);
  const [selected,      setSelected]      = useState(null);
  const [hoverRating,   setHoverRating]   = useState(0);
  const [pickedRating,  setPickedRating]  = useState(0);
  const [remarks,       setRemarks]       = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  // Confirm dialog
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(API_ENDPOINTS.PERFORMANCE_REVIEWABLE);
      setEmployees(res.data.employees || []);
      setPeriodLabel(`${res.data.month_name} ${res.data.current_year}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const openReview = (emp) => {
    setSelected(emp);
    setPickedRating(emp.rating || 0);
    setRemarks(emp.remarks || '');
    setHoverRating(0);
    setSubmitError('');
    setSubmitSuccess('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!pickedRating) { setSubmitError('Please select a rating.'); return; }
    setShowConfirm(false);
    setSubmitting(true);
    setSubmitError('');
    try {
      await axios.post(API_ENDPOINTS.PERFORMANCE_SUBMIT, {
        employee_id: selected.employee_id,
        rating:      pickedRating,
        remarks,
      });
      setSubmitSuccess('Review submitted successfully!');
      await fetchEmployees();
      setTimeout(() => setShowModal(false), 1200);
    } catch (e) {
      setSubmitError(e.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const pending   = employees.filter(e => !e.has_review);
  const completed = employees.filter(e =>  e.has_review);

  const displayRole = getRoleLabel(role);

  const ratingToDisplay = hoverRating || pickedRating;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e2a3e 0%, #2d3f5e 100%)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FaChartLine size={22} color="#fff" />
          </div>
          <div>
            <h4 style={{ color: '#fff', margin: 0, fontWeight: 700, fontSize: 20 }}>
              Performance Reviews
            </h4>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>
              {displayRole} — {periodLabel}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <StatPill label="Pending"   value={pending.length}   color="#f97316" />
          <StatPill label="Completed" value={completed.length} color="#22c55e" />
        </div>
      </div>

      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {/* ── Tabs ── */}
      <Tabs activeKey={activeTab} onSelect={k => setActiveTab(k)} className="mb-3">
        <Tab eventKey="pending"   title={<><FaClock className="me-1" size={12} />Pending ({pending.length})</>}>
          <EmployeeGrid employees={pending}   onReview={openReview} completed={false} />
        </Tab>
        <Tab eventKey="completed" title={<><FaCheckCircle className="me-1" size={12} />Completed ({completed.length})</>}>
          <EmployeeGrid employees={completed} onReview={openReview} completed={true} />
        </Tab>
      </Tabs>

      {/* ── Review Modal ── */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="md">
        <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', padding: '18px 24px' }}>
          <Modal.Title style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            <FaStar className="me-2" size={14} style={{ color: '#eab308' }} />
            Performance Review
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '24px' }}>
          {selected && (
            <>
              {/* Employee info */}
              <div style={{
                background: '#f8fafc', borderRadius: 10, padding: '14px 16px',
                marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16,
                }}>
                  {selected.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{selected.full_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {selected.employee_id} · {selected.designation || selected.department || getRoleLabel(selected.role)}
                  </div>
                  {selected.has_review && (
                    <Badge bg="warning" text="dark" className="mt-1" style={{ fontSize: 10 }}>
                      Override existing review
                    </Badge>
                  )}
                </div>
              </div>

              {submitError   && <Alert variant="danger"  className="py-2 small">{submitError}</Alert>}
              {submitSuccess && <Alert variant="success" className="py-2 small">{submitSuccess}</Alert>}

              {/* Star picker */}
              <Form.Group className="mb-3">
                <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
                  Select Rating <span style={{ color: '#ef4444' }}>*</span>
                </Form.Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[5, 4, 3, 2, 1].map(n => (
                    <div
                      key={n}
                      onClick={() => setPickedRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                        border: `2px solid ${pickedRating === n ? getRatingColor(n) : '#e2e8f0'}`,
                        background: pickedRating === n ? `${getRatingColor(n)}12` : '#fff',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Stars rating={ratingToDisplay >= n ? n : 0} size={16} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                          {n} Star{n > 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: getRatingColor(n), fontWeight: 500 }}>
                          {RATING_LABELS[n]}
                        </div>
                      </div>
                      {pickedRating === n && (
                        <FaCheckCircle style={{ color: getRatingColor(n), marginLeft: 'auto' }} size={14} />
                      )}
                    </div>
                  ))}
                </div>
              </Form.Group>

              {/* Rating preview */}
              {pickedRating > 0 && (
                <div style={{
                  background: `${getRatingColor(pickedRating)}12`,
                  border: `1px solid ${getRatingColor(pickedRating)}40`,
                  borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Stars rating={pickedRating} size={18} />
                  <span style={{ fontWeight: 600, color: getRatingColor(pickedRating), fontSize: 13 }}>
                    {RATING_LABELS[pickedRating]}
                  </span>
                </div>
              )}

              {/* Remarks */}
              <Form.Group>
                <Form.Label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Remarks</Form.Label>
                <Form.Control
                  as="textarea" rows={3} value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Add performance remarks or feedback..."
                  style={{ fontSize: 13, borderRadius: 10, resize: 'vertical' }}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #e2e8f0', padding: '12px 24px' }}>
          <Button variant="light" onClick={() => setShowModal(false)} style={{ borderRadius: 8, fontSize: 13 }}>
            Cancel
          </Button>
          <Button
            onClick={() => { if (!pickedRating) { setSubmitError('Please select a rating.'); return; } setSubmitError(''); setShowConfirm(true); }}
            disabled={submitting}
            style={{
              borderRadius: 8, fontSize: 13,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              border: 'none', padding: '8px 20px',
            }}
          >
            {submitting ? <Spinner animation="border" size="sm" className="me-1" /> : null}
            Submit Review
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Confirm Modal ── */}
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered size="sm">
        <Modal.Body style={{ padding: 28, textAlign: 'center' }}>
          <FaExclamationTriangle size={36} style={{ color: '#f59e0b', marginBottom: 12 }} />
          <h6 style={{ fontWeight: 700, marginBottom: 8 }}>Confirm Submission</h6>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
            Are you sure you want to submit this performance review for <strong>{selected?.full_name}</strong>?
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="light" size="sm" onClick={() => setShowConfirm(false)} style={{ borderRadius: 8 }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              style={{
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                border: 'none', borderRadius: 8,
              }}
            >
              Yes, Submit
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StatPill = ({ label, value, color }) => (
  <div style={{
    background: 'rgba(255,255,255,0.12)', borderRadius: 20,
    padding: '6px 16px', textAlign: 'center',
  }}>
    <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </div>
  </div>
);

const EmployeeGrid = ({ employees, onReview, completed }) => {
  if (employees.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px',
        background: '#f8fafc', borderRadius: 12, border: '1px dashed #e2e8f0',
      }}>
        {completed
          ? <FaCheckCircle size={40} style={{ color: '#22c55e', marginBottom: 12 }} />
          : <FaUsers size={40} style={{ color: '#94a3b8', marginBottom: 12 }} />
        }
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
          {completed ? 'No completed reviews yet.' : 'All reviews done for this month!'}
        </p>
      </div>
    );
  }

  return (
    <Row xs={1} sm={2} lg={3} className="g-3">
      {employees.map(emp => (
        <Col key={emp.employee_id}>
          <EmployeeCard emp={emp} onReview={onReview} completed={completed} />
        </Col>
      ))}
    </Row>
  );
};

const EmployeeCard = ({ emp, onReview, completed }) => {
  const initials = emp.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const color    = completed ? getRatingColor(emp.rating) : '#94a3b8';

  return (
    <Card style={{
      borderRadius: 14, border: `1px solid ${completed ? color + '40' : '#e2e8f0'}`,
      background: completed ? `${color}08` : '#fff',
      transition: 'box-shadow 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <Card.Body style={{ padding: '18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg,${completed ? color : '#6366f1'},${completed ? color + 'cc' : '#8b5cf6'})`,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 15,
          }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {emp.full_name}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{emp.employee_id}</div>
          </div>
        </div>

        {emp.department && (
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
            <FaUserTie size={10} className="me-1" />{emp.department}
          </div>
        )}

        {completed && emp.rating ? (
          <div style={{ marginBottom: 12 }}>
            <Stars rating={emp.rating} size={16} />
            <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 4 }}>
              {getRatingLabel(emp.rating)}
            </div>
            {emp.remarks && (
              <div style={{
                fontSize: 11, color: '#64748b', marginTop: 6,
                background: '#f1f5f9', borderRadius: 6, padding: '4px 8px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                "{emp.remarks}"
              </div>
            )}
          </div>
        ) : (
          <div style={{
            fontSize: 11, color: '#94a3b8', marginBottom: 12,
            padding: '6px 8px', background: '#f8fafc', borderRadius: 6,
          }}>
            No review this month
          </div>
        )}

        <Button
          size="sm"
          onClick={() => onReview(emp)}
          style={{
            width: '100%', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: completed
              ? 'transparent'
              : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: completed ? `1px solid ${color}` : 'none',
            color: completed ? color : '#fff',
            padding: '6px 0',
          }}
        >
          <FaStar size={10} className="me-1" />
          {completed ? 'Edit Review' : 'Submit Review'}
        </Button>
      </Card.Body>
    </Card>
  );
};

export default PerformanceReviews;
