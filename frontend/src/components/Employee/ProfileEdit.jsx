// src/components/Employee/ProfileEdit.jsx
import React, { useState, useEffect } from 'react';
import { 
  Card, Form, Button, Alert, Spinner, Row, Col, 
  InputGroup, Tab, Nav, ProgressBar 
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { 
  FaSave, 
  FaTimes, 
  FaUser, 
  FaEnvelope, 
  FaPhone, 
  FaMapMarkerAlt, 
  FaBriefcase, 
  FaUniversity, 
  FaCreditCard,
  FaIdCard,
  FaHeartbeat,
  FaInfoCircle,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowLeft,
  FaEdit
} from 'react-icons/fa';

const ProfileEdit = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeTab, setActiveTab] = useState('personal');
    const [validationErrors, setValidationErrors] = useState({});
    
    const [formData, setFormData] = useState({
        // Personal Information
        first_name: '',
        middle_name: '',
        last_name: '',
        dob: '',
        blood_group: '',
        
        // Contact Information
        email: '',
        phone: '',
        
        // Address
        address: '',
        city: '',
        state: '',
        pincode: '',
        
        // Employment Details
        designation: '',
        department: '',
        employment_type: '',
        shift_timing: '',
        reporting_manager: '',
        
        // Bank Details
        bank_account_name: '',
        account_number: '',
        ifsc_code: '',
        branch_name: '',
        pan_number: '',
        aadhar_number: '',
        
        // Emergency Contact
        emergency_contact: '',
        
        // Salary Information
        gross_salary: '',
        in_hand_salary: ''
    });

    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const employmentTypes = ['Full Time', 'Part Time', 'Contract', 'Intern', 'Probation'];

    useEffect(() => {
        fetchEmployeeData();
    }, []);

    const fetchEmployeeData = async () => {
        try {
            setLoading(true);
            const response = await axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(user?.employeeId));
            
            // Populate form data with existing values
            const employeeData = response.data;
            setFormData({
                // Personal Information
                first_name: employeeData.first_name || '',
                middle_name: employeeData.middle_name || '',
                last_name: employeeData.last_name || '',
                dob: employeeData.dob ? employeeData.dob.split('T')[0] : '',
                blood_group: employeeData.blood_group || '',
                
                // Contact Information
                email: employeeData.email || '',
                phone: employeeData.phone || '',
                
                // Address
                address: employeeData.address || '',
                city: employeeData.city || '',
                state: employeeData.state || '',
                pincode: employeeData.pincode || '',
                
                // Employment Details
                designation: employeeData.designation || '',
                department: employeeData.department || '',
                employment_type: employeeData.employment_type || 'Full Time',
                shift_timing: employeeData.shift_timing || '9:00 AM - 6:00 PM',
                reporting_manager: employeeData.reporting_manager || '',
                
                // Bank Details
                bank_account_name: employeeData.bank_account_name || '',
                account_number: employeeData.account_number || '',
                ifsc_code: employeeData.ifsc_code || '',
                branch_name: employeeData.branch_name || '',
                pan_number: employeeData.pan_number || '',
                aadhar_number: employeeData.aadhar_number || '',
                
                // Emergency Contact
                emergency_contact: employeeData.emergency_contact || '',
                
                // Salary Information
                gross_salary: employeeData.gross_salary || '',
                in_hand_salary: employeeData.in_hand_salary || ''
            });
            
            setError('');
        } catch (error) {
            console.error('Error fetching employee data:', error);
            setError(error.response?.data?.message || 'Failed to load profile data');
            showNotification(error.response?.data?.message || 'Failed to load profile data', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear validation error for this field
        if (validationErrors[name]) {
            setValidationErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const errors = {};
        
        // Personal Information validation
        if (!formData.first_name?.trim()) errors.first_name = 'First name is required';
        if (!formData.last_name?.trim()) errors.last_name = 'Last name is required';
        
        // Contact validation
        if (!formData.email?.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Invalid email format';
        }
        
        if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
            errors.phone = 'Phone must be 10 digits';
        }
        
        // PAN validation (optional but must be valid if provided)
        if (formData.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_number)) {
            errors.pan_number = 'Invalid PAN format (e.g., ABCDE1234F)';
        }
        
        // Aadhar validation (optional but must be valid if provided)
        if (formData.aadhar_number && !/^\d{12}$/.test(formData.aadhar_number)) {
            errors.aadhar_number = 'Aadhar must be 12 digits';
        }
        
        // IFSC validation (optional but must be valid if provided)
        if (formData.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc_code)) {
            errors.ifsc_code = 'Invalid IFSC format (e.g., SBIN0012345)';
        }
        
        // Emergency contact validation
        if (formData.emergency_contact && !/^\d{10}$/.test(formData.emergency_contact)) {
            errors.emergency_contact = 'Emergency contact must be 10 digits';
        }
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            showNotification('Please fix the validation errors', 'warning');
            return;
        }
        
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Get employee ID from user object
            const employeeId = user?.employeeId;
            
            await axios.put(API_ENDPOINTS.EMPLOYEE_UPDATE(employeeId), formData);
            
            setSuccess('Profile updated successfully!');
            showNotification('Profile updated successfully!', 'success');
            
            // Redirect to profile view after 2 seconds
            setTimeout(() => {
                navigate('/profile');
            }, 2000);
            
        } catch (error) {
            console.error('Error updating profile:', error);
            const errorMsg = error.response?.data?.message || 'Failed to update profile. Please try again.';
            setError(errorMsg);
            showNotification(errorMsg, 'danger');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        navigate('/profile');
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <div className="text-center">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted small">Loading profile data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                <div>
                    <h5 className="mb-1 d-flex align-items-center">
                        <FaEdit className="me-2 text-primary" />
                        Edit Profile
                    </h5>
                    <p className="text-muted small mb-0">
                        Update your personal and professional information
                    </p>
                </div>
                <Button 
                    variant="outline-secondary" 
                    size="sm"
                    onClick={handleCancel}
                    className="d-inline-flex align-items-center ms-0 ms-md-auto"
                >
                    <FaTimes className="me-2" size={12} />
                    Cancel
                </Button>
            </div>

            {/* Alerts */}
            {error && (
                <Alert variant="danger" onClose={() => setError('')} dismissible className="mb-4 py-2">
                    <div className="d-flex align-items-center">
                        <FaExclamationTriangle className="me-2 flex-shrink-0" />
                        <span className="small">{error}</span>
                    </div>
                </Alert>
            )}

            {success && (
                <Alert variant="success" onClose={() => setSuccess('')} dismissible className="mb-4 py-2">
                    <div className="d-flex align-items-center">
                        <FaCheckCircle className="me-2 flex-shrink-0" />
                        <span className="small">{success}</span>
                    </div>
                </Alert>
            )}

            {/* Main Form Card */}
            <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white py-2 py-md-3 border-0 overflow-auto">
                    <Nav variant="tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="border-0 flex-nowrap" style={{ minWidth: '600px' }}>
                        <Nav.Item>
                            <Nav.Link eventKey="personal" className="small text-nowrap">
                                <FaUser className="me-2" size={12} />
                                Personal
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="contact" className="small text-nowrap">
                                <FaEnvelope className="me-2" size={12} />
                                Contact
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="address" className="small text-nowrap">
                                <FaMapMarkerAlt className="me-2" size={12} />
                                Address
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="employment" className="small text-nowrap">
                                <FaBriefcase className="me-2" size={12} />
                                Employment
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="bank" className="small text-nowrap">
                                <FaUniversity className="me-2" size={12} />
                                Bank
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="emergency" className="small text-nowrap">
                                <FaHeartbeat className="me-2" size={12} />
                                Emergency
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                </Card.Header>

                <Card.Body className="p-2 p-md-3 p-lg-4">
                    <Form onSubmit={handleSubmit}>
                        {/* Personal Information Tab */}
                        {activeTab === 'personal' && (
                            <div>
                                <h6 className="mb-3 small">Personal Information</h6>
                                <Row className="g-2">
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">
                                                First Name <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="first_name"
                                                value={formData.first_name}
                                                onChange={handleChange}
                                                isInvalid={!!validationErrors.first_name}
                                                size="sm"
                                            />
                                            <Form.Control.Feedback type="invalid">
                                                {validationErrors.first_name}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Middle Name</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="middle_name"
                                                value={formData.middle_name}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">
                                                Last Name <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="last_name"
                                                value={formData.last_name}
                                                onChange={handleChange}
                                                isInvalid={!!validationErrors.last_name}
                                                size="sm"
                                            />
                                            <Form.Control.Feedback type="invalid">
                                                {validationErrors.last_name}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Row className="g-2">
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Date of Birth</Form.Label>
                                            <Form.Control
                                                type="date"
                                                name="dob"
                                                value={formData.dob}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Blood Group</Form.Label>
                                            <Form.Select
                                                name="blood_group"
                                                value={formData.blood_group}
                                                onChange={handleChange}
                                                size="sm"
                                            >
                                                <option value="">Select Blood Group</option>
                                                {bloodGroups.map(bg => (
                                                    <option key={bg} value={bg}>{bg}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {/* Contact Information Tab */}
                        {activeTab === 'contact' && (
                            <div>
                                <h6 className="mb-3 small">Contact Information</h6>
                                <Row className="g-2">
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">
                                                Email <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                isInvalid={!!validationErrors.email}
                                                size="sm"
                                            />
                                            <Form.Control.Feedback type="invalid">
                                                {validationErrors.email}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Phone</Form.Label>
                                            <Form.Control
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                isInvalid={!!validationErrors.phone}
                                                size="sm"
                                                placeholder="10 digit mobile number"
                                            />
                                            <Form.Control.Feedback type="invalid">
                                                {validationErrors.phone}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {/* Address Tab */}
                        {activeTab === 'address' && (
                            <div>
                                <h6 className="mb-3 small">Address</h6>
                                <Form.Group className="mb-2 mb-md-3">
                                    <Form.Label className="small fw-semibold">Address</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>

                                <Row className="g-2">
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">City</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="city"
                                                value={formData.city}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">State</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="state"
                                                value={formData.state}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Pincode</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="pincode"
                                                value={formData.pincode}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {/* Employment Details Tab */}
                        {activeTab === 'employment' && (
                            <div>
                                <h6 className="mb-3 small">Employment Details</h6>
                                <Row className="g-2">
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Designation</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="designation"
                                                value={formData.designation}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Department</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="department"
                                                value={formData.department}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Row className="g-2">
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Employment Type</Form.Label>
                                            <Form.Select
                                                name="employment_type"
                                                value={formData.employment_type}
                                                onChange={handleChange}
                                                size="sm"
                                            >
                                                {employmentTypes.map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Shift Timing</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="shift_timing"
                                                value={formData.shift_timing}
                                                onChange={handleChange}
                                                size="sm"
                                                placeholder="9:00 AM - 6:00 PM"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Form.Group className="mb-2 mb-md-3">
                                    <Form.Label className="small fw-semibold">Reporting Manager</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="reporting_manager"
                                        value={formData.reporting_manager}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </div>
                        )}

                        {/* Bank Details Tab */}
                        {activeTab === 'bank' && (
                            <div>
                                <h6 className="mb-3 small">Bank Details</h6>
                                <Row className="g-2">
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Account Holder Name</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="bank_account_name"
                                                value={formData.bank_account_name}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Account Number</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="account_number"
                                                value={formData.account_number}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Row className="g-2">
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">IFSC Code</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="ifsc_code"
                                                value={formData.ifsc_code}
                                                onChange={handleChange}
                                                isInvalid={!!validationErrors.ifsc_code}
                                                size="sm"
                                                placeholder="e.g., SBIN0012345"
                                            />
                                            <Form.Control.Feedback type="invalid">
                                                {validationErrors.ifsc_code}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">Branch Name</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="branch_name"
                                                value={formData.branch_name}
                                                onChange={handleChange}
                                                size="sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-2 mb-md-3">
                                            <Form.Label className="small fw-semibold">PAN Number</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="pan_number"
                                                value={formData.pan_number}
                                                onChange={handleChange}
                                                isInvalid={!!validationErrors.pan_number}
                                                size="sm"
                                                placeholder="e.g., ABCDE1234F"
                                            />
                                            <Form.Control.Feedback type="invalid">
                                                {validationErrors.pan_number}
                                            </Form.Control.Feedback>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Form.Group className="mb-2 mb-md-3">
                                    <Form.Label className="small fw-semibold">Aadhar Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="aadhar_number"
                                        value={formData.aadhar_number}
                                        onChange={handleChange}
                                        isInvalid={!!validationErrors.aadhar_number}
                                        size="sm"
                                        placeholder="12 digit Aadhar number"
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        {validationErrors.aadhar_number}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </div>
                        )}

                        {/* Emergency Contact Tab */}
                        {activeTab === 'emergency' && (
                            <div>
                                <h6 className="mb-3 small">Emergency Contact</h6>
                                <Form.Group className="mb-2 mb-md-3">
                                    <Form.Label className="small fw-semibold">Emergency Contact Number</Form.Label>
                                    <Form.Control
                                        type="tel"
                                        name="emergency_contact"
                                        value={formData.emergency_contact}
                                        onChange={handleChange}
                                        isInvalid={!!validationErrors.emergency_contact}
                                        size="sm"
                                        placeholder="10 digit mobile number"
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        {validationErrors.emergency_contact}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </div>
                        )}

                        {/* Form Actions */}
                        <div className="d-flex flex-column flex-sm-row justify-content-end gap-2 mt-4">
                            <Button
                                type="button"
                                variant="outline-secondary"
                                size="sm"
                                onClick={handleCancel}
                                className="order-2 order-sm-1"
                            >
                                <FaTimes className="me-2" size={12} />
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                disabled={saving}
                                className="d-inline-flex align-items-center justify-content-center order-1 order-sm-2"
                            >
                                {saving ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2" />
                                        <span className="d-none d-sm-inline">Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaSave className="me-2" size={12} />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Validation Summary */}
                        {Object.keys(validationErrors).length > 0 && (
                            <Alert variant="warning" className="mt-3 py-2 small">
                                <div className="d-flex align-items-center">
                                    <FaInfoCircle className="me-2 flex-shrink-0" size={12} />
                                    <span>Please fix the validation errors before saving</span>
                                </div>
                            </Alert>
                        )}
                    </Form>
                </Card.Body>
            </Card>
        </div>
    );
};

export default ProfileEdit;