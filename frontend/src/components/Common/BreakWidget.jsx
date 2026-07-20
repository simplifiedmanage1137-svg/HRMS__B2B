import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner } from 'react-bootstrap';
import { Coffee, Square, Clock, Users, ChevronDown, CheckCircle, History } from 'lucide-react';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';

// ── Break type definitions ────────────────────────────────────────────────────
const BREAK_TYPES = [
    { key: 'tea_break_1', label: 'Tea Break 1', minutes: 15, emoji: '☕' },
    { key: 'tea_break_2', label: 'Tea Break 2', minutes: 15, emoji: '☕' },
    { key: 'lunch_break', label: 'Lunch Break',  minutes: 30, emoji: '🍽️' },
];

const breakDef   = (key) => BREAK_TYPES.find(t => t.key === key) || { label: 'Break', emoji: '☕', minutes: 0 };
const breakLabel = (key) => breakDef(key).label;
const breakEmoji = (key) => breakDef(key).emoji;

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#0ea5e9','#ec4899'];
const avatarColor = (str) => AVATAR_COLORS[((str || '').charCodeAt(0) || 0) % AVATAR_COLORS.length];
const initials    = (f, l) => ((f || '')[0] || '?').toUpperCase() + ((l || '')[0] || '').toUpperCase();

