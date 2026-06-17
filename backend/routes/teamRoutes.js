const express = require('express');
const router  = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ── helpers ──────────────────────────────────────────────────────────────────

const enrichTeams = async (teams) => {
    if (!teams || teams.length === 0) return [];

    const teamIds    = teams.map(t => t.id);
    const managerIds = [...new Set(teams.map(t => t.manager_id))];

    const [{ data: members }, { data: managers }] = await Promise.all([
        supabase.from('team_members').select('team_id').in('team_id', teamIds),
        supabase.from('employees').select('employee_id, first_name, last_name').in('employee_id', managerIds),
    ]);

    const countMap = {};
    (members || []).forEach(m => { countMap[m.team_id] = (countMap[m.team_id] || 0) + 1; });

    const managerMap = {};
    (managers || []).forEach(m => { managerMap[m.employee_id] = `${m.first_name} ${m.last_name}`.trim(); });

    return teams.map(t => ({
        ...t,
        member_count: countMap[t.id] || 0,
        manager_name: managerMap[t.manager_id] || t.manager_id,
    }));
};

// ── SPECIFIC routes MUST come before /:id ────────────────────────────────────

// GET /api/teams/manager-settings/:manager_id
router.get('/manager-settings/:manager_id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { manager_id } = req.params;
        const { data, error } = await supabase
            .from('manager_settings')
            .select('*')
            .eq('manager_id', manager_id)
            .maybeSingle();
        if (error) throw error;
        res.json({ success: true, settings: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/teams/manager-settings/:manager_id
router.put('/manager-settings/:manager_id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { manager_id } = req.params;
        const { login_time, working_days } = req.body;
        if (!login_time) return res.status(400).json({ success: false, message: 'login_time is required' });
        if (!Array.isArray(working_days) || working_days.length === 0)
            return res.status(400).json({ success: false, message: 'working_days must be a non-empty array' });

        const { data, error } = await supabase
            .from('manager_settings')
            .upsert({ manager_id, login_time, working_days, updated_at: new Date().toISOString() },
                    { onConflict: 'manager_id' })
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, settings: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/teams/hierarchy — manager → employees (reporting_manager field)
router.get('/hierarchy', verifyToken, isAdmin, async (req, res) => {
    try {
        const [{ data: managers, error: mErr }, { data: allEmps, error: eErr }, { data: allSettings }] = await Promise.all([
            supabase
                .from('employees')
                .select('id, employee_id, first_name, last_name, designation, department, is_active')
                .eq('role', 'manager')
                .order('first_name'),
            supabase
                .from('employees')
                .select('id, employee_id, first_name, last_name, designation, department, reporting_manager, is_active')
                .eq('role', 'employee'),
            supabase
                .from('manager_settings')
                .select('manager_id, login_time, working_days'),
        ]);
        if (mErr) throw mErr;
        if (eErr) throw eErr;

        const settingsMap = {};
        (allSettings || []).forEach(s => { settingsMap[s.manager_id] = s; });

        const hierarchy = (managers || []).map(mgr => {
            const fullName = `${mgr.first_name} ${mgr.last_name}`.trim().toLowerCase();
            const employees = (allEmps || []).filter(e =>
                e.reporting_manager && e.reporting_manager.trim().toLowerCase() === fullName
            );
            return { ...mgr, employees, total_employees: employees.length,
                settings: settingsMap[mgr.employee_id] || null };
        });

        // Employees with no manager assigned
        const assignedNames = new Set(
            (managers || []).map(m => `${m.first_name} ${m.last_name}`.trim().toLowerCase())
        );
        const unassigned = (allEmps || []).filter(e =>
            !e.reporting_manager || !assignedNames.has(e.reporting_manager.trim().toLowerCase())
        );

        res.json({ success: true, hierarchy, unassigned });
    } catch (err) {
        console.error('Error fetching hierarchy:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/teams/managers/list — employees with role = 'manager'
router.get('/managers/list', verifyToken, isAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('employee_id, first_name, last_name, designation, department')
            .eq('role', 'manager')
            .eq('is_active', true)
            .order('first_name');
        if (error) throw error;
        res.json({ success: true, managers: data || [] });
    } catch (err) {
        console.error('Error fetching managers:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/teams/employees/unassigned — employees not yet in any team
router.get('/employees/unassigned', verifyToken, isAdmin, async (req, res) => {
    try {
        const { data: assigned } = await supabase.from('team_members').select('employee_id');
        const assignedIds = (assigned || []).map(r => r.employee_id);

        let query = supabase
            .from('employees')
            .select('employee_id, first_name, last_name, designation, department')
            .eq('is_active', true)
            .neq('role', 'admin')
            .order('first_name');

        if (assignedIds.length > 0) {
            query = query.not('employee_id', 'in', `(${assignedIds.map(id => `"${id}"`).join(',')})`);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json({ success: true, employees: data || [] });
    } catch (err) {
        console.error('Error fetching unassigned employees:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/teams — list all (admin) or own (manager) ───────────────────────
router.get('/', verifyToken, async (req, res) => {
    try {
        const { role, employeeId } = req.user;

        let query = supabase.from('teams').select('*').order('created_at', { ascending: false });

        if (role === 'manager') {
            query = query.eq('manager_id', employeeId);
        } else if (role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { data, error } = await query;
        if (error) throw error;

        const enriched = await enrichTeams(data || []);
        res.json({ success: true, teams: enriched });
    } catch (err) {
        console.error('Error fetching teams:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/teams/:id — team detail with members ────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { role, employeeId } = req.user;
        const { id } = req.params;

        const { data: team, error } = await supabase.from('teams').select('*').eq('id', id).single();
        if (error || !team) return res.status(404).json({ success: false, message: 'Team not found' });

        if (role === 'manager' && team.manager_id !== employeeId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { data: memberRows } = await supabase
            .from('team_members').select('employee_id').eq('team_id', id);

        const memberIds = (memberRows || []).map(r => r.employee_id);
        let members = [];
        if (memberIds.length > 0) {
            const { data: emps } = await supabase
                .from('employees')
                .select('employee_id, first_name, last_name, designation, department')
                .in('employee_id', memberIds);
            members = emps || [];
        }

        const { data: mgr } = await supabase
            .from('employees').select('employee_id, first_name, last_name, designation')
            .eq('employee_id', team.manager_id).maybeSingle();

        res.json({ success: true, team: { ...team, members, manager: mgr } });
    } catch (err) {
        console.error('Error fetching team:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/teams — create (admin only) ────────────────────────────────────
router.post('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { team_name, description, manager_id, status = 'active', member_ids = [] } = req.body;

        if (!team_name?.trim()) return res.status(400).json({ success: false, message: 'Team name is required' });
        if (!manager_id)        return res.status(400).json({ success: false, message: 'Manager is required' });

        const { data: existing } = await supabase.from('teams').select('id').eq('team_name', team_name.trim()).maybeSingle();
        if (existing) return res.status(400).json({ success: false, message: 'Team name already exists' });

        const { data: mgr } = await supabase.from('employees').select('employee_id, role').eq('employee_id', manager_id).maybeSingle();
        if (!mgr) return res.status(400).json({ success: false, message: 'Manager not found' });

        const { data: team, error } = await supabase
            .from('teams')
            .insert([{ team_name: team_name.trim(), description: description || null, manager_id, status }])
            .select().single();
        if (error) throw error;

        if (member_ids.length > 0) {
            await supabase.from('team_members').delete().in('employee_id', member_ids);
            await supabase.from('team_members').insert(member_ids.map(eid => ({ team_id: team.id, employee_id: eid })));
        }

        res.status(201).json({ success: true, message: 'Team created successfully', team });
    } catch (err) {
        console.error('Error creating team:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT /api/teams/:id — update (admin only) ─────────────────────────────────
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { team_name, description, manager_id, status, member_ids } = req.body;

        const { data: existing } = await supabase.from('teams').select('id').eq('id', id).maybeSingle();
        if (!existing) return res.status(404).json({ success: false, message: 'Team not found' });

        if (team_name) {
            const { data: dup } = await supabase.from('teams').select('id').eq('team_name', team_name.trim()).neq('id', id).maybeSingle();
            if (dup) return res.status(400).json({ success: false, message: 'Team name already exists' });
        }

        const updates = { updated_at: new Date().toISOString() };
        if (team_name   !== undefined) updates.team_name   = team_name.trim();
        if (description !== undefined) updates.description = description || null;
        if (manager_id  !== undefined) updates.manager_id  = manager_id;
        if (status      !== undefined) updates.status      = status;

        const { data: team, error } = await supabase.from('teams').update(updates).eq('id', id).select().single();
        if (error) throw error;

        if (Array.isArray(member_ids)) {
            await supabase.from('team_members').delete().eq('team_id', id);
            if (member_ids.length > 0) {
                await supabase.from('team_members').delete().in('employee_id', member_ids);
                await supabase.from('team_members').insert(member_ids.map(eid => ({ team_id: parseInt(id), employee_id: eid })));
            }
        }

        res.json({ success: true, message: 'Team updated successfully', team });
    } catch (err) {
        console.error('Error updating team:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/teams/:id — delete (admin only) ──────────────────────────────
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('teams').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: 'Team deleted successfully' });
    } catch (err) {
        console.error('Error deleting team:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
