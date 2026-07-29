// src/components/Employee/HolidayCalendar.jsx

import React, { useMemo, useState } from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { FaCalendarAlt } from 'react-icons/fa';
import { holidays } from '../../data/holidays';

// ── Design tokens (matches the indigo/enterprise palette used across Profile) ──
const HC = {
  primary: '#4F46E5',   // shared (USA & India)
  india: '#EA580C',
  usa: '#2563EB',
  optional: '#B45309',
  border: '#E5E7EB',
  borderSoft: '#EEF2F7',
  textMuted: '#667085',
};

const HC_CSS = `
.hc-card { background:#fff; border-radius:16px; border:1px solid ${HC.borderSoft}; box-shadow:0 6px 20px rgba(16,24,40,.05); }
.hc-header { padding:12px 16px; border-bottom:1px solid ${HC.borderSoft}; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.hc-title-wrap { display:flex; align-items:center; gap:9px; }
.hc-icon-circle { width:30px; height:30px; border-radius:9px; background:#EEF2FF; color:${HC.primary}; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:13px; }
.hc-title { font-size:13.5px; font-weight:700; color:#1D2939; margin:0; }
.hc-subtitle { font-size:11px; color:${HC.textMuted}; margin:0; }
.hc-year-toggle { display:flex; gap:4px; background:#F8FAFC; border:1px solid ${HC.borderSoft}; border-radius:9px; padding:3px; }
.hc-year-btn { border:none; background:transparent; font-size:11.5px; font-weight:600; color:${HC.textMuted}; padding:4px 10px; border-radius:7px; cursor:pointer; }
.hc-year-btn.active { background:${HC.primary}; color:#fff; }
.hc-legend { display:flex; flex-wrap:wrap; gap:12px; padding:10px 16px 0; }
.hc-legend-item { display:flex; align-items:center; gap:5px; font-size:10.5px; color:${HC.textMuted}; font-weight:600; }
.hc-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.hc-body { padding:12px 16px 14px; }
.hc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:10px; margin-top:10px; }
.hc-month { background:#F9FAFB; border:1px solid ${HC.borderSoft}; border-radius:11px; padding:8px 9px; }
.hc-month-title { font-size:10.5px; font-weight:700; color:#344054; margin-bottom:5px; text-transform:uppercase; letter-spacing:.4px; }
.hc-weekdays { display:grid; grid-template-columns:repeat(7,1fr); text-align:center; font-size:9px; color:#98A2B3; font-weight:700; margin-bottom:3px; }
.hc-days { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.hc-day { display:flex; align-items:center; justify-content:center; height:20px; font-size:10px; color:#667085; border:none; background:transparent; border-radius:5px; padding:0; position:relative; font-family:inherit; }
.hc-day--empty { visibility:hidden; }
.hc-day--weekend { color:#D0D5DD; }
.hc-day--holiday { cursor:pointer; font-weight:700; color:#fff; background:var(--hc-color, ${HC.primary}); }
.hc-day--holiday:hover { filter:brightness(1.1); }
.hc-day--holiday:focus { outline:2px solid rgba(79,70,229,.35); outline-offset:1px; }
.hc-emoji-badge { position:absolute; top:-5px; right:-3px; font-size:8px; line-height:1; }
.hc-upcoming { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:2px; }
.hc-upcoming-chip { display:inline-flex; align-items:center; gap:5px; background:#F8FAFC; border:1px solid ${HC.borderSoft}; border-radius:8px; padding:4px 9px; font-size:10.5px; font-weight:600; color:#344054; }
.hc-footer { margin-top:10px; padding-top:8px; border-top:1px solid #F5F6F8; font-size:10.5px; color:#98A2B3; }
`;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HOLIDAY_ICON_MAP = [
  [/new year/i, '🎆'],
  [/christmas/i, '🎄'],
  [/diwali/i, '🪔'],
  [/holi/i, '🎨'],
  [/eid/i, '🌙'],
  [/thanksgiving/i, '🦃'],
  [/republic day/i, '🎉'],
  [/independence/i, '🎉'],
  [/ganesh/i, '🐘'],
  [/labor|labour/i, '💼'],
  [/memorial/i, '🎗️'],
  [/martin luther|juneteenth/i, '✊'],
  [/president/i, '🏛️'],
  [/columbus/i, '🧭'],
  [/good friday/i, '✝️'],
  [/gandhi/i, '🕊️'],
];
const getHolidayIcon = (name) => (HOLIDAY_ICON_MAP.find(([re]) => re.test(name)) || [null, '🎉'])[1];

