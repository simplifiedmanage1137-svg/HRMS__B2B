import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { FaEdit, FaSave, FaTimes } from 'react-icons/fa';

const EmployeeUpdateSection = () => {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user?.employeeId) {
      fetchPendingRequests();
    }
  }, [user]);

  const fetchPendingRequests = async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/admin-updates/employee-requests/${user.employeeId}`
      );
      setPendingRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const handleEdit = (request) => {
    setSelectedRequest(request);
    // Fetch current employee data
    fetchCurrentEmployeeData();
  };

  const fetchCurrentEmployeeData = async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/employees/profile/${user.employeeId}`
      );
      setFormData(response.data);
    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await axios.post('http://localhost:5000/api/admin-updates/submit-update', {
        requestId: selectedRequest._id,
        updatedData: formData
      });

      setMessage('Update submitted successfully! Waiting for admin approval.');
      setSelectedRequest(null);
      fetchPendingRequests();
    } catch (error) {
      setMessage('Error submitting update. Please try again.');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!pendingRequests.length) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <h5>No Pending Update Requests</h5>
          <p className="text-muted">
            You don't have any pending update requests from admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-update-section">
      <h4 className="mb-4">Pending Update Requests</h4>

      {message && (
        <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-danger'}`}>
          {message}
        </div>
      )}

      {!selectedRequest ? (
        // Show list of pending requests
        <div className="row">
          {pendingRequests.map(request => (
            <div key={request._id} className="col-md-6 mb-3">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">Update Request #{request._id.slice(-6)}</h6>
                  <p className="card-text">
                    <strong>Status:</strong> {request.status}
                  </p>
                  <p className="card-text">
                    <strong>Fields to Update:</strong>{' '}
                    {request.requestedFields.join(', ')}
                  </p>
                  <p className="card-text">
                    <strong>Requested on:</strong>{' '}
                    {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleEdit(request)}
                  >
                    <FaEdit /> Edit Information
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Show edit form
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5>Edit Your Information</h5>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setSelectedRequest(null)}
            >
              <FaTimes /> Cancel
            </button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {/* Personal Information */}
              <h6 className="mb-3">Personal Information</h6>
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="firstName"
                    value={formData.firstName || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="lastName"
                    value={formData.lastName || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Designation</label>
                  <input
                    type="text"
                    className="form-control"
                    name="designation"
                    value={formData.designation || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    className="form-control"
                    name="department"
                    value={formData.department || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Address */}
              <h6 className="mb-3 mt-4">Address</h6>
              <div className="mb-3">
                <label className="form-label">Address</label>
                <textarea
                  className="form-control"
                  name="address"
                  rows="2"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                />
              </div>

              <div className="row mb-3">
                <div className="col-md-4">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-control"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-control"
                    name="state"
                    value={formData.state || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Pincode</label>
                  <input
                    type="text"
                    className="form-control"
                    name="pincode"
                    value={formData.pincode || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Bank Details */}
              <h6 className="mb-3 mt-4">Bank Details</h6>
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Bank Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="bankName"
                    value={formData.bankName || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    className="form-control"
                    name="accountNumber"
                    value={formData.accountNumber || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">IFSC Code</label>
                  <input
                    type="text"
                    className="form-control"
                    name="ifscCode"
                    value={formData.ifscCode || ''}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">PAN Card</label>
                  <input
                    type="text"
                    className="form-control"
                    name="panNumber"
                    value={formData.panNumber || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="text-end mt-4">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={loading}
                >
                  <FaSave /> {loading ? 'Submitting...' : 'Submit Update for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeUpdateSection;