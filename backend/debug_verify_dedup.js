const supabase = require('./config/supabase');

const toUTCMs = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  if (/[Zz]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const clean = s.replace('T', ' ').substring(0, 19);
  const [datePart, timePart] = clean.split(' ');
  if (!datePart || !timePart) return null;
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi, sec = 0] = timePart.split(':').map(Number);
  if ([y, mo, d, h, mi].some(isNaN)) return null;
  return Date.UTC(y, mo - 1, d, h, mi, sec) - IST_OFFSET_MS;
};

(async () => {
  const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: attendance } = await supabase
    .from('attendance')
    .select('*, employees(first_name, last_name, department, shift_timing)')
    .gte('attendance_date', todayIST)
    .lte('attendance_date', todayIST)
    .order('attendance_date', { ascending: false });

  // Replicate the FIXED dedup logic exactly
  const dedupedAttendanceMap = {};
  attendance.forEach(record => {
    const dateKey = record.attendance_date ? record.attendance_date.split('T')[0] : record.attendance_date;
    const key = `${record.employee_id}-${dateKey}`;
    const existing = dedupedAttendanceMap[key];
    if (!existing) { dedupedAttendanceMap[key] = record; return; }

    const existingClockOut = existing.clock_out_ist || existing.clock_out;
    const newClockOut = record.clock_out_ist || record.clock_out;

    if (newClockOut && !existingClockOut) {
      dedupedAttendanceMap[key] = record;
    } else if (newClockOut && existingClockOut) {
      const existingMs = toUTCMs(existingClockOut);
      const newMs = toUTCMs(newClockOut);
      if (newMs > existingMs) dedupedAttendanceMap[key] = record;
    } else if (!existingClockOut && !newClockOut) {
      const existingTime = new Date(existing.updated_at || existing.created_at).getTime() || 0;
      const newTime = new Date(record.updated_at || record.created_at).getTime() || 0;
      if (newTime > existingTime) {
        dedupedAttendanceMap[key] = record;
      } else if (newTime === existingTime) {
        const existingHasClockIn = !!(existing.clock_in || existing.clock_in_ist);
        const newHasClockIn = !!(record.clock_in || record.clock_in_ist);
        if (newHasClockIn && !existingHasClockIn) dedupedAttendanceMap[key] = record;
      }
    }
  });

  const targets = ['B2B260407', 'B2B250905'];
  for (const id of targets) {
    const key = `${id}-${todayIST}`;
    const r = dedupedAttendanceMap[key];
    console.log(id, '->', r ? { id: r.id, clock_in: r.clock_in_ist || r.clock_in, clock_out: r.clock_out_ist || r.clock_out, status: r.status } : 'NOT FOUND');
  }
  process.exit(0);
})();