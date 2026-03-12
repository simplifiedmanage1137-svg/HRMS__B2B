import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Badge,
  Button,
  Modal,
  Form,
  Row,
  Col,
  Alert,
  Spinner,
  Pagination,
  InputGroup
} from 'react-bootstrap';
import {
  FaCheck,
  FaTimes,
  FaEye,
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaFilter,
  FaSearch,
  FaExclamationTriangle,
  FaUserCircle,
  FaBriefcase,
  FaInfoCircle,
  FaTimes as FaTimesIcon,
  FaChartBar,
  FaSortNumericDown // Add this icon for Sr No
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const LeaveRequests = () => {
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [comments, setComments] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  // Update stats whenever leaveRequests changes
  useEffect(() => {
    const newStats = {
      total: leaveRequests.length,
      pending: leaveRequests.filter(l => l.status === 'pending').length,
      approved: leaveRequests.filter(l => l.status === 'approved').length,
      rejected: leaveRequests.filter(l => l.status === 'rejected').length
    };
    setStats(newStats);
  }, [leaveRequests]);

  // Apply filters whenever filter, searchTerm, or leaveRequests change
  useEffect(() => {
    applyFilters();
  }, [leaveRequests, filter, searchTerm]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/leaves');
      console.log('Leave requests fetched:', response.data);
      setLeaveRequests(response.data);
      setFilteredRequests(response.data);

    } catch (error) {
      console.error('Error fetching leave requests:', error);
      setMessage({
        type: 'danger',
        text: 'Failed to load leave requests'
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    console.log('Applying filters - Status:', filter, 'Search:', searchTerm);

    let filtered = [...leaveRequests];

    if (filter !== 'all') {
      filtered = filtered.filter(l => l.status === filter);
    }

    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(l => {
        const fullName = `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase();
        const employeeId = (l.employee_id || '').toLowerCase();
        const reason = (l.reason || '').toLowerCase();
        const leaveType = (l.leave_type || '').toLowerCase();
        const department = (l.department || '').toLowerCase();

        return fullName.includes(term) ||
          employeeId.includes(term) ||
          reason.includes(term) ||
          leaveType.includes(term) ||
          department.includes(term);
      });
    }

    setFilteredRequests(filtered);
    setCurrentPage(1);
  };

  const handleStatusUpdate = async (id, status) => {
    if (!id) {
      console.error('No leave ID provided');
      return;
    }

    console.log(`Updating leave ${id} to ${status}`);
    setProcessing(true);

    try {
      const response = await axios.put(`http://localhost:5000/api/leaves/${id}/status`, {
        status,
        comments
      });

      console.log('Update response:', response.data);

      if (response.data.stats) {
        setStats(response.data.stats);
      }

      await fetchLeaveRequests();

      setShowActionModal(false);
      setComments('');

      setMessage({
        type: 'success',
        text: `Leave ${status} successfully!`
      });

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);

      if (response.data.employee_id) {
        localStorage.setItem(`refresh_employee_${response.data.employee_id}`, 'true');
      }

    } catch (error) {
      console.error('Error updating leave status:', error);
      console.error('Error response:', error.response?.data);

      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to update leave status'
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger'
    };
    const icons = {
      pending: <FaClock className="me-1" />,
      approved: <FaCheckCircle className="me-1" />,
      rejected: <FaTimesCircle className="me-1" />
    };
    return (
      <Badge bg={colors[status]} className="px-3 py-2">
        {icons[status]}
        {status?.toUpperCase()}
      </Badge>
    );
  };

  const getTypeBadge = (type) => {
    const colors = {
      'Annual': 'primary',
      'Sick': 'info',
      'Personal': 'success',
      'Maternity': 'warning',
      'Paternity': 'secondary',
      'Bereavement': 'dark',
      'Unpaid': 'danger'
    };
    return (
      <Badge bg={colors[type] || 'light'} className="px-2 py-1">
        {type}
      </Badge>
    );
  };

  const calculateDays = (leave) => {
    if (leave.leave_duration === 'Half Day') return 0.5;
    if (!leave.start_date || !leave.end_date) return 1;
    if (leave.start_date === leave.end_date) return 1;

    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateRange = (start, end) => {
    if (!start) return 'N/A';
    if (!end || start === end) return formatDate(start);
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const handleViewDetails = (leave) => {
    console.log('Viewing leave details:', leave);
    setSelectedLeave(leave);
    setShowModal(true);
  };

  const handleAction = (leave, action) => {
    console.log('Action triggered for leave:', leave.id, 'Action:', action);
    setSelectedLeave(leave);
    setComments('');
    setShowActionModal(true);
  };

  const handleGoToReports = () => {
    navigate('/admin/leave-reports');
  };

  const clearFilters = () => {
    setFilter('all');
    setSearchTerm('');
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredRequests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted small">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header with title and Leave Reports button */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="h4 mb-0">
          <FaCalendarAlt className="me-2 text-dark" />
          Leave Requests Management
        </h2>
        <Button
          variant="dark"
          onClick={handleGoToReports}
          className="d-flex align-items-center"
        >
          <FaChartBar className="me-2" />
          Leave Reports
        </Button>
      </div>

      {/* Message Alert */}
      {message.text && (
        <Alert
          variant={message.type}
          onClose={() => setMessage({ type: '', text: '' })}
          dismissible
          className="mb-4 shadow-sm"
        >
          {message.type === 'success' && <FaCheckCircle className="me-2" size={14} />}
          {message.type === 'danger' && <FaExclamationTriangle className="me-2" size={14} />}
          {message.text}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card className="border-0 shadow-sm bg-white text-dark">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="text-dark mb-2 medium">Total Requests</h5>
                  <h5 className="mb-0 fw-semibold">{stats.total}</h5>
                </div>
                <div className="bg-dark bg-opacity-10 rounded-circle p-2">
                  <FaCalendarAlt className="text-dark" size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm bg-white text-dark">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="text-dark mb-2 medium">Pending</h5>
                  <h5 className="mb-0 fw-semibold">{stats.pending}</h5>
                </div>
                <div className="bg-dark bg-opacity-10 rounded-circle p-2">
                  <FaClock className="text-dark" size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm bg-white text-dark">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="text-dark mb-2 medium">Approved</h5>
                  <h5 className="mb-0 fw-semibold">{stats.approved}</h5>
                </div>
                <div className="bg-dark bg-opacity-10 rounded-circle p-2">
                  <FaCheckCircle className="text-dark" size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm bg-white text-dark">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="text-dark mb-2 medium">Rejected</h5>
                  <h5 className="mb-0 fw-semibold">{stats.rejected}</h5>
                </div>
                <div className="bg-dark bg-opacity-10 rounded-circle p-2">
                  <FaTimesCircle className="text-dark" size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="p-3">
          <Row className="g-3">
            <Col md={7}>
              <Form.Group>
                 <div className="d-flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={filter === 'all' ? 'primary' : 'outline-secondary'}
                    onClick={() => setFilter('all')}
                    className="px-3"
                  >
                    All ({stats.total})
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === 'pending' ? 'warning' : 'outline-warning'}
                    onClick={() => setFilter('pending')}
                    className="px-3"
                  >
                    Pending ({stats.pending})
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === 'approved' ? 'success' : 'outline-success'}
                    onClick={() => setFilter('approved')}
                    className="px-3"
                  >
                    Approved ({stats.approved})
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === 'rejected' ? 'danger' : 'outline-danger'}
                    onClick={() => setFilter('rejected')}
                    className="px-3"
                  >
                    Rejected ({stats.rejected})
                  </Button>
                </div>
              </Form.Group>
            </Col>

            <Col md={5}>
              <Form.Group>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-light border-0">
                    <FaSearch size={12} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by name, ID, reason..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-0 bg-light"
                  />
                  {searchTerm && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={clearSearch}
                      className="border-0"
                    >
                      <FaTimesIcon size={12} />
                    </Button>
                  )}
                </InputGroup>
               
              </Form.Group>
            </Col>
          </Row>

          {/* Active Filters Display */}
          {(filter !== 'all' || searchTerm) && (
            <div className="mt-2 d-flex align-items-center">
              <small className="text-muted me-2">Active filters:</small>
              {filter !== 'all' && (
                <Badge bg="info" className="me-2 px-2 py-1">
                  Status: {filter}
                </Badge>
              )}
              {searchTerm && (
                <Badge bg="info" className="me-2 px-2 py-1">
                  Search: "{searchTerm}"
                </Badge>
              )}
              <Button
                variant="link"
                size="sm"
                onClick={clearFilters}
                className="p-0 ms-2"
              >
                Clear all
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Main Table Card with Vertical Scroll */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-light d-flex justify-content-between align-items-center py-3">
          <h5 className="mb-0">
            <FaCalendarAlt className="me-2 text-dark" size={14} />
            Leave Requests List
          </h5>
          <Badge bg="dark" pill>
            {filteredRequests.length} Records
          </Badge>
        </Card.Header>
        <Card.Body className="p-0">
          {/* Table with Vertical Scroll - maxHeight 400px */}
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table className="mb-0">
              <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                <tr>
                  <th className="small fw-normal text-dark warp">
                    Sr No
                  </th>
                  <th className=" small fw-normal text-dark">Employee</th>
                  <th className=" small fw-normal text-dark">Leave Type</th>
                  <th className=" small fw-normal text-dark">Duration</th>
                  <th className=" small fw-normal text-dark">Date Range</th>
                  <th className=" small fw-normal text-dark">Days</th>
                  <th className=" small fw-normal text-dark">Reason</th>
                  <th className=" small fw-normal text-dark">Status</th>
                  <th className=" small fw-normal text-dark">Actions</th>
                </tr>
              </thead>

              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((leave, index) => (
                    <tr key={leave.id}>
                      {/* Sr No Column - Global index based on pagination */}
                      <td className="text-center">
                          {indexOfFirstItem + index + 1}
                      </td>

                      <td className="">
                        <div className="small">
                          <div>{leave.first_name} {leave.last_name}</div>
                          <div className="text-muted">{leave.employee_id}</div>
                        </div>
                      </td>

                      <td className=" small">
                        {leave.leave_type}
                      </td>

                      <td className=" small">
                        {leave.leave_duration}
                      </td>

                      <td className=" small">
                        {formatDateRange(leave.start_date, leave.end_date)}
                      </td>

                      <td className=" small">
                        {calculateDays(leave)} day's
                      </td>

                      <td className="">
                        <div style={{ margin: '0 auto' }}>
                          <small className="text-truncate d-block">
                            {leave.reason}
                          </small>

                          {leave.reporting_manager && (
                            <small className="d-block text-muted">
                              <FaBriefcase className="me-1" size={10} />
                              {leave.reporting_manager}
                            </small>
                          )}
                        </div>
                      </td>

                      <td className=" small">
                        {getStatusBadge(leave.status)}
                      </td>

                      <td className="">
                        <div className="d-flex justify-content-center gap-3 align-items-center">

                          {/* View */}
                          <FaEye
                            size={16}
                            className="text-dark action-icon"
                            onClick={() => handleViewDetails(leave)}
                            title="View Details"
                            style={{ cursor: "pointer" }}
                          />

                          {leave.status === "pending" && (
                            <>
                              {/* Approve */}
                              <FaCheck
                                size={16}
                                className="text-success action-icon"
                                onClick={() => handleAction(leave, "approve")}
                                title="Approve Leave"
                                style={{ cursor: "pointer" }}
                              />

                              {/* Reject */}
                              <FaTimes
                                size={16}
                                className="text-danger action-icon"
                                onClick={() => handleAction(leave, "reject")}
                                title="Reject Leave"
                                style={{ cursor: "pointer" }}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center py-5">
                      <FaSearch size={40} className="text-muted mb-3 opacity-50" />
                      <p className="text-muted mb-0">No leave requests found</p>

                      {(filter !== "all" || searchTerm) && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={clearFilters}
                          className="mt-2"
                        >
                          Clear all filters
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          {/* Pagination - Separate from scrollable area */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top">
              <small className="text-muted">
                Showing {indexOfFirstItem + 1} to{" "}
                {Math.min(indexOfLastItem, filteredRequests.length)} of{" "}
                {filteredRequests.length} entries
              </small>

              <Pagination size="sm">
                <Pagination.First
                  onClick={() => paginate(1)}
                  disabled={currentPage === 1}
                />
                <Pagination.Prev
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                />

                {[...Array(totalPages)].map((_, i) => (
                  <Pagination.Item
                    key={i + 1}
                    active={i + 1 === currentPage}
                    onClick={() => paginate(i + 1)}
                  >
                    {i + 1}
                  </Pagination.Item>
                ))}

                <Pagination.Next
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                />
                <Pagination.Last
                  onClick={() => paginate(totalPages)}
                  disabled={currentPage === totalPages}
                />
              </Pagination>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* View Details Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-primary text-white py-2">
          <Modal.Title as="h6" className="mb-0 small fw-semibold">
            <FaEye className="me-2" size={14} />
            Leave Request Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {selectedLeave && (
            <div className="small">
              <Row className="g-3">
                <Col md={6}>
                  <Card className="border-0 bg-light">
                    <Card.Body className="p-3">
                      <h6 className="text-primary mb-2 small fw-semibold">
                        <FaUserCircle className="me-2" size={12} />
                        Employee Information
                      </h6>
                      <p className="mb-1"><strong>Name:</strong> {selectedLeave.first_name} {selectedLeave.last_name}</p>
                      <p className="mb-1"><strong>Employee ID:</strong> {selectedLeave.employee_id}</p>
                      <p className="mb-1"><strong>Department:</strong> {selectedLeave.department}</p>
                      <p className="mb-0"><strong>Position:</strong> {selectedLeave.position}</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border-0 bg-light">
                    <Card.Body className="p-3">
                      <h6 className="text-primary mb-2 small fw-semibold">
                        <FaCalendarAlt className="me-2" size={12} />
                        Leave Information
                      </h6>
                      <p className="mb-1"><strong>Type:</strong> {selectedLeave.leave_type}</p>
                      <p className="mb-1"><strong>Duration:</strong> {selectedLeave.leave_duration}</p>
                      {selectedLeave.half_day_type && (
                        <p className="mb-1"><strong>Half Day:</strong> {selectedLeave.half_day_type}</p>
                      )}
                      <p className="mb-0"><strong>Days:</strong> {calculateDays(selectedLeave)} day(s)</p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Row className="mt-3 g-3">
                <Col md={6}>
                  <Card className="border-0 bg-light">
                    <Card.Body className="p-3">
                      <h6 className="text-primary mb-2 small fw-semibold">Date Range</h6>
                      <p className="mb-1"><strong>Start Date:</strong> {formatDate(selectedLeave.start_date)}</p>
                      <p className="mb-1"><strong>End Date:</strong> {formatDate(selectedLeave.end_date)}</p>
                      <p className="mb-0"><strong>Applied On:</strong> {formatDate(selectedLeave.applied_date)}</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="border-0 bg-light">
                    <Card.Body className="p-3">
                      <h6 className="text-primary mb-2 small fw-semibold">Status</h6>
                      <p className="mb-2">{getStatusBadge(selectedLeave.status)}</p>
                      {selectedLeave.admin_comments && (
                        <div className="mt-2 p-2 bg-white rounded">
                          <small className="text-muted d-block">Admin Comments:</small>
                          <p className="mb-0 small">{selectedLeave.admin_comments}</p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Card className="border-0 bg-light mt-3">
                <Card.Body className="p-3">
                  <h6 className="text-primary mb-2 small fw-semibold">
                    <FaInfoCircle className="me-2" size={12} />
                    Reason for Leave
                  </h6>
                  <p className="mb-0">{selectedLeave.reason}</p>

                  {selectedLeave.reporting_manager && (
                    <div className="mt-2">
                      <small className="text-muted">Reporting Manager:</small>
                      <p className="mb-0 small fw-bold">{selectedLeave.reporting_manager}</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          {selectedLeave?.status === 'pending' && (
            <>
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  setShowModal(false);
                  handleAction(selectedLeave, 'approve');
                }}
              >
                <FaCheck className="me-1" size={12} />
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setShowModal(false);
                  handleAction(selectedLeave, 'reject');
                }}
              >
                <FaTimes className="me-1" size={12} />
                Reject
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Action Modal (Approve/Reject) */}
      <Modal show={showActionModal} onHide={() => setShowActionModal(false)} centered>
        <Modal.Header closeButton className={selectedLeave?.status === 'pending' ? 'bg-warning' : 'bg-info'} style={{ color: 'white' }}>
          <Modal.Title as="h6" className="mb-0 small fw-semibold">
            {selectedLeave?.status === 'pending' ? (
              <>
                <FaCheckCircle className="me-2" size={14} />
                {comments ? 'Reject' : 'Approve'} Leave Request
              </>
            ) : (
              'Update Leave Request'
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {selectedLeave && (
            <div className="small">
              <p className="mb-2">
                <strong>Employee:</strong> {selectedLeave.first_name} {selectedLeave.last_name}
              </p>
              <p className="mb-2">
                <strong>Leave Dates:</strong> {formatDateRange(selectedLeave.start_date, selectedLeave.end_date)}
              </p>
              <p className="mb-3">
                <strong>Days:</strong> {calculateDays(selectedLeave)} day(s)
              </p>

              <Form.Group>
                <Form.Label className="small fw-semibold">Comments (Optional):</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Add comments about this decision..."
                  size="sm"
                  className="bg-light"
                />
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowActionModal(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={() => handleStatusUpdate(selectedLeave?.id, 'approved')}
            disabled={processing}
          >
            {processing ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                Processing...
              </>
            ) : (
              <>
                <FaCheck className="me-1" size={12} />
                Approve
              </>
            )}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleStatusUpdate(selectedLeave?.id, 'rejected')}
            disabled={processing}
          >
            {processing ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                Processing...
              </>
            ) : (
              <>
                <FaTimes className="me-1" size={12} />
                Reject
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LeaveRequests;