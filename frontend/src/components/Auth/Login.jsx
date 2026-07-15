// components/Auth/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import loginBg from '../../assets/login.jpg'
import {
  FaUser, FaLock, FaEye, FaEyeSlash,
  FaExclamationTriangle
} from 'react-icons/fa';
import { Spinner } from 'react-bootstrap';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

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
        if (role === 'admin' || role === 'desktop_support') navigate('/admin/dashboard');
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

        {/* ── Login card ── */}
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

          <h2 style={{
            fontSize: '24px', fontWeight: '700', color: '#0F172A',
            marginBottom: '6px', letterSpacing: '-0.5px',
          }}>
            
          </h2>
          <p style={{ fontSize: '13px', color: '#292a2b', marginBottom: '28px', fontWeight: '700' }}>
            Employee Management System
          </p>

          {/* Error alert */}
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
            <div style={{ marginBottom: '12px', position: 'relative' }}>
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

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', height: '48px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                border: 'none', color: 'white', fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                transition: 'opacity 0.15s',
              }}
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
        </div>
      </div>

    </>
  );
};

export default Login;
