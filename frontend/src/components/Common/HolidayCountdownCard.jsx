import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGift, FaCalendarAlt } from 'react-icons/fa';
import { getUpcomingHolidays } from '../../data/holidays';

const daysUntil = (dateStr) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

const fmtShort = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });

export default function HolidayCountdownCard({ limit = 3 }) {
  const navigate = useNavigate();
  const upcoming = getUpcomingHolidays(new Date(), limit);
  const next = upcoming[0];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
      borderRadius: 18, padding: 18, color: '#fff', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', right: -16, top: -16, fontSize: 70, opacity: 0.18 }}>🎉</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.9 }}>Holidays</div>
        <button onClick={() => navigate('/profile')} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '4px 12px', cursor: 'pointer' }}>
          View All
        </button>
      </div>

      {!next ? (
        <div style={{ fontSize: 13, opacity: 0.9 }}>No upcoming holidays scheduled</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
              <FaGift size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{next.name}</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>{fmtShort(next.date)} · in {daysUntil(next.date)} day{daysUntil(next.date) === 1 ? '' : 's'}</div>
            </div>
          </div>
          {upcoming.slice(1).map(h => (
            <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: 12 }}>
              <FaCalendarAlt size={10} style={{ opacity: 0.8 }} />
              <span style={{ flex: 1, fontWeight: 500 }}>{h.name}</span>
              <span style={{ opacity: 0.85 }}>{fmtShort(h.date)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
