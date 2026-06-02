// components/Auth/LoginFeedBackground.jsx
import React, { useEffect, useState, useRef } from 'react';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

const COLORS = [
  '#1a1a2e','#c0392b','#2c3e50','#27ae60','#e74c3c',
  '#8e44ad','#9b59b6','#16213e','#0f3460','#2d6a4f',
  '#023e8a','#533483','#264653','#e63946','#457b9d',
  '#2a9d8f','#6d6875','#1b4332','#7b2d8b','#e94560',
];

const col = (ci, i) => COLORS[(ci * 3 + i) % COLORS.length];

const H = [
  ['38%','28%','34%'],
  ['30%','25%','25%','20%'],
  ['45%','30%','25%'],
  ['30%','40%','30%'],
  ['25%','45%','30%'],
  ['35%','30%','35%'],
  ['55%','25%','20%'],
];

const Avatar = ({ name, image, size = 42 }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const [imgError, setImgError] = useState(false);
  if (image && !imgError) return (
    <img src={image} alt={name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0 }}
      onError={() => setImgError(true)} />
  );
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
      {initials}
    </div>
  );
};

const Stars = ({ n }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} style={{ fontSize: 10, color: i <= n ? '#FFD700' : 'rgba(255,255,255,0.25)' }}>★</span>
    ))}
  </div>
);

const Tag = ({ children, color }) => (
  <div style={{ fontSize: 10, background: color || 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '2px 10px', color: '#fff', display: 'inline-block' }}>
    {children}
  </div>
);

