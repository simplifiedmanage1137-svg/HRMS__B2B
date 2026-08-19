// Admin-only API for the Housekeeper IP-allowlist gate: policy toggles, emergency
// override, allowlist CRUD, and a whoami diagnostic so an admin can capture their
// current egress IP while standing in the office.
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { isValidCidr } = require('../utils/cidr');
const { getClientIp, invalidateCache } = require('../utils/housekeeperNetworkGate');
const { logAuditEvent } = require('../utils/housekeeperAudit');

const OVERRIDE_DURATIONS_HOURS = { '4h': 4, '8h': 8, '24h': 24 };

router.use(verifyToken, isAdmin);

// GET policy + active allowlist + blocked-count-last-24h
router.get('/policy', async (req, res) => {
    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const [{ data: policy, error: policyErr }, { data: networks, error: netErr }, { count: blocked24h, error: countErr }] = await Promise.all([
            supabase.from('housekeeper_network_policy').select('*').eq('id', 1).maybeSingle(),
            supabase.from('housekeeper_allowlisted_networks').select('*').order('created_at', { ascending: false }),
            supabase.from('housekeeper_access_audit').select('id', { count: 'exact', head: true }).in('event_type', ['ip_blocked', 'ip_blocked_monitor']).gte('created_at', since),
        ]);

        if (policyErr) throw policyErr;
        if (netErr) throw netErr;
        if (countErr) throw countErr;

        res.json({
            success: true,
            policy: policy || { restriction_enabled: false, monitor_only: true, emergency_override_until: null },
            networks: networks || [],
            blocked_24h: blocked24h || 0,
        });
    } catch (error) {
        console.error('❌ [HousekeeperNetwork] Error fetching policy:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch network policy', error: error.message });
    }
});

// PATCH policy — toggle restriction_enabled / monitor_only, start/stop emergency override
router.patch('/policy', async (req, res) => {
    try {
        const { restriction_enabled, monitor_only, override_duration, stop_override } = req.body;
        const updates = { updated_by: req.user?.employeeId, updated_at: new Date().toISOString() };

        if (restriction_enabled !== undefined) updates.restriction_enabled = Boolean(restriction_enabled);
        if (monitor_only !== undefined) updates.monitor_only = Boolean(monitor_only);

        if (stop_override) {
            updates.emergency_override_until = null;
        } else if (override_duration !== undefined) {
            const hours = OVERRIDE_DURATIONS_HOURS[override_duration];
            if (!hours) {
                return res.status(400).json({ success: false, message: 'Invalid override duration — use 4h, 8h, or 24h' });
            }
            updates.emergency_override_until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        }

        const { data, error } = await supabase
            .from('housekeeper_network_policy')
            .update(updates)
            .eq('id', 1)
            .select()
            .maybeSingle();
        if (error) throw error;

        invalidateCache();

        await logAuditEvent({
            userId: req.user?.employeeId,
            eventType: stop_override ? 'override_stopped' : override_duration ? 'override_started' : 'policy_updated',
            ip: getClientIp(req),
            userAgent: req.headers['user-agent'] || null,
            metadata: updates,
        });

        res.json({ success: true, message: 'Policy updated', policy: data });
    } catch (error) {
        console.error('❌ [HousekeeperNetwork] Error updating policy:', error.message);
        res.status(500).json({ success: false, message: 'Failed to update policy', error: error.message });
    }
});

// POST — add a new allowlisted network
router.post('/allowlist', async (req, res) => {
    try {
        const { label, cidr } = req.body;
        if (!label || !String(label).trim()) return res.status(400).json({ success: false, message: 'Label is required' });
        if (!cidr || !isValidCidr(cidr)) return res.status(400).json({ success: false, message: 'Invalid CIDR — use a bare IP or "a.b.c.d/nn"' });

        const { data, error } = await supabase
            .from('housekeeper_allowlisted_networks')
            .insert([{ label: String(label).trim(), cidr: String(cidr).trim(), is_active: true, created_by: req.user?.employeeId }])
            .select()
            .single();
        if (error) throw error;

        invalidateCache();
        await logAuditEvent({ userId: req.user?.employeeId, eventType: 'network_added', ip: getClientIp(req), userAgent: req.headers['user-agent'] || null, metadata: data });

        res.status(201).json({ success: true, message: 'Network added', network: data });
    } catch (error) {
        console.error('❌ [HousekeeperNetwork] Error adding network:', error.message);
        res.status(500).json({ success: false, message: 'Failed to add network', error: error.message });
    }
});

// PATCH — edit label/cidr, or toggle active/inactive
router.patch('/allowlist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { label, cidr, is_active } = req.body;
        const updates = {};

        if (label !== undefined) {
            if (!String(label).trim()) return res.status(400).json({ success: false, message: 'Label cannot be empty' });
            updates.label = String(label).trim();
        }
        if (cidr !== undefined) {
            if (!isValidCidr(cidr)) return res.status(400).json({ success: false, message: 'Invalid CIDR — use a bare IP or "a.b.c.d/nn"' });
            updates.cidr = String(cidr).trim();
        }
        if (is_active !== undefined) updates.is_active = Boolean(is_active);

        if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'No update data provided' });

        const { data, error } = await supabase.from('housekeeper_allowlisted_networks').update(updates).eq('id', id).select().maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: 'Network not found' });

        invalidateCache();
        await logAuditEvent({ userId: req.user?.employeeId, eventType: 'network_updated', ip: getClientIp(req), userAgent: req.headers['user-agent'] || null, metadata: { id, ...updates } });

        res.json({ success: true, message: 'Network updated', network: data });
    } catch (error) {
        console.error('❌ [HousekeeperNetwork] Error updating network:', error.message);
        res.status(500).json({ success: false, message: 'Failed to update network', error: error.message });
    }
});

// DELETE — remove an allowlist entry
router.delete('/allowlist/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('housekeeper_allowlisted_networks').delete().eq('id', id);
        if (error) throw error;

        invalidateCache();
        await logAuditEvent({ userId: req.user?.employeeId, eventType: 'network_removed', ip: getClientIp(req), userAgent: req.headers['user-agent'] || null, metadata: { id } });

        res.json({ success: true, message: 'Network removed' });
    } catch (error) {
        console.error('❌ [HousekeeperNetwork] Error removing network:', error.message);
        res.status(500).json({ success: false, message: 'Failed to remove network', error: error.message });
    }
});

// whoami — lets an admin stand in the office and capture their exact egress IP
router.get('/whoami', (req, res) => {
    const ip = getClientIp(req);
    // In local dev the frontend's Vite proxy forwards every /api/* call to the backend on
    // 127.0.0.1 (see frontend/vite.config.js) — the request never leaves the machine, so this
    // will always read back a loopback address here regardless of which Wi-Fi you're on. Flag
    // it so the UI can explain that instead of leaving it looking like a bug.
    const isLocalLoopback = /^(127\.|::1$|::ffff:127\.)/.test(ip);
    res.json({
        success: true,
        ip,
        isLocalLoopback,
        headers: { xForwardedFor: req.headers['x-forwarded-for'] || null, xRealIp: req.headers['x-real-ip'] || null },
    });
});

module.exports = router;
