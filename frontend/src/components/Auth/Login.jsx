// components/Auth/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FaEnvelope, FaLock, FaEye, FaEyeSlash,
  FaExclamationTriangle, FaCheckCircle, FaStar
} from 'react-icons/fa';
import { Spinner, Modal, Form, Alert, Button } from 'react-bootstrap';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

// Convert percentage heights to pixel values based on typical viewport height (~900px)
const COL_HEIGHT_POOLS = [
  [369, 234, 243],
  [270, 234, 342],
  [396, 216, 234],
  [162, 360, 324],
  [252, 288, 306],
  [306, 306, 234],
  [477, 198, 171],
];

// Hex colors extracted accurately from the clean screenshot layout
const STYLE_MAP = {
  'comp_off': { bg: '#F1F5F9', color: '#16A34A' },
  'recognition': { bg: '#F5F3FF', color: '#7C3AED' },
  'secure_work': { bg: '#F0F9FF', color: '#0284C7' },
  'wellbeing': { bg: '#FFF1F2', color: '#E11D48' },
  'announcements': { bg: '#F0FDF4', color: '#16A34A' },
  'performance': { bg: '#FFF5F5', color: '#DC2626' },
  'excellence': { bg: '#F8FAFC', color: '#6366F1' },
  'work_life': { bg: '#F0F9FF', color: '#2563EB' },
  'innovation': { bg: '#F0FDF4', color: '#0D9488' },
  'collaboration': { bg: '#FFF7ED', color: '#EA580C' },
  'notices': { bg: '#F8FAFC', color: '#4F46E5' },
  'birthdays': { bg: '#FAFaf9', color: '#D97706' },
  'growth': { bg: '#FFF5F5', color: '#E11D48' },
  'learning': { bg: '#F0FDF4', color: '#16A34A' },
  'top_performers': { bg: '#EEF2F6', color: '#4F46E5' },
  'diversity': { bg: '#F0FDF4', color: '#0D9488' },
  'goals': { bg: '#F8FAFC', color: '#DB2777' },
  'people_first': { bg: '#FAFaf9', color: '#C2410C' },
  'office_events': { bg: '#F8FAFC', color: '#0284C7' },
  'anniversaries': { bg: '#F0FDF4', color: '#0D9488' },
  'new_joining': { bg: '#EFF6FF', color: '#2563EB' },
};

const DUMMY_NEW_JOININGS = [
  { type: 'new_joining', emoji: '👋', title: '👋 Welcome OnBoard!', sub: 'Rahul Sharma', extra: 'Software Engineer · Engineering', avatar: null },
  { type: 'new_joining', emoji: '👋', title: '👋 Welcome OnBoard!', sub: 'Priya Mehta', extra: 'Business Analyst · Operations', avatar: null },
  { type: 'new_joining', emoji: '👋', title: '👋 Welcome OnBoard!', sub: 'Arjun Patel', extra: 'UI/UX Designer · Product', avatar: null },
];

const DUMMY_BIRTHDAYS = [
  { type: 'birthdays', emoji: '🎂', title: '🎂 Happy Birthday!', sub: 'Sneha Kapoor', extra: 'HR Executive · Human Resources', avatar: null },
  { type: 'birthdays', emoji: '🎂', title: '🎂 Happy Birthday!', sub: 'Vikram Nair', extra: 'Backend Developer · Engineering', avatar: null },
  { type: 'birthdays', emoji: '🎂', title: '🎂 Happy Birthday!', sub: 'Anjali Singh', extra: 'Marketing Lead · Marketing', avatar: null },
];

