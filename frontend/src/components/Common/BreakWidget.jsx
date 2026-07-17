import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner } from 'react-bootstrap';
import { Coffee, Square, Clock, Users } from 'lucide-react';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';

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
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const TeamPanel = ({ teamBreaks, loading }) => (
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
                    return (
                        <div key={b.id}
                            title={`${name} — on break since ${fmtTime(b.break_start)}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 6px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {initials(emp.first_name, emp.last_name)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{name}</div>
                                <div style={{ fontSize: 10, color: '#d97706' }}>{fmtDuration(b.break_start)}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
    </div>
);

// mode="inline-button" — just the pill button, embeds next to clock button
// mode="team-panel"    — just the team-on-break card for managers
// mode="full"          — original: button + team panel in one card
export default function BreakWidget({ isClockedIn = false, isClockedOut = false, mode = 'full' }) {
    const { user } = useAuth();
    const [activeBreak, setActiveBreak] = useState(null);
    const [teamBreaks, setTeamBreaks]   = useState([]);
    const [loading, setLoading]         = useState(true);
    const [acting, setActing]           = useState(false);
    const [error, setError]             = useState('');
    const [, setTicker]                 = useState(0);
    const timerRef = useRef(null);

    const isManager = ['admin', 'sub_admin', 'manager'].includes(user?.role);

    const fetchStatus = useCallback(async () => {
        try {
            if (mode === 'inline-button') {
                const res = await axios.get(API_ENDPOINTS.BREAK_MY_STATUS);
                setActiveBreak(res.data.active_break || null);
            } else if (mode === 'team-panel') {
                if (!isManager) return;
                const res = await axios.get(API_ENDPOINTS.BREAK_TEAM_ACTIVE);
                setTeamBreaks(res.data.breaks || []);
            } else {
                const [myRes, teamRes] = await Promise.allSettled([
                    axios.get(API_ENDPOINTS.BREAK_MY_STATUS),
                    isManager ? axios.get(API_ENDPOINTS.BREAK_TEAM_ACTIVE) : Promise.resolve({ data: { breaks: [] } }),
                ]);
                if (myRes.status === 'fulfilled')  setActiveBreak(myRes.value.data.active_break || null);
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
        if (activeBreak) {
            timerRef.current = setInterval(() => setTicker(t => t + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [activeBreak]);

    const handleStart = async () => {
        setActing(true); setError('');
        try {
            const res = await axios.post(API_ENDPOINTS.BREAK_START);
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
    const btnBase = {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 20, border: 'none',
        fontSize: 13, fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
    };

    // ── inline-button mode ────────────────────────────────────────────────────
    if (mode === 'inline-button') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                {activeBreak ? (
                    <>
                        <button onClick={handleEnd} disabled={acting} style={{
                            ...btnBase,
                            background: '#f97316', color: '#fff',
                            cursor: acting ? 'not-allowed' : 'pointer',
                            opacity: acting ? 0.7 : 1,
                        }}>
                            {acting ? <Spinner size="sm" animation="border" /> : <Square size={13} />}
                            End Break
                        </button>
                        <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>
                            <Clock size={9} style={{ marginRight: 2, verticalAlign: 'middle' }} />
                            {fmtDuration(activeBreak.break_start)}
                        </span>
                    </>
                ) : (
                    <button onClick={handleStart} disabled={acting || !canInteract} style={{
                        ...btnBase,
                        background: '#6366f1', color: '#fff',
                        cursor: (acting || !canInteract) ? 'not-allowed' : 'pointer',
                        opacity: (acting || !canInteract) ? 0.55 : 1,
                    }}>
                        {acting ? <Spinner size="sm" animation="border" /> : <Coffee size={13} />}
                        Start Break
                    </button>
                )}
                {error && <div style={{ fontSize: 10, color: '#ef4444', textAlign: 'center', maxWidth: 130 }}>{error}</div>}
            </div>
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

    // ── full mode (original) ──────────────────────────────────────────────────
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
                                {activeBreak ? 'On Break' : 'Break'}
                                {activeBreak && (
                                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: '#d97706', background: '#fef3c7', borderRadius: 12, padding: '1px 8px' }}>
                                        {fmtDuration(activeBreak.break_start)}
                                    </span>
                                )}
                            </div>
                            {activeBreak && (
                                <div style={{ fontSize: 11, color: '#9ca3af' }}>Started at {fmtTime(activeBreak.break_start)}</div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        {!canInteract && !activeBreak ? (
                            <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                                {isClockedOut ? 'Clocked out for today' : 'Clock in to take a break'}
                            </div>
                        ) : activeBreak ? (
                            <button onClick={handleEnd} disabled={acting}
                                style={{ ...btnBase, background: '#f97316', color: '#fff', cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.7 : 1 }}>
                                {acting ? <Spinner size="sm" animation="border" /> : <Square size={13} />}
                                End Break
                            </button>
                        ) : (
                            <button onClick={handleStart} disabled={acting || !canInteract}
                                style={{ ...btnBase, background: '#6366f1', color: '#fff', cursor: (acting || !canInteract) ? 'not-allowed' : 'pointer', opacity: (acting || !canInteract) ? 0.6 : 1 }}>
                                {acting ? <Spinner size="sm" animation="border" /> : <Coffee size={13} />}
                                Start Break
                            </button>
                        )}
                        {error && <div style={{ fontSize: 11, color: '#ef4444', textAlign: 'right' }}>{error}</div>}
                    </div>
                </div>
                {isManager && <TeamPanel teamBreaks={teamBreaks} loading={loading} />}
            </div>
        </div>
    );
}