const CardInner = ({ card, monthLabel }) => {
  const base = { padding: '12px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 5, overflow: 'hidden' };
  const nameStyle = { fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 };
  const sub = { fontSize: 10, color: 'rgba(255,255,255,0.65)' };

  if (card.type === 'birthday') return (
    <div style={base}>
      <div style={{ fontSize: 20 }}>🎂</div>
      <Avatar name={card.name} image={card.profile_image} />
      <div style={nameStyle}>{card.name}</div>
      {card.designation && <div style={{ ...sub, fontStyle: 'italic' }}>{card.designation}</div>}
      {card.department && <div style={sub}>{card.department}</div>}
      <Tag color="rgba(255,180,0,0.35)">🎉 Birthday this week!</Tag>
    </div>
  );

  if (card.type === 'anniversary') return (
    <div style={base}>
      <div style={{ fontSize: 20 }}>🏆</div>
      <Avatar name={card.name} image={card.profile_image} />
      <div style={nameStyle}>{card.name}</div>
      {card.designation && <div style={{ ...sub, fontStyle: 'italic' }}>{card.designation}</div>}
      {card.department && <div style={sub}>{card.department}</div>}
      <Tag color="rgba(100,220,100,0.3)">{card.years} Year{card.years > 1 ? 's' : ''} Anniversary! 🎊</Tag>
    </div>
  );

  if (card.type === 'new_joining') return (
    <div style={base}>
      <div style={{ fontSize: 20 }}>👋</div>
      <Avatar name={card.name} image={card.profile_image} />
      <div style={nameStyle}>{card.name}</div>
      {card.designation && <div style={{ ...sub, fontStyle: 'italic' }}>{card.designation}</div>}
      {card.department && <div style={sub}>{card.department}</div>}
      <Tag color="rgba(0,180,255,0.3)">New Joining!</Tag>
    </div>
  );

  if (card.type === 'top_rated') return (
    <div style={base}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>⭐ Top Performer</div>
      <Avatar name={card.name} image={card.profile_image} size={46} />
      <div style={nameStyle}>{card.name}</div>
      {card.designation && <div style={{ ...sub, fontStyle: 'italic' }}>{card.designation}</div>}
      {card.department && <div style={sub}>{card.department}</div>}
      <Stars n={card.rating} />
    </div>
  );

  if (card.type === 'announcement') return (
    <div style={{ ...base, alignItems: 'flex-start', textAlign: 'left', justifyContent: 'flex-start', gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 }}>📢 Announcement</div>
      {card.image_url && <img src={card.image_url} alt="" style={{ width: '100%', height: 50, objectFit: 'cover', borderRadius: 5 }} />}
      <div style={{ ...nameStyle, textAlign: 'left' }}>{card.title}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{card.message}</div>
    </div>
  );

  if (card.type === 'notice') return (
    <div style={{ ...base, alignItems: 'flex-start', textAlign: 'left', justifyContent: 'flex-start', gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 }}>📋 Notice</div>
      <div style={{ ...nameStyle, textAlign: 'left' }}>{card.title}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{card.message}</div>
      {card.sender_name && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 'auto' }}>— {card.sender_name}</div>}
    </div>
  );

  if (card.type === 'office_event') return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {card.media_type === 'video'
        ? <video src={card.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted autoPlay loop playsInline />
        : <img src={card.media_url} alt={card.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      }
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,0.65))', padding: '16px 10px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{card.title}</div>
      </div>
    </div>
  );

  if (card.type === 'comp_off') return (
    <div style={base}>
      <div style={{ fontSize: 20 }}>📅</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.3, textAlign: 'center' }}>{card.holiday_name}</div>
      <div style={sub}>{card.holiday_date}</div>
      <Tag color="rgba(255,255,255,0.15)">{monthLabel || 'This Month'}</Tag>
    </div>
  );

  // static fallback
  return (
    <div style={{ ...base, alignItems: 'flex-start', textAlign: 'left' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{card.text}</div>
      {card.sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>{card.sub}</div>}
    </div>
  );
};

const STATIC_CARDS = [
  { type: 'static', text: 'Employee Management', sub: 'Manage your team effortlessly' },
  { type: 'static', text: 'Track Attendance', sub: 'Real-time monitoring' },
  { type: 'static', text: 'Leave Management', sub: 'Apply & approve leaves' },
  { type: 'static', text: 'Payroll', sub: 'Automated salary processing' },
  { type: 'static', text: 'Performance', sub: 'Rate & review employees' },
  { type: 'static', text: 'Announcements', sub: 'Stay updated with team news' },
  { type: 'static', text: 'Comp-Off', sub: 'Track compensatory offs' },
  { type: 'static', text: 'Work Anniversary', sub: 'Celebrate milestones' },
  { type: 'static', text: 'New Joinings', sub: 'Welcome new members' },
  { type: 'static', text: 'Team Reports', sub: 'Insights at a glance' },
  { type: 'static', text: 'Regularization', sub: 'Fix missed clock-outs' },
  { type: 'static', text: 'Notifications', sub: 'Never miss an update' },
  { type: 'static', text: 'Shift Management', sub: 'Flexible work timings' },
  { type: 'static', text: 'Documents', sub: 'All files in one place' },
  { type: 'static', text: 'Ratings', sub: 'Recognize top performers' },
  { type: 'static', text: 'Holidays', sub: 'Plan your time off' },
  { type: 'static', text: 'Comp-Off Balance', sub: 'Track earned days' },
  { type: 'static', text: 'Salary Slips', sub: 'Download anytime' },
  { type: 'static', text: 'Late Marks', sub: 'Transparent tracking' },
  { type: 'static', text: 'Overtime', sub: 'Extra hours rewarded' },
  { type: 'static', text: 'Department View', sub: 'Team-wise analytics' },
];

// Pad cards array to fill all 7 columns (min 21 cards needed)
const padCards = (cards) => {
  if (cards.length >= 21) return cards;
  const padded = [...cards];
  let si = 0;
  while (padded.length < 21) {
    padded.push(STATIC_CARDS[si % STATIC_CARDS.length]);
    si++;
  }
  return padded;
};

const buildCards = (data) => {
  if (!data) return padCards(STATIC_CARDS);
  const live = [
    ...(data.birthdays || []),
    ...(data.anniversaries || []),
    ...(data.new_joinings || []),
    ...(data.top_rated || []),
    ...(data.announcements || []),
    ...(data.notices || []),
    ...(data.office_events || []),
    ...(data.comp_offs || []),
  ];
  return padCards(live.length > 0 ? live : STATIC_CARDS);
};

const distribute = (cards) => {
  const cols = Array.from({ length: 7 }, () => []);
  cards.forEach((card, i) => {
    const ci = i % 7;
    const pattern = H[ci];
    const hi = Math.floor(i / 7) % pattern.length;
    cols[ci].push({ ...card, h: pattern[hi] });
  });
  return cols;
};

const LoginFeedBackground = () => {
  const [cards, setCards] = useState(buildCards(null));
  const [monthLabel, setMonthLabel] = useState('');
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    axios.get(API_ENDPOINTS.LOGIN_FEED)
      .then(res => {
        if (res.data?.success) {
          setCards(buildCards(res.data.data));
          setMonthLabel(res.data.data.month_label || '');
        }
      })
      .catch(() => {});
  }, []);

  const columns = distribute(cards);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'flex', gap: '6px', padding: '6px', overflow: 'hidden' }}>
      {columns.map((column, ci) => (
        <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {column.map((card, i) => (
            <div key={`${card.type}-${card.employee_id || card.id || card.holiday_date || i}`}
              style={{ height: card.h, background: col(ci, i), borderRadius: '8px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
              <CardInner card={card} monthLabel={monthLabel} />
            </div>
          ))}
        </div>
      ))}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)', pointerEvents: 'none' }} />
    </div>
  );
};

export default LoginFeedBackground;