const PLACEHOLDER_POOL = [
  { type: 'comp_off', emoji: '📅', title: 'Comp-Off', sub: 'Memorial Day', extra: 'Monday, 25 May 2026' },
  { type: 'recognition', emoji: '🌟', title: 'Recognition', sub: 'Great work deserves it' },
  { type: 'secure_work', emoji: '🔒', title: 'Secure Work', sub: 'Safety is our priority' },
  { type: 'wellbeing', emoji: '💖', title: 'Employee Well-being', sub: 'Your health matters to us' },
  { type: 'announcements', emoji: '📢', title: 'Announcements', sub: 'Stay tuned for updates' },
  { type: 'performance', emoji: '📊', title: 'Performance', sub: 'Track. Improve. Excel.' },
  { type: 'excellence', emoji: '🏆', title: 'Excellence Award', sub: 'Recognizing the best' },
  { type: 'work_life', emoji: '☕', title: 'Work-Life Balance', sub: 'Recharge. Refresh. Return.' },
 { type: 'notices', emoji: '📋', title: 'Notices', sub: 'Important updates' },
  { type: 'birthdays', emoji: '🎂', title: 'Birthdays This Week', sub: 'Celebrating our team' },
  { type: 'growth', emoji: '🚀', title: 'Growth Mindset', sub: 'Every day is a chance to grow' },
  { type: 'top_performers', emoji: '⭐', title: 'Top Performers', sub: 'Ratings updated monthly' },
  { type: 'people_first', emoji: '💼', title: 'People First', sub: 'Our greatest asset is our team' },
  { type: 'office_events', emoji: '📸', title: 'Office Events', sub: 'Capturing memories' },
  { type: 'anniversaries', emoji: '🎉', title: 'Work Anniversaries', sub: 'Celebrating milestones' },
  ...DUMMY_NEW_JOININGS,
  ...DUMMY_BIRTHDAYS,
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const toCard = (item) => {
  if (item.type === 'birthday') return { type: 'birthdays', emoji: '🎂', title: '🎂 Happy Birthday!', sub: item.name, extra: [item.designation, item.department].filter(Boolean).join(' · '), avatar: item.profile_image || null };
  if (item.type === 'anniversary') return { type: 'anniversaries', emoji: '🎉', title: `🏆 ${item.years} Year${item.years > 1 ? 's' : ''} Anniversary!`, sub: item.name, extra: [item.designation, item.department].filter(Boolean).join(' · '), avatar: item.profile_image || null };
  if (item.type === 'new_joining') return { type: 'collaboration', emoji: '👋', title: '👋 Welcome Onboard!', sub: item.name, extra: [item.designation, item.department].filter(Boolean).join(' · '), avatar: item.profile_image || null };
  if (item.type === 'top_rated') return { type: 'top_performers', emoji: '⭐', title: '⭐ Top Performer', sub: item.name, extra: [item.designation, item.department].filter(Boolean).join(' · '), avatar: item.profile_image || null, rating: item.rating };
  if (item.type === 'announcement') return { type: 'announcements', emoji: '📢', title: item.title, sub: item.message?.slice(0, 80) || '', image: item.image_url };
  if (item.type === 'notice') return { type: 'notices', emoji: '📋', title: item.title, sub: item.message?.slice(0, 80) || '', extra: item.sender_name ? `— ${item.sender_name}` : '' };
  if (item.type === 'office_event') return { type: 'office_events', emoji: '📸', title: item.title, sub: item.description?.slice(0, 60) || '', media: item.media_url, mediaType: item.media_type };
  if (item.type === 'comp_off') {
    const d = new Date(item.holiday_date);
    const dateLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
    return { type: 'comp_off', emoji: '📅', title: 'Comp-Off', sub: item.holiday_name, extra: `${dayName}, ${dateLabel}` };
  }
  return null;
};

const NUM_COLS = 7;

const buildGrid = (d) => {
  const realCards = [];
  if (d) {
    ['birthdays', 'anniversaries', 'new_joinings', 'top_rated', 'announcements', 'notices', 'office_events'].forEach(key => {
      (d[key] || []).forEach(item => { const c = toCard(item); if (c) realCards.push(c); });
    });
    (d.comp_offs || []).forEach(item => {
      const c = toCard(item);
      if (c) realCards.push(c);
    });
  }

  const shuffledReal = shuffle(realCards);
  const minTotal = NUM_COLS * 3;
  const totalNeeded = Math.max(minTotal, shuffledReal.length + (NUM_COLS - (shuffledReal.length % NUM_COLS || NUM_COLS)));
  const shuffledPH = shuffle(PLACEHOLDER_POOL);
  const allFlat = [];
  let pi = 0;

  for (let i = 0; i < totalNeeded; i++) {
    if (i < shuffledReal.length) {
      const cardConfig = STYLE_MAP[shuffledReal[i].type] || { bg: '#F8FAFC', color: '#1E293B' };
      allFlat.push({ ...shuffledReal[i], bg: cardConfig.bg, color: cardConfig.color });
    } else {
      const p = shuffledPH[pi % shuffledPH.length];
      const cardConfig = STYLE_MAP[p.type] || { bg: '#F8FAFC', color: '#1E293B' };
      allFlat.push({ ...p, bg: cardConfig.bg, color: cardConfig.color });
      pi++;
    }
  }

  const cols = Array.from({ length: NUM_COLS }, () => []);
  allFlat.forEach((card, i) => cols[i % NUM_COLS].push(card));

  return cols.map((col, ci) => {
    const pool = COL_HEIGHT_POOLS[ci];
    return col.map((card, i) => ({ ...card, h: pool[i % pool.length] }));
  });
};

const COL_SPEEDS = [0.22, 0.16, 0.28, 0.19, 0.25, 0.15, 0.30];
const GAP = 12;

const MasonryCol = ({ cards, speed }) => {
  const containerRef = React.useRef(null);
  const cardRefs = React.useRef([]);
  const positions = React.useRef([]);
  const raf = React.useRef(null);
  const initialized = React.useRef(false);

  // tripled cards so there's always enough below to fill screen
  const tripled = [...cards, ...cards, ...cards];

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const init = () => {
      const containerH = container.clientHeight;
      if (!containerH) { raf.current = requestAnimationFrame(init); return; }

      // measure each card's actual pixel height
      const heights = cardRefs.current.map(el => el ? el.offsetHeight : 0);

      // assign absolute top positions
      let y = 0;
      positions.current = heights.map(h => {
        const top = y;
        y += h + GAP;
        return top;
      });

      // apply positions
      cardRefs.current.forEach((el, i) => {
        if (el) { el.style.position = 'absolute'; el.style.top = positions.current[i] + 'px'; el.style.left = '0'; el.style.right = '0'; }
      });

      // set container height to hold all cards
      container.style.height = y + 'px';
      initialized.current = true;

      let offset = 0;
      const step = () => {
        offset += speed;

        cardRefs.current.forEach((el, i) => {
          if (!el) return;
          let top = positions.current[i] - offset;
          // when card fully scrolls above viewport, move it below the last visible card
          if (top + heights[i] < 0) {
            // find the current bottom-most card position and place this card below it
            const maxPos = Math.max(...positions.current);
            const maxIdx = positions.current.indexOf(maxPos);
            positions.current[i] = maxPos + heights[maxIdx] + GAP;
            top = positions.current[i] - offset;
          }
          el.style.top = top + 'px';
        });

        raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(init);
    return () => cancelAnimationFrame(raf.current);
  }, [cards, speed]);

  return (
    <div style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
        {tripled.map((card, i) => (
          <div key={i} ref={el => cardRefs.current[i] = el} style={{ width: '100%' }}>
            <MasonryCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
};

const MasonryCard = ({ card }) => {
  const [imgErr, setImgErr] = React.useState(false);
  return (
    <div style={{
      height: card.h,
      background: card.bg,
      borderRadius: '16px',
      padding: '16px 12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
      border: '1px solid rgba(226, 232, 240, 0.7)',
    }}>
      {card.media && (
        card.mediaType === 'video'
          ? <video src={card.media} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.1 }} muted autoPlay loop playsInline />
          : <img src={card.media} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.1 }} />
      )}
      {card.image && (
        <img src={card.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.1 }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        {card.avatar !== undefined ? (
          <>
            {/* Card label e.g. Happy Birthday!, Top Performer */}
            <div style={{ color: card.color || '#5046E5', fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px', marginBottom: '2px' }}>{card.title}</div>
            {/* Avatar */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%', background: '#F1F5F9',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #E2E8F0', flexShrink: 0
            }}>
              {card.avatar && !imgErr
                ? <img src={card.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
                : <span style={{ color: '#64748B', fontWeight: '700', fontSize: '15px' }}>{(card.sub || '?')[0].toUpperCase()}</span>
              }
            </div>
            {/* Name */}
            <div style={{ color: '#1E293B', fontSize: '12px', fontWeight: '700', lineHeight: 1.2 }}>{card.sub}</div>
            {/* Designation / department */}
            {card.extra && <div style={{ color: '#64748B', fontSize: '10px', lineHeight: 1.3 }}>{card.extra}</div>}
            {/* Star rating */}
            {card.rating && (
              <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                {[1,2,3,4,5].map(s => <FaStar key={s} size={9} color={s <= card.rating ? '#F59E0B' : '#CBD5E1'} />)}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: '26px', marginBottom: '6px', lineHeight: 1 }}>{card.emoji}</div>
            <div style={{ color: card.color, fontSize: '13px', fontWeight: '700', marginBottom: '3px' }}>{card.title}</div>
            {card.sub && <div style={{ color: '#475569', fontSize: '11px', fontWeight: '500', lineHeight: 1.4 }}>{card.sub}</div>}
            {card.extra && <div style={{ color: card.color, fontSize: '10px', marginTop: '3px', fontWeight: '600', opacity: 0.9 }}>{card.extra}</div>}
          </>
        )}
      </div>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gridCols, setGridCols] = useState(() => buildGrid(null));

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpSuccess, setFpSuccess] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(API_ENDPOINTS.LOGIN_FEED)
      .then(res => setGridCols(buildGrid(res.data?.success ? res.data.data : null)))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate(result.user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard');
      } else {
        setError(result.message || 'Login failed. Please try again.');
      }
    } catch {
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setFpError(''); setFpSuccess('');
    if (!fpEmail) return setFpError('Please enter your email address.');
    if (!fpNewPassword) return setFpError('Please enter a new password.');
    if (fpNewPassword.length < 6) return setFpError('Password must be at least 6 characters.');
    if (fpNewPassword !== fpConfirmPassword) return setFpError('Passwords do not match.');
    setFpLoading(true);
    try {
      const res = await axios.post(API_ENDPOINTS.PASSWORD_RESET_DIRECT, { email: fpEmail, newPassword: fpNewPassword });
      if (res.data.success) {
        setFpSuccess(res.data.message);
        setFpNewPassword(''); setFpConfirmPassword('');
        setTimeout(() => { setShowForgotModal(false); setFpEmail(''); setFpSuccess(''); setEmail(fpEmail); }, 2000);
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <>
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', fontFamily: "'Inter', -apple-system, sans-serif", position: 'relative',
        background: '#0d0d1a'
      }}>
        
        {/* 7 Columns Clean Light Masonry Grid background */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          display: 'flex', gap: '12px', padding: '12px',
          background: '#F1F5F9',
        }}>
          {gridCols.map((col, ci) => (
            <MasonryCol key={ci} cards={col} speed={COL_SPEEDS[ci]} />
          ))}
        </div>
        
        {/* OPACITY LAYER - Matte darkish veil to push down background structure depth */}
        <div style={{ 
          position: 'absolute', inset: 0, zIndex: 1, 
          background: 'rgba(13, 13, 26, 0.45)', 
          backdropFilter: 'blur(0.5px)' 
        }} />

        {/* ELEVATED FRONT BRAND LOGO - Fixed Layering (Moved below opacity layer and z-index synced) */}
        <div style={{
          position: 'absolute', top: '22px', left: '26px', zIndex: 3,
          display: 'flex', alignItems: 'center'
        }}>
          <img 
            src="./images/b2b_logo.png" 
            alt="B2B inDemand Logo"
            style={{ height: '42px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.2)' }}
          />
        </div>

        {/* CRISP CENTRAL FLOATING LOGIN INTERFACE FORM */}
        <div style={{
          position: 'relative', zIndex: 2, background: '#FFFFFF', borderRadius: '24px',
          padding: '44px 38px', width: '100%', maxWidth: '415px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          textAlign: 'center', margin: '16px', border: '1px solid rgba(255, 255, 255, 0.8)'
        }}>
          {/* Central Logo Letter Icon Badge */}
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: '#5046E5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', boxShadow: '0 8px 16px rgba(80, 70, 229, 0.25)'
          }}>
            <span style={{ fontSize: '24px', fontWeight: '600', color: '#FFFFFF' }}>E</span>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1E293B', marginBottom: '6px', letterSpacing: '-0.5px' }}>Welcome back!</h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '28px', fontWeight: '500' }}>Employee Management System</p>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '10px',
              padding: '10px 14px', marginBottom: '16px', display: 'flex',
              alignItems: 'center', gap: '8px', fontSize: '13px', color: '#991B1B', textAlign: 'left'
            }}>
              <FaExclamationTriangle size={12} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email Form Field row wrapper */}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <FaEnvelope style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1 }} />
              <input type="email" value={email} required disabled={loading}
                onChange={e => setEmail(e.target.value)} placeholder="Email address" 
                style={{
                  height: '48px', fontSize: '14px', borderRadius: '12px',
                  border: '1.5px solid #CBD5E1', paddingLeft: '44px', paddingRight: '44px',
                  color: '#334155', background: '#FFFFFF', outline: 'none', width: '100%', transition: 'all 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#5046E5'}
                onBlur={e => e.target.style.borderColor = '#CBD5E1'} />
            </div>

            {/* Password Form Field row wrapper */}
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <FaLock style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1 }} />
              <input type={showPassword ? 'text' : 'password'} value={password} required disabled={loading}
                onChange={e => setPassword(e.target.value)} placeholder="Password" 
                style={{
                  height: '48px', fontSize: '14px', borderRadius: '12px',
                  border: '1.5px solid #CBD5E1', paddingLeft: '44px', paddingRight: '44px',
                  color: '#334155', background: '#FFFFFF', outline: 'none', width: '100%', transition: 'all 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#5046E5'}
                onBlur={e => e.target.style.borderColor = '#CBD5E1'} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0, userSelect: 'none' }}>
                {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
              </button>
            </div>

            {/* Forgot state link clicker */}
            <div style={{ textAlign: 'right', marginBottom: '24px' }}>
              <button type="button"
                onClick={() => { setShowForgotModal(true); setFpEmail(email); setFpError(''); setFpSuccess(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#5046E5', fontWeight: '600' }}>
                Forgot password?
              </button>
            </div>

            {/* Confirm Submit action button CTA */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', height: '48px', borderRadius: '12px',
                background: '#5046E5', border: 'none', color: 'white', fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#4338CA'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#5046E5'; }}>
              {loading ? <><Spinner as="span" animation="border" size="sm" /> Signing in...</> : 'Continue'}
            </button>
          </form>

          {/* Separation boundary elements design markup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0 16px' }}>
            <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
          </div>
          <p style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8', margin: 0 }}>Secure sign-in · Role-based access</p>
        </div>
      </div>

      {/* Forgot Password Recovery Modal Dialogue window */}
      <Modal show={showForgotModal} onHide={() => setShowForgotModal(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: '1px solid #E2E8F0', padding: '20px 24px' }}>
          <Modal.Title style={{ fontSize: '16px', fontWeight: '700', color: '#1E293B' }}>
            <FaLock className="me-2" size={13} style={{ color: '#5046E5' }} />Set New Password
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '24px' }}>
          {fpError && <Alert variant="danger" dismissible onClose={() => setFpError('')} style={{ fontSize: '13px', borderRadius: '8px' }}><FaExclamationTriangle className="me-2" size={12} />{fpError}</Alert>}
          {fpSuccess && <Alert variant="success" style={{ fontSize: '13px', borderRadius: '8px' }}><FaCheckCircle className="me-2" size={12} />{fpSuccess}</Alert>}
          <Form onSubmit={handleForgotPassword}>
            {[
              { label: 'Email Address', type: 'email', value: fpEmail, onChange: setFpEmail, placeholder: 'Enter your registered email' },
              { label: 'New Password', type: 'password', value: fpNewPassword, onChange: setFpNewPassword, placeholder: 'Min 6 characters' },
              { label: 'Confirm Password', type: 'password', value: fpConfirmPassword, onChange: setFpConfirmPassword, placeholder: 'Confirm new password' },
            ].map(({ label, type, value, onChange, placeholder }) => (
              <Form.Group className="mb-3" key={label}>
                <Form.Label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{label}</Form.Label>
                <Form.Control type={type} value={value} required onChange={e => onChange(e.target.value)} placeholder={placeholder}
                  style={{ height: '44px', fontSize: '13px', borderRadius: '10px', border: '1.5px solid #E2E8F0' }} />
              </Form.Group>
            ))}
            <Button type="submit" disabled={fpLoading}
              style={{ width: '100%', height: '44px', background: '#5046E5', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {fpLoading ? <><Spinner as="span" animation="border" size="sm" /> Setting...</> : 'Set Password'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default Login;