// src/components/Employee/EmployeeDocumentUpload.jsx
import React, { useState, useEffect } from 'react';
import {
  Card, Button, Alert, Spinner, Badge,
  Form, Row, Col, ProgressBar
} from 'react-bootstrap';
import {
  FaUpload,
  FaCheckCircle,
  FaTimesCircle,
  FaFilePdf,
  FaFileWord,
  FaFileImage,
  FaFileAlt,
  FaTrash,
  FaInfoCircle,
  FaArrowLeft,
  FaEye
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const EmployeeDocumentUpload = ({ requestId, documentTypes, onComplete, existingDocuments }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  
  const [files, setFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const [previewUrls, setPreviewUrls] = useState({});

  // Document type icons and labels mapping
  const getDocumentInfo = (docType) => {
    const docs = {
      profile_image: { icon: <FaFileImage className="text-primary" />, label: 'Profile Image', accept: 'image/*' },
      appointment_letter: { icon: <FaFileWord className="text-info" />, label: 'Appointment Letter', accept: '.pdf,.doc,.docx' },
      offer_letter: { icon: <FaFilePdf className="text-danger" />, label: 'Offer Letter', accept: '.pdf,.doc,.docx' },
      contract_document: { icon: <FaFileAlt className="text-secondary" />, label: 'Contract Document', accept: '.pdf,.doc,.docx' },
      aadhar_card: { icon: <FaFileImage className="text-primary" />, label: 'Aadhar Card', accept: 'image/*,.pdf' },
      pan_card: { icon: <FaFileImage className="text-warning" />, label: 'PAN Card', accept: 'image/*,.pdf' },
      bank_proof: { icon: <FaFileAlt className="text-info" />, label: 'Bank Proof', accept: '.pdf,.jpg,.png' },
      education_certificates: { icon: <FaFileAlt className="text-success" />, label: 'Education Certificates', accept: '.pdf,.doc,.docx' },
      experience_certificates: { icon: <FaFileAlt className="text-secondary" />, label: 'Experience Certificates', accept: '.pdf,.doc,.docx' }
    };
    return docs[docType] || { icon: <FaFileAlt className="text-secondary" />, label: docType, accept: '*' };
  };

  useEffect(() => {
    // Cleanup preview URLs on unmount
    return () => {
      Object.values(previewUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const handleFileSelect = (docType, file) => {
    if (file) {
      // Create preview URL for images
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        setPreviewUrls(prev => ({ ...prev, [docType]: previewUrl }));
      }
      
      setFiles(prev => ({ ...prev, [docType]: file }));
      setError('');
    }
  };

  const handleRemoveFile = (docType) => {
    // Revoke preview URL
    if (previewUrls[docType]) {
      URL.revokeObjectURL(previewUrls[docType]);
      setPreviewUrls(prev => {
        const newUrls = { ...prev };
        delete newUrls[docType];
        return newUrls;
      });
    }
    
    setFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[docType];
      return newFiles;
    });
  };

  const uploadDocument = async (docType, file) => {
    const formData = new FormData();
    formData.append(docType, file);

    try {
      setUploadProgress(prev => ({ ...prev, [docType]: 0 }));

      const response = await axios.post(
        API_ENDPOINTS.EMPLOYEE_DOCUMENTS(user.employeeId),
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(prev => ({ ...prev, [docType]: percentCompleted }));
          }
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error(`Error uploading ${docType}:`, error);
      return { success: false, error: error.response?.data?.message || 'Upload failed' };
    }
  };

  const handleSubmit = async () => {
    const selectedFiles = Object.keys(files);
    if (selectedFiles.length === 0) {
      setError('Please select at least one document to upload');
      return;
    }

    setUploading(true);
    setError('');

    const results = [];
    for (const docType of selectedFiles) {
      const result = await uploadDocument(docType, files[docType]);
      results.push({ docType, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      showNotification(
        `${successCount} document(s) uploaded successfully!${failCount > 0 ? ` ${failCount} failed.` : ''}`,
        successCount === results.length ? 'success' : 'warning'
      );
      
      // Submit the update request after successful upload
      await submitUpdateRequest();
      
      setCompleted(true);
      setFiles({});
      
      if (onComplete) {
        onComplete();
      }
    } else {
      setError('Failed to upload documents. Please try again.');
    }

    setUploading(false);
  };

  const submitUpdateRequest = async () => {
    try {
      // Get the uploaded document info to save in request
      const uploadedDocs = {};
      for (const docType of Object.keys(files)) {
        uploadedDocs[docType] = {
          uploaded_at: new Date().toISOString(),
          filename: files[docType].name,
          size: files[docType].size
        };
      }

      // Update the request with document upload info
      await axios.post(API_ENDPOINTS.EMPLOYEE_UPDATES_SUBMIT, {
        requestId,
        updatedData: { documents_uploaded: uploadedDocs },
        isDocumentUpdate: true
      });
      
    } catch (error) {
      console.error('Error updating request with document info:', error);
    }
  };

  if (completed) {
    return (
      <div className="text-center py-4">
        <FaCheckCircle size={50} className="text-success mb-3" />
        <h6 className="mb-2">Documents Uploaded Successfully!</h6>
        <p className="text-muted small mb-3">
          Your documents have been submitted for review.
        </p>
        <Button 
          variant="primary" 
          size="sm"
          onClick={() => navigate('/employee/update-requests')}
        >
          Back to Requests
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h6 className="mb-0">Upload Requested Documents</h6>
          <button
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft size={12} /> Back
          </button>
        </div>
        <p className="text-muted small mb-0">
          Please upload the following documents as requested by admin.
        </p>
      </div>

      {error && (
        <Alert variant="danger" className="py-2 small mb-3">
          <FaTimesCircle className="me-2" size={12} />
          {error}
        </Alert>
      )}

      <Row className="g-3">
        {documentTypes.map(docType => {
          const docInfo = getDocumentInfo(docType);
          const hasExisting = existingDocuments && existingDocuments[docType];
          const selectedFile = files[docType];
          const previewUrl = previewUrls[docType];
          const isImage = previewUrl && selectedFile?.type?.startsWith('image/');

          return (
            <Col xs={12} md={6} key={docType}>
              <Card className={`border-0 shadow-sm h-100 ${selectedFile ? 'bg-light' : ''}`}>
                <Card.Body className="p-2 p-md-3">
                  <div className="d-flex align-items-center mb-2">
                    {docInfo.icon}
                    <h6 className="mb-0 ms-2 small fw-semibold">{docInfo.label}</h6>
                    {hasExisting && !selectedFile && (
                      <Badge bg="success" className="ms-2 small">Uploaded</Badge>
                    )}
                  </div>

                  {/* Preview for existing document */}
                  {hasExisting && !selectedFile && (
                    <div className="small text-muted mb-2">
                      <div className="d-flex align-items-center">
                        <FaFileAlt className="me-1" size={10} />
                        <span className="text-truncate">{existingDocuments[docType]}</span>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 ms-2"
                          onClick={() => window.open(`${API_ENDPOINTS.EMPLOYEE_DOCUMENT_BY_TYPE(user.employeeId, docType)}?inline=true`, '_blank')}
                        >
                          <FaEye size={12} />
                        </Button>
                      </div>
                      <small>Upload a new file to replace it.</small>
                    </div>
                  )}

                  {/* Preview for selected new file */}
                  {selectedFile && previewUrl && isImage && (
                    <div className="mb-2 text-center">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }}
                        className="border rounded p-1"
                      />
                    </div>
                  )}

                  {!selectedFile ? (
                    <Form.Control
                      type="file"
                      size="sm"
                      accept={docInfo.accept}
                      onChange={(e) => handleFileSelect(docType, e.target.files[0])}
                      className="mb-2"
                    />
                  ) : (
                    <div className="border rounded p-2 bg-white">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center overflow-hidden">
                          {docInfo.icon}
                          <span className="ms-2 small text-truncate" style={{ maxWidth: '150px' }}>
                            {selectedFile.name}
                          </span>
                        </div>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-danger p-0"
                          onClick={() => handleRemoveFile(docType)}
                          disabled={uploading}
                        >
                          <FaTrash size={12} />
                        </Button>
                      </div>
                      {uploadProgress[docType] > 0 && uploadProgress[docType] < 100 && (
                        <ProgressBar
                          now={uploadProgress[docType]}
                          label={`${uploadProgress[docType]}%`}
                          size="sm"
                          className="mt-2"
                        />
                      )}
                    </div>
                  )}

                  <small className="text-muted d-block mt-2">
                    Supported: {docInfo.accept === '*' ? 'All files' : docInfo.accept} (Max 10MB)
                  </small>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      <div className="text-center mt-4">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={uploading || Object.keys(files).length === 0}
          className="px-4"
        >
          {uploading ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Uploading...
            </>
          ) : (
            <>
              <FaUpload className="me-2" size={12} />
              Upload Selected Documents
            </>
          )}
        </Button>
      </div>

      <div className="mt-3 p-2 bg-light rounded small text-muted">
        <FaInfoCircle className="me-1" size={12} />
        <strong>Note:</strong> Uploaded documents will be reviewed by admin. You can upload multiple documents at once.
        Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG (Max 10MB per file)
      </div>
    </div>
  );
};

export default EmployeeDocumentUpload;