const fmtDuration = (start) => {
    const diff = Math.floor((Date.now() - new Date(start).getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
};

const fmtTime = (iso) => {
    if (!iso) return '--:--';
    const d   = new Date(iso);
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const h   = ist.getUTCHours(), m = ist.getUTCMinutes();
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const fmtMins = (mins) => {
    if (!mins && mins !== 0) return '—';
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins} min`;
};

// ── Break dropdown (fixed-position, escapes overflow:hidden parents) ──────────
function BreakDropdown({ activeBreak, usedTypes, canInteract, acting, error, onStart, onEnd }) {
    const [open, setOpen]           = useState(false);
    const [pendingType, setPending] = useState(null);
    const [dropPos, setDropPos]     = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);
    const dropRef    = useRef(null);
    const allUsed    = BREAK_TYPES.every(t => usedTypes.includes(t.key));
    const activeType = BREAK_TYPES.find(t => t.key === activeBreak?.break_type);
    const pendingDef = BREAK_TYPES.find(t => t.key === pendingType);

    const openDropdown = () => {
        if (!canInteract || allUsed) return;
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropPos({ top: rect.bottom + 6, left: Math.max(8, rect.right - 190) });
        }
        setOpen(o => !o);
        setPending(null);
    };

    useEffect(() => {
        const close = (e) => {
            if (
                dropRef.current    && !dropRef.current.contains(e.target) &&
                triggerRef.current && !triggerRef.current.contains(e.target)
            ) { setOpen(false); setPending(null); }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const btnBase = {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 13px', borderRadius: 20, border: 'none',
        fontSize: 13, fontWeight: 600,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        whiteSpace: 'nowrap',
    };

    if (activeBreak) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <button onClick={onEnd} disabled={acting} style={{
                ...btnBase, background: '#f97316', color: '#fff',
                cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.7 : 1,
            }}>
                {acting ? <Spinner size="sm" animation="border" /> : <Square size={13} />}
                End {activeType?.label || 'Break'}
            </button>
            <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>
                <Clock size={9} style={{ marginRight: 2, verticalAlign: 'middle' }} />
                {fmtDuration(activeBreak.break_start)}
            </span>
            {error && <div style={{ fontSize: 10, color: '#ef4444' }}>{error}</div>}
        </div>
    );

    return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <button ref={triggerRef} onClick={openDropdown}
                disabled={acting || !canInteract || allUsed}
                style={{
                    ...btnBase,
                    background: allUsed ? '#e5e7eb' : '#6366f1',
                    color: allUsed ? '#9ca3af' : '#fff',
                    cursor: (acting || !canInteract || allUsed) ? 'not-allowed' : 'pointer',
                    opacity: (acting || !canInteract) ? 0.55 : 1,
                }}
            >
                {acting ? <Spinner size="sm" animation="border" /> : <Coffee size={13} />}
                {allUsed ? 'All Breaks Used' : 'Start Break'}
                {!allUsed && <ChevronDown size={12} />}
            </button>

            {open && (
                <div ref={dropRef} style={{
                    position: 'fixed', top: dropPos.top, left: dropPos.left,
                    zIndex: 99999, background: '#fff', borderRadius: 12, minWidth: 190,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb', overflow: 'hidden',
                }}>
                    {pendingType ? (
                        <div style={{ padding: '12px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                                {pendingDef?.emoji} Start {pendingDef?.label}?
                            </div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
                                Are you sure you want to go for a {pendingDef?.minutes}-minute break?
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => { setOpen(false); setPending(null); onStart(pendingType); }}
                                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                    Yes, Start
                                </button>
                                <button onClick={() => setPending(null)}
                                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #f3f4f6' }}>
                                Select Break Type
                            </div>
                            {BREAK_TYPES.map((t, i) => {
                                const used = usedTypes.includes(t.key);
                                return (
                                    <button key={t.key}
                                        onClick={() => { if (!used) setPending(t.key); }}
                                        disabled={used}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            width: '100%', padding: '6px 12px',
                                            border: 'none', textAlign: 'left',
                                            background: used ? '#fafafa' : 'transparent',
                                            cursor: used ? 'not-allowed' : 'pointer',
                                            borderBottom: i < BREAK_TYPES.length - 1 ? '1px solid #f3f4f6' : 'none',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => { if (!used) e.currentTarget.style.background = '#f5f3ff'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = used ? '#fafafa' : 'transparent'; }}
                                    >
                                        <span style={{ fontSize: 14 }}>{t.emoji}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: used ? '#9ca3af' : '#111827' }}>{t.label}</div>
                                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{t.minutes} mins</div>
                                        </div>
                                        {used
                                            ? <CheckCircle size={13} color="#10b981" />
                                            : <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 700 }}>USE</span>}
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
            {error && <div style={{ fontSize: 10, color: '#ef4444', textAlign: 'center', maxWidth: 160 }}>{error}</div>}
        </div>
    );
}

// ── Individual break history (compact, shown under the button in inline-button mode) ──
function MyBreakHistory({ breaks }) {
    const done = (breaks || []).filter(b => b.break_end);
    if (done.length === 0) return null;
    return (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {done.map(b => (
                <span key={b.id} style={{
                    fontSize: 10, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)',
                    borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap',
                    border: '1px solid rgba(255,255,255,0.15)',
                }}>
                    {breakEmoji(b.break_type)} {fmtTime(b.break_start)} → {fmtTime(b.break_end)}
                    {b.break_duration_minutes ? ` · ${b.break_duration_minutes}m` : ''}
                </span>
            ))}
        </div>
    );
}

// ── Team break panel (active + today's history) ───────────────────────────────
function TeamPanel({ todayBreaks, loading }) {
    const active    = (todayBreaks || []).filter(b => !b.break_end);
    const completed = (todayBreaks || []).filter(b => b.break_end);

    const EmpChip = ({ b, live }) => {
        const emp   = b.employee || {};
        const name  = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || b.employee_id;
        const color = avatarColor(emp.first_name);
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderBottom: '1px solid #f9fafb',
            }}>
                <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: color, color: '#fff', fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {initials(emp.first_name, emp.last_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {name}
                    </div>
                    <div style={{ fontSize: 11, color: live ? '#d97706' : '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>{breakEmoji(b.break_type)}</span>
                        <span>{breakLabel(b.break_type)}</span>
                        {live
                            ? <><span style={{ color: '#d1d5db' }}>·</span><span>{fmtDuration(b.break_start)}</span></>
                            : <><span style={{ color: '#d1d5db' }}>·</span><span>{fmtTime(b.break_start)} → {fmtTime(b.break_end)}</span></>
                        }
                    </div>
                </div>
                {live
                    ? <span style={{ fontSize: 9, background: '#fef3c7', color: '#92400e', borderRadius: 99, padding: '2px 7px', fontWeight: 700, flexShrink: 0 }}>LIVE</span>
                    : <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{fmtMins(b.break_duration_minutes)}</span>
                }
            </div>
        );
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <Spinner size="sm" animation="border" variant="secondary" />
        </div>
    );

    if (active.length === 0 && completed.length === 0) return (
        <div style={{ fontSize: 12, color: '#d1d5db', textAlign: 'center', padding: '14px 0' }}>
            No breaks today
        </div>
    );

    return (
        <div>
            {/* Active now */}
            {active.length > 0 && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 4px', background: '#fffbeb' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 0 2px #fde68a' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            On Break Now
                        </span>
                        <span style={{ fontSize: 10, background: '#f59e0b', color: '#fff', borderRadius: 99, padding: '0 6px', fontWeight: 700 }}>{active.length}</span>
                    </div>
                    {active.map(b => <EmpChip key={b.id} b={b} live={true} />)}
                </div>
            )}

            {/* Today's history */}
            {completed.length > 0 && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 4px', background: '#f0fdf4', borderTop: active.length ? '1px solid #f3f4f6' : 'none' }}>
                        <History size={11} color="#16a34a" />
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Completed Today
                        </span>
                        <span style={{ fontSize: 10, background: '#16a34a', color: '#fff', borderRadius: 99, padding: '0 6px', fontWeight: 700 }}>{completed.length}</span>
                    </div>
                    {completed.map(b => <EmpChip key={b.id} b={b} live={false} />)}
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
// mode="inline-button" — compact button, sits next to clock button
// mode="team-panel"    — full team break activity card (managers / admin)
// mode="full"          — legacy combined card
export default function BreakWidget({ isClockedIn = false, isClockedOut = false, mode = 'full' }) {
    const { user } = useAuth();
    const [activeBreak,   setActiveBreak]   = useState(null);
    const [usedTypes,     setUsedTypes]     = useState([]);
    const [sessionBreaks, setSessionBreaks] = useState([]); // own breaks this session
    const [todayBreaks,   setTodayBreaks]   = useState([]); // team breaks today
    const [loading,   setLoading]   = useState(true);
    const [acting,    setActing]    = useState(false);
    const [error,     setError]     = useState('');
    const [, setTicker] = useState(0);
    const timerRef = useRef(null);

    const isManager = ['admin', 'sub_admin', 'manager', 'hr'].includes(user?.role);

    const fetchStatus = useCallback(async () => {
        try {
            if (mode === 'inline-button') {
                const res = await axios.get(API_ENDPOINTS.BREAK_MY_STATUS);
                setActiveBreak(res.data.active_break || null);
                setUsedTypes(res.data.used_break_types || []);
                setSessionBreaks(res.data.session_breaks || []);
            } else if (mode === 'team-panel') {
                if (!isManager) return;
                const res = await axios.get(API_ENDPOINTS.BREAK_TEAM_TODAY);
                setTodayBreaks(res.data.breaks || []);
            } else {
                // full mode
                const [myRes, teamRes] = await Promise.allSettled([
                    axios.get(API_ENDPOINTS.BREAK_MY_STATUS),
                    isManager ? axios.get(API_ENDPOINTS.BREAK_TEAM_TODAY) : Promise.resolve({ data: { breaks: [] } }),
                ]);
                if (myRes.status === 'fulfilled') {
                    setActiveBreak(myRes.value.data.active_break || null);
                    setUsedTypes(myRes.value.data.used_break_types || []);
                    setSessionBreaks(myRes.value.data.session_breaks || []);
                }
                if (teamRes.status === 'fulfilled') setTodayBreaks(teamRes.value.data.breaks || []);
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [isManager, mode]);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30_000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Live ticker for active breaks
    useEffect(() => {
        const active = mode === 'team-panel'
            ? todayBreaks.some(b => !b.break_end)
            : !!activeBreak;
        if (active) {
            timerRef.current = setInterval(() => setTicker(t => t + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [activeBreak, todayBreaks, mode]);

    const handleStart = async (breakType) => {
        setActing(true); setError('');
        try {
            const res = await axios.post(API_ENDPOINTS.BREAK_START, { break_type: breakType });
            setActiveBreak(res.data.break);
            await fetchStatus();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to start break');
        } finally { setActing(false); }
    };

    const handleEnd = async () => {
        setActing(true); setError('');
        try {
            await axios.post(API_ENDPOINTS.BREAK_END);
            setActiveBreak(null);
            await fetchStatus();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to end break');
        } finally { setActing(false); }
    };

    const canInteract = isClockedIn && !isClockedOut;

    // ── inline-button mode ────────────────────────────────────────────────────
    if (mode === 'inline-button') return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <BreakDropdown
                activeBreak={activeBreak}
                usedTypes={usedTypes}
                canInteract={canInteract}
                acting={acting}
                error={error}
                onStart={handleStart}
                onEnd={handleEnd}
            />
            <MyBreakHistory breaks={sessionBreaks} />
        </div>
    );

    // ── team-panel mode ───────────────────────────────────────────────────────
    if (mode === 'team-panel') {
        if (!isManager) return null;
        const activeCount    = todayBreaks.filter(b => !b.break_end).length;
        const completedCount = todayBreaks.filter(b => b.break_end).length;
        return (
            <div style={{ marginBottom: 16 }}>
                <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    {/* Panel header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Coffee size={14} color="#f59e0b" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Team Break Activity</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {activeCount > 0 && (
                                <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>
                                    {activeCount} live
                                </span>
                            )}
                            {completedCount > 0 && (
                                <span style={{ fontSize: 10, background: '#f0fdf4', color: '#15803d', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>
                                    {completedCount} done
                                </span>
                            )}
                        </div>
                    </div>
                    <TeamPanel todayBreaks={todayBreaks} loading={loading} />
                </div>
            </div>
        );
    }

    // ── full mode ─────────────────────────────────────────────────────────────
    const activeType = BREAK_TYPES.find(t => t.key === activeBreak?.break_type);
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: activeBreak ? '#fef3c7' : '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Coffee size={15} color={activeBreak ? '#92400e' : '#4338ca'} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>
                                {activeBreak ? (activeType?.label || 'On Break') : 'Break'}
                                {activeBreak && (
                                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: '#d97706', background: '#fef3c7', borderRadius: 12, padding: '1px 8px' }}>
                                        {fmtDuration(activeBreak.break_start)}
                                    </span>
                                )}
                            </div>
                            {!activeBreak && sessionBreaks.filter(b => b.break_end).length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                                    {sessionBreaks.filter(b => b.break_end).map(b => (
                                        <span key={b.id} style={{ fontSize: 10, borderRadius: 10, padding: '1px 7px', background: '#f3f4f6', color: '#6b7280' }}>
                                            {breakEmoji(b.break_type)} {fmtMins(b.break_duration_minutes)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <BreakDropdown
                        activeBreak={activeBreak}
                        usedTypes={usedTypes}
                        canInteract={canInteract}
                        acting={acting}
                        error={error}
                        onStart={handleStart}
                        onEnd={handleEnd}
                    />
                </div>
                {isManager && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 4px', borderBottom: '1px solid #f9fafb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Users size={12} color="#9ca3af" />
                                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Team Break Activity</span>
                            </div>
                        </div>
                        <TeamPanel todayBreaks={todayBreaks} loading={loading} />
                    </>
                )}
            </div>
        </div>
    );
}
