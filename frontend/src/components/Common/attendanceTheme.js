// src/components/Common/attendanceTheme.js
//
// Shared design tokens + CSS for the "premium" attendance table look, used consistently
// across every attendance table in the app (Admin daily/monthly reports, Manager/TL team
// attendance, and each employee's own attendance history), so redesigning one doesn't drift
// out of sync with the others.

export const DA = {
  bg: '#f5f7fb',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  secondary: '#667085',
  primaryGreen: '#16a34a',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  purple: '#8b5cf6',
};

// Status pill styles — Present = green outline, Working = solid green, everything else a
// soft translucent "glass" tint matching its semantic color.
export const STATUS_PILL = {
  present:  { background: '#fff',                color: '#16a34a', border: '1.5px solid #16a34a' },
  working:  { background: '#16a34a',              color: '#fff',    border: '1.5px solid #16a34a' },
  absent:   { background: 'rgba(239,68,68,.12)',  color: '#ef4444', border: '1px solid rgba(239,68,68,.3)' },
  late:     { background: 'rgba(245,158,11,.14)', color: '#d97706', border: '1px solid rgba(245,158,11,.3)' },
  half_day: { background: 'rgba(245,158,11,.14)', color: '#b45309', border: '1px solid rgba(245,158,11,.3)' },
  on_leave: { background: 'rgba(139,92,246,.14)', color: '#7c3aed', border: '1px solid rgba(139,92,246,.3)' },
  comp_off: { background: 'rgba(139,92,246,.14)', color: '#7c3aed', border: '1px solid rgba(139,92,246,.3)' },
  holiday:  { background: 'rgba(245,158,11,.14)', color: '#b45309', border: '1px solid rgba(245,158,11,.3)' },
  weekend:  { background: '#f1f5f9',              color: '#64748b', border: '1px solid #e2e8f0' },
  missing:  { background: 'rgba(17,24,39,.08)',   color: '#374151', border: '1px solid rgba(17,24,39,.15)' },
  not_clocked: { background: '#f1f5f9',           color: '#64748b', border: '1px solid #e2e8f0' },
};

export const LATE_PILL_ON_TIME = { background: '#ECFDF3', color: '#16a34a', border: '1px solid rgba(22,163,74,.2)' };
export const LATE_PILL_LATE     = { background: '#FEF3C7', color: '#D97706', border: '1px solid rgba(217,119,6,.2)' };

export const DA_TH_STYLE = {
  height: 60, verticalAlign: 'middle', textTransform: 'uppercase',
  fontSize: 13, fontWeight: 600, letterSpacing: '.5px', color: '#667085',
  background: '#fff', borderBottom: '1px solid #edf2f7', whiteSpace: 'nowrap',
};

const AVATAR_COLORS = ['#16a34a', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#22c55e'];
export const avatarColorFor = (id) =>
  AVATAR_COLORS[(String(id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
export const initialsFor = (first, last) => `${(first || '?')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();

// Shared card chrome: white, 18px radius, soft shadow, thin border, 4px green gradient top bar.
export const DA_CARD_STYLE = {
  background: DA.card, borderRadius: 18, boxShadow: '0 10px 35px rgba(16,24,40,.08)',
  overflow: 'hidden', border: `1px solid ${DA.border}`,
};
export const DA_GRADIENT_BAR = { height: 4, background: 'linear-gradient(90deg, #16a34a, #22c55e, #4ade80)' };

// Shared animations / hover states / scrollbar styling. Render once via <AttendanceTableStyles />
// inside any component using the "da-*" class names below.
export const ATTENDANCE_TABLE_CSS = `
  .da-row { transition: background .25s, transform .2s; }
  .da-row:hover { background: #f9fafb; }
  .da-badge { transition: transform .15s; }
  .da-badge:hover { transform: scale(1.06); }
  .da-action-btn { transition: background .2s; }
  .da-action-btn:hover { background: #f3f4f6 !important; }
  .da-fade-in { animation: daFadeIn .3s ease; }
  @keyframes daFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .da-skeleton {
    background: linear-gradient(90deg, #eef0f3 25%, #f6f7f9 37%, #eef0f3 63%);
    background-size: 400% 100%;
    animation: daShimmer 1.4s ease infinite;
  }
  @keyframes daShimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
  .da-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .da-scroll::-webkit-scrollbar-track { background: transparent; }
  .da-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 8px; }
  .da-scroll::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
  .da-scroll { scroll-behavior: smooth; }
  /* Plays once when a row first mounts (i.e. only newly-appended infinite-scroll rows —
     already-visible rows keep their React key and never remount, so they don't replay it). */
  .da-row-enter { animation: daRowEnter .35s ease; }
  @keyframes daRowEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;
