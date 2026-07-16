const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const multer = require('multer');
const path = require('path');
const { verifyToken, isAdmin, isAdminOrManager, isAdminOrDesktopSupport } = require('../middleware/auth');
const { uploadFile, deleteFile, folderForField } = require('../lib/supabaseStorage');
const { sendShiftChangeEmail } = require('../services/emailService');

// Memory storage — files are uploaded to Supabase Storage (no local disk in serverless)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf|doc|docx/;
        const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
        cb(ok ? null : new Error('Only images and documents are allowed'), ok);
    },
});

// Generate Employee ID with 2-digit sequence based on joining date
const generateEmployeeIdBasedOnJoiningDate = async (joiningDate) => {
    const date = new Date(joiningDate);
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    try {
        console.log('Generating employee ID for joining date:', joiningDate);
        console.log('Year:', year, 'Month:', month);

        // Get all employees with same year/month prefix
        const { data: employees, error } = await supabase
            .from('employees')
            .select('employee_id')
            .like('employee_id', `B2B${year}${month}%`)
            .order('employee_id', { ascending: false });

        if (error) throw error;

        let nextSequence = 1;

        if (employees && employees.length > 0) {
            // Extract the last 2 digits from the existing IDs
            const sequences = employees.map(emp => {
                const id = emp.employee_id;
                const seqStr = id.slice(-2);
                const seq = parseInt(seqStr, 10);
                return isNaN(seq) ? 0 : seq;
            });
            
            const maxSequence = Math.max(...sequences);
            nextSequence = maxSequence + 1;
            console.log('Last sequence found:', maxSequence, 'Next sequence:', nextSequence);
        } else {
            console.log('No existing employees for this month, starting with sequence 01');
        }

        // Ensure sequence doesn't exceed 99
        if (nextSequence > 99) {
            throw new Error('Maximum employees for this month reached (99)');
        }

        // Format sequence as 2 digits with leading zero
        const sequence = nextSequence.toString().padStart(2, '0');
        const employeeId = `B2B${year}${month}${sequence}`;

        // Double-check if this ID already exists
        const { data: existing, error: checkError } = await supabase
            .from('employees')
            .select('employee_id')
            .eq('employee_id', employeeId);

        if (checkError) throw checkError;

        if (existing && existing.length > 0) {
            console.log('Generated ID already exists, trying next sequence');
            // If it exists, try the next number recursively
            return await generateEmployeeIdBasedOnJoiningDate(joiningDate);
        }

        console.log('Generated Employee ID:', {
            joiningDate,
            year,
            month,
            nextSequence,
            sequence,
            employeeId
        });

        return employeeId;
    } catch (error) {
        console.error('Error generating employee ID:', error);
        // Fallback with timestamp to ensure uniqueness
        const timestamp = Date.now().toString().slice(-4);
        const fallbackSeq = timestamp.slice(-2);
        return `B2B${year}${month}${fallbackSeq}`;
    }
};

// Get employee statistics (Admin only) — MUST be before /:id
router.get('/stats/summary', verifyToken, isAdmin, async (req, res) => {
    try {
        const { count: total, error: totalError } = await supabase
            .from('employees').select('*', { count: 'exact', head: true });
        if (totalError) throw totalError;

        const { count: active, error: activeError } = await supabase
            .from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true);
        if (activeError) throw activeError;

        const { data: deptStats, error: deptError } = await supabase
            .from('employees').select('department').eq('is_active', true);
        if (deptError) throw deptError;

        const deptMap = {};
        deptStats?.forEach(item => { deptMap[item.department] = (deptMap[item.department] || 0) + 1; });
        const department_breakdown = Object.entries(deptMap).map(([department, count]) => ({ department, count }));

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { count: recent, error: recentError } = await supabase
            .from('employees').select('*', { count: 'exact', head: true })
            .gte('joining_date', thirtyDaysAgo.toISOString().split('T')[0]);
        if (recentError) throw recentError;

        res.json({
            success: true,
            stats: { total: total || 0, active: active || 0, inactive: (total || 0) - (active || 0), recent_joinings: recent || 0, department_breakdown }
        });
    } catch (error) {
        console.error('Error fetching employee stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics', error: error.message });
    }
});

