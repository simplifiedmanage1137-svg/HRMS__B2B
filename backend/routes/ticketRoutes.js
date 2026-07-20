/**
 * Ticket Routes  — /api/tickets
 *
 * Supabase tables required (run once in Supabase SQL editor):
 * ──────────────────────────────────────────────────────────
 * CREATE TABLE support_tickets (
 *   id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   ticket_number   TEXT UNIQUE NOT NULL,
 *   subject         TEXT NOT NULL,
 *   description     TEXT NOT NULL,
 *   department      TEXT NOT NULL,
 *   issue_type      TEXT NOT NULL,
 *   status          TEXT NOT NULL DEFAULT 'open',
 *   priority        TEXT DEFAULT 'medium',
 *   raised_by       TEXT NOT NULL,
 *   raised_by_email TEXT NOT NULL,
 *   raised_by_name  TEXT NOT NULL,
 *   assigned_to     TEXT,
 *   assigned_to_name TEXT,
 *   tagged_employees JSONB DEFAULT '[]',
 *   attachment_url  TEXT,
 *   attachment_name TEXT,
 *   resolve_note    TEXT,
 *   created_at      TIMESTAMPTZ DEFAULT NOW(),
 *   resolved_at     TIMESTAMPTZ,
 *   closed_at       TIMESTAMPTZ,
 *   updated_at      TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE ticket_history (
 *   id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   ticket_id         UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
 *   action            TEXT NOT NULL,
 *   message           TEXT,
 *   old_status        TEXT,
 *   new_status        TEXT,
 *   performed_by      TEXT,
 *   performed_by_name TEXT,
 *   created_at        TIMESTAMPTZ DEFAULT NOW()
 * );
 */

const express = require('express');
const router  = express.Router();

