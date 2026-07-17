import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner } from 'react-bootstrap';
import { Coffee, Square, Clock, Users, ChevronDown, CheckCircle } from 'lucide-react';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';

// ── Break type definitions ────────────────────────────────────────────────────
const BREAK_TYPES = [
    { key: 'tea_break_1', label: 'Tea Break 1', minutes: 15, emoji: '☕' },
    { key: 'tea_break_2', label: 'Tea Break 2', minutes: 15, emoji: '☕' },
    { key: 'lunch_break', label: 'Lunch Break',  minutes: 30, emoji: '🍽️' },
];

const breakLabel = (key) => BREAK_TYPES.find(t => t.key === key)?.label || 'Break';

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#0ea5e9','#ec4899'];
const avatarColor = (str) => AVATAR_COLORS[((str || '').charCodeAt(0) || 0) % AVATAR_COLORS.length];
const initials = (f, l) => ((f || '')[0] || '?').toUpperCase() + ((l || '')[0] || '').toUpperCase();

const fmtDuration = (breakStart) => {
    const diff = Math.floor((Date.now() - new Date(breakStart).getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
};

const fmtTime = (iso) => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const h = ist.getUTCHours(), m = ist.getUTCMinutes();
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

// ── Shared dropdown for all modes ─────────────────────────────────────────────
function BreakDropdown({ activeBreak, usedTypes, canInteract, acting, error, onStart, onEnd, align = 'right' }) {
    const [open, setOpen] = useState(false);
    const [pendingType, setPendingType] = useState(null); // break type awaiting confirmation
    const ref = useRef(null);
    const allUsed = BREAK_TYPES.every(t => usedTypes.includes(t.key));
    const activeType = BREAK_TYPES.find(t => t.key === activeBreak?.break_type);
    const pendingDef = BREAK_TYPES.find(t => t.key === pendingType);

    useEffect(() => {
        const close = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
                setPendingType(null);
            }
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

    if (activeBreak) {
        return (
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
                {error && <div style={{ fontSize: 10, color: '#ef4444', textAlign: 'center' }}>{error}</div>}
            </div>
        );
    }

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <button
                onClick={() => { if (canInteract && !allUsed) { setOpen(o => !o); setPendingType(null); } }}
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
                <div style={{
                    position: 'absolute',
                    [align === 'left' ? 'left' : 'right']: 0,
                    top: 'calc(100% + 6px)', zIndex: 9999,
                    background: '#fff', borderRadius: 12, minWidth: 188,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    border: '1px solid #e5e7eb', overflow: 'hidden',
                }}>
                    {/* Confirmation screen */}
                    {pendingType ? (
                        <div style={{ padding: '12px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                                {pendingDef?.emoji} Start {pendingDef?.label}?
                            </div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
                                Are you sure you want to go for a {pendingDef?.minutes}-minute break?
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={() => { setOpen(false); setPendingType(null); onStart(pendingType); }}
                                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Yes, Start
                                </button>
                                <button
                                    onClick={() => setPendingType(null)}
                                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                >
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
                                        onClick={() => { if (!used) setPendingType(t.key); }}
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
                                            <div style={{ fontSize: 12, fontWeight: 600, color: used ? '#9ca3af' : '#111827' }}>
                                                {t.label}
                                            </div>
                                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{t.minutes} mins</div>
                                        </div>
                                        {used
                                            ? <CheckCircle size={13} color="#10b981" />
                                            : <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 700 }}>USE</span>
                                        }
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

// ── Team panel ────────────────────────────────────────────────────────────────
function TeamPanel({ teamBreaks, loading }) {
    return (
        <div style={{ padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Users size={12} color="#9ca3af" />
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Team on Break
                </span>
                {teamBreaks.length > 0 && (
                    <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>
                        {teamBreaks.length}
                    </span>
                )}
            </div>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                    <Spinner size="sm" animation="border" variant="secondary" />
                </div>
            ) : teamBreaks.length === 0 ? (
                <div style={{ fontSize: 12, color: '#d1d5db', textAlign: 'center', padding: '6px 0' }}>
                    No team members currently on break
                </div>
            ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {teamBreaks.map(b => {
                        const emp = b.employee;
                        const name = `${emp.first_name} ${emp.last_name}`.trim();
                        const color = avatarColor(emp.first_name);
                        const bLabel = breakLabel(b.break_type);
                        return (
                            <div key={b.id}
                                title={`${name} · ${bLabel} · started ${fmtTime(b.break_start)}`}
                                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 6px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {initials(emp.first_name, emp.last_name)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{name}</div>
                                    <div style={{ fontSize: 10, color: '#d97706' }}>{bLabel} · {fmtDuration(b.break_start)}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
// mode="inline-button" — compact button only, embeds next to clock button
// mode="team-panel"    — team-on-break card (managers only)
// mode="full"          — button + team panel in one card (legacy)
export default function BreakWidget({ isClockedIn = false, isClockedOut = false, mode = 'full' }) {
    const { user } = useAuth();
    const [activeBreak, setActiveBreak]   = useState(null);
    const [usedTypes, setUsedTypes]       = useState([]);
    const [teamBreaks, setTeamBreaks]     = useState([]);
    const [loading, setLoading]           = useState(true);
    const [acting, setActing]             = useState(false);
    const [error, setError]               = useState('');
    const [, setTicker]                   = useState(0);
    const timerRef = useRef(null);

    const isManager = ['admin', 'sub_admin', 'manager'].includes(user?.role);

    const fetchStatus = useCallback(async () => {
        try {
            if (mode === 'inline-button') {
                const res = await axios.get(API_ENDPOINTS.BREAK_MY_STATUS);
                setActiveBreak(res.data.active_break || null);
                setUsedTypes(res.data.used_break_types || []);
            } else if (mode === 'team-panel') {
                if (!isManager) return;
                const res = await axios.get(API_ENDPOINTS.BREAK_TEAM_ACTIVE);
                setTeamBreaks(res.data.breaks || []);
            } else {
                const [myRes, teamRes] = await Promise.allSettled([
                    axios.get(API_ENDPOINTS.BREAK_MY_STATUS),
                    isManager ? axios.get(API_ENDPOINTS.BREAK_TEAM_ACTIVE) : Promise.resolve({ data: { breaks: [] } }),
                ]);
                if (myRes.status === 'fulfilled') {
                    setActiveBreak(myRes.value.data.active_break || null);
                    setUsedTypes(myRes.value.data.used_break_types || []);
                }
                if (teamRes.status === 'fulfilled') setTeamBreaks(teamRes.value.data.breaks || []);
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [isManager, mode]);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30_000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    useEffect(() => {
        const shouldTick = !!activeBreak || (mode === 'team-panel' && teamBreaks.length > 0);
        if (shouldTick) {
            timerRef.current = setInterval(() => setTicker(t => t + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [activeBreak, teamBreaks, mode]);

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
    if (mode === 'inline-button') {
        return (
            <BreakDropdown
                activeBreak={activeBreak}
                usedTypes={usedTypes}
                canInteract={canInteract}
                acting={acting}
                error={error}
                onStart={handleStart}
                onEnd={handleEnd}
                align="right"
            />
        );
    }

    // ── team-panel mode ───────────────────────────────────────────────────────
    if (mode === 'team-panel') {
        if (!isManager) return null;
        return (
            <div style={{ marginBottom: 16 }}>
                <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    <TeamPanel teamBreaks={teamBreaks} loading={loading} />
                </div>
            </div>
        );
    }

    // ── full mode ─────────────────────────────────────────────────────────────
    const activeType = BREAK_TYPES.find(t => t.key === activeBreak?.break_type);
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: isManager ? '1px solid #f3f4f6' : 'none', flexWrap: 'wrap', gap: 10 }}>
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
                            {!activeBreak && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                                    {BREAK_TYPES.map(t => (
                                        <span key={t.key} style={{
                                            fontSize: 10, fontWeight: 600, borderRadius: 10, padding: '1px 7px',
                                            background: usedTypes.includes(t.key) ? '#f3f4f6' : '#e0e7ff',
                                            color: usedTypes.includes(t.key) ? '#9ca3af' : '#4338ca',
                                            textDecoration: usedTypes.includes(t.key) ? 'line-through' : 'none',
                                        }}>
                                            {t.emoji} {t.label}
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
                        align="right"
                    />
                </div>
                {isManager && <TeamPanel teamBreaks={teamBreaks} loading={loading} />}
            </div>
        </div>
    );
}