const colorForHoliday = (holiday) => {
  if (holiday.type === 'optional_holiday') return HC.optional;
  if (holiday.region === 'India') return HC.india;
  if (holiday.region === 'USA') return HC.usa;
  return HC.primary; // USA & India / shared
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const reasonFor = (holiday) => {
  if (holiday.note) return holiday.note;
  const kind = holiday.type === 'optional_holiday' ? 'an optional holiday' : 'a public holiday';
  return `${holiday.name} is observed as ${kind} for ${holiday.region}.`;
};

function MiniMonth({ year, month, holidaysByDate }) {
  const first = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="hc-month">
      <div className="hc-month-title">{MONTH_NAMES[month - 1]}</div>
      <div className="hc-weekdays">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="hc-days">
        {cells.map((day, idx) => {
          if (day === null) return <span key={idx} className="hc-day hc-day--empty">.</span>;

          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const holiday = holidaysByDate[dateStr];
          const dow = new Date(year, month - 1, day).getDay();
          const isWeekend = dow === 0 || dow === 6;

          if (!holiday) {
            return <span key={idx} className={`hc-day ${isWeekend ? 'hc-day--weekend' : ''}`}>{day}</span>;
          }

          return (
            <OverlayTrigger
              key={idx}
              trigger="click"
              placement="top"
              rootClose
              overlay={
                <Popover id={`hc-pop-${dateStr}`} style={{ maxWidth: 240 }}>
                  <Popover.Header style={{ fontSize: 12.5, fontWeight: 700 }}>
                    {getHolidayIcon(holiday.name)} {holiday.name}
                  </Popover.Header>
                  <Popover.Body style={{ fontSize: 11.5 }}>
                    <div className="mb-1" style={{ color: '#475467' }}>{formatDate(holiday.date)}</div>
                    <div className="mb-1" style={{ color: '#475467' }}><strong>Region:</strong> {holiday.region}</div>
                    <div style={{ color: '#344054' }}>{reasonFor(holiday)}</div>
                  </Popover.Body>
                </Popover>
              }
            >
              <button
                type="button"
                className="hc-day hc-day--holiday"
                style={{ '--hc-color': colorForHoliday(holiday) }}
                aria-label={`${holiday.name} — ${formatDate(holiday.date)}`}
              >
                {day}
                <span className="hc-emoji-badge">{getHolidayIcon(holiday.name)}</span>
              </button>
            </OverlayTrigger>
          );
        })}
      </div>
    </div>
  );
}

const HolidayCalendar = ({ employeeRegion = 'All' }) => {
  const [selectedYear, setSelectedYear] = useState(2026);

  const yearHolidays = useMemo(() => {
    return holidays
      .filter(h => h.date.startsWith(String(selectedYear)))
      .filter(h => h.region === 'USA & India' || h.region === employeeRegion || employeeRegion === 'All');
  }, [selectedYear, employeeRegion]);

  const holidaysByDate = useMemo(() => {
    const map = {};
    yearHolidays.forEach(h => { map[h.date] = h; });
    return map;
  }, [yearHolidays]);

  const upcoming = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return yearHolidays
      .filter(h => h.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  }, [yearHolidays]);

  return (
    <div className="hc-card">
      <style>{HC_CSS}</style>

      <div className="hc-header">
        <div className="hc-title-wrap">
          <div className="hc-icon-circle"><FaCalendarAlt /></div>
          <div>
            <p className="hc-title">Company Holiday Calendar</p>
            <p className="hc-subtitle">United States & India</p>
          </div>
        </div>
        <div className="hc-year-toggle">
          {[2025, 2026].map(y => (
            <button
              key={y}
              type="button"
              className={`hc-year-btn ${selectedYear === y ? 'active' : ''}`}
              onClick={() => setSelectedYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="hc-legend">
        <span className="hc-legend-item"><span className="hc-legend-dot" style={{ background: HC.primary }} /> Shared</span>
        <span className="hc-legend-item"><span className="hc-legend-dot" style={{ background: HC.india }} /> India</span>
        <span className="hc-legend-item"><span className="hc-legend-dot" style={{ background: HC.usa }} /> USA</span>
        <span className="hc-legend-item"><span className="hc-legend-dot" style={{ background: HC.optional }} /> Optional</span>
      </div>

      <div className="hc-body">
        {upcoming.length > 0 && (
          <div className="hc-upcoming">
            {upcoming.map((h, i) => (
              <span key={i} className="hc-upcoming-chip">
                {getHolidayIcon(h.name)} {formatDate(h.date).split(',').slice(0, 2).join(',')} — {h.name}
              </span>
            ))}
          </div>
        )}

        <div className="hc-grid">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
            <MiniMonth key={month} year={selectedYear} month={month} holidaysByDate={holidaysByDate} />
          ))}
        </div>

        <div className="hc-footer">
          Click a highlighted date to see the holiday reason. Subject to change — contact HR for the latest updates.
        </div>
      </div>
    </div>
  );
};

export default HolidayCalendar;