// ============== REPORTING MANAGER: GET TEAM MEMBERS ==============
router.get('/manager/team', verifyToken, async (req, res) => {
    try {
        const managerEmployeeId = req.user?.employeeId;
        const { data: manager, error: mErr } = await supabase
            .from('employees').select('first_name, last_name')
            .eq('employee_id', managerEmployeeId).single();
        if (mErr || !manager) return res.status(404).json({ success: false, message: 'Manager not found' });

        const managerName = `${manager.first_name} ${manager.last_name}`.trim();

        // Fetch team members - trim stored values to handle any whitespace issues
        const { data: allEmps, error } = await supabase
            .from('employees')
            .select('id, employee_id, first_name, last_name, department, designation, shift_timing, reporting_manager')
            .order('first_name', { ascending: true });

        if (error) throw error;

        // Filter in JS: trim + lowercase compare to handle any DB whitespace/case issues
        const team = (allEmps || []).filter(e =>
            e.reporting_manager?.trim().toLowerCase() === managerName.toLowerCase()
        );

        res.json({ success: true, team, manager_name: managerName });
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch team', error: error.message });
    }
});

// ============== REPORTING MANAGER: UPDATE TEAM MEMBER SHIFT ==============
router.put('/manager/shift/:employee_id', verifyToken, async (req, res) => {
    console.log(`🔄 [SHIFT UPDATE] API hit — employee_id: ${req.params.employee_id} | by: ${req.user?.employeeId}`);
    try {
        const { employee_id } = req.params;
        const { shift_timing, effective_from, effective_until } = req.body;
        const managerEmployeeId = req.user?.employeeId;

        if (!shift_timing || !shift_timing.trim()) {
            return res.status(400).json({ success: false, message: 'Shift timing is required' });
        }

        const { data: manager, error: mErr } = await supabase
            .from('employees').select('first_name, last_name')
            .eq('employee_id', managerEmployeeId).single();
        if (mErr || !manager) return res.status(403).json({ success: false, message: 'Manager not found' });

        const managerName = `${manager.first_name} ${manager.last_name}`.trim();

        const { data: emp, error: empErr } = await supabase
            .from('employees').select('employee_id, first_name, last_name, reporting_manager, email, shift_timing')
            .eq('employee_id', employee_id).single();
        if (empErr || !emp) return res.status(404).json({ success: false, message: 'Employee not found' });

        console.log(`📧 [SHIFT UPDATE] Employee email found: ${emp.email || 'NULL — no email on record'}`);

        if (emp.reporting_manager?.trim().toLowerCase() !== managerName.toLowerCase()) {
            return res.status(403).json({ success: false, message: 'You can only update shift for employees who report to you' });
        }

        const effectiveFrom = effective_from || new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('employees')
            .update({ shift_timing: shift_timing.trim(), updated_at: new Date().toISOString() })
            .eq('employee_id', employee_id)
            .select('employee_id, first_name, last_name, shift_timing');

        if (error) throw error;

        await supabase.from('employee_shift_history').insert([{
            employee_id,
            shift_timing: shift_timing.trim(),
            effective_from: effectiveFrom,
            ...(effective_until ? { effective_until } : {})
        }]);

        console.log(`✅ [SHIFT UPDATE] DB updated — new shift: ${shift_timing.trim()} | effective_from: ${effectiveFrom}`);

        res.json({ success: true, message: `Shift updated for ${emp.first_name} ${emp.last_name}`, employee: data[0] });

        // Non-blocking email — runs after response is sent
        ;(async () => {
            try {
                console.log(`🔑 [SHIFT EMAIL] RESEND_API_KEY exists: ${!!process.env.RESEND_API_KEY}`);

                if (!emp.email) {
                    console.warn('⚠️ [SHIFT EMAIL] Skipped — no email address on employee record');
                    return;
                }

                console.log(`📤 [SHIFT EMAIL] Sending to: ${emp.email} | new shift: ${shift_timing.trim()}`);

                const result = await sendShiftChangeEmail(
                    { email: emp.email, first_name: emp.first_name, last_name: emp.last_name },
                    {
                        oldShift: emp.shift_timing || null,
                        newShift: shift_timing.trim(),
                        effectiveFrom,
                        effectiveUntil: effective_until || null,
                        changedBy: managerName,
                    }
                );

                if (result?.success) {
                    console.log(`✅ [SHIFT EMAIL] Sent successfully | Resend ID: ${result.id}`);
                } else {
                    console.error(`❌ [SHIFT EMAIL] Failed | reason: ${result?.reason || result?.error || 'unknown'}`);
                }
            } catch (emailErr) {
                console.error('❌ [SHIFT EMAIL] Exception:', emailErr.message);
            }
        })();

    } catch (error) {
        console.error('❌ [SHIFT UPDATE] Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to update shift', error: error.message });
    }
});

