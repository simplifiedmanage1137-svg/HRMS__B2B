import React, { useState, useEffect } from 'react';
import { FaGift, FaBirthdayCake, FaTrophy, FaUserFriends, FaHeart, FaRegHeart, FaCommentDots } from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNotification } from '../../context/NotificationContext';
import Avatar from './Avatar';
import { QA, QA_ANIMATIONS_CSS } from './quickAccessTheme';

const UPCOMING_WINDOW_DAYS = 14;
const UPCOMING_LIMIT = 3;

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtToday = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long' });
const fmtShort = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

// Per-tab theming — this app's own palette (purple/amber/emerald), not a copy of
// any external reference design's exact brand colors or illustration assets.
const TAB_THEME = {
  birthdays: {
    label: 'Birthdays', icon: FaBirthdayCake, accent: '#7C3AED', light: '#F3E8FF',
    illustration: '🎂', floaters: ['🎈', '🎁', '✨'],
    heroTitle: (name) => <>Happy Birthday, <span style={{ color: '#7C3AED' }}>{name}!</span> 🎉</>,
    actionLabel: 'Send Wishes', actionIcon: FaHeart,
    footer: '🎉 Celebrate together and make every birthday memorable.',
    emptyToday: 'No birthdays today', emptyIcon: '🎂',
  },
  anniversaries: {
    label: 'Work Anniversaries', icon: FaTrophy, accent: '#F59E0B', light: '#FFFBEB',
    illustration: '🏆', floaters: ['🎗️', '🥇', '✨'],
    heroTitle: (name) => <>Happy Work Anniversary, <span style={{ color: '#F59E0B' }}>{name}!</span> 🏆</>,
    actionLabel: 'Celebrate', actionIcon: FaGift,
    footer: '🏆 Recognizing dedication and celebrating milestones together.',
    emptyToday: 'No work anniversaries today', emptyIcon: '🏆',
  },
  new_joiners: {
    label: 'New Joiners', icon: FaUserFriends, accent: '#10B981', light: '#ECFDF5',
    illustration: '👋', floaters: ['💼', '🪴', '🎊'],
    heroTitle: (name) => <>Welcome Aboard, <span style={{ color: '#10B981' }}>{name}!</span> 🎉</>,
    actionLabel: 'Welcome', actionIcon: FaUserFriends,
    footer: '💚 Every new teammate brings fresh ideas and new energy.',
    emptyToday: 'No new joiners today', emptyIcon: '👋',
  },
};

const CONFETTI_EMOJI = ['🎉', '🎊', '✨', '🎈', '🎂'];
function ConfettiBurst() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const dist = 50 + (i % 3) * 18;
        const x = Math.round(Math.cos(angle) * dist);
        const y = Math.round(Math.sin(angle) * dist - 25);
        return (
          <span key={i} className="qa-confetti-piece" style={{ '--qa-x': `${x}px`, '--qa-y': `${y}px`, animationDelay: `${i * 0.03}s` }}>
            {CONFETTI_EMOJI[i % CONFETTI_EMOJI.length]}
          </span>
        );
      })}
    </>
  );
}

