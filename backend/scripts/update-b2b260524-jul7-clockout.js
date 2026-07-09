/**
 * Script: Fix clock-out for B2B260524 (Divya Navatkke) — 2026-07-07
 * Sets clock-out to 2026-07-08 02:35:00 IST (2:35 AM, crossing midnight)
 * Run: node scripts/update-b2b260524-jul7-clockout.js
 */

require('dotenv').config();
const supabase = require('../config/supabase');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const toUTCMs = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  const clean = s.replace('T', ' ').substring(0, 19);
  const [datePart, timePart] = clean.split(' ');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi, sec = 0] = timePart.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, sec) - IST_OFFSET_MS;
};

const istStringToUTCISO = (istStr) => {
  const ms = toUTCMs(istStr);
  return ms != null ? new Date(ms).toISOString() : null;
};

async function run() {
  const EMPLOYEE_ID = 'B2B260524';
  const ATTENDANCE_DATE = '2026-07-07';
  const NEW_CLOCK_OUT_IST = '2026-07-08 02:35:00';

  const { data: attendance, error: fetchErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', EMPLOYEE_ID)
    .eq('attendance_date', ATTENDANCE_DATE)
    .maybeSingle();

  if (fetchErr || !attendance) {
    console.error('Attendance record not found:', fetchErr?.message);
    process.exit(1);
  }

  const clockInMs = toUTCMs(attendance.clock_in_ist || attendance.clock_in);
  const clockOutMs = toUTCMs(NEW_CLOCK_OUT_IST);

  let totalMinutes = Math.round((clockOutMs - clockInMs) / (1000 * 60));
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  const totalHours = totalMinutes / 60;
  const displayHours = Math.floor(totalMinutes / 60);
  const displayMinutes = totalMinutes % 60;
  const totalHoursDisplay = `${displayHours}h ${displayMinutes}m`;

  const expectedWorkMinutes = 9 * 60; // shift_timing "11:00 AM - 8:00 PM"
  let status = 'half_day';
  if (totalMinutes >= expectedWorkMinutes) status = 'present';
  else if (totalMinutes < 300) status = 'absent';

  const updatePayload = {
    clock_out: istStringToUTCISO(NEW_CLOCK_OUT_IST),
    clock_out_ist: NEW_CLOCK_OUT_IST,
    total_hours: parseFloat(totalHours.toFixed(2)),
    total_minutes: totalMinutes,
    total_hours_display: totalHoursDisplay,
    status,
  };

  console.log('Before:', {
    clock_in_ist: attendance.clock_in_ist,
    clock_out_ist: attendance.clock_out_ist,
    total_hours: attendance.total_hours,
    total_minutes: attendance.total_minutes,
    status: attendance.status,
  });
  console.log('Update payload:', updatePayload);

  const { data: updated, error: updateErr } = await supabase
    .from('attendance')
    .update(updatePayload)
    .eq('id', attendance.id)
    .select()
    .maybeSingle();

  if (updateErr) {
    console.error('Update failed:', updateErr.message);
    process.exit(1);
  }

  console.log('\nUpdated record:', JSON.stringify(updated, null, 2));
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