// ============== TODAY'S EVENTS ROUTE (BIRTHDAYS & ANNIVERSARIES) ==============
router.get('/today-events', async (req, res) => {
    try {
        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayDay = today.getDate();

        console.log('📅 Fetching events for date:', `${todayMonth}-${todayDay}`);

        // Get all employees
        const { data: employees, error } = await supabase
            .from('employees')
            .select('*');

        if (error) throw error;

        const birthdays = [];
        const anniversaries = [];

        (employees || []).forEach(emp => {
            // Check birthday
            if (emp.dob) {
                const dob = new Date(emp.dob);
                const dobMonth = dob.getMonth() + 1;
                const dobDay = dob.getDate();

                if (dobMonth === todayMonth && dobDay === todayDay) {
                    birthdays.push({
                        id: emp.id,
                        employee_id: emp.employee_id,
                        first_name: emp.first_name,
                        last_name: emp.last_name,
                        department: emp.department,
                        position: emp.designation || emp.position,
                        profile_image: emp.profile_image
                    });
                }
            }

            // Check work anniversary
            if (emp.joining_date) {
                const joiningDate = new Date(emp.joining_date);
                const joiningMonth = joiningDate.getMonth() + 1;
                const joiningDay = joiningDate.getDate();

                if (joiningMonth === todayMonth && joiningDay === todayDay) {
                    const years = today.getFullYear() - joiningDate.getFullYear();
                    if (years > 0) { // Only count if at least 1 year completed
                        anniversaries.push({
                            id: emp.id,
                            employee_id: emp.employee_id,
                            first_name: emp.first_name,
                            last_name: emp.last_name,
                            department: emp.department,
                            position: emp.designation || emp.position,
                            profile_image: emp.profile_image,
                            joining_date: emp.joining_date,
                            years: years
                        });
                    }
                }
            }
        });

        console.log(`✅ Found ${birthdays.length} birthdays and ${anniversaries.length} anniversaries today`);

        res.json({
            success: true,
            date: today.toISOString().split('T')[0],
            birthdays,
            anniversaries,
            total: birthdays.length + anniversaries.length
        });

    } catch (error) {
        console.error('❌ Error fetching today events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: error.message
        });
    }
});

// ============== EMPLOYEE CRUD OPERATIONS ==============

