import React, { useState, useEffect } from 'react';
import { FaGift, FaBirthdayCake, FaTrophy, FaUserFriends, FaHeart, FaRegHeart, FaCommentDots } from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNotification } from '../../context/NotificationContext';
import Avatar from './Avatar';
import { QA, QA_CARD_STYLE, QA_CARD_TITLE_STYLE } from './quickAccessTheme';

const todayStr = () => new Date().toISOString().split('T')[0];

const CONFETTI_EMOJI = ['🎉', '🎊', '✨', '🎈', '🎂'];
function ConfettiBurst() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dist = 45 + (i % 3) * 15;
        const x = Math.round(Math.cos(angle) * dist);
        const y = Math.round(Math.sin(angle) * dist - 20);
        return (
          <span key={i} className="qa-confetti-piece" style={{ '--qa-x': `${x}px`, '--qa-y': `${y}px`, animationDelay: `${i * 0.03}s` }}>
            {CONFETTI_EMOJI[i % CONFETTI_EMOJI.length]}
          </span>
        );
      })}
    </>
  );
}

function WishThread({ recipientEmployeeId, recipientName, eventType }) {
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [openComments, setOpenComments] = useState({});
  const [comments, setComments] = useState({});
  const [commentInput, setCommentInput] = useState({});

  const fetchWishes = () => {
    setLoading(true);
    axios.get(API_ENDPOINTS.WISHES, { params: { recipient_employee_id: recipientEmployeeId, event_date: todayStr(), event_type: eventType } })
      .then(res => { if (res.data?.success) setWishes(res.data.wishes || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWishes(); }, [recipientEmployeeId, eventType]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitWish = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await axios.post(API_ENDPOINTS.WISHES, {
        recipient_employee_id: recipientEmployeeId,
        recipient_name: recipientName,
        event_type: eventType,
        message: message.trim(),
      });
      if (res.data?.success) {
        setMessage('');
        fetchWishes();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send wish');
    } finally {
      setSending(false);
    }
  };

  const toggleLike = async (wishId) => {
    setWishes(prev => prev.map(w => w.id === wishId
      ? { ...w, liked_by_me: !w.liked_by_me, like_count: w.like_count + (w.liked_by_me ? -1 : 1) }
      : w));
    try {
      await axios.patch(API_ENDPOINTS.WISH_LIKE(wishId));
    } catch {
      fetchWishes();
    }
  };

  const toggleComments = (wishId) => {
    setOpenComments(prev => ({ ...prev, [wishId]: !prev[wishId] }));
    if (!comments[wishId]) {
      axios.get(API_ENDPOINTS.WISH_COMMENTS(wishId))
        .then(res => setComments(prev => ({ ...prev, [wishId]: res.data?.comments || [] })))
        .catch(() => {});
    }
  };

  const submitComment = async (wishId) => {
    const text = (commentInput[wishId] || '').trim();
    if (!text) return;
    try {
      const res = await axios.post(API_ENDPOINTS.WISH_COMMENTS(wishId), { comment: text });
      if (res.data?.success) {
        setComments(prev => ({ ...prev, [wishId]: [...(prev[wishId] || []), res.data.comment] }));
        setCommentInput(prev => ({ ...prev, [wishId]: '' }));
        setWishes(prev => prev.map(w => w.id === wishId ? { ...w, comment_count: (w.comment_count || 0) + 1 } : w));
      }
    } catch { /* silent */ }
  };

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={`Write a message for ${recipientName || 'them'}…`}
          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1px solid ${QA.border}`, fontSize: 12, outline: 'none' }}
          onKeyDown={e => { if (e.key === 'Enter') submitWish(); }}
        />
        <button onClick={submitWish} disabled={sending || !message.trim()}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: QA.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: sending || !message.trim() ? 'not-allowed' : 'pointer', opacity: sending || !message.trim() ? 0.6 : 1 }}>
          {sending ? '…' : 'Wish'}
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: QA.danger, marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div style={{ fontSize: 11, color: QA.textMuted }}>Loading wishes…</div>
      ) : wishes.length === 0 ? (
        <div style={{ fontSize: 11, color: QA.textMuted }}>No wishes yet — be the first!</div>
      ) : wishes.map(w => (
        <div key={w.id} style={{ padding: '8px 0', borderTop: '1px solid #f9fafb' }}>
          <div style={{ fontSize: 12, color: QA.textDark }}><strong>{w.sender_name}</strong> {w.message}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
            <button onClick={() => toggleLike(w.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: w.liked_by_me ? QA.danger : QA.textMuted, fontSize: 11, padding: 0 }}>
              {w.liked_by_me ? <FaHeart size={11} /> : <FaRegHeart size={11} />} {w.like_count > 0 ? w.like_count : 'Like'}
            </button>
            <button onClick={() => toggleComments(w.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: QA.textMuted, fontSize: 11, padding: 0 }}>
              <FaCommentDots size={11} /> {w.comment_count > 0 ? w.comment_count : 'Comment'}
            </button>
          </div>
          {openComments[w.id] && (
            <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #f3f4f6' }}>
              {(comments[w.id] || []).map(c => (
                <div key={c.id} style={{ fontSize: 11, color: QA.textDark, marginBottom: 4 }}>
                  <strong>{c.commenter_name}</strong> {c.comment}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  value={commentInput[w.id] || ''}
                  onChange={e => setCommentInput(prev => ({ ...prev, [w.id]: e.target.value }))}
                  placeholder="Write a comment…"
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: `1px solid ${QA.border}`, fontSize: 11, outline: 'none' }}
                  onKeyDown={e => { if (e.key === 'Enter') submitComment(w.id); }}
                />
                <button onClick={() => submitComment(w.id)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#f3f4f6', color: QA.textDark, fontSize: 11, cursor: 'pointer' }}>
                  Post
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PersonRow({ p, showWish, eventType, expandedId, confettiFor, onWishClick, suffix }) {
  return (
    <div style={{ borderBottom: '1px solid #f9fafb', paddingBottom: 8, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar photo={p.profile_image} id={p.employee_id} firstName={p.first_name} lastName={p.last_name} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: QA.textDark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.first_name} {p.last_name}
          </div>
          <div style={{ fontSize: 10, color: QA.textMuted }}>{p.department}{suffix ? ` · ${suffix}` : ''}</div>
        </div>
        {showWish && (
          <div style={{ position: 'relative' }}>
            {confettiFor === p.employee_id && <ConfettiBurst />}
            <button onClick={() => onWishClick(p.employee_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: expandedId === p.employee_id ? QA.primary : QA.primaryLight,
                color: expandedId === p.employee_id ? '#fff' : QA.primary,
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
              <FaGift size={10} /> Wish
            </button>
          </div>
        )}
      </div>
      {expandedId === p.employee_id && showWish && (
        <WishThread recipientEmployeeId={p.employee_id} recipientName={`${p.first_name} ${p.last_name}`} eventType={eventType} />
      )}
    </div>
  );
}

export default function CelebrationsCard() {
  const { todayEvents } = useNotification();
  const [expandedId, setExpandedId] = useState(null);
  const [confettiFor, setConfettiFor] = useState(null);
  const [tab, setTab] = useState('birthdays');
  const [upcoming, setUpcoming] = useState({ birthdays: [], anniversaries: [], new_joiners: [] });

  useEffect(() => {
    let cancelled = false;
    axios.get(API_ENDPOINTS.TODAY_EVENTS_UPCOMING)
      .then(res => { if (!cancelled && res.data?.success) setUpcoming(res.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleWishClick = (employeeId) => {
    setExpandedId(prev => prev === employeeId ? null : employeeId);
    setConfettiFor(employeeId);
    setTimeout(() => setConfettiFor(null), 900);
  };

  const todayBirthdays = todayEvents?.birthdays || [];
  const todayAnniversaries = todayEvents?.anniversaries || [];

  const TABS = [
    { key: 'birthdays', label: 'Birthdays', icon: FaBirthdayCake, count: todayBirthdays.length },
    { key: 'anniversaries', label: 'Work Anniversaries', icon: FaTrophy, count: todayAnniversaries.length },
    { key: 'new_joiners', label: 'New Joiners', icon: FaUserFriends, count: upcoming.new_joiners.length },
  ];

  return (
    <div style={QA_CARD_STYLE}>
      <div style={QA_CARD_TITLE_STYLE}>Celebrations</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: tab === t.key ? QA.primary : '#f3f4f6',
              color: tab === t.key ? '#fff' : QA.textMuted,
            }}>
            <t.icon size={10} /> {t.label} ({t.count})
          </button>
        ))}
      </div>

      {(tab === 'birthdays' || tab === 'anniversaries') && (() => {
        const eventType = tab === 'birthdays' ? 'birthday' : 'anniversary';
        const todayPeople = tab === 'birthdays' ? todayBirthdays : todayAnniversaries;
        const upcomingPeople = tab === 'birthdays' ? upcoming.birthdays : upcoming.anniversaries;
        return (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: QA.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Today</div>
            {todayPeople.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '14px 0', color: QA.textMuted }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{tab === 'birthdays' ? '🎂' : '🏆'}</div>
                <div style={{ fontSize: 12 }}>No {tab === 'birthdays' ? 'birthdays' : 'work anniversaries'} today</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {todayPeople.map(p => (
                  <PersonRow key={p.employee_id} p={p} showWish eventType={eventType}
                    expandedId={expandedId}
                    confettiFor={confettiFor} onWishClick={handleWishClick}
                    suffix={tab === 'anniversaries' ? `${p.years} yr${p.years === 1 ? '' : 's'}` : ''} />
                ))}
              </div>
            )}

            {upcomingPeople.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: QA.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Upcoming</div>
                <div className="qa-scroll-x">
                  {upcomingPeople.map(p => (
                    <div key={p.employee_id} style={{ minWidth: 100, textAlign: 'center', flexShrink: 0, padding: '10px 8px', borderRadius: 12, background: '#f9fafb' }}>
                      <Avatar photo={p.profile_image} id={p.employee_id} firstName={p.first_name} lastName={p.last_name} size={36} />
                      <div style={{ fontSize: 11, fontWeight: 600, color: QA.textDark, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.first_name}
                      </div>
                      <div style={{ fontSize: 10, color: QA.primary, fontWeight: 700, marginTop: 2 }}>
                        {p.days_until === 1 ? 'Tomorrow' : `${p.days_until} days`}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}

      {tab === 'new_joiners' && (
        upcoming.new_joiners.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '14px 0', color: QA.textMuted }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>👋</div>
            <div style={{ fontSize: 12 }}>No new joiners this week</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.new_joiners.map(p => (
              <div key={p.employee_id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f9fafb', paddingBottom: 8 }}>
                <Avatar photo={p.profile_image} id={p.employee_id} firstName={p.first_name} lastName={p.last_name} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: QA.textDark }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontSize: 10, color: QA.textMuted }}>{p.designation ? `${p.designation} · ` : ''}{p.department}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: QA.primary, background: QA.primaryLight, borderRadius: 20, padding: '3px 10px' }}>👋 Welcome</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
