// src/components/Employee/ProfileEdit.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaSave, FaTimes, FaUser, FaEnvelope, FaPhone, FaMapMarker, FaBriefcase, FaUniversity, FaCreditCard } from 'react-icons/fa';

const ProfileEdit = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        pan_number: '',
        emergency_contact: ''
    });

    useEffect(() => {
        fetchEmployeeData();
    }, []);

    const fetchEmployeeData = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`http://localhost:5000/api/employees/profile/${user?.employeeId}`);
            
            // Populate form data with existing values
            const employeeData = response.data;
            setFormData({
                first_name: employeeData.first_name || '',
                last_name: employeeData.last_name || '',
                email: employeeData.email || '',
                phone: employeeData.phone || '',
                address: employeeData.address || '',
                city: employeeData.city || '',
                state: employeeData.state || '',
                pincode: employeeData.pincode || '',
                bank_name: employeeData.bank_name || '',
                account_number: employeeData.account_number || '',
                ifsc_code: employeeData.ifsc_code || '',
                pan_number: employeeData.pan_number || '',
                emergency_contact: employeeData.emergency_contact || ''
            });
        } catch (error) {
            console.error('Error fetching employee data:', error);
            setError('Failed to load profile data');
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
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Get employee ID from user object
            const employeeId = user?.employeeId;
            
            await axios.put(`http://localhost:5000/api/employees/${employeeId}`, formData);
            
            setSuccess('Profile updated successfully!');
            
            // Redirect to profile view after 2 seconds
            setTimeout(() => {
                navigate('/profile');
            }, 2000);
            
        } catch (error) {
            console.error('Error updating profile:', error);
            setError('Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-edit container py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h3>Edit Profile</h3>
                <button 
                    className="btn btn-secondary"
                    onClick={() => navigate('/profile')}
                >
                    <FaTimes /> Cancel
                </button>
            </div>

            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="alert alert-success" role="alert">
                    {success}
                </div>
            )}

            <div className="card">
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        {/* Personal Information */}
                        <h5 className="mb-3">
                            <FaUser className="me-2" /> Personal Information
                        </h5>
                        <div className="row mb-4">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="first_name" className="form-label">First Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="first_name"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="last_name" className="form-label">Last Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="last_name"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* Contact Information */}
                        <h5 className="mb-3">
                            <FaEnvelope className="me-2" /> Contact Information
                        </h5>
                        <div className="row mb-4">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="email" className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="phone" className="form-label">Phone</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <h5 className="mb-3">
                            <FaMapMarker className="me-2" /> Address
                        </h5>
                        <div className="row mb-4">
                            <div className="col-12 mb-3">
                                <label htmlFor="address" className="form-label">Address</label>
                                <textarea
                                    className="form-control"
                                    id="address"
                                    name="address"
                                    rows="2"
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label htmlFor="city" className="form-label">City</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="city"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label htmlFor="state" className="form-label">State</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="state"
                                    name="state"
                                    value={formData.state}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label htmlFor="pincode" className="form-label">Pincode</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="pincode"
                                    name="pincode"
                                    value={formData.pincode}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Bank Details */}
                        <h5 className="mb-3">
                            <FaUniversity className="me-2" /> Bank Details
                        </h5>
                        <div className="row mb-4">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="bank_name" className="form-label">Bank Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="bank_name"
                                    name="bank_name"
                                    value={formData.bank_name}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="account_number" className="form-label">Account Number</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="account_number"
                                    name="account_number"
                                    value={formData.account_number}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="ifsc_code" className="form-label">IFSC Code</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="ifsc_code"
                                    name="ifsc_code"
                                    value={formData.ifsc_code}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="pan_number" className="form-label">PAN Number</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="pan_number"
                                    name="pan_number"
                                    value={formData.pan_number}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        <h5 className="mb-3">Emergency Contact</h5>
                        <div className="row mb-4">
                            <div className="col-12 mb-3">
                                <label htmlFor="emergency_contact" className="form-label">Emergency Contact</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="emergency_contact"
                                    name="emergency_contact"
                                    value={formData.emergency_contact}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="text-end">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving}
                            >
                                <FaSave className="me-2" />
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfileEdit;