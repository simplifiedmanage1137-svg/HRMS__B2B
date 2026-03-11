// src/components/Admin/SendUpdateRequest.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaPaperPlane } from 'react-icons/fa';

const SendUpdateRequest = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fieldOptions = [
    { value: 'personal', label: 'Personal Information', fields: ['first_name', 'last_name', 'dob', 'blood_group'] },
    { value: 'contact', label: 'Contact Details', fields: ['email', 'phone'] },
    { value: 'address', label: 'Address', fields: ['address', 'city', 'state', 'pincode'] },
    { value: 'bank', label: 'Bank Details', fields: ['bank_name', 'account_number', 'ifsc_code', 'branch_name', 'pan_number'] },
    { value: 'employment', label: 'Employment Details', fields: ['designation', 'department', 'employment_type', 'shift_timing', 'reporting_manager'] },
    { value: 'emergency', label: 'Emergency Contact', fields: ['emergency_contact'] },
    { value: 'documents', label: 'Documents', fields: ['aadhar_number', 'pan_number'] },
    { value: 'salary', label: 'Salary Information', fields: ['gross_salary', 'in_hand_salary'] }
  ];

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/admin-updates/employees');
      if (Array.isArray(response.data)) {
        setEmployees(response.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleFieldChange = (field) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedEmployee) {
      setMessage('Please select an employee');
      return;
    }

    if (selectedFields.length === 0) {
      setMessage('Please select at least one field to update');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Get full field list for selected categories
      const fieldsToUpdate = [];
      selectedFields.forEach(category => {
        const categoryObj = fieldOptions.find(f => f.value === category);
        if (categoryObj) {
          fieldsToUpdate.push(...categoryObj.fields);
        }
      });

      await axios.post('http://localhost:5000/api/admin-updates/send-request', {
        employee_id: selectedEmployee,
        requested_fields: selectedFields,      // Store categories
        requested_field_names: fieldsToUpdate,  // Store actual field names
        notes: `Please update your ${selectedFields.join(', ')} information.`
      });

      setMessage('Update request sent successfully!');
      setSelectedEmployee('');
      setSelectedFields([]);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error sending request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <h4 className="mb-4">Send Update Request to Employee</h4>

      {message && (
        <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-danger'}`}>
          {message}
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Select Employee</label>
              <select
                className="form-select"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                required
              >
                <option value="">Choose employee...</option>
                {employees.map(emp => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.first_name} {emp.last_name} - {emp.designation} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">Select Fields to Update</label>
              <div className="row">
                {fieldOptions.map(field => (
                  <div key={field.value} className="col-md-4 mb-2">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={field.value}
                        checked={selectedFields.includes(field.value)}
                        onChange={() => handleFieldChange(field.value)}
                      />
                      <label className="form-check-label" htmlFor={field.value}>
                        {field.label}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedFields.length > 0 && (
              <div className="mb-3 p-2 bg-light rounded">
                <small className="text-muted">Selected fields to update:</small>
                <div className="mt-1">
                  {selectedFields.map(field => {
                    const fieldObj = fieldOptions.find(f => f.value === field);
                    return (
                      <span key={field} className="badge bg-info me-2 p-2">
                        {fieldObj?.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="text-end">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                <FaPaperPlane /> {loading ? 'Sending...' : 'Send Update Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SendUpdateRequest;