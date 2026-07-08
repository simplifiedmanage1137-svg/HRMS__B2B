// src/components/Admin/LeaveRequests.jsx
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
  FaSortNumericDown,
  FaArrowLeft
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

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
      console.log('🔍 Fetching all leave requests for admin...');
      // Admin sees all leave requests (not just team leaders)
      const response = await axios.get(`${API_ENDPOINTS.LEAVES}?all=true`);
      console.log('✅ Leave requests fetched:', response.data.length, 'records');
      setLeaveRequests(response.data);
      setFilteredRequests(response.data);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('❌ Error fetching leave requests:', error);
      console.error('Error response:', error.response?.data);
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to load leave requests' });
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
      // Only send status and remarks - no extra fields
      const response = await axios.put(API_ENDPOINTS.LEAVE_STATUS(id), {
        status,
        remarks: comments || null
      });

      console.log('Update response:', response.data);

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
      <Badge bg={colors[status]} className="px-2 px-sm-3 py-1 py-sm-2 d-inline-flex align-items-center">
        {icons[status]}
        <span className="d-none d-sm-inline">{status?.toUpperCase()}</span>
        <span className="d-inline d-sm-none">{status?.charAt(0).toUpperCase()}</span>
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
      <Badge bg={colors[type] || 'light'} className="px-2 py-1 text-nowrap">
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

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    // Handle IST string "YYYY-MM-DD HH:MM:SS"
    if (typeof dateString === 'string' && dateString.includes(' ') && !dateString.includes('T')) {
      const [datePart, timePart] = dateString.split(' ');
      const [y, mo, d] = datePart.split('-');
      const [h, mi] = timePart.split(':');
      const hourNum = parseInt(h);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
      return `${d}/${mo}/${y} ${hour12}:${mi} ${ampm} IST`;
    }
    // UTC ISO string - convert to IST
    const d = new Date(dateString);
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const h = ist.getUTCHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(ist.getUTCDate()).padStart(2,'0')}/${String(ist.getUTCMonth()+1).padStart(2,'0')}/${ist.getUTCFullYear()} ${hour12}:${String(ist.getUTCMinutes()).padStart(2,'0')} ${ampm} IST`;
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
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted small">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 p-md-3 p-lg-4">
      {/* Header with title and Leave Reports button - Responsive */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-4 gap-3">
        <h2 className="h4 mb-0 d-flex align-items-center">
          <FaCalendarAlt className="me-2 text-dark" />
          Leave Requests List
        </h2>
        <div className="d-flex gap-2 ms-0 ms-sm-auto">
          <Button
            variant="dark"
            onClick={handleGoToReports}
            className="d-flex align-items-center"
          >
            <FaChartBar className="me-2" />
            Leave Reports
          </Button>
          <button
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft size={12} /> Back
          </button>
        </div>
      </div>

      {/* Message Alert */}
      {message.text && (
        <Alert
          variant={message.type}
          onClose={() => setMessage({ type: '', text: '' })}
          dismissible
          className="mb-4 shadow-sm py-2"
        >
          <div className="d-flex align-items-center">
            {message.type === 'success' && <FaCheckCircle className="me-2 flex-shrink-0" size={14} />}
            {message.type === 'danger' && <FaExclamationTriangle className="me-2 flex-shrink-0" size={14} />}
            <span className="small">{message.text}</span>
          </div>
        </Alert>
      )}

      {/* Statistics Cards - Responsive grid */}
      <Row className="mb-4 g-2 g-md-3">
        <Col xs={6} lg={3}>
          <Card className="border-0 shadow-sm bg-white text-dark h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="overflow-hidden">
                  <h6 className="text-dark mb-2 small text-truncate">Total Requests</h6>
                  <h5 className="mb-0 fw-semibold">{stats.total}</h5>
                </div>
                <div className="bg-dark bg-opacity-10 rounded-circle p-2 flex-shrink-0">
                  <FaCalendarAlt className="text-dark" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} lg={3}>
          <Card className="border-0 shadow-sm bg-white text-dark h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="overflow-hidden">
                  <h6 className="text-dark mb-2 small text-truncate">Pending</h6>
                  <h5 className="mb-0 fw-semibold">{stats.pending}</h5>
                </div>
                <div className="bg-dark bg-opacity-10 rounded-circle p-2 flex-shrink-0">
                  <FaClock className="text-dark" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} lg={3}>
          <Card className="border-0 shadow-sm bg-white text-dark h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="overflow-hidden">
                  <h6 className="text-dark mb-2 small text-truncate">Approved</h6>
                  <h5 className="mb-0 fw-semibold">{stats.approved}</h5>
                </div>
                <div className="bg-dark bg-opacity-10 rounded-circle p-2 flex-shrink-0">
                  <FaCheckCircle className="text-dark" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} lg={3}>
          <Card className="border-0 shadow-sm bg-white text-dark h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="overflow-hidden">
                  <h6 className="text-dark mb-2 small text-truncate">Rejected</h6>
                  <h5 className="mb-0 fw-semibold">{stats.rejected}</h5>
                </div>
                <div className="bg-dark bg-opacity-10 rounded-circle p-2 flex-shrink-0">
                  <FaTimesCircle className="text-dark" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="p-2 p-md-3">
          <Row className="g-2 g-md-3">
            <Col xs={12} md={7}>
              <Form.Group>
                <div className="d-flex gap-1 gap-sm-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={filter === 'all' ? 'primary' : 'outline-secondary'}
                    onClick={() => setFilter('all')}
                    className="px-2 px-sm-3"
                  >
                    All ({stats.total})
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === 'pending' ? 'warning' : 'outline-warning'}
                    onClick={() => setFilter('pending')}
                    className="px-2 px-sm-3"
                  >
                    Pending ({stats.pending})
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === 'approved' ? 'success' : 'outline-success'}
                    onClick={() => setFilter('approved')}
                    className="px-2 px-sm-3"
                  >
                    Approved ({stats.approved})
                  </Button>
                  <Button
                    size="sm"
                    variant={filter === 'rejected' ? 'danger' : 'outline-danger'}
                    onClick={() => setFilter('rejected')}
                    className="px-2 px-sm-3"
                  >
                    Rejected ({stats.rejected})
                  </Button>
                </div>
              </Form.Group>
            </Col>

            <Col xs={12} md={5}>
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
            <div className="mt-2 d-flex flex-wrap align-items-center gap-2">
              <small className="text-muted">Active filters:</small>
              {filter !== 'all' && (
                <Badge bg="info" className="px-2 py-1">
                  Status: {filter}
                </Badge>
              )}
              {searchTerm && (
                <Badge bg="info" className="px-2 py-1">
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
        <Card.Header className="bg-light d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center py-3 gap-2">
          <h5 className="mb-0 d-flex align-items-center">
            <FaCalendarAlt className="me-2 text-dark" size={14} />
            Leave Requests List
          </h5>
          <Badge bg="dark" pill className="ms-0 ms-sm-auto">
            {filteredRequests.length} Records
          </Badge>
        </Card.Header>
        <Card.Body className="p-0">
          {/* Table with Vertical Scroll - Responsive */}
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table className="mb-0" size="sm">
              <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                <tr>
                  <th className="small fw-normal text-dark text-center">Sr No</th>
                  <th className="small fw-normal text-dark">Employee</th>
                  <th className="small fw-normal text-dark d-none d-sm-table-cell">Leave Type</th>
                  <th className="small fw-normal text-dark d-none d-md-table-cell">Duration</th>
                  <th className="small fw-normal text-dark d-none d-lg-table-cell">Date Range</th>
                  <th className="small fw-normal text-dark d-none d-xl-table-cell">Days</th>
                  <th className="small fw-normal text-dark">Reason / Manager</th>
                  <th className="small fw-normal text-dark d-none d-md-table-cell">Applied At (IST)</th>
                  <th className="small fw-normal text-dark">Status</th>
                  <th className="small fw-normal text-dark text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((leave, index) => (
                    <tr key={leave.id}>
                      {/* Sr No Column */}
                      <td className="text-center small">
                        {indexOfFirstItem + index + 1}
                      </td>

                      {/* Employee Column */}
                      <td className="small">
                        <div className="text-truncate" style={{ maxWidth: '100px' }} title={`${leave.first_name} ${leave.last_name}`}>
                          {leave.first_name} {leave.last_name}
                        </div>
                        <div className="text-muted small text-truncate" style={{ maxWidth: '100px' }} title={leave.employee_id}>
                          {leave.employee_id}
                        </div>
                      </td>

                      {/* Leave Type - Hidden on xs */}
                      <td className="small d-none d-sm-table-cell">
                        {getTypeBadge(leave.leave_type)}
                      </td>

                      {/* Duration - Hidden on sm and below */}
                      <td className="small d-none d-md-table-cell">
                        {leave.leave_duration}
                      </td>

                      {/* Date Range - Hidden on lg and below */}
                      <td className="small d-none d-lg-table-cell">
                        <span className="text-nowrap" title={formatDateRange(leave.start_date, leave.end_date)}>
                          {formatDateRange(leave.start_date, leave.end_date)}
                        </span>
                      </td>

                      {/* Days - Hidden on xl and below */}
                      <td className="small d-none d-xl-table-cell">
                        {calculateDays(leave)} day's
                      </td>

                      {/* Reason Column */}
                      <td className="small">
                        <div style={{ maxWidth: '120px' }}>
                          <div className="text-truncate d-block" title={leave.reason}>
                            {leave.reason}
                          </div>
                          {leave.reporting_manager && (
                            <small className="d-block text-muted text-truncate" title={leave.reporting_manager}>
                              <FaBriefcase className="me-1" size={10} />
                              {leave.reporting_manager}
                            </small>
                          )}
                        </div>
                      </td>

                      {/* Applied At IST */}
                      <td className="small d-none d-md-table-cell text-nowrap">
                        {formatDateTime(leave.created_at)}
                      </td>

                      {/* Status Column */}
                      <td className="small">
                        {getStatusBadge(leave.status)}
                      </td>

                      {/* Actions - Admin can approve/reject any pending leave */}
                      <td className="text-center">
                        <div className="d-flex align-items-center justify-content-center gap-1">
                          <FaEye
                            size={16}
                            className="text-primary"
                            onClick={() => handleViewDetails(leave)}
                            title="View Details"
                            style={{ cursor: 'pointer' }}
                          />
                          {leave.status === 'pending' && (
                            <>
                              <FaCheck
                                size={14}
                                className="text-success ms-1"
                                onClick={() => handleAction(leave, 'approve')}
                                title="Approve"
                                style={{ cursor: 'pointer' }}
                              />
                              <FaTimes
                                size={14}
                                className="text-danger ms-1"
                                onClick={() => handleAction(leave, 'reject')}
                                title="Reject"
                                style={{ cursor: 'pointer' }}
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

          {/* Pagination - Responsive */}
          {totalPages > 1 && (
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center px-3 py-2 border-top gap-2">
              <small className="text-muted order-2 order-sm-1">
                Showing {indexOfFirstItem + 1} to{" "}
                {Math.min(indexOfLastItem, filteredRequests.length)} of{" "}
                {filteredRequests.length} entries
              </small>

              <Pagination size="sm" className="mb-0 order-1 order-sm-2">
                <Pagination.First
                  onClick={() => paginate(1)}
                  disabled={currentPage === 1}
                  className="d-none d-sm-inline"
                />
                <Pagination.Prev
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                />

                {totalPages <= 5 ? (
                  [...Array(totalPages)].map((_, i) => (
                    <Pagination.Item
                      key={i + 1}
                      active={i + 1 === currentPage}
                      onClick={() => paginate(i + 1)}
                      className="d-none d-sm-inline"
                    >
                      {i + 1}
                    </Pagination.Item>
                  ))
                ) : (
                  <>
                    {/* Show first page */}
                    <Pagination.Item
                      key={1}
                      active={1 === currentPage}
                      onClick={() => paginate(1)}
                      className="d-none d-sm-inline"
                    >
                      1
                    </Pagination.Item>

                    {/* Show ellipsis if currentPage > 3 */}
                    {currentPage > 3 && <Pagination.Ellipsis className="d-none d-sm-inline" />}

                    {/* Show pages around current page */}
                    {[...Array(totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      if (pageNum !== 1 && pageNum !== totalPages &&
                        pageNum >= currentPage - 1 && pageNum <= currentPage + 1) {
                        return (
                          <Pagination.Item
                            key={pageNum}
                            active={pageNum === currentPage}
                            onClick={() => paginate(pageNum)}
                            className="d-none d-sm-inline"
                          >
                            {pageNum}
                          </Pagination.Item>
                        );
                      }
                      return null;
                    })}

                    {/* Show ellipsis if currentPage < totalPages - 2 */}
                    {currentPage < totalPages - 2 && <Pagination.Ellipsis className="d-none d-sm-inline" />}

                    {/* Show last page */}
                    {totalPages > 1 && (
                      <Pagination.Item
                        key={totalPages}
                        active={totalPages === currentPage}
                        onClick={() => paginate(totalPages)}
                        className="d-none d-sm-inline"
                      >
                        {totalPages}
                      </Pagination.Item>
                    )}
                  </>
                )}

                <Pagination.Ellipsis className="d-inline d-sm-none" />

                <Pagination.Next
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                />
                <Pagination.Last
                  onClick={() => paginate(totalPages)}
                  disabled={currentPage === totalPages}
                  className="d-none d-sm-inline"
                />
              </Pagination>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* View Details Modal - Responsive */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="lg"
        centered
        dialogClassName="mx-2 mx-md-auto"
      >
        <Modal.Header closeButton className="bg-primary text-white py-2">
          <Modal.Title as="h6" className="mb-0 small fw-semibold d-flex align-items-center">
            <FaEye className="me-2" size={14} />
            <span className="text-truncate">Leave Request Details</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2 p-md-3">
          {selectedLeave && (
            <div className="small">
              <Row className="g-2 g-md-3">
                <Col xs={12} md={6}>
                  <Card className="border-0 bg-light h-100">
                    <Card.Body className="p-2 p-md-3">
                      <h6 className="text-primary mb-2 small fw-semibold d-flex align-items-center">
                        <FaUserCircle className="me-2 flex-shrink-0" size={12} />
                        Employee Information
                      </h6>
                      <p className="mb-1"><strong>Name:</strong> {selectedLeave.first_name} {selectedLeave.last_name}</p>
                      <p className="mb-1"><strong>Employee ID:</strong> {selectedLeave.employee_id}</p>
                      <p className="mb-1"><strong>Department:</strong> {selectedLeave.department}</p>
                      <p className="mb-0"><strong>Position:</strong> {selectedLeave.designation || selectedLeave.position}</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12} md={6}>
                  <Card className="border-0 bg-light h-100">
                    <Card.Body className="p-2 p-md-3">
                      <h6 className="text-primary mb-2 small fw-semibold d-flex align-items-center">
                        <FaCalendarAlt className="me-2 flex-shrink-0" size={12} />
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

              <Row className="mt-2 mt-md-3 g-2 g-md-3">
                <Col xs={12} md={6}>
                  <Card className="border-0 bg-light">
                    <Card.Body className="p-2 p-md-3">
                      <h6 className="text-primary mb-2 small fw-semibold">Date Range</h6>
                      <p className="mb-1"><strong>Start Date:</strong> {formatDate(selectedLeave.start_date)}</p>
                      <p className="mb-1"><strong>End Date:</strong> {formatDate(selectedLeave.end_date)}</p>
                      <p className="mb-0"><strong>Applied On:</strong> {formatDate(selectedLeave.applied_date)}</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12} md={6}>
                  <Card className="border-0 bg-light">
                    <Card.Body className="p-2 p-md-3">
                      <h6 className="text-primary mb-2 small fw-semibold">Status</h6>
                      <p className="mb-2">{getStatusBadge(selectedLeave.status)}</p>
                      {selectedLeave.remarks && (
                        <div className="mt-2 p-2 bg-white rounded">
                          <small className="text-muted d-block">Admin Comments:</small>
                          <p className="mb-0 small">{selectedLeave.remarks}</p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Card className="border-0 bg-light mt-2 mt-md-3">
                <Card.Body className="p-2 p-md-3">
                  <h6 className="text-primary mb-2 small fw-semibold d-flex align-items-center">
                    <FaInfoCircle className="me-2 flex-shrink-0" size={12} />
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
                className="d-inline-flex align-items-center"
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
                className="d-inline-flex align-items-center"
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

      {/* Action Modal (Approve/Reject) - Responsive */}
      <Modal
        show={showActionModal}
        onHide={() => setShowActionModal(false)}
        centered
        dialogClassName="mx-2 mx-md-auto"
      >
        <Modal.Header closeButton className={selectedLeave?.status === 'pending' ? 'bg-warning' : 'bg-info'} style={{ color: 'white' }}>
          <Modal.Title as="h6" className="mb-0 small fw-semibold d-flex align-items-center">
            {selectedLeave?.status === 'pending' ? (
              <>
                <FaCheckCircle className="me-2 flex-shrink-0" size={14} />
                <span className="text-truncate">{comments ? 'Reject' : 'Approve'} Leave Request</span>
              </>
            ) : (
              'Update Leave Request'
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2 p-md-3">
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
            className="d-inline-flex align-items-center"
          >
            {processing ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                <span className="d-none d-sm-inline">Processing...</span>
              </>
            ) : (
              <>
                <FaCheck className="me-1" size={12} />
                <span className="d-none d-sm-inline">Approve</span>
              </>
            )}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleStatusUpdate(selectedLeave?.id, 'rejected')}
            disabled={processing}
            className="d-inline-flex align-items-center"
          >
            {processing ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                <span className="d-none d-sm-inline">Processing...</span>
              </>
            ) : (
              <>
                <FaTimes className="me-1" size={12} />
                <span className="d-none d-sm-inline">Reject</span>
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LeaveRequests;