// src/components/Employee/Profile.jsx
import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Badge, Spinner, Alert, Table, 
  Button, ProgressBar, ListGroup 
} from 'react-bootstrap';
import { 
  FaUserCircle, 
  FaCalendar, 
  FaBriefcase, 
  FaMoneyBill, 
  FaClock, 
  FaEnvelope, 
  FaIdCard,
  FaMapMarkerAlt,
  FaFileSignature,
  FaPhoneAlt,
  FaUmbrellaBeach,
  FaRupeeSign,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaEye,
  FaBuilding,
  FaUserTie,
  FaHeartbeat,
  FaUniversity,
  FaCreditCard,
  FaFilePdf,
  FaDownload,
  FaEdit,
  FaInfoCircle,
  FaExclamationTriangle,
  FaTrophy
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import HolidayCalendar from './HolidayCalendar';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
    const { user } = useAuth();
    const { employeeUpdate, clearEmployeeUpdate, showNotification } = useNotification();
    const navigate = useNavigate();
    
    const [employee, setEmployee] = useState(null);
    const [leaveBalance, setLeaveBalance] = useState({
        available: '0',
        total_accrued: '0',
        used: '0',
        pending: '0',
        comp_off_balance: '0',
        total_comp_off_earned: '0',
        total_comp_off_used: '0',
        completed_months_in_year: 0,
        message: '',
        is_eligible: false,
        months_completed: 0
    });
    const [compOffHistory, setCompOffHistory] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [imageError, setImageError] = useState(false);
    const [activeTab, setActiveTab] = useState('personal');
    const [documentCount, setDocumentCount] = useState(0);

    useEffect(() => {
        if (user?.employeeId) {
            fetchEmployeeProfile();
            fetchLeaveBalance();
            fetchCompOffHistory();
            fetchLeaveRequests();
            fetchDocumentCount();
        }
    }, [user]);

    // Listen for employee updates
    useEffect(() => {
        if (employeeUpdate && employeeUpdate.employeeId === user?.employeeId) {
            fetchEmployeeProfile();
            fetchLeaveBalance();
            fetchCompOffHistory();
            clearEmployeeUpdate();
            showNotification('Your profile has been updated!', 'info');
        }
    }, [employeeUpdate, user?.employeeId]);

    const fetchEmployeeProfile = async () => {
        try {
            setLoading(true);
            
            let empData = user?.employeeData;
            if (!empData && user?.employeeId) {
                const response = await axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(user?.employeeId));
                empData = response.data;
            }
            
            if (empData) {
                setEmployee(empData);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            setError(error.response?.data?.message || 'Failed to load profile data');
            showNotification(error.response?.data?.message || 'Failed to load profile data', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const fetchLeaveBalance = async () => {
        try {
            const response = await axios.get(API_ENDPOINTS.LEAVE_BALANCE(user?.employeeId));
            setLeaveBalance(response.data);
        } catch (error) {
            console.error('Error fetching leave balance:', error);
        }
    };

    const fetchCompOffHistory = async () => {
        try {
            const response = await axios.get(`${API_ENDPOINTS.ATTENDANCE}/comp-off/${user?.employeeId}/history`);
            setCompOffHistory(response.data.earnings || []);
        } catch (error) {
            console.error('Error fetching comp-off history:', error);
        }
    };

    const fetchLeaveRequests = async () => {
        try {
            const response = await axios.get(API_ENDPOINTS.LEAVE_BY_EMPLOYEE(user?.employeeId));
            setLeaveRequests(response.data || []);
        } catch (error) {
            console.error('Error fetching leave requests:', error);
        }
    };

    const fetchDocumentCount = async () => {
        try {
            const response = await axios.get(API_ENDPOINTS.EMPLOYEE_DOCUMENTS(user?.employeeId));
            const docs = Object.values(response.data).filter(v => v && v !== 'null' && v !== '');
            setDocumentCount(docs.length);
        } catch (error) {
            console.error('Error fetching document count:', error);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatShortDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const getLeaveStatusBadge = (status) => {
        switch(status) {
            case 'approved':
                return <Badge bg="success" pill><FaCheckCircle className="me-1" size={10} /> Approved</Badge>;
            case 'pending':
                return <Badge bg="warning" pill><FaHourglassHalf className="me-1" size={10} /> Pending</Badge>;
            case 'rejected':
                return <Badge bg="danger" pill><FaTimesCircle className="me-1" size={10} /> Rejected</Badge>;
            default:
                return <Badge bg="secondary" pill>Unknown</Badge>;
        }
    };

    const handleImageError = () => {
        setImageError(true);
    };

    const handleEditProfile = () => {
        navigate('/employee/update-requests');
    };

    const calculateLeavePercentage = () => {
        const used = parseFloat(leaveBalance.used) || 0;
        const total = parseFloat(leaveBalance.total_accrued) || 1;
        return (used / total * 100).toFixed(1);
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="text-center">
                    <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                    <p className="mt-3 text-muted small">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="danger" className="m-4" onClose={() => setError('')} dismissible>
                <FaExclamationTriangle className="me-2" />
                {error}
            </Alert>
        );
    }

    if (!employee) {
        return (
            <Alert variant="warning" className="m-4">
                <FaInfoCircle className="me-2" />
                No employee data found. Please contact admin.
            </Alert>
        );
    }

    return (
        <div className="p-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">
                    <FaUserCircle className="me-2 text-primary" />
                    My Profile
                </h4>
                <div className="d-flex gap-2">
                    <Badge bg="dark" className="px-3 py-2">
                        ID: {employee.employee_id}
                    </Badge>
                    <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={handleEditProfile}
                    >
                        <FaEdit className="me-2" size={12} />
                        Update Profile
                    </Button>
                </div>
            </div>

            {/* Main Profile Card */}
            <Card className="mb-4 border-0 shadow-sm">
                <Card.Header className="bg-white py-2 border-0">
                    <div className="d-flex border-bottom">
                        <Button
                            variant={activeTab === 'personal' ? 'primary' : 'light'}
                            size="sm"
                            onClick={() => setActiveTab('personal')}
                            className="me-1 rounded-0 border-0"
                            style={{ 
                                backgroundColor: activeTab === 'personal' ? '#0d6efd' : '#f8f9fa',
                                color: activeTab === 'personal' ? 'white' : '#6c757d',
                                borderBottom: activeTab === 'personal' ? '3px solid #0d6efd' : '3px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaUserCircle className="me-2" size={12} />
                            Personal
                        </Button>
                        <Button
                            variant={activeTab === 'leave' ? 'primary' : 'light'}
                            size="sm"
                            onClick={() => setActiveTab('leave')}
                            className="me-1 rounded-0 border-0"
                            style={{ 
                                backgroundColor: activeTab === 'leave' ? '#0d6efd' : '#f8f9fa',
                                color: activeTab === 'leave' ? 'white' : '#6c757d',
                                borderBottom: activeTab === 'leave' ? '3px solid #0d6efd' : '3px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaUmbrellaBeach className="me-2" size={12} />
                            Leave
                        </Button>
                        <Button
                            variant={activeTab === 'comp-off' ? 'primary' : 'light'}
                            size="sm"
                            onClick={() => setActiveTab('comp-off')}
                            className="me-1 rounded-0 border-0"
                            style={{ 
                                backgroundColor: activeTab === 'comp-off' ? '#0d6efd' : '#f8f9fa',
                                color: activeTab === 'comp-off' ? 'white' : '#6c757d',
                                borderBottom: activeTab === 'comp-off' ? '3px solid #0d6efd' : '3px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaTrophy className="me-2" size={12} />
                            Comp-Off
                        </Button>
                        <Button
                            variant={activeTab === 'bank' ? 'primary' : 'light'}
                            size="sm"
                            onClick={() => setActiveTab('bank')}
                            className="me-1 rounded-0 border-0"
                            style={{ 
                                backgroundColor: activeTab === 'bank' ? '#0d6efd' : '#f8f9fa',
                                color: activeTab === 'bank' ? 'white' : '#6c757d',
                                borderBottom: activeTab === 'bank' ? '3px solid #0d6efd' : '3px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaUniversity className="me-2" size={12} />
                            Bank
                        </Button>
                        <Button
                            variant={activeTab === 'salary' ? 'primary' : 'light'}
                            size="sm"
                            onClick={() => setActiveTab('salary')}
                            className="me-1 rounded-0 border-0"
                            style={{ 
                                backgroundColor: activeTab === 'salary' ? '#0d6efd' : '#f8f9fa',
                                color: activeTab === 'salary' ? 'white' : '#6c757d',
                                borderBottom: activeTab === 'salary' ? '3px solid #0d6efd' : '3px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaRupeeSign className="me-2" size={12} />
                            Salary
                        </Button>
                        <Button
                            variant={activeTab === 'policy' ? 'primary' : 'light'}
                            size="sm"
                            onClick={() => setActiveTab('policy')}
                            className="me-1 rounded-0 border-0"
                            style={{ 
                                backgroundColor: activeTab === 'policy' ? '#0d6efd' : '#f8f9fa',
                                color: activeTab === 'policy' ? 'white' : '#6c757d',
                                borderBottom: activeTab === 'policy' ? '3px solid #0d6efd' : '3px solid transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaFileSignature className="me-2" size={12} />
                            Contract
                        </Button>
                    </div>
                </Card.Header>
                
                <Card.Body className="p-3">
                    {/* Personal Tab */}
                    {activeTab === 'personal' && (
                        <Row>
                            {/* Profile Picture Card */}
                            <Col md={4}>
                                <Card className="text-center mb-3 border-0 shadow-sm">
                                    <Card.Body className="p-3">
                                        <div className="mb-3">
                                            {employee.profile_image && !imageError ? (
                                                <img 
                                                    src={`${API_ENDPOINTS.EMPLOYEE_DOCUMENT_BY_TYPE(employee.employee_id, 'profile_image')}?inline=true`}
                                                    alt="Profile"
                                                    className="rounded-circle border"
                                                    style={{ 
                                                        width: '120px', 
                                                        height: '120px', 
                                                        objectFit: 'cover',
                                                        border: '3px solid #4e73df'
                                                    }}
                                                    onError={handleImageError}
                                                />
                                            ) : (
                                                <FaUserCircle size={100} className="text-secondary" />
                                            )}
                                        </div>
                                        <h5 className="mb-1">
                                            {employee.first_name} {employee.middle_name} {employee.last_name}
                                        </h5>
                                        <p className="text-muted small mb-2">{employee.designation}</p>
                                        <Badge bg="info" className="px-3 py-2 mb-2 small">{employee.employment_type}</Badge>
                                        
                                        <div className="text-start mt-3">
                                            <ListGroup variant="flush" className="border-0">
                                                <ListGroup.Item className="px-0 py-1 border-0 bg-transparent">
                                                    <FaEnvelope className="text-primary me-2" size={12} />
                                                    <small>{employee.email}</small>
                                                </ListGroup.Item>
                                                {employee.phone && (
                                                    <ListGroup.Item className="px-0 py-1 border-0 bg-transparent">
                                                        <FaPhoneAlt className="text-primary me-2" size={12} />
                                                        <small>{employee.phone}</small>
                                                    </ListGroup.Item>
                                                )}
                                                {employee.emergency_contact && (
                                                    <ListGroup.Item className="px-0 py-1 border-0 bg-transparent">
                                                        <FaHeartbeat className="text-danger me-2" size={12} />
                                                        <small>Emergency: {employee.emergency_contact}</small>
                                                    </ListGroup.Item>
                                                )}
                                            </ListGroup>
                                        </div>

                                        <div className="mt-3">
                                            <small className="text-muted d-block mb-1">Documents Uploaded:</small>
                                            <Badge bg="success" className="px-3 py-2">
                                                <FaFilePdf className="me-2" size={12} />
                                                {documentCount} Documents
                                            </Badge>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>

                            {/* Personal Details */}
                            <Col md={8}>
                                <Row>
                                    <Col md={6}>
                                        <Card className="mb-3 border-0 shadow-sm">
                                            <Card.Header className="bg-light py-2">
                                                <h6 className="mb-0 small fw-semibold">
                                                    <FaUserCircle className="me-2" size={12} />
                                                    Personal Details
                                                </h6>
                                            </Card.Header>
                                            <Card.Body className="p-3">
                                                <ListGroup variant="flush" className="border-0">
                                                    <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                        <span className="text-muted small" style={{ minWidth: '100px' }}>Full Name:</span>
                                                        <span className="small">{employee.first_name} {employee.middle_name} {employee.last_name}</span>
                                                    </ListGroup.Item>
                                                    <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                        <span className="text-muted small" style={{ minWidth: '100px' }}>Date of Birth:</span>
                                                        <span className="small">{formatDate(employee.dob)}</span>
                                                    </ListGroup.Item>
                                                    <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                        <span className="text-muted small" style={{ minWidth: '100px' }}>Blood Group:</span>
                                                        <Badge bg="danger" pill className="px-2 py-1">
                                                            {employee.blood_group || 'N/A'}
                                                        </Badge>
                                                    </ListGroup.Item>
                                                </ListGroup>
                                            </Card.Body>
                                        </Card>
                                    </Col>

                                    <Col md={6}>
                                        <Card className="mb-3 border-0 shadow-sm">
                                            <Card.Header className="bg-light py-2">
                                                <h6 className="mb-0 small fw-semibold">
                                                    <FaBriefcase className="me-2" size={12} />
                                                    Employment Details
                                                </h6>
                                            </Card.Header>
                                            <Card.Body className="p-3">
                                                <ListGroup variant="flush" className="border-0">
                                                    <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                        <span className="text-muted small" style={{ minWidth: '120px' }}>Department:</span>
                                                        <span className="small">{employee.department}</span>
                                                    </ListGroup.Item>
                                                    <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                        <span className="text-muted small" style={{ minWidth: '120px' }}>Designation:</span>
                                                        <span className="small">{employee.designation}</span>
                                                    </ListGroup.Item>
                                                    <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                        <span className="text-muted small" style={{ minWidth: '120px' }}>Joining Date:</span>
                                                        <span className="small">{formatDate(employee.joining_date)}</span>
                                                    </ListGroup.Item>
                                                    <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                        <span className="text-muted small" style={{ minWidth: '130px' }}>Reporting Manager:</span>
                                                        <span className="small">{employee.reporting_manager || 'N/A'}</span>
                                                    </ListGroup.Item>
                                                    <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                        <span className="text-muted small" style={{ minWidth: '120px' }}>Shift Timing:</span>
                                                        <span className="small">{employee.shift_timing || '9:00 AM - 6:00 PM'}</span>
                                                    </ListGroup.Item>
                                                </ListGroup>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                </Row>

                                {/* Address Card */}
                                {employee.address && (
                                    <Card className="border-0 shadow-sm">
                                        <Card.Header className="bg-light py-2">
                                            <h6 className="mb-0 small fw-semibold">
                                                <FaMapMarkerAlt className="me-2" size={12} />
                                                Address
                                            </h6>
                                        </Card.Header>
                                        <Card.Body className="p-3">
                                            <p className="mb-0 small">{employee.address}</p>
                                            {(employee.city || employee.state || employee.pincode) && (
                                                <small className="text-muted d-block mt-1">
                                                    {[employee.city, employee.state, employee.pincode].filter(Boolean).join(', ')}
                                                </small>
                                            )}
                                        </Card.Body>
                                    </Card>
                                )}
                            </Col>
                        </Row>
                    )}

                    {/* Leave Tab */}
                    {activeTab === 'leave' && (
                        <Row>
                            <Col md={4}>
                                {/* Leave Balance Card */}
                                <Card className="border-0 shadow-sm">
                                    <Card.Header className="bg-primary text-white py-2">
                                        <h6 className="mb-0 small fw-semibold">
                                            <FaUmbrellaBeach className="me-2" size={12} />
                                            Leave Balance
                                        </h6>
                                    </Card.Header>
                                    <Card.Body className="p-3">
                                        {/* Comp-Off Balance Display */}
                                        {parseFloat(leaveBalance.comp_off_balance) > 0 && (
                                            <div className="text-center mb-3 p-2 bg-purple bg-opacity-10 rounded">
                                                <FaTrophy className="text-purple mb-2" size={24} />
                                                <h5 className="text-purple fw-bold mb-0">{leaveBalance.comp_off_balance}</h5>
                                                <p className="text-muted small">Comp-Off Days</p>
                                                <Badge bg="purple" className="mt-1">
                                                    Earned by working on holidays
                                                </Badge>
                                            </div>
                                        )}

                                        <div className="text-center mb-3">
                                            <h1 className="display-4 text-primary fw-bold">{leaveBalance.available}</h1>
                                            <p className="text-muted small">Available Leaves</p>
                                        </div>
                                        
                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between mb-1 small">
                                                <span className="text-muted">Total Accrued:</span>
                                                <span className="fw-semibold">{leaveBalance.total_accrued} days</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-1 small">
                                                <span className="text-muted">Used:</span>
                                                <span className="fw-semibold text-danger">{leaveBalance.used} days</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-2 small">
                                                <span className="text-muted">Pending:</span>
                                                <span className="fw-semibold text-warning">{leaveBalance.pending} days</span>
                                            </div>

                                            {/* Comp-Off Summary */}
                                            {parseFloat(leaveBalance.total_comp_off_earned) > 0 && (
                                                <div className="mt-2 pt-2 border-top">
                                                    <div className="d-flex justify-content-between mb-1 small">
                                                        <span className="text-muted">
                                                            <FaTrophy className="me-1 text-purple" size={10} />
                                                            Comp-Off Earned:
                                                        </span>
                                                        <span className="fw-semibold">{leaveBalance.total_comp_off_earned || 0}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between mb-1 small">
                                                        <span className="text-muted">
                                                            <FaTrophy className="me-1 text-purple" size={10} />
                                                            Comp-Off Used:
                                                        </span>
                                                        <span className="fw-semibold">{leaveBalance.total_comp_off_used || 0}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="d-flex justify-content-between mb-2 small">
                                                <span className="text-muted">Months Completed (this year):</span>
                                                <span className="fw-semibold">{leaveBalance.completed_months_in_year || 0}</span>
                                            </div>

                                            {leaveBalance.message && (
                                                <Alert variant="info" className="p-2 small mb-2">
                                                    <FaInfoCircle className="me-2" size={10} />
                                                    {leaveBalance.message}
                                                </Alert>
                                            )}

                                            <ProgressBar 
                                                now={parseFloat(calculateLeavePercentage())} 
                                                variant="success" 
                                                style={{ height: '6px' }}
                                                className="mb-1"
                                            />
                                            <small className="text-muted d-block text-center">
                                                {calculateLeavePercentage()}% used
                                            </small>
                                        </div>

                                        <Button 
                                            variant="primary" 
                                            size="sm" 
                                            className="w-100"
                                            onClick={() => navigate('/apply-leave')}
                                        >
                                            Apply for Leave
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Col>

                            <Col md={8}>
                                {/* Leave History */}
                                <Card className="border-0 shadow-sm">
                                    <Card.Header className="bg-light py-2 d-flex justify-content-between align-items-center">
                                        <h6 className="mb-0 small fw-semibold">Leave History</h6>
                                        <Badge bg="dark" pill>
                                            {leaveRequests.length} Records
                                        </Badge>
                                    </Card.Header>
                                    <Card.Body className="p-0">
                                        {leaveRequests.length > 0 ? (
                                            <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                <Table hover size="sm" className="mb-0">
                                                    <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                                                        <tr>
                                                            <th className="small text-dark">Leave Type</th>
                                                            <th className="small text-dark">Duration</th>
                                                            <th className="small text-dark">Date Range</th>
                                                            <th className="small text-dark">Days</th>
                                                            <th className="small text-dark">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {leaveRequests.map((leave, index) => (
                                                            <tr key={leave.id || index}>
                                                                <td className="small">
                                                                    <Badge 
                                                                        bg={leave.leave_type === 'Comp-Off' ? 'purple' : 'secondary'} 
                                                                        className="px-2 py-1"
                                                                    >
                                                                        {leave.leave_type === 'Comp-Off' && '🎉 '}
                                                                        {leave.leave_type}
                                                                    </Badge>
                                                                </td>
                                                                <td className="small">{leave.leave_duration || 'Full Day'}</td>
                                                                <td className="small">
                                                                    {formatShortDate(leave.start_date)}
                                                                    {leave.start_date !== leave.end_date && ` - ${formatShortDate(leave.end_date)}`}
                                                                </td>
                                                                <td className="small fw-bold">{leave.days_count || 1}</td>
                                                                <td className="small">{getLeaveStatusBadge(leave.status)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4">
                                                <FaUmbrellaBeach size={40} className="text-muted mb-3 opacity-50" />
                                                <p className="text-muted small mb-0">No leave requests found</p>
                                                <Button 
                                                    variant="link" 
                                                    size="sm" 
                                                    onClick={() => navigate('/apply-leave')}
                                                    className="mt-2"
                                                >
                                                    Apply for your first leave
                                                </Button>
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Comp-Off Tab */}
                    {activeTab === 'comp-off' && (
                        <Row>
                            <Col md={12}>
                                <Card className="border-0 shadow-sm">
                                    <Card.Header className="bg-purple text-white py-2 d-flex justify-content-between align-items-center">
                                        <h6 className="mb-0 small fw-semibold">
                                            <FaTrophy className="me-2" size={12} />
                                            Comp-Off Earnings History
                                        </h6>
                                        <Badge bg="light" text="dark" className="px-3 py-1">
                                            Balance: {leaveBalance.comp_off_balance} days
                                        </Badge>
                                    </Card.Header>
                                    <Card.Body className="p-0">
                                        {compOffHistory.length > 0 ? (
                                            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                                <Table hover size="sm" className="mb-0">
                                                    <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                                                        <tr>
                                                            <th className="small text-dark">#</th>
                                                            <th className="small text-dark">Date Earned</th>
                                                            <th className="small text-dark">Holiday</th>
                                                            <th className="small text-dark">Hours Worked</th>
                                                            <th className="small text-dark">Comp-Off Days</th>
                                                            <th className="small text-dark">Status</th>
                                                            <th className="small text-dark">Used Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {compOffHistory.map((item, index) => (
                                                            <tr key={item.id || index}>
                                                                <td className="small">{index + 1}</td>
                                                                <td className="small">{formatDate(item.attendance_date)}</td>
                                                                <td className="small">
                                                                    <Badge bg="info" pill className="px-2 py-1">
                                                                        {item.holiday_name}
                                                                    </Badge>
                                                                </td>
                                                                <td className="small">{item.hours_worked} hrs</td>
                                                                <td className="small fw-bold">{item.comp_off_days}</td>
                                                                <td className="small">
                                                                    {item.is_used ? (
                                                                        <Badge bg="secondary" pill>Used</Badge>
                                                                    ) : (
                                                                        <Badge bg="success" pill>Available</Badge>
                                                                    )}
                                                                </td>
                                                                <td className="small">
                                                                    {item.used_date ? formatDate(item.used_date) : '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-5">
                                                <FaTrophy size={50} className="text-muted mb-3 opacity-50" />
                                                <h6 className="text-muted">No Comp-Off earnings yet</h6>
                                                <p className="text-muted small mb-0">
                                                    Work on holidays to earn Comp-Off days!
                                                </p>
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {/* Bank Tab */}
                    {activeTab === 'bank' && (
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-light py-2">
                                <h6 className="mb-0 small fw-semibold">
                                    <FaUniversity className="me-2" size={12} />
                                    Bank Details
                                </h6>
                            </Card.Header>
                            <Card.Body className="p-3">
                                <Row>
                                    <Col md={6}>
                                        <ListGroup variant="flush" className="border-0">
                                            <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                <span className="text-muted small" style={{ minWidth: '120px' }}>Account Name:</span>
                                                <span className="small fw-semibold">{employee.bank_account_name || 'N/A'}</span>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                <span className="text-muted small" style={{ minWidth: '120px' }}>Account Number:</span>
                                                <span className="small fw-semibold">{employee.account_number || 'N/A'}</span>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                <span className="text-muted small" style={{ minWidth: '120px' }}>IFSC Code:</span>
                                                <span className="small fw-semibold">{employee.ifsc_code || 'N/A'}</span>
                                            </ListGroup.Item>
                                        </ListGroup>
                                    </Col>
                                    <Col md={6}>
                                        <ListGroup variant="flush" className="border-0">
                                            <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                <span className="text-muted small" style={{ minWidth: '120px' }}>Branch Name:</span>
                                                <span className="small fw-semibold">{employee.branch_name || 'N/A'}</span>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                <span className="text-muted small" style={{ minWidth: '120px' }}>PAN Number:</span>
                                                <span className="small fw-semibold">{employee.pan_number || 'N/A'}</span>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="px-0 py-2 border-0 d-flex">
                                                <span className="text-muted small" style={{ minWidth: '120px' }}>Aadhar Number:</span>
                                                <span className="small fw-semibold">{employee.aadhar_number || 'N/A'}</span>
                                            </ListGroup.Item>
                                        </ListGroup>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    )}

                    {/* Salary Tab */}
                    {activeTab === 'salary' && (
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-light py-2">
                                <h6 className="mb-0 small fw-semibold">
                                    <FaRupeeSign className="me-2" size={12} />
                                    Salary Information
                                </h6>
                            </Card.Header>
                            <Card.Body className="p-3">
                                <Row>
                                    <Col md={6}>
                                        <div className="bg-light p-3 rounded mb-3">
                                            <small className="text-muted d-block mb-1">Gross Salary</small>
                                            <h4 className="text-primary mb-0">{formatCurrency(employee.gross_salary)}</h4>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="bg-light p-3 rounded mb-3">
                                            <small className="text-muted d-block mb-1">In-hand Salary</small>
                                            <h4 className="text-success mb-0">{formatCurrency(employee.in_hand_salary)}</h4>
                                        </div>
                                    </Col>
                                </Row>
                                <Alert variant="info" className="py-2 small mb-0">
                                    <FaInfoCircle className="me-2" size={10} />
                                    Monthly Deduction: ₹200 (Fixed)
                                </Alert>
                            </Card.Body>
                        </Card>
                    )}

                    {/* Policy Tab */}
                    {activeTab === 'policy' && (
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-light py-2">
                                <h6 className="mb-0 small fw-semibold">
                                    <FaFileSignature className="me-2" size={12} />
                                    Employment Contract Policy
                                </h6>
                            </Card.Header>
                            <Card.Body className="p-3">
                                {employee.contract_policy ? (
                                    <div 
                                        className="bg-light p-3 rounded"
                                        style={{ 
                                            maxHeight: '400px', 
                                            overflowY: 'auto',
                                            fontSize: '0.85rem',
                                            whiteSpace: 'pre-line',
                                            fontFamily: 'monospace'
                                        }}
                                    >
                                        {employee.contract_policy}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <FaFileSignature size={40} className="text-muted mb-3 opacity-50" />
                                        <p className="text-muted small mb-0">No contract policy found</p>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    )}
                </Card.Body>
            </Card>

            {/* Holiday Calendar */}
            <HolidayCalendar employeeRegion={employee.region || 'All'} />
        </div>
    );
};

export default Profile;