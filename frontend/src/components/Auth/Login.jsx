// components/Auth/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import loginBg from '../../assets/login.jpg'
import {
  FaUser, FaLock, FaEye, FaEyeSlash,
  FaExclamationTriangle, FaCalendarAlt, FaCheckCircle, FaArrowLeft, FaPhone
} from 'react-icons/fa';
import { Spinner } from 'react-bootstrap';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  // Forgot-password flow — no email service is configured in this project, so identity
  // is verified with Employee ID/Email + (Date of Birth OR Phone Number, employee's choice)
  // instead of an emailed reset link.
  const [mode, setMode] = useState('login'); // 'login' | 'identity' | 'newpass' | 'success'
  const [verifyMethod, setVerifyMethod] = useState('dob'); // 'dob' | 'phone'
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetDob, setResetDob] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(identifier, password);
      if (result.success) {
        const { role } = result.user;
        if (role === 'admin' || role === 'desktop_support' || role === 'hr') navigate('/admin/dashboard');
        else if (role === 'sub_admin') navigate('/');
        else if (role === 'manager') navigate('/manager/dashboard');
        else if (role === 'finance') navigate('/finance/export');
        else navigate('/employee/dashboard');
      } else {
        setError(result.message || 'Login failed. Please try again.');
      }
    } catch {
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetToLoginMode = () => {
    setMode('login');
    setVerifyMethod('dob');
    setResetIdentifier('');
    setResetDob('');
    setResetPhone('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
  };

  const handleVerifyIdentity = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      const res = await axios.post(API_ENDPOINTS.PASSWORD_VERIFY_RESET_IDENTITY, {
        identifier: resetIdentifier,
        method: verifyMethod,
        dob: verifyMethod === 'dob' ? resetDob : undefined,
        phone: verifyMethod === 'phone' ? resetPhone : undefined,
      });
      if (res.data.success) {
        setResetToken(res.data.resetToken);
        setMode('newpass');
      }
    } catch (err) {
      setResetError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');

    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    setResetLoading(true);
    try {
      const res = await axios.post(API_ENDPOINTS.PASSWORD_RESET, {
        token: resetToken,
        newPassword,
      });
      if (res.data.success) {
        setMode('success');
      }
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const inputStyle = {
    height: '48px',
    fontSize: '14px',
    borderRadius: '12px',
    border: '1.5px solid #CBD5E1',
    paddingLeft: '44px',
    paddingRight: '44px',
    color: '#334155',
    background: '#FFFFFF',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  };

  const submitButtonStyle = (disabled) => ({
    width: '100%', height: '48px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
    border: 'none', color: 'white', fontSize: '15px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
    transition: 'opacity 0.15s',
  });

  return (
    <>
      {/* ── Full-page wrapper ── */}
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, sans-serif",
        position: 'relative',
      }}>

        {/* ── Background image ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${loginBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }} />

        {/* ── Dark overlay for readability ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.52)',
          zIndex: 1,
        }} />

        {/* ── Logo top-left ── */}
        <div style={{
          position: 'absolute',
          top: '22px',
          left: '26px',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
        }}>

        </div>

        {/* ── Auth card ── */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '44px 38px',
          width: '100%',
          maxWidth: '415px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
          textAlign: 'center',
          margin: '16px',
          border: '1px solid rgba(255,255,255,0.85)',
        }}>

          {/* Avatar badge */}
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <img
            src="/images/b2b_logo.png"
            alt="Logo"
            style={{ height: '40px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.15)' }}
          />
          </div>

          {mode === 'login' && (
            <>
              <p style={{ fontSize: '13px', color: '#292a2b', marginBottom: '28px', fontWeight: '700' }}>
                Employee Management System
              </p>

              {error && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FEE2E2',
                  borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '13px', color: '#991B1B', textAlign: 'left',
                }}>
                  <FaExclamationTriangle size={12} />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Employee ID or Email */}
                <div style={{ marginBottom: '16px', position: 'relative' }}>
                  <FaUser style={{
                    position: 'absolute', left: '16px', top: '50%',
                    transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1,
                  }} />
                  <input
                    type="text" value={identifier} required disabled={loading}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="Employee ID or Email address"
                    autoComplete="username"
                    style={inputStyle}
                    onFocus={e  => e.target.style.borderColor = '#2563EB'}
                    onBlur={e   => e.target.style.borderColor = '#CBD5E1'}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: '8px', position: 'relative' }}>
                  <FaLock style={{
                    position: 'absolute', left: '16px', top: '50%',
                    transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1,
                  }} />
                  <input
                    type={showPassword ? 'text' : 'password'} value={password} required disabled={loading}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    style={inputStyle}
                    onFocus={e  => e.target.style.borderColor = '#2563EB'}
                    onBlur={e   => e.target.style.borderColor = '#CBD5E1'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{
                      position: 'absolute', right: '16px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0,
                    }}
                  >
                    {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>

                <div style={{ textAlign: 'right', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setMode('identity')}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      fontSize: '12.5px', fontWeight: 600, color: '#2563EB', cursor: 'pointer',
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit" disabled={loading}
                  style={submitButtonStyle(loading)}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {loading
                    ? <><Spinner as="span" animation="border" size="sm" /> Signing in...</>
                    : 'Continue'
                  }
                </button>
              </form>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0 16px' }}>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
              </div>
              <p style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8', margin: 0 }}>
                Secure sign-in · Role-based access
              </p>
            </>
          )}

          {mode === 'identity' && (
            <>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                Reset your password
              </h2>
              <p style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '18px' }}>
                Verify your identity with your Employee ID/Email, plus one more detail
              </p>

              {/* Verification method toggle */}
              <div style={{
                display: 'flex', background: '#F1F5F9', borderRadius: '10px',
                padding: '4px', marginBottom: '18px', gap: '4px',
              }}>
                {[
                  { key: 'dob', label: 'Date of Birth' },
                  { key: 'phone', label: 'Phone Number' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setVerifyMethod(opt.key)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: '8px', border: 'none',
                      fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                      background: verifyMethod === opt.key ? '#FFFFFF' : 'transparent',
                      color: verifyMethod === opt.key ? '#2563EB' : '#64748B',
                      boxShadow: verifyMethod === opt.key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {resetError && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FEE2E2',
                  borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '13px', color: '#991B1B', textAlign: 'left',
                }}>
                  <FaExclamationTriangle size={12} />
                  {resetError}
                </div>
              )}

              <form onSubmit={handleVerifyIdentity}>
                <div style={{ marginBottom: '16px', position: 'relative' }}>
                  <FaUser style={{
                    position: 'absolute', left: '16px', top: '50%',
                    transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1,
                  }} />
                  <input
                    type="text" value={resetIdentifier} required disabled={resetLoading}
                    onChange={e => setResetIdentifier(e.target.value)}
                    placeholder="Employee ID or Email address"
                    autoComplete="username"
                    style={inputStyle}
                    onFocus={e  => e.target.style.borderColor = '#2563EB'}
                    onBlur={e   => e.target.style.borderColor = '#CBD5E1'}
                  />
                </div>

                {verifyMethod === 'dob' ? (
                  <div style={{ marginBottom: '20px', position: 'relative' }}>
                    <FaCalendarAlt style={{
                      position: 'absolute', left: '16px', top: '50%',
                      transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1,
                    }} />
                    <input
                      type="date" value={resetDob} required disabled={resetLoading}
                      onChange={e => setResetDob(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      style={{ ...inputStyle, textAlign: 'left', color: resetDob ? '#334155' : '#94A3B8' }}
                      onFocus={e  => e.target.style.borderColor = '#2563EB'}
                      onBlur={e   => e.target.style.borderColor = '#CBD5E1'}
                    />
                  </div>
                ) : (
                  <div style={{ marginBottom: '20px', position: 'relative' }}>
                    <FaPhone style={{
                      position: 'absolute', left: '16px', top: '50%',
                      transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1,
                    }} />
                    <input
                      type="tel" value={resetPhone} required disabled={resetLoading}
                      onChange={e => setResetPhone(e.target.value)}
                      placeholder="Registered phone number"
                      autoComplete="tel"
                      style={inputStyle}
                      onFocus={e  => e.target.style.borderColor = '#2563EB'}
                      onBlur={e   => e.target.style.borderColor = '#CBD5E1'}
                    />
                  </div>
                )}

                <button type="submit" disabled={resetLoading} style={submitButtonStyle(resetLoading)}>
                  {resetLoading
                    ? <><Spinner as="span" animation="border" size="sm" /> Verifying...</>
                    : 'Verify Identity'
                  }
                </button>
              </form>

              <button
                type="button"
                onClick={resetToLoginMode}
                style={{
                  background: 'none', border: 'none', marginTop: '18px', padding: 0,
                  fontSize: '12.5px', fontWeight: 600, color: '#64748B', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
              >
                <FaArrowLeft size={11} /> Back to login
              </button>
            </>
          )}

          {mode === 'newpass' && (
            <>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                Set a new password
              </h2>
              <p style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '24px' }}>
                Identity verified. Choose a new password below.
              </p>

              {resetError && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FEE2E2',
                  borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '13px', color: '#991B1B', textAlign: 'left',
                }}>
                  <FaExclamationTriangle size={12} />
                  {resetError}
                </div>
              )}

              <form onSubmit={handleResetPassword}>
                <div style={{ marginBottom: '16px', position: 'relative' }}>
                  <FaLock style={{
                    position: 'absolute', left: '16px', top: '50%',
                    transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1,
                  }} />
                  <input
                    type={showNewPassword ? 'text' : 'password'} value={newPassword} required disabled={resetLoading}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password (min. 6 characters)"
                    autoComplete="new-password"
                    style={inputStyle}
                    onFocus={e  => e.target.style.borderColor = '#2563EB'}
                    onBlur={e   => e.target.style.borderColor = '#CBD5E1'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(s => !s)}
                    style={{
                      position: 'absolute', right: '16px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0,
                    }}
                  >
                    {showNewPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>

                <div style={{ marginBottom: '20px', position: 'relative' }}>
                  <FaLock style={{
                    position: 'absolute', left: '16px', top: '50%',
                    transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1,
                  }} />
                  <input
                    type={showNewPassword ? 'text' : 'password'} value={confirmPassword} required disabled={resetLoading}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Retype new password"
                    autoComplete="new-password"
                    style={inputStyle}
                    onFocus={e  => e.target.style.borderColor = '#2563EB'}
                    onBlur={e   => e.target.style.borderColor = '#CBD5E1'}
                  />
                </div>

                <button type="submit" disabled={resetLoading} style={submitButtonStyle(resetLoading)}>
                  {resetLoading
                    ? <><Spinner as="span" animation="border" size="sm" /> Saving...</>
                    : 'Change Password'
                  }
                </button>
              </form>

              <button
                type="button"
                onClick={resetToLoginMode}
                style={{
                  background: 'none', border: 'none', marginTop: '18px', padding: 0,
                  fontSize: '12.5px', fontWeight: 600, color: '#64748B', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
              >
                <FaArrowLeft size={11} /> Back to login
              </button>
            </>
          )}

          {mode === 'success' && (
            <>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: '#ECFDF5', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <FaCheckCircle size={24} color="#16A34A" />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Password changed
              </h2>
              <p style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '24px' }}>
                Your password has been updated. You can now sign in with your new password.
              </p>
              <button
                type="button"
                onClick={resetToLoginMode}
                style={submitButtonStyle(false)}
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>

    </>
  );
};

export default Login;
