import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCheck, FaTimes, FaEye } from 'react-icons/fa';

const AdminUpdateApprovals = () => {
  const [completedRequests, setCompletedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchCompletedRequests();
  }, []);

  const fetchCompletedRequests = async () => {
    try {
      const response = await axios.get(
        'http://localhost:5000/api/admin-updates/completed-requests'
      );
      setCompletedRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const handleApprove = async (requestId) => {
    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/admin-updates/handle-request', {
        requestId,
        action: 'approve'
      });
      
      setMessage('Request approved successfully!');
      fetchCompletedRequests();
      setSelectedRequest(null);
    } catch (error) {
      setMessage('Error approving request');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId) => {
    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/admin-updates/handle-request', {
        requestId,
        action: 'reject'
      });
      
      setMessage('Request rejected successfully!');
      fetchCompletedRequests();
      setSelectedRequest(null);
    } catch (error) {
      setMessage('Error rejecting request');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewChanges = (request) => {
    setSelectedRequest(request);
  };

  return (
    <div className="admin-update-approvals">
      <h4 className="mb-4">Pending Update Approvals</h4>

      {message && (
        <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-danger'}`}>
          {message}
        </div>
      )}

      {selectedRequest ? (
        // Show comparison view
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5>
              Update Request - {selectedRequest.employeeDetails?.firstName}{' '}
              {selectedRequest.employeeDetails?.lastName}
            </h5>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setSelectedRequest(null)}
            >
              Back to List
            </button>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <h6 className="text-primary">Current Data</h6>
                <pre className="bg-light p-3 rounded">
                  {JSON.stringify(selectedRequest.employeeDetails, null, 2)}
                </pre>
              </div>
              <div className="col-md-6">
                <h6 className="text-success">Updated Data</h6>
                <pre className="bg-light p-3 rounded">
                  {JSON.stringify(selectedRequest.employeeData, null, 2)}
                </pre>
              </div>
            </div>
            <div className="text-end mt-3">
              <button
                className="btn btn-success me-2"
                onClick={() => handleApprove(selectedRequest._id)}
                disabled={loading}
              >
                <FaCheck /> Approve
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleReject(selectedRequest._id)}
                disabled={loading}
              >
                <FaTimes /> Reject
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Show list of completed requests
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Requested Fields</th>
                <th>Submitted On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {completedRequests.map(request => (
                <tr key={request._id}>
                  <td>
                    {request.employeeDetails?.firstName}{' '}
                    {request.employeeDetails?.lastName}
                    <br />
                    <small className="text-muted">
                      {request.employeeDetails?.designation}
                    </small>
                  </td>
                  <td>{request.requestedFields.join(', ')}</td>
                  <td>
                    {new Date(request.updatedAt).toLocaleDateString()}
                    <br />
                    <small className="text-muted">
                      {new Date(request.updatedAt).toLocaleTimeString()}
                    </small>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-info me-2"
                      onClick={() => viewChanges(request)}
                    >
                      <FaEye /> View Changes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUpdateApprovals;