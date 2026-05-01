// src/components/Employee/ManagerRegularizationRequests.jsx
import React, { useState, useEffect } from 'react';
import {
  Table, Card, Badge, Button, Modal, Form,
  Alert, Spinner, Row, Col, InputGroup
} from 'react-bootstrap';
import {
  FaCheckCircle,
  FaTimesCircle,
  FaRegClock,
  FaClock,
  FaSearch,
  FaEye,
  FaEyeSlash,
  FaSyncAlt,
  FaInfoCircle,
  FaUserTie
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const ManagerRegularizationRequests = ({ embedded = false }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvedTime, setApprovedTime] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRequest, setExpandedRequest] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      console.log('📡 Fetching regularization requests for manager...');
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_PENDING_REGULARIZATIONS);
      const requestsData = response.data.requests || [];
      
      // Filter requests where user is the reporting manager (can_act = true)
      // Or show team requests that are pending manager action
      const teamRequests = requestsData.filter(req => 
        req.can_act === true || // Manager can act on these
        (req.status === 'pending' && req.reporting_manager) // Show pending team requests
      );
      
      console.log(`✅ Found ${teamRequests.length} team regularization requests`);
      setRequests(teamRequests);
    } catch (error) {
      console.error('Error fetching regularization requests:', error);
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to load regularization requests' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    if (typeof dateString === 'string' && dateString.includes(' ') && !dateString.includes('T')) {
      const [datePart] = dateString.split(' ');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    if (typeof dateString === 'string' && dateString.includes(' ') && !dateString.includes('T')) {
      const [datePart, timePart] = dateString.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      const hourNum = parseInt(hour, 10);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
      return `${day}/${month}/${year} ${hour12}:${minute} ${ampm}`;
    }
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const toDatetimeLocal = (datetime) => {
    if (!datetime) return '';
    let value = String(datetime).trim();
    if (value.includes(' ') && !value.includes('T')) {
      const [datePart, timePart] = value.split(' ');
      const [hour, minute] = timePart.split(':');
      return `${datePart}T${hour}:${minute}`;
    }
    if (value.includes('T')) {
      const [datePart, timePart] = value.split('T');
      const [hour, minute] = (timePart || '').split(':');
      if (hour && minute) return `${datePart}T${hour}:${minute}`;
    }
    return '';
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    if (!approvedTime) {
      setMessage({ type: 'warning', text: 'Please select clock-out time' });
      return;
    }

    setProcessing(true);
    try {
      const requestId = String(selectedRequest.id);
      await axios.put(API_ENDPOINTS.ATTENDANCE_APPROVE_REGULARIZATION(requestId), {
        approved_clock_out_time: approvedTime,
        admin_notes: adminNotes
      });
      setMessage({ type: 'success', text: 'Regularization request approved successfully!' });
      setShowApproveModal(false);
      setSelectedRequest(null);
      setApprovedTime('');
      setAdminNotes('');
      await fetchRequests();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error approving regularization:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Failed to approve request';
      setMessage({ type: 'danger', text: errorMsg });
      if (error.response?.data?.message?.includes('Only the reporting manager')) {
        // Refresh to update permissions
        await fetchRequests();
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!rejectionReason) {
      setMessage({ type: 'warning', text: 'Please provide a rejection reason' });
      return;
    }

    setProcessing(true);
    try {
      const requestId = String(selectedRequest.id);
      await axios.put(API_ENDPOINTS.ATTENDANCE_REJECT_REGULARIZATION(requestId), {
        rejection_reason: rejectionReason
      });
      setMessage({ type: 'success', text: 'Regularization request rejected successfully!' });
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      await fetchRequests();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error rejecting regularization:', error);
      const errorMsg = error.response?.data?.message || 'Failed to reject request';
      setMessage({ type: 'danger', text: errorMsg });
      if (error.response?.data?.message?.includes('Only the reporting manager')) {
        await fetchRequests();
      }
    } finally {
      setProcessing(false);
    }
  };

  const filteredRequests = requests.filter((request) => {
    if (filter !== 'all' && request.status !== filter) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return [
      request.employee_name,
      request.employee_id,
      request.attendance_date,
      request.reason,
      request.department
    ].some(value => String(value || '').toLowerCase().includes(term));
  });

  const getStatusBadge = (status) => {
    if (status === 'pending') return <Badge bg="warning" text="dark">Pending</Badge>;
    if (status === 'approved') return <Badge bg="success">Approved</Badge>;
    if (status === 'rejected') return <Badge bg="danger">Rejected</Badge>;
    return <Badge bg="secondary">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending' && r.can_act).length;

  return (
    <div className={embedded ? '' : 'p-2 p-md-3 p-lg-4'}>
      {!embedded && (
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-4 gap-3">
          <div>
            <h5 className="mb-1 d-flex align-items-center gap-2">
              <FaUserTie className="text-primary" />
              Team Regularization Requests
            </h5>
            <small className="text-muted">
              {pendingCount > 0 
                ? `You have ${pendingCount} pending request${pendingCount > 1 ? 's' : ''} awaiting your action`
                : 'No pending requests from your team members'}
            </small>
          </div>
          <Button variant="outline-primary" size="sm" onClick={fetchRequests}>
            <FaSyncAlt className="me-1" size={12} /> Refresh
          </Button>
        </div>
      )}

      {message.text && (
        <Alert variant={message.type} dismissible onClose={() => setMessage({ type: '', text: '' })} className="mb-3">
          {message.text}
        </Alert>
      )}

      <Row className="align-items-center mb-3 gx-2 gy-2">
        <Col xs={12} md={6} lg={4}>
          <div className="d-flex gap-2 flex-wrap">
            <Button
              variant={filter === 'pending' ? 'warning' : 'outline-secondary'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pending ({requests.filter(r => r.status === 'pending').length})
            </Button>
            <Button
              variant={filter === 'approved' ? 'success' : 'outline-secondary'}
              size="sm"
              onClick={() => setFilter('approved')}
            >
              Approved ({requests.filter(r => r.status === 'approved').length})
            </Button>
            <Button
              variant={filter === 'rejected' ? 'danger' : 'outline-secondary'}
              size="sm"
              onClick={() => setFilter('rejected')}
            >
              Rejected ({requests.filter(r => r.status === 'rejected').length})
            </Button>
            <Button
              variant={filter === 'all' ? 'primary' : 'outline-secondary'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({requests.length})
            </Button>
          </div>
        </Col>
        <Col xs={12} md={6} lg={4} className="ms-auto">
          <InputGroup size="sm">
            <InputGroup.Text><FaSearch size={12} /></InputGroup.Text>
            <Form.Control
              placeholder="Search by name, ID, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-light"
            />
            {searchTerm && (
              <Button variant="outline-secondary" size="sm" onClick={() => setSearchTerm('')}>
                Clear
              </Button>
            )}
          </InputGroup>
        </Col>
      </Row>

      {filteredRequests.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <FaRegClock size={40} className="text-muted mb-3" />
            <p className="text-muted mb-0">No regularization requests found for your team.</p>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="bg-light">
                  <tr className="small">
                    <th className="fw-normal text-center">#</th>
                    <th className="fw-normal">Employee</th>
                    <th className="fw-normal d-none d-md-table-cell">Department</th>
                    <th className="fw-normal d-none d-md-table-cell">Date</th>
                    <th className="fw-normal">Clock In</th>
                    <th className="fw-normal">Requested Out</th>
                    <th className="fw-normal">Status</th>
                    <th className="fw-normal text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request, index) => (
                    <React.Fragment key={request.id}>
                      <tr
                        className={expandedRequest === request.id ? 'table-active' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                      >
                        <td className="small text-center">{index + 1}</td>
                        <td className="small">
                          <div className="fw-semibold text-truncate" style={{ maxWidth: '140px' }}>{request.employee_name}</div>
                          <small className="text-muted">{request.employee_id}</small>
                        </td>
                        <td className="small d-none d-md-table-cell text-truncate" style={{ maxWidth: '100px' }}>
                          {request.department}
                        </td>
                        <td className="small d-none d-md-table-cell">
                          <Badge bg="light" text="dark" pill>{formatDate(request.attendance_date)}</Badge>
                        </td>
                        <td className="small">
                          <Badge bg="success" pill className="px-2 py-1">
                            <FaClock className="me-1" size={10} />{formatDateTime(request.clock_in_time)}
                          </Badge>
                        </td>
                        <td className="small">
                          <Badge bg="warning" text="dark" pill className="px-2 py-1">
                            <FaRegClock className="me-1" size={10} />{formatDateTime(request.requested_clock_out_time)}
                          </Badge>
                        </td>
                        <td>{getStatusBadge(request.status)}</td>
                        <td className="text-center">
                          {request.status === 'pending' ? (
                            <div className="d-flex flex-column gap-2 align-items-center justify-content-center">
                              {request.can_act ? (
                                <div className="d-flex gap-2 justify-content-center flex-wrap">
                                  <Button
                                    variant="success"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRequest(request);
                                      setApprovedTime(toDatetimeLocal(request.requested_clock_out_time));
                                      setShowApproveModal(true);
                                    }}
                                    title="Approve this regularization request"
                                  >
                                    <FaCheckCircle className="me-1" size={12} /> Approve
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRequest(request);
                                      setShowRejectModal(true);
                                    }}
                                    title="Reject this regularization request"
                                  >
                                    <FaTimesCircle className="me-1" size={12} /> Reject
                                  </Button>
                                </div>
                              ) : (
                                <small className="text-muted" title="This request is from someone outside your team">
                                  <FaInfoCircle className="me-1" size={10} />
                                  Not authorized
                                </small>
                              )}
                            </div>
                          ) : (
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setExpandedRequest(expandedRequest === request.id ? null : request.id); }}
                            >
                              {expandedRequest === request.id ? <FaEyeSlash className="me-1" size={12} /> : <FaEye className="me-1" size={12} />} Details
                            </Button>
                          )}
                        </td>
                      </tr>
                      {expandedRequest === request.id && (
                        <tr className="bg-light">
                          <td colSpan="8" className="p-3">
                            <Row className="g-3">
                              <Col xs={12} md={6}>
                                <div className="small">
                                  <strong>Reason:</strong>
                                  <p className="text-muted mb-0">{request.reason || 'No reason provided'}</p>
                                </div>
                              </Col>
                              <Col xs={12} md={6}>
                                <div className="small">
                                  <strong>Requested At:</strong>
                                  <p className="text-muted mb-0">{formatDateTime(request.created_at)}</p>
                                </div>
                              </Col>
                              {request.status === 'approved' && request.approved_clock_out_time && (
                                <Col xs={12} md={6}>
                                  <div className="small">
                                    <strong>Approved Clock Out:</strong>
                                    <p className="text-success mb-0">{formatDateTime(request.approved_clock_out_time)}</p>
                                  </div>
                                </Col>
                              )}
                              {request.status === 'approved' && request.admin_notes && (
                                <Col xs={12} md={6}>
                                  <div className="small">
                                    <strong>Notes:</strong>
                                    <p className="text-muted mb-0">{request.admin_notes}</p>
                                  </div>
                                </Col>
                              )}
                              {request.status === 'rejected' && request.rejection_reason && (
                                <Col xs={12}>
                                  <div className="small">
                                    <strong>Rejection Reason:</strong>
                                    <p className="text-danger mb-0">{request.rejection_reason}</p>
                                  </div>
                                </Col>
                              )}
                              {request.reporting_manager && (
                                <Col xs={12}>
                                  <div className="small">
                                    <strong>Reporting Manager:</strong>
                                    <p className="text-muted mb-0">{request.reporting_manager}</p>
                                  </div>
                                </Col>
                              )}
                            </Row>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Approve Modal */}
      <Modal show={showApproveModal} onHide={() => setShowApproveModal(false)} centered size="lg">
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title className="h6"><FaCheckCircle className="me-2" /> Approve Regularization Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <>
              <div className="mb-3 p-3 bg-light rounded">
                <Row className="g-3">
                  <Col xs={12} md={6}>
                    <div className="small"><strong>Employee:</strong><p className="mb-0">{selectedRequest.employee_name}</p></div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="small"><strong>Date:</strong><p className="mb-0">{formatDate(selectedRequest.attendance_date)}</p></div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="small"><strong>Clock In:</strong><p className="mb-0">{formatDateTime(selectedRequest.clock_in_time)}</p></div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="small"><strong>Requested Out:</strong><p className="mb-0">{formatDateTime(selectedRequest.requested_clock_out_time)}</p></div>
                  </Col>
                  <Col xs={12}>
                    <div className="small"><strong>Reason:</strong><p className="mb-0">{selectedRequest.reason || 'No reason provided'}</p></div>
                  </Col>
                </Row>
              </div>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Clock Out Time *</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={approvedTime}
                  onChange={(e) => setApprovedTime(e.target.value)}
                />
                <Form.Text className="text-muted">
                  You can adjust the clock-out time if needed
                </Form.Text>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Notes (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any notes about this approval..."
                />
              </Form.Group>
              <Alert variant="info" className="small">
                <FaInfoCircle className="me-2" /> Approving will update the employee's attendance record with the selected clock-out time.
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowApproveModal(false)}>Cancel</Button>
          <Button variant="success" size="sm" onClick={handleApprove} disabled={processing || !approvedTime}>
            {processing ? 'Processing...' : 'Approve Request'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reject Modal */}
      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title className="h6"><FaTimesCircle className="me-2" /> Reject Regularization Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <>
              <div className="mb-3 p-3 bg-light rounded">
                <div className="small"><strong>Employee:</strong><p className="mb-0">{selectedRequest.employee_name}</p></div>
                <div className="small"><strong>Date:</strong><p className="mb-0">{formatDate(selectedRequest.attendance_date)}</p></div>
              </div>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Rejection Reason *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                />
                <Form.Text className="text-muted">This will be visible to the employee.</Form.Text>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleReject} disabled={processing || !rejectionReason}>
            {processing ? 'Processing...' : 'Reject Request'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ManagerRegularizationRequests;