router.post('/', verifyToken, isAdminOrDesktopSupport, async (req, res) => {
    try {
        const employeeData = req.body;
        let retryCount = 0;
        const maxRetries = 5;

        while (retryCount < maxRetries) {
            try {
                console.log('='.repeat(50));
                console.log('📝 CREATE EMPLOYEE REQUEST (Attempt', retryCount + 1, ')');
                console.log('Request body:', JSON.stringify(employeeData, null, 2));
                console.log('='.repeat(50));

                // Check if employee_id already exists
                const { data: existingId, error: idCheckError } = await supabase
                    .from('employees')
                    .select('employee_id')
                    .eq('employee_id', employeeData.employee_id);

                if (idCheckError) throw idCheckError;

                if (existingId && existingId.length > 0) {
                    console.log('⚠️ Employee ID already exists:', employeeData.employee_id);
                    console.log('Retrying with new ID...');

                    // Generate new ID
                    employeeData.employee_id = await generateEmployeeIdBasedOnJoiningDate(employeeData.joining_date);
                    retryCount++;
                    continue;
                }

                // Check if email already exists
                const { data: existingEmail, error: emailCheckError } = await supabase
                    .from('employees')
                    .select('email')
                    .eq('email', employeeData.email);

                if (emailCheckError) throw emailCheckError;

                if (existingEmail && existingEmail.length > 0) {
                    console.log('❌ Email already exists:', employeeData.email);
                    return res.status(400).json({
                        success: false,
                        message: 'Email already exists',
                        field: 'email',
                        value: employeeData.email
                    });
                }

                // ... rest of your validation code ...

                const newEmployee = {
                    first_name: employeeData.first_name,
                    middle_name: employeeData.middle_name || null,
                    last_name: employeeData.last_name,
                    employee_id: employeeData.employee_id,
                    email: employeeData.email,
                    joining_date: employeeData.joining_date,
                    designation: employeeData.designation,
                    department: employeeData.department,
                    reporting_manager: employeeData.reporting_manager || null,
                    employment_type: employeeData.employment_type || 'Full Time',
                    shift_timing: employeeData.shift_timing || '9:00 AM - 6:00 PM',
                    in_hand_salary: employeeData.in_hand_salary || 0,
                    gross_salary: employeeData.gross_salary || 0,
                    bank_account_name: employeeData.bank_account_name || null,
                    account_number: employeeData.account_number || null,
                    ifsc_code: employeeData.ifsc_code || null,
                    branch_name: employeeData.branch_name || null,
                    pan_number: employeeData.pan_number || null,
                    aadhar_number: employeeData.aadhar_number || null,
                    dob: employeeData.dob || null,
                    address: employeeData.address || null,
                    blood_group: employeeData.blood_group || null,
                    emergency_contact: employeeData.emergency_contact || null,
                    contract_policy: employeeData.contract_policy || null,
                    is_active: true,
                    role: employeeData.role || 'employee',
                    joining_month_count: 0,
                    can_apply_leave: false,
                    created_at: new Date().toISOString()
                };

                console.log('📦 Inserting employee with data:', newEmployee);

                const { data, error } = await supabase
                    .from('employees')
                    .insert([newEmployee])
                    .select();

                if (error) {
                    if (error.code === '23505') { // Duplicate key error
                        console.log('⚠️ Duplicate key error, retrying with new ID...');
                        employeeData.employee_id = await generateEmployeeIdBasedOnJoiningDate(employeeData.joining_date);
                        retryCount++;
                        continue;
                    }
                    throw error;
                }

                console.log('✅ Employee created successfully:', data[0]);

                return res.status(201).json({
                    success: true,
                    message: 'Employee created successfully',
                    employee: {
                        id: data[0].id,
                        employee_id: data[0].employee_id
                    }
                });

            } catch (error) {
                if (retryCount >= maxRetries - 1) throw error;
                retryCount++;
            }
        }

        throw new Error('Failed to create employee after multiple retries');

    } catch (error) {
        console.error('❌ Error creating employee:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to create employee',
            error: error.message,
            details: error.details || error.hint
        });
    }
});

// Update employee role (Admin only)
router.patch('/:id/role', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const validRoles = ['admin', 'sub_admin', 'manager', 'employee', 'desktop_support', 'finance'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        }
        const { data, error } = await supabase
            .from('employees')
            .update({ role })
            .eq('id', id)
            .select('id, employee_id, role');
        if (error) throw error;
        if (!data || data.length === 0) return res.status(404).json({ success: false, message: 'Employee not found' });
        res.json({ success: true, message: 'Role updated successfully', employee: data[0] });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ success: false, message: 'Failed to update role', error: error.message });
    }
});

