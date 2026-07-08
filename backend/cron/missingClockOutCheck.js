const cron = require('node-cron');
const supabase = require('../config/supabase');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const nowIST = () => {
    const ist = new Date(Date.now() + IST_OFFSET_MS);
    const y  = ist.getUTCFullYear();
    const mo = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const d  = String(ist.getUTCDate()).padStart(2, '0');
    const h  = String(ist.getUTCHours()).padStart(2, '0');
    const mi = String(ist.getUTCMinutes()).padStart(2, '0');
    const s  = String(ist.getUTCSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
};

const toUTCMs = (val) => {
    if (!val) return null;
    const s = String(val).trim().replace('T', ' ').substring(0, 19);
    const [datePart, timePart] = s.split(' ');
    if (!datePart || !timePart) return null;
    const [y, mo, d] = datePart.split('-').map(Number);
    const [h, mi, sec = 0] = timePart.split(':').map(Number);
    if ([y, mo, d, h, mi].some(isNaN)) return null;
    return Date.UTC(y, mo - 1, d, h, mi, sec) - IST_OFFSET_MS;
};

const MISSING_THRESHOLD_HOURS = 15;
const MISSING_THRESHOLD_MS    = MISSING_THRESHOLD_HOURS * 60 * 60 * 1000;

/**
 * Scans all open attendance records (clock_in set, clock_out NULL).
 * Any record where the employee has been clocked in for 15+ hours
 * is marked as 'missing':
 *   - status        → 'missing'
 *   - total_hours   → 0
 *   - total_minutes → 0
 *   - clock_out     stays NULL (no fabricated time)
 *   - session closed so next-day clock-in is unblocked
 */
const markMissingClockOuts = async () => {
    try {
        console.log('🔍 [MissingClockOut] Starting check...');

        const nowISTStr = nowIST();
        const nowMs     = toUTCMs(nowISTStr);

        // Fetch all open records (no clock_out) with a clock_in
        const { data: openRecords, error } = await supabase
            .from('attendance')
            .select('id, employee_id, attendance_date, clock_in, clock_in_ist, session_id, status')
            .not('clock_in', 'is', null)
            .is('clock_out', null)
            .neq('status', 'missing'); // skip already-marked ones

        if (error) {
            console.error('❌ [MissingClockOut] DB fetch error:', error);
            return { success: false, error: error.message };
        }

        let markedCount = 0;

        for (const record of (openRecords || [])) {
            const clockInValue = record.clock_in_ist || record.clock_in;
            const clockInMs    = toUTCMs(clockInValue);
            if (!clockInMs) continue;

            const elapsedMs = nowMs - clockInMs;
            if (elapsedMs < MISSING_THRESHOLD_MS) continue;

            // ── Mark as missing ──────────────────────────────────────────────
            const { error: updateErr } = await supabase
                .from('attendance')
                .update({
                    status:        'missing',
                    total_hours:   0,
                    total_minutes: 0,
                    total_hours_display: '0h 0m',
                })
                .eq('id', record.id);

            if (updateErr) {
                console.error(`❌ [MissingClockOut] Failed to mark ${record.employee_id} (${record.attendance_date}):`, updateErr);
                continue;
            }

            // ── Close the session so next-day clock-in is not blocked ────────
            if (record.session_id) {
                await supabase
                    .from('attendance_sessions')
                    .update({ is_active: false, clock_out_time: new Date().toISOString() })
                    .eq('session_id', record.session_id)
                    .eq('employee_id', record.employee_id);
            }

            markedCount++;
            const elapsedHours = (elapsedMs / (1000 * 60 * 60)).toFixed(1);
            console.log(`⚠️  [MissingClockOut] ${record.employee_id} | ${record.attendance_date} | ${elapsedHours}h elapsed → marked missing`);
        }

        console.log(`✅ [MissingClockOut] Done. Marked ${markedCount} record(s) as missing.`);
        return { success: true, markedCount };

    } catch (err) {
        console.error('❌ [MissingClockOut] Unexpected error:', err);
        return { success: false, error: err.message };
    }
};

// Run every 15 minutes
const scheduleMissingClockOutCheck = () => {
    cron.schedule('*/15 * * * *', async () => {
        await markMissingClockOuts();
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    console.log('📅 [MissingClockOut] Cron scheduled — runs every 15 minutes');
};

module.exports = { scheduleMissingClockOutCheck, markMissingClockOuts };
