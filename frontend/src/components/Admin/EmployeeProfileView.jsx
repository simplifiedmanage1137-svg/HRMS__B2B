// src/components/Admin/EmployeeProfileView.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Badge, Spinner, Alert } from 'react-bootstrap';
import { 
    FaUser, FaEnvelope, FaPhone, FaCalendar, FaMapMarker, 
    FaBriefcase, FaUniversity, FaCreditCard, FaIdCard, 
    FaUserTie, FaHeart, FaFileAlt, FaTimes, FaEdit 
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNavigate } from 'react-router-dom';

const EmployeeProfileView = ({ show, onHide, employeeId }) => {
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show && employeeId) {
            fetchEmployeeDetails();
        }
    }, [show, employeeId]);

    const fetchEmployeeDetails = async () => {
        try {
            setLoading(true);
            setError('');
            console.log('📤 Fetching employee details for ID:', employeeId);
            
            const response = await axios.get(API_ENDPOINTS.EMPLOYEE_BY_ID(employeeId));
            console.log('✅ Employee data received:', response.data);
            
            // Log specific fields to debug
            console.log('📞 Phone from API:', response.data.phone);
            console.log('🏦 Bank Name from API:', response.data.bank_name);
            console.log('🏦 Account Number from API:', response.data.account_number);
            
            setEmployee(response.data);
        } catch (error) {
            console.error('❌ Error fetching employee details:', error);
            setError(error.response?.data?.message || 'Failed to load employee details');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = () => {
        onHide();
        navigate(`/admin/edit-employee/${employeeId}`);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatCurrency = (amount) => {
        if (!amount) return 'N/A';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const getDisplayName = () => {
        if (!employee) return '';
        return `${employee.first_name || ''} ${employee.middle_name || ''} ${employee.last_name || ''}`.trim();
    };

    return (
        <Modal 
            show={show} 
            onHide={onHide} 
            size="xl" 
            centered 
            scrollable
            dialogClassName="mx-2 mx-md-auto"
        >
            <Modal.Header closeButton className="bg-primary text-white py-2">
                <Modal.Title as="h5" className="mb-0 d-flex align-items-center">
                    <FaUser className="me-2" /> 
                    <span className="text-truncate">Employee Profile</span>
                </Modal.Title>
            </Modal.Header>
            
            <Modal.Body className="p-0" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2 text-muted small">Loading employee details...</p>
                    </div>
                ) : error ? (
                    <Alert variant="danger" className="m-3">
                        {error}
                    </Alert>
                ) : !employee ? (
                    <Alert variant="warning" className="m-3">
                        No employee data found
                    </Alert>
                ) : (
                    <div className="p-2 p-md-3">
                        {/* Header with Employee Name and ID - Responsive */}
                        <div className="bg-light p-2 p-md-3 rounded mb-3">
                            <Row className="align-items-center g-2">
                                <Col xs={12} sm={8} md={9}>
                                    <h4 className="mb-1 text-truncate">
                                        {getDisplayName()}
                                    </h4>
                                    <p className="mb-0 text-muted small d-flex flex-wrap align-items-center gap-2">
                                        <Badge bg="secondary" className="me-1">ID: {employee.employee_id}</Badge>
                                        <Badge bg="info">{employee.employment_type || 'Full Time'}</Badge>
                                    </p>
                                </Col>
                                <Col xs={12} sm={4} md={3} className="text-sm-end">
                                    <Button 
                                        variant="outline-primary" 
                                        size="sm"
                                        onClick={handleEdit}
                                        className="w-100 w-sm-auto"
                                    >
                                        <FaEdit className="me-1" /> Edit
                                    </Button>
                                </Col>
                            </Row>
                        </div>

                        {/* Personal Information */}
                        <div className="mb-3">
                            <h6 className="border-bottom pb-2 mb-3 d-flex align-items-center">
                                <FaUser className="me-2 text-primary" size={14} />
                                Personal Information
                            </h6>
                            <Row className="g-2">
                                <Col xs={12} md={4} className="mb-2">
                                    <small className="text-muted d-block">Full Name</small>
                                    <span className="fw-semibold d-block text-wrap">
                                        {getDisplayName()}
                                    </span>
                                </Col>
                                <Col xs={6} md={4} className="mb-2">
                                    <small className="text-muted d-block">Date of Birth</small>
                                    <span className="fw-semibold">{formatDate(employee.dob)}</span>
                                </Col>
                                <Col xs={6} md={4} className="mb-2">
                                    <small className="text-muted d-block">Blood Group</small>
                                    <span className="fw-semibold">{employee.blood_group || 'N/A'}</span>
                                </Col>
                            </Row>
                        </div>

                        {/* Contact Information */}
                        <div className="mb-3">
                            <h6 className="border-bottom pb-2 mb-3 d-flex align-items-center">
                                <FaEnvelope className="me-2 text-primary" size={14} />
                                Contact Information
                            </h6>
                            <Row className="g-2">
                                <Col xs={12} md={6} className="mb-2">
                                    <small className="text-muted d-block">Email Address</small>
                                    <span className="fw-semibold d-block text-truncate" title={employee.email}>
                                        {employee.email || 'N/A'}
                                    </span>
                                </Col>
                                <Col xs={12} md={6} className="mb-2">
                                    <small className="text-muted d-block">Phone Number</small>
                                    <span className="fw-semibold">
                                        {employee.phone ? employee.phone : 'N/A'}
                                    </span>
                                </Col>
                            </Row>
                        </div>

                        {/* Address */}
                        {(employee.address || employee.city || employee.state || employee.pincode) && (
                            <div className="mb-3">
                                <h6 className="border-bottom pb-2 mb-3 d-flex align-items-center">
                                    <FaMapMarker className="me-2 text-primary" size={14} />
                                    Address
                                </h6>
                                <Row className="g-2">
                                    <Col xs={12} className="mb-2">
                                        <span className="fw-semibold d-block text-wrap">{employee.address || ''}</span>
                                    </Col>
                                    {(employee.city || employee.state || employee.pincode) && (
                                        <Col xs={12}>
                                            <small className="text-muted d-block text-wrap">
                                                {[employee.city, employee.state, employee.pincode].filter(Boolean).join(', ')}
                                            </small>
                                        </Col>
                                    )}
                                </Row>
                            </div>
                        )}

                        {/* Employment Details */}
                        <div className="mb-3">
                            <h6 className="border-bottom pb-2 mb-3 d-flex align-items-center">
                                <FaBriefcase className="me-2 text-primary" size={14} />
                                Employment Details
                            </h6>
                            <Row className="g-2">
                                <Col xs={6} md={4} className="mb-2">
                                    <small className="text-muted d-block">Designation</small>
                                    <span className="fw-semibold text-truncate d-block" title={employee.designation}>
                                        {employee.designation || 'N/A'}
                                    </span>
                                </Col>
                                <Col xs={6} md={4} className="mb-2">
                                    <small className="text-muted d-block">Department</small>
                                    <span className="fw-semibold text-truncate d-block" title={employee.department}>
                                        {employee.department || 'N/A'}
                                    </span>
                                </Col>
                                <Col xs={6} md={4} className="mb-2">
                                    <small className="text-muted d-block">Joining Date</small>
                                    <span className="fw-semibold">{formatDate(employee.joining_date)}</span>
                                </Col>
                                <Col xs={6} md={4} className="mb-2">
                                    <small className="text-muted d-block">Employment Type</small>
                                    <span className="fw-semibold">{employee.employment_type || 'Full Time'}</span>
                                </Col>
                                <Col xs={6} md={4} className="mb-2">
                                    <small className="text-muted d-block">Shift Timing</small>
                                    <span className="fw-semibold text-truncate d-block" title={employee.shift_timing}>
                                        {employee.shift_timing || '9:00 AM - 6:00 PM'}
                                    </span>
                                </Col>
                                <Col xs={6} md={4} className="mb-2">
                                    <small className="text-muted d-block">Reporting Manager</small>
                                    <span className="fw-semibold text-truncate d-block" title={employee.reporting_manager}>
                                        {employee.reporting_manager || 'N/A'}
                                    </span>
                                </Col>
                            </Row>
                        </div>

                        {/* Bank Details */}
                        {(employee.bank_name || employee.account_number || employee.ifsc_code || employee.bank_account_name) && (
                            <div className="mb-3">
                                <h6 className="border-bottom pb-2 mb-3 d-flex align-items-center">
                                    <FaUniversity className="me-2 text-primary" size={14} />
                                    Bank Details
                                </h6>
                                <Row className="g-2">
                                    <Col xs={6} md={4} className="mb-2">
                                        <small className="text-muted d-block">Bank Name</small>
                                        <span className="fw-semibold text-truncate d-block" title={employee.bank_name || employee.bank_account_name}>
                                            {employee.bank_name || employee.bank_account_name || 'N/A'}
                                        </span>
                                    </Col>
                                    <Col xs={6} md={4} className="mb-2">
                                        <small className="text-muted d-block">Account Number</small>
                                        <span className="fw-semibold text-truncate d-block" title={employee.account_number}>
                                            {employee.account_number || 'N/A'}
                                        </span>
                                    </Col>
                                    <Col xs={6} md={4} className="mb-2">
                                        <small className="text-muted d-block">IFSC Code</small>
                                        <span className="fw-semibold">{employee.ifsc_code || 'N/A'}</span>
                                    </Col>
                                    <Col xs={6} md={4} className="mb-2">
                                        <small className="text-muted d-block">Branch Name</small>
                                        <span className="fw-semibold text-truncate d-block" title={employee.branch_name}>
                                            {employee.branch_name || 'N/A'}
                                        </span>
                                    </Col>
                                    <Col xs={6} md={4} className="mb-2">
                                        <small className="text-muted d-block">PAN Number</small>
                                        <span className="fw-semibold">{employee.pan_number || 'N/A'}</span>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {/* Salary Information */}
                        {(employee.gross_salary || employee.in_hand_salary) && (
                            <div className="mb-3">
                                <h6 className="border-bottom pb-2 mb-3 d-flex align-items-center">
                                    <FaCreditCard className="me-2 text-primary" size={14} />
                                    Salary Information
                                </h6>
                                <Row className="g-2">
                                    <Col xs={6} md={6} className="mb-2">
                                        <small className="text-muted d-block">Gross Salary</small>
                                        <span className="fw-semibold">{formatCurrency(employee.gross_salary)}</span>
                                    </Col>
                                    <Col xs={6} md={6} className="mb-2">
                                        <small className="text-muted d-block">In Hand Salary</small>
                                        <span className="fw-semibold">{formatCurrency(employee.in_hand_salary)}</span>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {/* Emergency Contact */}
                        {employee.emergency_contact && (
                            <div className="mb-3">
                                <h6 className="border-bottom pb-2 mb-3 d-flex align-items-center">
                                    <FaUserTie className="me-2 text-primary" size={14} />
                                    Emergency Contact
                                </h6>
                                <Row className="g-2">
                                    <Col xs={12} className="mb-2">
                                        <span className="fw-semibold">{employee.emergency_contact}</span>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {/* Documents */}
                        {(employee.aadhar_number || employee.pan_number) && (
                            <div className="mb-3">
                                <h6 className="border-bottom pb-2 mb-3 d-flex align-items-center">
                                    <FaIdCard className="me-2 text-primary" size={14} />
                                    Documents
                                </h6>
                                <Row className="g-2">
                                    <Col xs={6} md={6} className="mb-2">
                                        <small className="text-muted d-block">Aadhar Number</small>
                                        <span className="fw-semibold text-truncate d-block" title={employee.aadhar_number}>
                                            {employee.aadhar_number || 'N/A'}
                                        </span>
                                    </Col>
                                    <Col xs={6} md={6} className="mb-2">
                                        <small className="text-muted d-block">PAN Number</small>
                                        <span className="fw-semibold text-truncate d-block" title={employee.pan_number}>
                                            {employee.pan_number || 'N/A'}
                                        </span>
                                    </Col>
                                </Row>
                            </div>
                        )}
                    </div>
                )}
            </Modal.Body>

            <Modal.Footer className="py-2">
                <Button variant="secondary" size="sm" onClick={onHide}>
                    <FaTimes className="me-1" /> Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default EmployeeProfileView;