// Employee completes their own onboarding profile
router.post('/complete-profile', verifyToken, async (req, res) => {
    try {
        const employeeId = req.user?.employeeId;
        if (!employeeId) return res.status(400).json({ success: false, message: 'Employee ID missing from token' });

        const ALLOWED_FIELDS = [
            'first_name','middle_name','last_name','dob','gender','blood_group',
            'phone','personal_email','address','city','state','pincode',
            'bank_account_name','account_number','ifsc_code','branch_name',
            'pan_number','aadhar_number','uan',
            'emergency_contact','emergency_contact_name','emergency_contact_relation',
        ];

        const updates = {};
        for (const field of ALLOWED_FIELDS) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field] || null;
            }
        }
        updates.profile_completed = true;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('employees')
            .update(updates)
            .eq('employee_id', employeeId)
            .select()
            .single();

        if (error) return res.status(500).json({ success: false, message: error.message });
        res.json({ success: true, message: 'Profile completed successfully', employee: data });
    } catch (err) {
        console.error('complete-profile error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin resets an employee's profile completion status
router.post('/:id/reset-profile', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('employees')
            .update({ profile_completed: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ success: false, message: error.message });
        res.json({ success: true, message: 'Profile completion reset. Employee will be prompted to re-complete on next login.', employee: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin toggles whether an employee must fill the profile completion form
router.post('/:id/toggle-profile-form', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Read current value then flip it
        const { data: current, error: fetchErr } = await supabase
            .from('employees')
            .select('require_profile_completion')
            .eq('id', id)
            .single();
        if (fetchErr) return res.status(500).json({ success: false, message: fetchErr.message });

        const newValue = !current.require_profile_completion;
        const patch = { require_profile_completion: newValue, updated_at: new Date().toISOString() };
        // When turning ON, also reset profile_completed so the popup appears again
        if (newValue) patch.profile_completed = false;

        const { data, error } = await supabase
            .from('employees')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ success: false, message: error.message });
        res.json({ success: true, require_profile_completion: newValue, profile_completed: data.profile_completed, employee: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Toggle employee active/inactive status (Admin, sub_admin, TL/manager)
router.patch('/:id/toggle-status', verifyToken, async (req, res) => {
    try {
        const { role, employeeId: callerEmpId } = req.user;
        const allowed = ['admin', 'sub_admin', 'manager'];
        if (!allowed.includes(role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { id } = req.params;
        const { data: target, error: fetchErr } = await supabase
            .from('employees')
            .select('id, employee_id, first_name, last_name, is_active, reporting_manager, role')
            .eq('id', id)
            .single();
        if (fetchErr || !target) return res.status(404).json({ success: false, message: 'Employee not found' });

        // TLs (manager role) can only deactivate their own direct reports
        if (role === 'manager') {
            const { data: caller } = await supabase
                .from('employees')
                .select('first_name, last_name')
                .eq('employee_id', callerEmpId)
                .single();
            if (caller) {
                const callerName = `${caller.first_name} ${caller.last_name}`.trim().toLowerCase();
                if (!target.reporting_manager || target.reporting_manager.trim().toLowerCase() !== callerName) {
                    return res.status(403).json({ success: false, message: 'You can only deactivate your own team members' });
                }
            }
        }

        const newStatus = !target.is_active;
        const { data, error } = await supabase
            .from('employees')
            .update({ is_active: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('id, employee_id, first_name, last_name, is_active')
            .single();
        if (error) throw error;

        const action = newStatus ? 'activated' : 'deactivated';
        res.json({ success: true, message: `Employee ${action} successfully`, employee: data, is_active: newStatus });
    } catch (err) {
        console.error('Error toggling employee status:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update employee (Admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const newShiftTiming = updates.shift_timing;

        // Only admin/sub_admin can change role
        if ('role' in updates && !['admin', 'sub_admin'].includes(req.user?.role)) {
            delete updates.role;
        }
        if ('role' in updates) {
            const validRoles = ['admin', 'sub_admin', 'manager', 'employee', 'desktop_support', 'finance'];
            if (!validRoles.includes(updates.role)) {
                return res.status(400).json({ success: false, message: 'Invalid role value' });
            }
        }

        // Remove fields that shouldn't be updated
        delete updates.id;
        delete updates.employee_id;
        delete updates.created_at;

        // Add updated timestamp
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('employees')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // If shift_timing was updated, save to history
        if (newShiftTiming) {
            const effectiveFrom = new Date().toISOString().split('T')[0];
            await supabase.from('employee_shift_history').insert([{
                employee_id: data[0].employee_id,
                shift_timing: newShiftTiming.trim(),
                effective_from: effectiveFrom
            }]);
        }

        res.json({
            success: true,
            message: 'Employee updated successfully',
            employee: data[0]
        });

    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update employee',
            error: error.message
        });
    }
});

// Get employee by ID (with all fields)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`📤 Fetching employee with ID: ${id}`);

        let query = supabase
            .from('employees')
            .select('*');

        // Check if id is number or string
        if (!isNaN(id)) {
            query = query.eq('id', parseInt(id));
        } else {
            query = query.eq('employee_id', id);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') { // No rows returned
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            throw error;
        }

        console.log('📤 Sending employee data:', Object.keys(data));
        res.json(data);

    } catch (error) {
        console.error('❌ Error fetching employee:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get employee by employee_id (for profile)
router.get('/profile/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;

        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id', employeeId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            throw error;
        }

        res.json(data);

    } catch (error) {
        console.error('Error fetching employee profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee profile',
            error: error.message
        });
    }
});


// Get all employees (returns array directly)
router.get('/', async (req, res) => {
    try {
        const { department, search, active } = req.query;

        let query = supabase
            .from('employees')
            .select('*');

        if (department) {
            query = query.eq('department', department);
        }

        if (search) {
            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%,email.ilike.%${search}%`);
        }

        if (active === 'true') {
            query = query.eq('is_active', true);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        console.log(`📊 Found ${data?.length || 0} employees`);
        res.json(data || []);

    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employees',
            error: error.message
        });
    }
});

// Delete employee (Admin only - HARD DELETE)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // First get the employee to know their employee_id
        const { data: employee, error: fetchError } = await supabase
            .from('employees')
            .select('employee_id')
            .eq('id', id);

        if (fetchError) throw fetchError;

        if (!employee || employee.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const employeeId = employee[0].employee_id;

        // Delete from users table first (due to foreign key)
        const { error: userError } = await supabase
            .from('users')
            .delete()
            .eq('employee_id', employeeId);

        if (userError) {
            console.error('Error deleting from users:', userError);
            // Continue even if user delete fails
        }

        // Delete from leave_balance
        const { error: leaveError } = await supabase
            .from('leave_balance')
            .delete()
            .eq('employee_id', employeeId);

        if (leaveError) {
            console.error('Error deleting leave balance:', leaveError);
        }

        // Delete from leaves
        const { error: leavesError } = await supabase
            .from('leaves')
            .delete()
            .eq('employee_id', employeeId);

        if (leavesError) {
            console.error('Error deleting leaves:', leavesError);
        }

        // Delete from attendance
        const { error: attendanceError } = await supabase
            .from('attendance')
            .delete()
            .eq('employee_id', employeeId);

        if (attendanceError) {
            console.error('Error deleting attendance:', attendanceError);
        }

        // Finally delete from employees table
        const { error: empError } = await supabase
            .from('employees')
            .delete()
            .eq('id', id);

        if (empError) throw empError;

        res.json({
            success: true,
            message: 'Employee permanently deleted successfully',
            employeeId: employeeId
        });

    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete employee',
            error: error.message
        });
    }
});

// Hard delete (Admin only - use with caution)
router.delete('/:id/hard', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('employees')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Employee permanently deleted'
        });
    } catch (error) {
        console.error('Error hard deleting employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete employee',
            error: error.message
        });
    }
});

// Admin / Desktop Support can reset an employee's password
router.post('/:id/reset-password', verifyToken, isAdminOrDesktopSupport, async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) return res.status(400).json({ success: false, message: 'New password is required' });
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const { error } = await supabase
            .from('employees')
            .update({ password: hashedPassword, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        return res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
        return res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
});

// ============== DOCUMENT MANAGEMENT ==============

// Upload documents — buffers go directly to Supabase Storage (no disk write)
router.post('/:employeeId/documents', verifyToken, upload.any(), async (req, res) => {
    try {
        const { employeeId } = req.params;
        const files = req.files;

        console.log('📥 Document upload for employee:', employeeId, '| files:', files?.length || 0);

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }

        const documentUpdates = {};

        for (const file of files) {
            const folder = folderForField(file.fieldname);
            const { publicUrl } = await uploadFile(file.buffer, file.originalname, folder, file.mimetype);
            documentUpdates[file.fieldname] = publicUrl;
            console.log(`📄 Uploaded ${file.fieldname} → ${publicUrl}`);
        }

        const { data, error } = await supabase
            .from('employees')
            .update(documentUpdates)
            .eq('employee_id', employeeId)
            .select();

        if (error) throw error;

        console.log('✅ DB updated with document URLs');
        res.json({
            success: true,
            message: 'Documents uploaded successfully',
            documents: documentUpdates,
            updated_employee: data[0],
        });

    } catch (error) {
        console.error('❌ Error uploading documents:', error);
        res.status(500).json({ success: false, message: 'Failed to upload documents', error: error.message });
    }
});

// Get employee documents
router.get('/:employeeId/documents', async (req, res) => {
    try {
        const { employeeId } = req.params;

        console.log('📄 Fetching documents for employee:', employeeId);

        // First verify employee exists
        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('id')
            .eq('employee_id', employeeId)
            .maybeSingle();

        if (empError) {
            console.error('❌ Error checking employee:', empError);
            throw empError;
        }

        if (!employee) {
            console.log('⚠️ Employee not found:', employeeId);
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Now fetch documents
        const { data, error } = await supabase
            .from('employees')
            .select(`
                profile_image, appointment_letter, offer_letter, 
                contract_document, aadhar_card, pan_card, 
                bank_proof, education_certificates, experience_certificates,
                relieving_letter, salary_slip
            `)
            .eq('employee_id', employeeId)
            .maybeSingle();

        if (error) {
            console.error('❌ Error fetching documents:', error);
            throw error;
        }

        if (!data) {
            console.log('⚠️ No document record found for employee:', employeeId);
            return res.json({});
        }

        // Filter out null values
        const documents = {};
        Object.keys(data).forEach(key => {
            if (data[key]) {
                documents[key] = data[key];
            }
        });

        console.log('✅ Documents fetched successfully:', Object.keys(documents));
        res.json(documents);

    } catch (error) {
        console.error('❌ Error in documents endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch documents',
            error: error.message,
            details: error.details || error.hint
        });
    }
});


// Download / view a specific document — redirects to the Supabase Storage URL
router.get('/:employeeId/documents/:documentType', verifyToken, async (req, res) => {
    try {
        const { employeeId, documentType } = req.params;

        const { data, error } = await supabase
            .from('employees')
            .select(documentType)
            .eq('employee_id', employeeId)
            .single();

        if (error || !data || !data[documentType]) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        const url = data[documentType];

        // Documents stored as Supabase Storage public URLs — redirect the browser directly
        if (url.startsWith('http')) {
            return res.redirect(url);
        }

        // Legacy: file was stored as a bare filename before the Supabase migration
        return res.status(410).json({
            success: false,
            message: 'Document predates cloud storage — please re-upload.',
        });

    } catch (error) {
        console.error('❌ Error fetching document:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch document', error: error.message });
    }
});

// Delete a specific document — removes from Supabase Storage then clears DB field
router.delete('/:employeeId/documents/:documentType', verifyToken, async (req, res) => {
    try {
        const { employeeId, documentType } = req.params;

        const { data, error: fetchError } = await supabase
            .from('employees')
            .select(documentType)
            .eq('employee_id', employeeId)
            .single();

        if (fetchError) throw fetchError;

        // Delete from Supabase Storage (handles both URL and bare-path formats)
        if (data?.[documentType]) {
            await deleteFile(data[documentType]);
        }

        const { error: updateError } = await supabase
            .from('employees')
            .update({ [documentType]: null })
            .eq('employee_id', employeeId);

        if (updateError) throw updateError;

        res.json({ success: true, message: 'Document deleted successfully' });

    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ success: false, message: 'Failed to delete document', error: error.message });
    }
});

module.exports = router;