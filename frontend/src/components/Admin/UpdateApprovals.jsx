// src/components/Admin/UpdateApprovals.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCheck, FaTimes, FaEye, FaArrowLeft, FaSync } from 'react-icons/fa';

const UpdateApprovals = () => {
  const [completedRequests, setCompletedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  useEffect(() => {
    fetchCompletedRequests();
  }, []);

  const fetchCompletedRequests = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('📤 Fetching completed requests...');
      
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin-updates/completed-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('✅ Response:', response.data);
      
      if (Array.isArray(response.data)) {
        setCompletedRequests(response.data);
        if (response.data.length === 0) {
          setError('No completed requests found');
        } else {
          setError(''); // Clear error if data found
        }
      } else {
        setCompletedRequests([]);
        setError('Unexpected response format');
      }
      
    } catch (err) {
      console.error('❌ Error:', err);
      setError('Failed to load completed requests');
      setCompletedRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      setMessage('');
      setMessageType('');
      console.log('📤 Approving request:', requestId);
      
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/admin-updates/handle-request', 
        {
          request_id: requestId,
          action: 'approve'
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      console.log('✅ Approve response:', response.data);
      
      // Show success message
      setMessageType('success');
      setMessage('Request approved successfully!');
      
      // Close the detail view
      setSelectedRequest(null);
      
      // ✅ IMPORTANT: Wait a moment then refresh the list
      setTimeout(() => {
        fetchCompletedRequests();
      }, 500);
      
    } catch (error) {
      console.error('❌ Error approving:', error);
      setMessageType('error');
      setMessage(error.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleReject = async (requestId) => {
    try {
      setMessage('');
      setMessageType('');
      console.log('📤 Rejecting request:', requestId);
      
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/admin-updates/handle-request', 
        {
          request_id: requestId,
          action: 'reject'
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      console.log('✅ Reject response:', response.data);
      
      setMessageType('success');
      setMessage('Request rejected successfully!');
      
      setSelectedRequest(null);
      
      // ✅ Refresh the list
      setTimeout(() => {
        fetchCompletedRequests();
      }, 500);
      
    } catch (error) {
      console.error('❌ Error rejecting:', error);
      setMessageType('error');
      setMessage(error.response?.data?.message || 'Failed to reject request');
    }
  };

  const handleRefresh = () => {
    fetchCompletedRequests();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p style={{ marginTop: '20px', color: '#666' }}>Loading approvals...</p>
      </div>
    );
  }

  if (selectedRequest) {
    return (
      <div style={{ padding: '20px' }}>
        <button 
          onClick={() => setSelectedRequest(null)}
          style={{
            marginBottom: '20px',
            padding: '8px 15px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <FaArrowLeft /> Back to List
        </button>
        
        <h3 style={{ marginBottom: '20px' }}>Review Update Request</h3>
        
        {message && (
          <div style={{
            padding: '12px',
            marginBottom: '20px',
            backgroundColor: messageType === 'success' ? '#d4edda' : '#f8d7da',
            border: `1px solid ${messageType === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
            color: messageType === 'success' ? '#155724' : '#721c24'
          }}>
            {message}
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '15px'
          }}>
            <h4 style={{ color: '#007bff', marginBottom: '15px' }}>Current Data</h4>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '400px'
            }}>
              {JSON.stringify(selectedRequest.employeeDetails || {}, null, 2)}
            </pre>
          </div>
          
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '15px'
          }}>
            <h4 style={{ color: '#28a745', marginBottom: '15px' }}>Updated Data</h4>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '400px'
            }}>
              {JSON.stringify(selectedRequest.employee_data || {}, null, 2)}
            </pre>
          </div>
        </div>
        
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button 
            onClick={() => handleReject(selectedRequest.id)}
            style={{
              marginRight: '10px',
              padding: '10px 20px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <FaTimes /> Reject
          </button>
          <button 
            onClick={() => handleApprove(selectedRequest.id)}
            style={{
              padding: '10px 20px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <FaCheck /> Approve
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px' 
      }}>
        <h3 style={{ margin: 0 }}>Pending Approvals</h3>
        <button
          onClick={handleRefresh}
          style={{
            padding: '8px 15px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <FaSync /> Refresh
        </button>
      </div>
      
      {message && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: messageType === 'success' ? '#d4edda' : '#f8d7da',
          border: `1px solid ${messageType === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          color: messageType === 'success' ? '#155724' : '#721c24'
        }}>
          {message}
        </div>
      )}
      
      {error && completedRequests.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <p style={{ color: '#666', marginBottom: '20px' }}>{error}</p>
          <button
            onClick={fetchCompletedRequests}
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>
      ) : completedRequests.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <p style={{ color: '#666', marginBottom: '20px' }}>No pending approvals</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>ID</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Employee</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Fields</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Submitted</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {completedRequests.map(req => (
                <tr key={req.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{req.id}</td>
                  <td style={{ padding: '12px' }}>
                    <strong>{req.first_name} {req.last_name}</strong>
                    <br />
                    <small style={{ color: '#666' }}>{req.employee_id}</small>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {req.requested_fields?.map(field => (
                      <span key={field} style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        margin: '2px',
                        background: '#e9ecef',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {field}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {new Date(req.updated_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => setSelectedRequest(req)}
                      style={{
                        padding: '5px 10px',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <FaEye /> Review
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

export default UpdateApprovals;