function WishThread({ recipientEmployeeId, recipientName, eventType, accent }) {
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
    <div style={{ marginTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={`Write a message for ${recipientName || 'them'}…`}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${QA.border}`, fontSize: 12, outline: 'none', background: '#fff' }}
          onKeyDown={e => { if (e.key === 'Enter') submitWish(); }}
        />
        <button onClick={submitWish} disabled={sending || !message.trim()}
          style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: sending || !message.trim() ? 'not-allowed' : 'pointer', opacity: sending || !message.trim() ? 0.6 : 1 }}>
          {sending ? '…' : 'Send'}
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: QA.danger, marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div style={{ fontSize: 11, color: QA.textMuted }}>Loading wishes…</div>
      ) : wishes.length === 0 ? (
        <div style={{ fontSize: 11, color: QA.textMuted }}>No wishes yet — be the first!</div>
      ) : wishes.map(w => (
        <div key={w.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
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
            <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid rgba(0,0,0,0.08)' }}>
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

function HeroCard({ theme, person, eventType, expanded, confetti, onAction }) {
  const name = person.first_name;
  const suffix = eventType === 'anniversary' ? `${person.years} Year${person.years === 1 ? '' : 's'}` : null;

  return (
    <div className="qa-fade-in" style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20, padding: 20,
      background: theme.light, display: 'grid', gridTemplateColumns: '1fr 140px', gap: 16, alignItems: 'center',
    }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar photo={person.profile_image} id={person.employee_id} firstName={person.first_name} lastName={person.last_name} size={58} />
            <div style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, border: '2px solid #fff' }}>
              {theme.illustration}
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: QA.textDark, lineHeight: 1.3 }}>{theme.heroTitle(name)}</div>
            <div style={{ fontSize: 12, color: QA.textMuted, marginTop: 2 }}>{person.position || person.designation}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {suffix && (
            <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, background: '#fff', borderRadius: 20, padding: '3px 10px' }}>⭐ {suffix}</span>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: QA.textMuted, background: '#fff', borderRadius: 20, padding: '3px 10px' }}>📅 Today, {fmtToday()}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: QA.textMuted, background: '#fff', borderRadius: 20, padding: '3px 10px' }}>👤 From {person.department || 'the'} Team</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
          {confetti && <ConfettiBurst />}
          <button onClick={onAction}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: expanded ? theme.accent : theme.accent, color: '#fff', fontSize: 12, fontWeight: 700,
              opacity: expanded ? 0.85 : 1,
            }}>
            <theme.actionIcon size={11} /> {theme.actionLabel}
          </button>
          <button onClick={onAction} title="Comment" style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${QA.border}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.accent }}>
            <FaCommentDots size={12} />
          </button>
        </div>

        {expanded && (
          <WishThread recipientEmployeeId={person.employee_id} recipientName={`${person.first_name} ${person.last_name}`} eventType={eventType} accent={theme.accent} />
        )}
      </div>

      {/* Decorative illustration side */}
      <div style={{ position: 'relative', height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 68, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.12))' }}>{theme.illustration}</div>
        {theme.floaters.map((f, i) => (
          <span key={i} style={{
            position: 'absolute', fontSize: 18, opacity: 0.8,
            top: `${10 + i * 30}%`, left: i % 2 === 0 ? '5%' : '78%',
          }}>{f}</span>
        ))}
      </div>
    </div>
  );
}

function EmptyToday({ theme }) {
  return (
    <div style={{ textAlign: 'center', padding: '22px 0', color: QA.textMuted, background: theme.light, borderRadius: 20 }}>
      <div style={{ fontSize: 34, marginBottom: 6 }}>{theme.emptyIcon}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{theme.emptyToday}</div>
    </div>
  );
}

function UpcomingRow({ theme, people, extraLabel }) {
  const shown = people.slice(0, UPCOMING_LIMIT);
  const extra = people.length - shown.length;

  return (
    <div className="qa-scroll-x">
      {shown.map(p => {
        const pct = Math.max(8, Math.round(((UPCOMING_WINDOW_DAYS - p.days_until) / UPCOMING_WINDOW_DAYS) * 100));
        return (
          <div key={p.employee_id} style={{ minWidth: 110, flexShrink: 0, padding: '10px 10px', borderRadius: 12, background: '#f9fafb' }}>
            <Avatar photo={p.profile_image} id={p.employee_id} firstName={p.first_name} lastName={p.last_name} size={34} />
            <div style={{ fontSize: 11, fontWeight: 700, color: QA.textDark, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.first_name}
            </div>
            <div style={{ fontSize: 10, color: QA.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.position || p.designation}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: theme.accent, fontWeight: 700, marginTop: 4 }}>
              <span>{fmtShort(p.joining_date || p.dob)}</span>
              <span>{p.days_until === 1 ? 'Tomorrow' : `${p.days_until}d`}</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: '#e5e7eb', marginTop: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: theme.accent, borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
      {extra > 0 && (
        <div style={{ minWidth: 110, flexShrink: 0, padding: '10px', borderRadius: 12, background: theme.light, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
            <FaUserFriends size={13} color={theme.accent} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: theme.accent }}>+{extra} More</div>
          <div style={{ fontSize: 9, color: QA.textMuted }}>{extraLabel}</div>
        </div>
      )}
    </div>
  );
}

export default function CelebrationsCard() {
  const { todayEvents } = useNotification();
  const [expandedId, setExpandedId] = useState(null);
  const [confettiFor, setConfettiFor] = useState(null);
  // null = not manually chosen yet — falls back to whichever tab actually has
  // something today (birthdays > anniversaries > new joiners). Once the user
  // clicks a tab, it's pinned and no longer auto-switches.
  const [tab, setTab] = useState(null);
  const [upcoming, setUpcoming] = useState({ birthdays: [], anniversaries: [], new_joiners: [] });

  useEffect(() => {
    let cancelled = false;
    axios.get(API_ENDPOINTS.TODAY_EVENTS_UPCOMING)
      .then(res => { if (!cancelled && res.data?.success) setUpcoming(res.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleAction = (employeeId) => {
    setExpandedId(prev => prev === employeeId ? null : employeeId);
    setConfettiFor(employeeId);
    setTimeout(() => setConfettiFor(null), 900);
  };

  const todayBirthdays = todayEvents?.birthdays || [];
  const todayAnniversaries = todayEvents?.anniversaries || [];
  const todayNewJoiners = (upcoming.new_joiners || []).filter(p => p.joining_date === todayStr());
  const laterNewJoiners = (upcoming.new_joiners || []).filter(p => p.joining_date !== todayStr());

  const autoTab = todayBirthdays.length > 0 ? 'birthdays'
    : todayAnniversaries.length > 0 ? 'anniversaries'
    : todayNewJoiners.length > 0 ? 'new_joiners'
    : 'birthdays';
  const activeTab = tab || autoTab;

  const TABS = [
    { key: 'birthdays', count: todayBirthdays.length },
    { key: 'anniversaries', count: todayAnniversaries.length },
    { key: 'new_joiners', count: todayEvents ? todayNewJoiners.length + laterNewJoiners.length : upcoming.new_joiners.length },
  ];

  const theme = TAB_THEME[activeTab];
  const eventType = activeTab === 'birthdays' ? 'birthday' : activeTab === 'anniversaries' ? 'anniversary' : 'new_joiner';
  const todayPeople = activeTab === 'birthdays' ? todayBirthdays : activeTab === 'anniversaries' ? todayAnniversaries : todayNewJoiners;
  const upcomingPeople = activeTab === 'birthdays' ? upcoming.birthdays : activeTab === 'anniversaries' ? upcoming.anniversaries : laterNewJoiners;

  return (
    <div className="qa-hover-lift" style={{ background: '#fff', borderRadius: 22, border: `1px solid ${QA.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 20 }}>
      <style>{QA_ANIMATIONS_CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: QA.textDark }}>🎉 Celebrations</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const th = TAB_THEME[t.key];
          const active = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20,
                border: active ? 'none' : `1px solid ${QA.border}`, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: active ? th.accent : '#fff',
                color: active ? '#fff' : QA.textMuted,
                transition: 'all 0.15s',
              }}>
              <th.icon size={11} /> {th.label}
              <span style={{
                fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '1px 7px',
                background: active ? 'rgba(255,255,255,0.25)' : th.light, color: active ? '#fff' : th.accent,
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accent, display: 'inline-block' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: QA.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Today</span>
      </div>

      {todayPeople.length === 0 ? (
        <EmptyToday theme={theme} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <HeroCard
            theme={theme} person={todayPeople[0]} eventType={eventType}
            expanded={expandedId === todayPeople[0].employee_id}
            confetti={confettiFor === todayPeople[0].employee_id}
            onAction={() => handleAction(todayPeople[0].employee_id)}
          />
          {todayPeople.slice(1).map(p => (
            <div key={p.employee_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }}>
              <Avatar photo={p.profile_image} id={p.employee_id} firstName={p.first_name} lastName={p.last_name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: QA.textDark }}>{p.first_name} {p.last_name}</div>
                <div style={{ fontSize: 10, color: QA.textMuted }}>{p.department}</div>
              </div>
              <button onClick={() => handleAction(p.employee_id)}
                style={{ padding: '5px 12px', borderRadius: 20, border: 'none', background: theme.light, color: theme.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {theme.actionLabel}
              </button>
              {expandedId === p.employee_id && (
                <WishThread recipientEmployeeId={p.employee_id} recipientName={`${p.first_name} ${p.last_name}`} eventType={eventType} accent={theme.accent} />
              )}
            </div>
          ))}
        </div>
      )}

      {upcomingPeople.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 8px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: QA.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {activeTab === 'new_joiners' ? 'Joined This Week' : 'Upcoming'}
            </span>
          </div>
          <UpcomingRow theme={theme} people={upcomingPeople} extraLabel="View all upcoming" />
        </>
      )}

      <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 14, background: theme.light, color: theme.accent, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
        {theme.footer}
      </div>
    </div>
  );
}
