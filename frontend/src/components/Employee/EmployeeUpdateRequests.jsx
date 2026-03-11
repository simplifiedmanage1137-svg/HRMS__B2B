// src/components/Employee/EmployeeUpdateRequests.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { FaSave, FaArrowLeft, FaEdit, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const EmployeeUpdateRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({});

  // Field definitions with categories
  const fieldDefinitions = {
    personal: {
      label: 'Personal Information',
      fields: [
        { name: 'first_name', label: 'First Name', type: 'text', required: true },
        { name: 'last_name', label: 'Last Name', type: 'text', required: true },
        { name: 'dob', label: 'Date of Birth', type: 'date' },
        { name: 'blood_group', label: 'Blood Group', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] }
      ]
    },
    contact: {
      label: 'Contact Details',
      fields: [
        { name: 'email', label: 'Email Address', type: 'email', required: true },
        { name: 'phone', label: 'Phone Number', type: 'tel', required: true }
      ]
    },
    address: {
      label: 'Address',
      fields: [
        { name: 'address', label: 'Address', type: 'textarea' },
        { name: 'city', label: 'City', type: 'text' },
        { name: 'state', label: 'State', type: 'text' },
        { name: 'pincode', label: 'Pincode', type: 'text' }
      ]
    },
    bank: {
      label: 'Bank Details',
      fields: [
        { name: 'bank_name', label: 'Bank Name', type: 'text' },
        { name: 'account_number', label: 'Account Number', type: 'text' },
        { name: 'ifsc_code', label: 'IFSC Code', type: 'text' },
        { name: 'branch_name', label: 'Branch Name', type: 'text' },
        { name: 'pan_number', label: 'PAN Number', type: 'text' }
      ]
    },
    employment: {
      label: 'Employment Details',
      fields: [
        { name: 'designation', label: 'Designation', type: 'text' },
        { name: 'department', label: 'Department', type: 'text' },
        { name: 'employment_type', label: 'Employment Type', type: 'select', options: ['Full Time', 'Part Time', 'Contract', 'Intern'] },
        { name: 'shift_timing', label: 'Shift Timing', type: 'text' },
        { name: 'reporting_manager', label: 'Reporting Manager', type: 'text' }
      ]
    },
    emergency: {
      label: 'Emergency Contact',
      fields: [
        { name: 'emergency_contact', label: 'Emergency Contact Number', type: 'tel' }
      ]
    },
    documents: {
      label: 'Documents',
      fields: [
        { name: 'aadhar_number', label: 'Aadhar Number', type: 'text' },
        { name: 'pan_number', label: 'PAN Number', type: 'text' }
      ]
    },
    salary: {
      label: 'Salary Information',
      fields: [
        { name: 'gross_salary', label: 'Gross Salary', type: 'number' },
        { name: 'in_hand_salary', label: 'In Hand Salary', type: 'number' }
      ]
    }
  };

  useEffect(() => {
    console.log('👤 User from context:', user);
    if (user?.employeeId) {
      fetchPendingRequests();
    } else {
      console.log('⏳ Waiting for user to load...');
      const timer = setTimeout(() => {
        if (!user) {
          setLoading(false);
          setError('User not loaded. Please refresh the page.');
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('📤 Fetching pending requests for employee:', user?.employeeId);
      
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/employee-updates/pending-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('✅ API Response:', response.data);
      console.log('✅ Response type:', typeof response.data);
      console.log('✅ Is Array:', Array.isArray(response.data));
      
      // Handle different response formats
      let requestsData = [];
      if (Array.isArray(response.data)) {
        requestsData = response.data;
        console.log('📊 Number of requests:', requestsData.length);
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        requestsData = response.data.data;
      } else if (response.data?.requests && Array.isArray(response.data.requests)) {
        requestsData = response.data.requests;
      } else {
        console.warn('⚠️ Unexpected response format:', response.data);
        requestsData = [];
      }
      
      // Parse JSON fields
      const formattedRequests = requestsData.map(req => ({
        ...req,
        requested_fields: req.requested_fields ? 
          (typeof req.requested_fields === 'string' ? JSON.parse(req.requested_fields) : req.requested_fields) : [],
        requested_field_names: req.requested_field_names ? 
          (typeof req.requested_field_names === 'string' ? JSON.parse(req.requested_field_names) : req.requested_field_names) : [],
        employee_data: req.employee_data ? 
          (typeof req.employee_data === 'string' ? JSON.parse(req.employee_data) : req.employee_data) : null
      }));
      
      console.log('📊 Formatted requests:', formattedRequests);
      setRequests(formattedRequests);
      
      if (formattedRequests.length === 0) {
        setError('No pending update requests from admin');
      }
      
    } catch (err) {
      console.error('❌ Error fetching requests:', err);
      console.error('❌ Error response:', err.response?.data);
      setError('Failed to load requests. Please try again.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentEmployeeData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/employees/profile/${user?.employeeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Current employee data:', response.data);
      setFormData(response.data);
    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  };

  const handleAcceptRequest = async (request) => {
    try {
      setSubmitting(true);
      console.log('📤 Accepting request:', request.id);
      
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/employee-updates/accept-request/${request.id}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setSelectedRequest(request);
      await fetchCurrentEmployeeData();
      
    } catch (error) {
      console.error('Error accepting request:', error);
      setError('Failed to accept request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Prepare data - only send fields that were requested
      const updateData = {};
      
      // If we have requested_field_names, use those
      if (selectedRequest.requested_field_names?.length > 0) {
        selectedRequest.requested_field_names.forEach(fieldName => {
          if (formData[fieldName] !== undefined) {
            updateData[fieldName] = formData[fieldName];
          }
        });
      } 
      // Otherwise use requested_fields (categories)
      else if (selectedRequest.requested_fields?.length > 0) {
        selectedRequest.requested_fields.forEach(category => {
          const categoryFields = fieldDefinitions[category]?.fields || [];
          categoryFields.forEach(field => {
            if (formData[field.name] !== undefined) {
              updateData[field.name] = formData[field.name];
            }
          });
        });
      }

      console.log('📤 Submitting update data:', updateData);

      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5000/api/employee-updates/submit-update',
        {
          requestId: selectedRequest.id,
          updatedData: updateData
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setSuccess('Update submitted successfully! Waiting for admin approval.');
      
      // Refresh requests after 2 seconds
      setTimeout(() => {
        setSelectedRequest(null);
        fetchPendingRequests();
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting update:', error);
      setError('Failed to submit update');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if a field should be shown
  const shouldShowField = (category, fieldName) => {
    if (!selectedRequest) return false;
    
    // Check by field names first
    if (selectedRequest.requested_field_names?.includes(fieldName)) {
      return true;
    }
    
    // Check by category
    if (selectedRequest.requested_fields?.includes(category)) {
      return true;
    }
    
    return false;
  };

  // Loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Loading update requests...</p>
        </div>
      </div>
    );
  }

  // Selected request view
  if (selectedRequest) {
    return (
      <div className="container py-4">
        <button
          className="btn btn-link mb-3"
          onClick={() => setSelectedRequest(null)}
        >
          <FaArrowLeft /> Back to Requests
        </button>

        <div className="card">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">Update Request #{selectedRequest.id}</h5>
            <small>
              Fields to update: {selectedRequest.requested_fields?.join(', ')}
            </small>
          </div>
          
          <div className="card-body">
            {success && (
              <div className="alert alert-success">{success}</div>
            )}
            {error && (
              <div className="alert alert-danger">{error}</div>
            )}

            <form onSubmit={handleSubmitUpdate}>
              {/* Show only selected categories */}
              {Object.entries(fieldDefinitions).map(([category, definition]) => {
                // Check if this category has any fields to show
                const hasFieldsToShow = definition.fields.some(field => 
                  shouldShowField(category, field.name)
                );
                
                if (!hasFieldsToShow) return null;

                return (
                  <div key={category} className="mb-4">
                    <h6 className="border-bottom pb-2">{definition.label}</h6>
                    <div className="row">
                      {definition.fields.map(field => {
                        if (!shouldShowField(category, field.name)) return null;

                        return (
                          <div key={field.name} className="col-md-6 mb-3">
                            <label className="form-label">
                              {field.label} {field.required && <span className="text-danger">*</span>}
                            </label>
                            
                            {field.type === 'select' ? (
                              <select
                                className="form-control"
                                name={field.name}
                                value={formData[field.name] || ''}
                                onChange={handleInputChange}
                                required={field.required}
                              >
                                <option value="">Select {field.label}</option>
                                {field.options?.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === 'textarea' ? (
                              <textarea
                                className="form-control"
                                name={field.name}
                                value={formData[field.name] || ''}
                                onChange={handleInputChange}
                                rows="3"
                              />
                            ) : (
                              <input
                                type={field.type}
                                className="form-control"
                                name={field.name}
                                value={formData[field.name] || ''}
                                onChange={handleInputChange}
                                required={field.required}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="text-end">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={submitting}
                >
                  <FaSave /> {submitting ? 'Submitting...' : 'Submit Update for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="container py-4">
      <h4 className="mb-4">Update Requests</h4>

      {error && (
        <div className="alert alert-info">
          {error}
          {error.includes('No pending') && (
            <div className="mt-2">
              <small>You have {requests.length} request(s) but they might be already processed.</small>
            </div>
          )}
        </div>
      )}

      {requests.length > 0 ? (
        <div className="row">
          {requests.map(request => {
            console.log('Rendering request:', request);
            return (
              <div key={request.id} className="col-md-6 mb-3">
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title">
                      Update Request #{request.id}
                      <span className={`badge bg-${request.status === 'pending' ? 'warning' : 'info'} ms-2`}>
                        {request.status}
                      </span>
                    </h5>
                    <p className="card-text">
                      <strong>Fields to Update:</strong><br />
                      {request.requested_fields?.map(field => (
                        <span key={field} className="badge bg-secondary me-1 p-2">
                          {field}
                        </span>
                      ))}
                    </p>
                    <p className="card-text">
                      <strong>Requested on:</strong> {new Date(request.created_at).toLocaleDateString()}
                    </p>
                    {request.notes && (
                      <p className="card-text">
                        <strong>Notes:</strong> {request.notes}
                      </p>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={() => handleAcceptRequest(request)}
                      disabled={submitting}
                    >
                      <FaEdit /> Review & Update Selected Fields
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !error && (
          <div className="text-center py-5">
            <div className="mb-3">
              <FaCheckCircle size={50} className="text-muted" />
            </div>
            <h5>No Pending Update Requests</h5>
            <p className="text-muted">
              You don't have any pending update requests from admin at the moment.
            </p>
          </div>
        )
      )}
    </div>
  );
};

export default EmployeeUpdateRequests;