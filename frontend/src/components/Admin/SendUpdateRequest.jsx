// src/components/Admin/SendUpdateRequest.jsx
import React, { useState, useEffect } from 'react';
import {
  Card, Form, Button, Alert, Spinner, Badge,
  Row, Col, InputGroup
} from 'react-bootstrap';
import {
  FaPaperPlane, FaUser, FaInfoCircle, FaCheckCircle,
  FaTimesCircle, FaSearch, FaFilter, FaBriefcase,
  FaEnvelope, FaPhone, FaMapMarkerAlt, FaUniversity,
  FaCalendarAlt, FaClock, FaUserTie, FaFileAlt,
  FaCreditCard, FaHeartbeat
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

const SendUpdateRequest = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const fieldOptions = [
    {
      value: 'personal',
      label: 'Personal Information',
      icon: <FaUser className="text-primary" />,
      fields: ['first_name', 'last_name', 'dob', 'blood_group']
    },
    {
      value: 'contact',
      label: 'Contact Details',
      icon: <FaEnvelope className="text-info" />,
      fields: ['email', 'phone']
    },
    {
      value: 'address',
      label: 'Address',
      icon: <FaMapMarkerAlt className="text-danger" />,
      fields: ['address', 'city', 'state', 'pincode']
    },
    {
      value: 'bank',
      label: 'Bank Details',
      icon: <FaUniversity className="text-warning" />,
      fields: ['bank_account_name', 'account_number', 'ifsc_code', 'branch_name', 'pan_number']
    },
    {
      value: 'employment',
      label: 'Employment Details',
      icon: <FaBriefcase className="text-secondary" />,
      fields: ['designation', 'department', 'employment_type', 'shift_timing', 'reporting_manager']
    },
    {
      value: 'emergency',
      label: 'Emergency Contact',
      icon: <FaHeartbeat className="text-danger" />,
      fields: ['emergency_contact']
    },
    {
      value: 'documents',
      label: 'Documents',
      icon: <FaFileAlt className="text-success" />,
      fields: ['aadhar_number', 'pan_number']
    },
    {
      value: 'salary',
      label: 'Salary Information',
      icon: <FaCreditCard className="text-success" />,
      fields: ['gross_salary', 'in_hand_salary']
    }
  ];

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Apply filters whenever searchTerm, departmentFilter, or employees change
  useEffect(() => {
    applyFilters();
  }, [searchTerm, departmentFilter, employees]);

  const fetchEmployees = async () => {
    try {
      setFetching(true);
      console.log('📡 Fetching employees from:', API_ENDPOINTS.ADMIN_UPDATES_EMPLOYEES);

      const response = await axios.get(API_ENDPOINTS.ADMIN_UPDATES_EMPLOYEES);

      console.log('✅ API Response:', response);
      console.log('📦 Response data:', response.data);
      console.log('📦 Data type:', typeof response.data);
      console.log('📦 Is array?', Array.isArray(response.data));

      if (Array.isArray(response.data)) {
        setEmployees(response.data);
        setFilteredEmployees(response.data);
        console.log(`✅ Loaded ${response.data.length} employees`);
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        setEmployees(response.data.data);
        setFilteredEmployees(response.data.data);
      } else {
        console.warn('Unexpected response format:', response.data);
        setEmployees([]);
        setFilteredEmployees([]);
      }

      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('❌ Error fetching employees:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to load employees'
      });
    } finally {
      setFetching(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...employees];

    // Apply search filter
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(emp => {
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
        const employeeId = (emp.employee_id || '').toLowerCase();
        const department = (emp.department || '').toLowerCase();
        const designation = (emp.designation || '').toLowerCase();

        return fullName.includes(term) ||
          employeeId.includes(term) ||
          department.includes(term) ||
          designation.includes(term);
      });
    }

    // Apply department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(emp => emp.department === departmentFilter);
    }

    setFilteredEmployees(filtered);
  };

  const departments = ['all', ...new Set(employees.map(emp => emp.department).filter(Boolean))];

  const handleFieldChange = (field) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleSelectAll = () => {
    if (selectedFields.length === fieldOptions.length) {
      setSelectedFields([]);
    } else {
      setSelectedFields(fieldOptions.map(f => f.value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedEmployee) {
      setMessage({
        type: 'danger',
        text: 'Please select an employee'
      });
      return;
    }

    if (selectedFields.length === 0) {
      setMessage({
        type: 'danger',
        text: 'Please select at least one field to update'
      });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Get full field list for selected categories
      const fieldsToUpdate = [];
      selectedFields.forEach(category => {
        const categoryObj = fieldOptions.find(f => f.value === category);
        if (categoryObj) {
          fieldsToUpdate.push(...categoryObj.fields);
        }
      });

      const response = await axios.post(API_ENDPOINTS.ADMIN_UPDATES_SEND_REQUEST, {
        employee_id: selectedEmployee,
        requested_fields: selectedFields,      // Store categories
        requested_field_names: fieldsToUpdate,  // Store actual field names
        notes: `Please update your ${selectedFields.map(f => {
          const fieldObj = fieldOptions.find(opt => opt.value === f);
          return fieldObj?.label || f;
        }).join(', ')} information.`
      });

      setMessage({
        type: 'success',
        text: 'Update request sent successfully!'
      });

      // Reset form
      setSelectedEmployee('');
      setSelectedFields([]);
      setSearchTerm('');
      setDepartmentFilter('all');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);

    } catch (error) {
      console.error('Error sending request:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Error sending request'
      });
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setDepartmentFilter('all');
  };

  return (
    <div className="p-2 p-md-3 p-lg-4">
      {/* Header - Responsive */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <h5 className="mb-0 d-flex align-items-center">
          <FaPaperPlane className="me-2 text-primary" />
          Send Update Request to Employee
        </h5>
        <Badge bg="info" pill className="px-3 py-2 ms-0 ms-md-auto">
          {filteredEmployees.length} Employees Available
        </Badge>
      </div>

      {/* Message Alert - Responsive */}
      {message.text && (
        <Alert
          variant={message.type}
          onClose={() => setMessage({ type: '', text: '' })}
          dismissible
          className="mb-4 py-2"
        >
          <div className="d-flex align-items-center">
            {message.type === 'success' && <FaCheckCircle className="me-2 flex-shrink-0" size={14} />}
            {message.type === 'danger' && <FaTimesCircle className="me-2 flex-shrink-0" size={14} />}
            <span className="small">{message.text}</span>
          </div>
        </Alert>
      )}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-light py-2 py-md-3">
          <h6 className="mb-0">Request Information Update</h6>
        </Card.Header>
        <Card.Body className="p-2 p-md-3">
          <Form onSubmit={handleSubmit}>
            {/* Employee Selection with Search */}
            <Form.Group className="mb-4">
              <Form.Label className="fw-semibold small d-flex align-items-center">
                <FaUser className="me-2 text-primary" size={14} />
                Select Employee
              </Form.Label>

              {/* Search and Filter - Responsive */}
              <Row className="mb-3 g-2">
                <Col xs={12} md={8}>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-light border-0">
                      <FaSearch size={12} className="text-muted" />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Search by name, ID, department..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border-0 bg-light"
                    />
                    {searchTerm && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setSearchTerm('')}
                        className="border-0"
                      >
                        <FaTimesCircle size={12} />
                      </Button>
                    )}
                  </InputGroup>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Select
                    size="sm"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="bg-light border-0"
                  >
                    <option value="all">All Departments</option>
                    {departments.filter(d => d !== 'all').map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>

              {/* Employee Dropdown */}
              <Form.Select
                size="sm"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                required
                disabled={fetching}
                className="mb-2"
              >
                <option value="">-- Choose an employee --</option>
                {filteredEmployees.map(emp => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.first_name} {emp.last_name} - {emp.designation || 'N/A'} ({emp.employee_id})
                  </option>
                ))}
              </Form.Select>

              {/* Filter Info - Responsive */}
              {(searchTerm || departmentFilter !== 'all') && (
                <div className="mt-2 d-flex flex-wrap align-items-center gap-2">
                  <small className="text-muted">Active filters:</small>
                  {departmentFilter !== 'all' && (
                    <Badge bg="info" className="px-2 py-1">
                      Dept: {departmentFilter}
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
                    onClick={clearSearch}
                    className="p-0 ms-2"
                  >
                    Clear filters
                  </Button>
                </div>
              )}

              {fetching && (
                <div className="text-center py-2">
                  <Spinner size="sm" animation="border" variant="primary" />
                  <small className="ms-2 text-muted">Loading employees...</small>
                </div>
              )}
            </Form.Group>

            {/* Fields Selection */}
            <Form.Group className="mb-4">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-2 gap-2">
                <Form.Label className="fw-semibold small mb-0 d-flex align-items-center">
                  <FaInfoCircle className="me-2 text-primary" size={14} />
                  Select Fields to Update
                </Form.Label>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleSelectAll}
                  className="ms-0 ms-sm-auto"
                >
                  {selectedFields.length === fieldOptions.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <Row className="g-2">
                {fieldOptions.map(field => (
                  <Col xs={12} sm={6} lg={3} key={field.value} className="mb-2">
                    <div className={`p-2 rounded border h-100 ${selectedFields.includes(field.value) ? 'bg-primary bg-opacity-10 border-primary' : ''}`}>
                      <Form.Check
                        type="checkbox"
                        id={field.value}
                        checked={selectedFields.includes(field.value)}
                        onChange={() => handleFieldChange(field.value)}
                        label={
                          <span className="d-flex align-items-center">
                            <span className="me-2 flex-shrink-0">{field.icon}</span>
                            <span className="small text-wrap">{field.label}</span>
                          </span>
                        }
                      />
                    </div>
                  </Col>
                ))}
              </Row>
            </Form.Group>

            {/* Selected Fields Summary - Responsive */}
            {selectedFields.length > 0 && (
              <div className="mb-4 p-2 p-md-3 bg-light rounded">
                <div className="d-flex align-items-center mb-2">
                  <FaCheckCircle className="text-success me-2 flex-shrink-0" size={14} />
                  <small className="fw-semibold">Selected fields to update:</small>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {selectedFields.map(field => {
                    const fieldObj = fieldOptions.find(f => f.value === field);
                    return (
                      <Badge
                        key={field}
                        bg="info"
                        className="px-2 px-md-3 py-1 py-md-2 d-flex align-items-center"
                      >
                        <span className="me-1">{fieldObj?.icon}</span>
                        <span className="small">{fieldObj?.label}</span>
                      </Badge>
                    );
                  })}
                </div>
                <small className="text-muted d-block mt-2 small">
                  Total fields to update: {
                    selectedFields.reduce((total, field) => {
                      const fieldObj = fieldOptions.find(f => f.value === field);
                      return total + (fieldObj?.fields.length || 0);
                    }, 0)
                  }
                </small>
              </div>
            )}

            {/* Submit Button - Responsive */}
            <div className="text-center text-md-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={loading || fetching}
                className="px-4 w-100 w-md-auto"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    <span className="d-none d-sm-inline">Sending Request...</span>
                  </>
                ) : (
                  <>
                    <FaPaperPlane className="me-2" size={12} />
                    Send Update Request
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* Info Card - Responsive */}
      <Card className="border-0 shadow-sm mt-4 bg-light">
        <Card.Body className="p-2 p-md-3">
          <div className="d-flex align-items-start gap-2">
            <FaInfoCircle className="text-primary me-2 me-md-3 mt-1 flex-shrink-0" size={20} />
            <div>
              <h6 className="mb-2 small fw-bold">About Update Requests</h6>
              <p className="small text-muted mb-1">
                • Sending an update request will notify the employee to review and update their information.
              </p>
              <p className="small text-muted mb-1">
                • Employees can accept or reject the request from their dashboard.
              </p>
              <p className="small text-muted mb-1">
                • Once approved by the employee, you can review and approve the changes.
              </p>
              <p className="small text-muted mb-0">
                • Track all pending requests in the "Update Approvals" section.
              </p>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default SendUpdateRequest;