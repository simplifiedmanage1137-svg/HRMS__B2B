// Audit trail for the Housekeeper IP-allowlist gate. Mirrors the insert-only history
// pattern already used for shift changes (see employee_shift_history in
// backend/routes/employeeRoutes.js) — one row per event, no update/delete.

const supabase = require('../config/supabase');
const { sendEmail } = require('../services/emailService');

const SPIKE_THRESHOLD = 10;
const SPIKE_WINDOW_MS = 15 * 60 * 1000;

// In-memory dedupe so a spike only notifies admins once per rolling window,
// even if this process handles many blocked requests in that window.
let lastSpikeAlertAt = 0;

async function logAuditEvent({ userId = null, eventType, ip = null, userAgent = null, metadata = null }) {
    try {
        await supabase.from('housekeeper_access_audit').insert([{
            user_id: userId,
            event_type: eventType,
            ip,
            user_agent: userAgent,
            metadata: metadata || null,
        }]);
    } catch (err) {
        // Audit logging must never break the request it's observing.
        console.warn('⚠️ [HousekeeperAudit] Failed to write audit event:', err.message);
    }

    if (eventType === 'ip_blocked' || eventType === 'ip_blocked_monitor') {
        checkForSpike().catch((err) => console.warn('⚠️ [HousekeeperAudit] Spike check failed:', err.message));
    }
}

async function checkForSpike() {
    const since = new Date(Date.now() - SPIKE_WINDOW_MS).toISOString();
    const { count, error } = await supabase
        .from('housekeeper_access_audit')
        .select('id', { count: 'exact', head: true })
        .in('event_type', ['ip_blocked', 'ip_blocked_monitor'])
        .gte('created_at', since);

    if (error) throw error;
    if ((count || 0) < SPIKE_THRESHOLD) return;
    if (Date.now() - lastSpikeAlertAt < SPIKE_WINDOW_MS) return; // already alerted this window

    lastSpikeAlertAt = Date.now();

    await logAuditEvent({
        eventType: 'spike_alert',
        metadata: { blocked_count: count, window_minutes: SPIKE_WINDOW_MS / 60000 },
    });

    notifyAdmins(count).catch((err) => console.warn('⚠️ [HousekeeperAudit] Admin notification failed:', err.message));
}

async function notifyAdmins(blockedCount) {
    const { data: admins, error } = await supabase
        .from('employees')
        .select('email, first_name')
        .in('role', ['admin', 'sub_admin', 'hr'])
        .eq('is_active', true)
        .not('email', 'is', null);
    if (error || !admins || admins.length === 0) return;

    const subject = '⚠️ Housekeeper IP-restriction: unusual block activity';
    const html = `
      <p>Hi,</p>
      <p><strong>${blockedCount}</strong> Housekeeper clock-in/login attempts were blocked by the
      IP allowlist in the last 15 minutes. This could mean an office network's IP changed, or
      someone is trying to access Housekeeper accounts from an unexpected location.</p>
      <p>Review the IP Access Control panel in Admin settings to check the blocked attempts and,
      if needed, update the allowlist or start an emergency override.</p>
    `;

    for (const admin of admins) {
        sendEmail({ to: admin.email, subject, html }).catch(() => {});
    }
}

module.exports = { logAuditEvent };
