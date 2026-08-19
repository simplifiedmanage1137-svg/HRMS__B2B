// Housekeeper IP-allowlist gate — fail-open by design. A bug or DB hiccup here must
// never lock out the workforce, so every failure path resolves to "pass".
//
// Scope: pure-role only. This app stores a single `role` string per employee (see
// employees.role), not a roles[] array, so "pure Housekeeper" collapses to
// role === 'housekeeper' — kept as a named helper for parity with the spec and so the
// intent (never restrict an account that also has admin/HR/etc access) stays explicit
// if the schema ever grows multi-role support.

const supabase = require('../config/supabase');
const { ipMatchesAnyCidr } = require('./cidr');

const CACHE_TTL_MS = 60 * 1000;
let cache = null; // { expiresAt, policy, cidrs }

function isPureHousekeeper(role) {
    return role === 'housekeeper';
}

// Matches the x-forwarded-for parsing convention already used elsewhere in this backend
// (see backend/controllers/regularizationController.js clientIp()), with an x-real-ip
// fallback per the gate spec. First entry of x-forwarded-for is trusted as-is — this app
// runs behind Vercel, which strips spoofed inbound x-forwarded-for values before they
// reach the function; re-verify that assumption if the hosting platform ever changes.
function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) return String(xRealIp).trim();
    return (req.socket?.remoteAddress || 'unknown').toString().trim();
}

function invalidateCache() {
    cache = null;
}

async function loadPolicyAndAllowlist() {
    if (cache && cache.expiresAt > Date.now()) return cache;

    const [{ data: policyRow, error: policyErr }, { data: networks, error: netErr }] = await Promise.all([
        supabase.from('housekeeper_network_policy').select('*').eq('id', 1).maybeSingle(),
        supabase.from('housekeeper_allowlisted_networks').select('cidr, is_active').eq('is_active', true),
    ]);

    if (policyErr) throw policyErr;
    if (netErr) throw netErr;

    const result = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        policy: policyRow || { restriction_enabled: false, monitor_only: true, emergency_override_until: null },
        cidrs: (networks || []).map((n) => n.cidr),
    };
    cache = result;
    return result;
}

/**
 * @returns {Promise<{ decision: 'pass'|'blocked', monitorOnly?: boolean, ip?: string, reason?: string }>}
 */
async function evaluateNetworkGate(req, userId, role) {
    try {
        if (!isPureHousekeeper(role)) return { decision: 'pass', reason: 'not_housekeeper' };

        const { policy, cidrs } = await loadPolicyAndAllowlist();

        if (!policy.restriction_enabled) return { decision: 'pass', reason: 'restriction_disabled' };

        if (policy.emergency_override_until && new Date(policy.emergency_override_until) > new Date()) {
            return { decision: 'pass', reason: 'emergency_override' };
        }

        if (cidrs.length === 0) {
            // An empty allowlist would block every Housekeeper — that's a misconfiguration,
            // not an intentional lockout, so treat it as an open gate.
            return { decision: 'pass', reason: 'empty_allowlist' };
        }

        const ip = getClientIp(req);
        if (ipMatchesAnyCidr(ip, cidrs)) return { decision: 'pass', ip, reason: 'ip_allowed' };

        const { logAuditEvent } = require('./housekeeperAudit');
        await logAuditEvent({
            userId,
            eventType: policy.monitor_only ? 'ip_blocked_monitor' : 'ip_blocked',
            ip,
            userAgent: req.headers['user-agent'] || null,
            metadata: { monitorOnly: policy.monitor_only, path: req.originalUrl },
        });

        if (policy.monitor_only) return { decision: 'pass', monitorOnly: true, ip, reason: 'monitor_only' };

        return { decision: 'blocked', ip, reason: 'ip_not_allowlisted' };
    } catch (err) {
        console.warn('⚠️ [HousekeeperNetworkGate] evaluateNetworkGate error — failing open:', err.message);
        return { decision: 'pass', reason: 'gate_error' };
    }
}

module.exports = { isPureHousekeeper, getClientIp, evaluateNetworkGate, invalidateCache };