module.exports = (supabase, authenticateToken) => {

    const ROLES_SEE_ALL = ['admin', 'sub_admin', 'hr'];

    // ── helpers ──────────────────────────────────────────────────────────────

    const generateTicketNumber = async () => {
        const today = new Date();
        const ymd = today.toISOString().slice(0, 10).replace(/-/g, '');
        const { count } = await supabase.from('support_tickets')
            .select('*', { count: 'exact', head: true });
        const seq = String((count || 0) + 1).padStart(4, '0');
        return `TKT-${ymd}-${seq}`;
    };

    const addHistory = async (ticketId, action, message, oldStatus, newStatus, performedBy, performedByName) => {
        await supabase.from('ticket_history').insert({
            ticket_id: ticketId,
            action,
            message,
            old_status: oldStatus || null,
            new_status: newStatus || null,
            performed_by: performedBy,
            performed_by_name: performedByName,
        });
    };

    const getEmployeeDetails = async (employeeId) => {
        const { data } = await supabase.from('employees')
            .select('employee_id, first_name, last_name, email, reporting_manager, department, role')
            .eq('employee_id', employeeId)
            .maybeSingle();
        return data;
    };

    const findAssignee = async (raiserEmpId) => {
        const emp = await getEmployeeDetails(raiserEmpId);
        if (!emp || !emp.reporting_manager) return null;
        const managerName = emp.reporting_manager.trim().toLowerCase();
        const { data: allEmps } = await supabase.from('employees')
            .select('employee_id, first_name, last_name')
            .eq('is_active', true);
        const mgr = (allEmps || []).find(e =>
            `${e.first_name} ${e.last_name}`.trim().toLowerCase() === managerName
        );
        return mgr || null;
    };

    // ── GET /api/tickets/dept-employees/:department ────────────────────────
    // Returns employees in a given department for @ tagging
    router.get('/dept-employees/:department', authenticateToken, async (req, res) => {
        try {
            const dept = req.params.department;
            const { data, error } = await supabase.from('employees')
                .select('employee_id, first_name, last_name, email, department')
                .eq('department', dept)
                .eq('is_active', true);
            if (error) throw error;
            return res.json({ success: true, employees: data || [] });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET /api/tickets ──────────────────────────────────────────────────
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const { employeeId, role } = req.user;
            let query = supabase.from('support_tickets')
                .select('*')
                .order('created_at', { ascending: false });

            if (ROLES_SEE_ALL.includes(role)) {
                // admin / sub_admin — see everything
            } else if (role === 'manager') {
                // TL — see tickets assigned to them OR raised by them
                const emp = await getEmployeeDetails(employeeId);
                const myName = emp ? `${emp.first_name} ${emp.last_name}`.trim() : '';
                query = supabase.from('support_tickets')
                    .select('*')
                    .or(`raised_by.eq.${employeeId},assigned_to_name.eq.${myName}`)
                    .order('created_at', { ascending: false });
            } else {
                // employee — see own tickets only
                query = query.eq('raised_by', employeeId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return res.json({ success: true, tickets: data || [] });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST /api/tickets — create ─────────────────────────────────────────
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const { employeeId, role } = req.user;
            const { subject, description, department, issue_type, priority, tagged_employees, attachment_url, attachment_name } = req.body;

            if (!subject || !description || !department || !issue_type)
                return res.status(400).json({ success: false, message: 'Subject, description, department and issue type are required' });

            const emp = await getEmployeeDetails(employeeId);
            if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

            const ticketNumber = await generateTicketNumber();
            const assignee     = await findAssignee(employeeId);

            const { data, error } = await supabase.from('support_tickets').insert({
                ticket_number:    ticketNumber,
                subject,
                description,
                department,
                issue_type,
                priority:         priority || 'medium',
                status:           'open',
                raised_by:        employeeId,
                raised_by_email:  emp.email || '',
                raised_by_name:   `${emp.first_name} ${emp.last_name}`.trim(),
                assigned_to:      assignee?.employee_id || null,
                assigned_to_name: assignee ? `${assignee.first_name} ${assignee.last_name}`.trim() : null,
                tagged_employees: tagged_employees || [],
                attachment_url:   attachment_url || null,
                attachment_name:  attachment_name || null,
            }).select().maybeSingle();

            if (error) throw error;

            await addHistory(data.id, 'created', `Ticket raised by ${emp.first_name} ${emp.last_name}`, null, 'open', employeeId, `${emp.first_name} ${emp.last_name}`);

            return res.json({ success: true, ticket: data });
        } catch (err) {
            console.error('[tickets] create error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET /api/tickets/:id ───────────────────────────────────────────────
    router.get('/:id', authenticateToken, async (req, res) => {
        try {
            const { data: ticket, error } = await supabase.from('support_tickets')
                .select('*').eq('id', req.params.id).maybeSingle();
            if (error) throw error;
            if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

            const { data: history } = await supabase.from('ticket_history')
                .select('*').eq('ticket_id', req.params.id).order('created_at', { ascending: true });

            return res.json({ success: true, ticket, history: history || [] });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST /api/tickets/:id/comment ──────────────────────────────────────
    router.post('/:id/comment', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { message } = req.body;
            if (!message?.trim()) return res.status(400).json({ success: false, message: 'Comment is required' });

            const emp = await getEmployeeDetails(employeeId);
            const name = emp ? `${emp.first_name} ${emp.last_name}`.trim() : employeeId;

            const { data: ticket } = await supabase.from('support_tickets')
                .select('id').eq('id', req.params.id).maybeSingle();
            if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

            await addHistory(ticket.id, 'comment', message.trim(), null, null, employeeId, name);

            await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticket.id);

            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PATCH /api/tickets/:id/in-progress ────────────────────────────────
    router.patch('/:id/in-progress', authenticateToken, async (req, res) => {
        try {
            const { employeeId, role } = req.user;
            if (!['admin', 'sub_admin', 'manager', 'hr'].includes(role))
                return res.status(403).json({ success: false, message: 'Not authorized' });

            const emp = await getEmployeeDetails(employeeId);
            const name = emp ? `${emp.first_name} ${emp.last_name}`.trim() : employeeId;

            const { data: ticket } = await supabase.from('support_tickets')
                .select('id, status').eq('id', req.params.id).maybeSingle();
            if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

            const oldStatus = ticket.status;
            await supabase.from('support_tickets').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', req.params.id);
            await addHistory(req.params.id, 'status_changed', `Marked as In Progress by ${name}`, oldStatus, 'in_progress', employeeId, name);

            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PATCH /api/tickets/:id/resolve ────────────────────────────────────
    router.patch('/:id/resolve', authenticateToken, async (req, res) => {
        try {
            const { employeeId, role } = req.user;
            if (!['admin', 'sub_admin', 'manager', 'hr'].includes(role))
                return res.status(403).json({ success: false, message: 'Not authorized' });

            const { resolve_note } = req.body;
            const emp  = await getEmployeeDetails(employeeId);
            const name = emp ? `${emp.first_name} ${emp.last_name}`.trim() : employeeId;

            const { data: ticket } = await supabase.from('support_tickets')
                .select('id, status').eq('id', req.params.id).maybeSingle();
            if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

            const now = new Date().toISOString();
            await supabase.from('support_tickets').update({
                status:       'resolved_pending',
                resolve_note: resolve_note || null,
                resolved_at:  now,
                updated_at:   now,
            }).eq('id', req.params.id);

            await addHistory(req.params.id, 'resolved', resolve_note || `Resolved by ${name}. Awaiting employee confirmation.`, ticket.status, 'resolved_pending', employeeId, name);

            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PATCH /api/tickets/:id/accept ─────────────────────────────────────
    // Raiser accepts resolution → ticket closed
    router.patch('/:id/accept', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { data: ticket } = await supabase.from('support_tickets')
                .select('id, status, raised_by').eq('id', req.params.id).maybeSingle();
            if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
            if (ticket.raised_by !== employeeId)
                return res.status(403).json({ success: false, message: 'Only the ticket raiser can accept' });
            if (ticket.status !== 'resolved_pending')
                return res.status(400).json({ success: false, message: 'Ticket is not awaiting confirmation' });

            const emp  = await getEmployeeDetails(employeeId);
            const name = emp ? `${emp.first_name} ${emp.last_name}`.trim() : employeeId;
            const now  = new Date().toISOString();

            await supabase.from('support_tickets').update({ status: 'closed', closed_at: now, updated_at: now }).eq('id', req.params.id);
            await addHistory(req.params.id, 'closed', `Issue confirmed resolved by ${name}. Ticket closed.`, 'resolved_pending', 'closed', employeeId, name);

            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PATCH /api/tickets/:id/decline ────────────────────────────────────
    // Raiser declines resolution → ticket reopened
    router.patch('/:id/decline', authenticateToken, async (req, res) => {
        try {
            const { employeeId } = req.user;
            const { reason } = req.body;
            const { data: ticket } = await supabase.from('support_tickets')
                .select('id, status, raised_by').eq('id', req.params.id).maybeSingle();
            if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
            if (ticket.raised_by !== employeeId)
                return res.status(403).json({ success: false, message: 'Only the ticket raiser can decline' });
            if (ticket.status !== 'resolved_pending')
                return res.status(400).json({ success: false, message: 'Ticket is not awaiting confirmation' });

            const emp  = await getEmployeeDetails(employeeId);
            const name = emp ? `${emp.first_name} ${emp.last_name}`.trim() : employeeId;

            await supabase.from('support_tickets').update({
                status:      'reopened',
                resolved_at: null,
                updated_at:  new Date().toISOString(),
            }).eq('id', req.params.id);

            await addHistory(req.params.id, 'reopened', reason ? `Declined by ${name}: ${reason}` : `Declined by ${name} — issue not resolved. Ticket reopened.`, 'resolved_pending', 'reopened', employeeId, name);

            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    });

    console.log('✅ Ticket routes loaded');
    return router;
};
