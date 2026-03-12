// src/components/Admin/EditEmployee.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Card, Row, Col, Spinner, Alert, Modal, Table, Badge } from 'react-bootstrap';
import { FaSave, FaArrowLeft, FaTrash, FaFileAlt, FaFileImage, FaFilePdf, FaDownload, FaEye } from 'react-icons/fa';
import axios from 'axios';

const EditEmployee = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    
    // Form states
    const [formData, setFormData] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        employee_id: '',
        email: '',
        phone: '',
        joining_date: '',
        designation: '',
        department: '',
        reporting_manager: '',
        employment_type: 'Full Time',
        shift_timing: '9:00 AM - 6:00 PM',
        in_hand_salary: '',
        gross_salary: '',
        bank_account_name: '',
        account_number: '',
        ifsc_code: '',
        branch_name: '',
        pan_number: '',
        aadhar_number: '',
        dob: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        blood_group: '',
        emergency_contact: '',
        contract_policy: ''
    });

    // UI states
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Document states
    const [employeeDocuments, setEmployeeDocuments] = useState([]);
    const [docLoading, setDocLoading] = useState(false);  // ✅ YAHI STATE MISSING THI
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);

    useEffect(() => {
        if (id) {
            fetchEmployeeDetails();
            fetchEmployeeDocuments(); // ✅ Ab yeh kaam karega
        }
    }, [id]);

    const fetchEmployeeDetails = async () => {
        try {
            setLoading(true);
            console.log('📤 Fetching employee details for ID:', id);
            
            const response = await axios.get(`http://localhost:5000/api/employees/${id}`);
            console.log('✅ Employee data:', response.data);
            
            // Format dates for input fields
            const employee = response.data;
            setFormData({
                ...employee,
                joining_date: employee.joining_date ? employee.joining_date.split('T')[0] : '',
                dob: employee.dob ? employee.dob.split('T')[0] : ''
            });
            
        } catch (error) {
            console.error('❌ Error fetching employee:', error);
            setError('Failed to load employee details');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployeeDocuments = async () => {
        try {
            setDocLoading(true);  // ✅ Ab defined hai
            console.log('📄 Fetching documents for employee ID:', id);
            
            const response = await axios.get(`http://localhost:5000/api/employees/${id}/documents`);
            console.log('✅ Documents response:', response.data);
            
            // Process documents - filter out null/empty values
            const docs = Object.entries(response.data)
                .filter(([key, value]) => value && value !== 'null' && value !== '')
                .map(([key, value]) => ({
                    type: key,
                    filename: value,
                    displayName: formatDocumentName(key),
                    icon: getDocumentIcon(key, value)
                }));
            
            setEmployeeDocuments(docs);
            
        } catch (error) {
            console.error('❌ Error fetching documents:', error);
            // Don't show error to user, just set empty documents
            setEmployeeDocuments([]);
        } finally {
            setDocLoading(false);  // ✅ Ab defined hai
        }
    };

    const formatDocumentName = (type) => {
        const names = {
            'profile_image': 'Profile Image',
            'appointment_letter': 'Appointment Letter',
            'offer_letter': 'Offer Letter',
            'contract_document': 'Contract Document',
            'aadhar_card': 'Aadhar Card',
            'pan_card': 'PAN Card',
            'resume': 'Resume',
            'salary_slip': 'Salary Slip',
            'bank_proof': 'Bank Proof',
            'education_certificates': 'Education Certificates',
            'experience_certificates': 'Experience Certificates'
        };
        return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getDocumentIcon = (type, filename) => {
        if (!filename) return <FaFileAlt className="text-secondary" size={20} />;
        
        const ext = filename.split('.').pop().toLowerCase();
        
        if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return <FaFileImage className="text-primary" size={20} />;
        }
        if (ext === 'pdf') {
            return <FaFilePdf className="text-danger" size={20} />;
        }
        return <FaFileAlt className="text-secondary" size={20} />;
    };

    const handleViewDocument = (doc) => {
        setSelectedDocument(doc);
        setShowDocumentModal(true);
    };

    const handleDownloadDocument = async (doc) => {
        try {
            const response = await axios.get(
                `http://localhost:5000/api/employees/${formData.employee_id}/documents/${doc.type}`,
                {
                    responseType: 'blob',
                    headers: { 'Accept': '*/*' }
                }
            );

            const blob = new Blob([response.data], { 
                type: response.headers['content-type'] || 'application/octet-stream' 
            });
            
            const url = window.URL.createObjectURL(blob);
            const link = window.document.createElement('a');
            link.href = url;
            link.setAttribute('download', doc.filename);
            window.document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                window.document.body.removeChild(link);
            }, 100);

        } catch (error) {
            console.error('Error downloading document:', error);
            alert('Failed to download document');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await axios.put(`http://localhost:5000/api/employees/${id}`, formData);
            setSuccess('Employee updated successfully!');
            
            // Redirect after 2 seconds
            setTimeout(() => {
                navigate('/admin/employees');
            }, 2000);
            
        } catch (error) {
            console.error('Error updating employee:', error);
            setError('Failed to update employee');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="text-center">
                    <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                    <p className="mt-3 text-muted">Loading employee details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => navigate('/admin/employees')}
                        className="me-3"
                    >
                        <FaArrowLeft className="me-2" /> Back
                    </Button>
                    <h4 className="d-inline-block mb-0">Edit Employee</h4>
                </div>
                
              
            </div>

            {/* Messages */}
            {error && (
                <Alert variant="danger" onClose={() => setError('')} dismissible>
                    {error}
                </Alert>
            )}
            {success && (
                <Alert variant="success" onClose={() => setSuccess('')} dismissible>
                    {success}
                </Alert>
            )}

            {/* Edit Form */}
            <Card>
                <Card.Body>
                    <Form onSubmit={handleSubmit}>
                        {/* Personal Information */}
                        <h5 className="mb-3">Personal Information</h5>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>First Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Middle Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="middle_name"
                                        value={formData.middle_name}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Last Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Employee ID <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="employee_id"
                                        value={formData.employee_id}
                                        onChange={handleChange}
                                        required
                                        disabled
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Date of Birth</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="dob"
                                        value={formData.dob}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Blood Group</Form.Label>
                                    <Form.Select
                                        name="blood_group"
                                        value={formData.blood_group}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Blood Group</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>

                        {/* Contact Information */}
                        <h5 className="mb-3 mt-4">Contact Information</h5>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Phone <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        {/* Address */}
                        <h5 className="mb-3 mt-4">Address</h5>
                        <Row className="mb-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label>Address</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>City</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>State</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="state"
                                        value={formData.state}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Pincode</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="pincode"
                                        value={formData.pincode}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        {/* Employment Details */}
                        <h5 className="mb-3 mt-4">Employment Details</h5>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Designation <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="designation"
                                        value={formData.designation}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Department <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Joining Date <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="joining_date"
                                        value={formData.joining_date}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Employment Type</Form.Label>
                                    <Form.Select
                                        name="employment_type"
                                        value={formData.employment_type}
                                        onChange={handleChange}
                                    >
                                        <option value="Full Time">Full Time</option>
                                        <option value="Part Time">Part Time</option>
                                        <option value="Contract">Contract</option>
                                        <option value="Intern">Intern</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Shift Timing</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="shift_timing"
                                        value={formData.shift_timing}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Reporting Manager</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="reporting_manager"
                                        value={formData.reporting_manager}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        {/* Bank Details */}
                        <h5 className="mb-3 mt-4">Bank Details</h5>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Bank Account Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="bank_account_name"
                                        value={formData.bank_account_name}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Account Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="account_number"
                                        value={formData.account_number}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>IFSC Code</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="ifsc_code"
                                        value={formData.ifsc_code}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Branch Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="branch_name"
                                        value={formData.branch_name}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>PAN Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="pan_number"
                                        value={formData.pan_number}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Aadhar Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="aadhar_number"
                                        value={formData.aadhar_number}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        {/* Salary Information */}
                        <h5 className="mb-3 mt-4">Salary Information</h5>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Gross Salary</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="gross_salary"
                                        value={formData.gross_salary}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>In Hand Salary</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="in_hand_salary"
                                        value={formData.in_hand_salary}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        {/* Emergency Contact */}
                        <h5 className="mb-3 mt-4">Emergency Contact</h5>
                        <Row className="mb-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label>Emergency Contact Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="emergency_contact"
                                        value={formData.emergency_contact}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        {/* Submit Button */}
                        <div className="text-end mt-4">
                            <Button 
                                type="submit" 
                                variant="primary"
                                disabled={saving}
                            >
                                <FaSave className="me-2" />
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>

            {/* Documents Modal */}
            <Modal show={showDocumentModal} onHide={() => setShowDocumentModal(false)} size="lg" centered>
                <Modal.Header closeButton className="bg-info text-white">
                    <Modal.Title as="h5">
                        <FaFileAlt className="me-2" />
                        Employee Documents: {formData.first_name} {formData.last_name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {docLoading ? (
                        <div className="text-center py-4">
                            <Spinner animation="border" variant="info" />
                            <p className="mt-2 text-muted">Loading documents...</p>
                        </div>
                    ) : employeeDocuments.length > 0 ? (
                        <Table striped hover>
                            <thead>
                                <tr>
                                    <th>Document Type</th>
                                    <th>File Name</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employeeDocuments.map((doc, index) => (
                                    <tr key={index}>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                {doc.icon}
                                                <span className="ms-2 fw-semibold">{doc.displayName}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <small className="text-muted">{doc.filename}</small>
                                        </td>
                                        <td className="text-center">
                                            <Button
                                                variant="outline-info"
                                                size="sm"
                                                onClick={() => handleViewDocument(doc)}
                                                className="me-2"
                                            >
                                                <FaEye /> View
                                            </Button>
                                            <Button
                                                variant="outline-success"
                                                size="sm"
                                                onClick={() => handleDownloadDocument(doc)}
                                            >
                                                <FaDownload /> Download
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <div className="text-center py-4">
                            <FaFileAlt size={40} className="text-muted mb-3" />
                            <p className="text-muted">No documents found for this employee</p>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDocumentModal(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default EditEmployee;