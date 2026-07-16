// backend/routes/onboardingRoutes.js
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const path    = require('path');
const multer  = require('multer');
const supabase = require('../config/supabase');
const { verifyToken, isAdmin, isAdminOrDesktopSupport } = require('../middleware/auth');
const { uploadFile } = require('../lib/supabaseStorage');

// Multer — memory storage, no local disk (serverless safe)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
    fileFilter: (_req, file, cb) => {
        const ok = /jpeg|jpg|png|pdf|doc|docx/.test(
            path.extname(file.originalname).toLowerCase()
        );
        cb(ok ? null : new Error('Only JPG, PNG, PDF, DOC or DOCX files are allowed'), ok);
    },
});

// ── POST /api/onboarding/generate ─────────────────────────────────────────────
router.post('/generate', verifyToken, isAdminOrDesktopSupport, async (req, res) => {
    try {
        const {
            employee_name, designation, department, employment_type,
            salary, reporting_manager, reporting_manager_id, expiry_date, notes,
        } = req.body;

        if (!employee_name?.trim())  return res.status(400).json({ success: false, message: 'Employee name is required' });
        if (!designation?.trim())    return res.status(400).json({ success: false, message: 'Position / Designation is required' });
        if (!department?.trim())     return res.status(400).json({ success: false, message: 'Department is required' });
        if (!employment_type)        return res.status(400).json({ success: false, message: 'Employment type is required' });
        if (!salary || isNaN(Number(salary)) || Number(salary) <= 0)
            return res.status(400).json({ success: false, message: 'Valid offered salary is required' });
        if (!expiry_date) return res.status(400).json({ success: false, message: 'Offer expiry date is required' });
        if (new Date(expiry_date) <= new Date())
            return res.status(400).json({ success: false, message: 'Expiry date must be in the future' });

        const token = crypto.randomBytes(32).toString('hex'); // 64-char hex

        const { data: admin } = await supabase
            .from('employees').select('first_name, last_name')
            .eq('employee_id', req.user.employeeId).maybeSingle();
        const generatedByName = admin
            ? `${admin.first_name} ${admin.last_name}`.trim()
            : req.user.employeeId;

        const { data, error } = await supabase.from('employee_offer_links').insert([{
            token,
            employee_name: employee_name.trim(),
            designation:   designation.trim(),
            department:    department.trim(),
            employment_type,
            salary:              Number(salary),
            reporting_manager:   reporting_manager || null,
            reporting_manager_id: reporting_manager_id || null,
            expiry_date,
            notes:               notes?.trim() || null,
            status:              'pending',
            generated_by:        req.user.employeeId,
            generated_by_name:   generatedByName,
        }]).select().single();

        if (error) throw error;

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = `${baseUrl}/onboarding/${token}`;
        res.status(201).json({ success: true, link, offer: data });
    } catch (err) {
        console.error('[onboarding] generate:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/onboarding/links — Protected: list all offer links ───────────────
router.get('/links', verifyToken, isAdminOrDesktopSupport, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employee_offer_links')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        const now = new Date();
        const links = (data || []).map(l => ({
            ...l,
            effective_status: (l.status === 'pending' && new Date(l.expiry_date) < now) ? 'expired' : l.status,
        }));
        res.json({ success: true, links });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/onboarding/links/:id/submission — Protected: view submission ─────
router.get('/links/:id/submission', verifyToken, isAdminOrDesktopSupport, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employee_onboarding_submissions')
            .select('*')
            .eq('offer_id', req.params.id)
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: 'No submission found for this offer' });
        res.json({ success: true, submission: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH /api/onboarding/links/:id/expire — Protected: expire a link ─────────
router.patch('/links/:id/expire', verifyToken, isAdminOrDesktopSupport, async (req, res) => {
    try {
        const { error } = await supabase.from('employee_offer_links')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'Link expired successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/onboarding/links/:id — Protected: delete offer link ───────────
router.delete('/links/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { error } = await supabase.from('employee_offer_links').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'Offer link deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH /api/onboarding/links/:id/approve — Protected: create employee account
router.patch('/links/:id/approve', verifyToken, isAdmin, async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');

        const { data: offer } = await supabase
            .from('employee_offer_links').select('*').eq('id', req.params.id).maybeSingle();
        if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
        if (offer.status !== 'submitted')
            return res.status(400).json({ success: false, message: 'Only submitted offers can be approved' });

        const { data: sub } = await supabase
            .from('employee_onboarding_submissions').select('*').eq('offer_id', req.params.id).maybeSingle();
        if (!sub) return res.status(404).json({ success: false, message: 'No submission found for this offer' });

        // Generate employee_id (B2BYYMMNN)
        const { data: existing } = await supabase.from('employees').select('employee_id');
        const now = new Date();
        const yy  = String(now.getFullYear()).slice(-2);
        const mm  = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `B2B${yy}${mm}`;
        const count = (existing || []).filter(e => e.employee_id?.startsWith(prefix)).length;
        const newEmployeeId = `${prefix}${String(count + 1).padStart(2, '0')}`;

        const tempPassword = `HRMS@${Math.random().toString(36).slice(-6).toUpperCase()}`;
        const hashed = await bcrypt.hash(tempPassword, 10);

        const { data: emp, error: empErr } = await supabase.from('employees').insert([{
            employee_id:    newEmployeeId,
            first_name:     sub.first_name,
            middle_name:    sub.middle_name || null,
            last_name:      sub.last_name,
            email:          sub.email,
            password:       hashed,
            phone:          sub.phone || null,
            dob:            sub.dob || null,
            gender:         sub.gender || null,
            blood_group:    sub.blood_group || null,
            address:        sub.address || null,
            city:           sub.city || null,
            state:          sub.state || null,
            pincode:        sub.pincode || null,
            designation:    offer.designation,
            department:     offer.department,
            employment_type: offer.employment_type,
            gross_salary:   offer.salary,
            in_hand_salary: Math.max(0, offer.salary - 200),
            reporting_manager: offer.reporting_manager || null,
            joining_date:   sub.joining_date || now.toISOString().split('T')[0],
            bank_account_name: sub.bank_account_name || null,
            account_number: sub.account_number || null,
            ifsc_code:      sub.ifsc_code || null,
            branch_name:    sub.branch_name || null,
            pan_number:     sub.pan_number || null,
            aadhar_number:  sub.aadhar_number || null,
            uan:            sub.uan || null,
            emergency_contact: sub.emergency_contact || null,
            emergency_contact_name: sub.emergency_contact_name || null,
            emergency_contact_relation: sub.emergency_contact_relation || null,
            role:           'employee',
            is_active:      true,
            can_apply_leave: true,
            profile_completed: true,
            shift_timing:   '9:00 AM - 6:00 PM',
        }]).select().single();

        if (empErr) throw empErr;

        await supabase.from('employee_offer_links').update({
            status:      'approved',
            approved_at: now.toISOString(),
            approved_by: req.user.employeeId,
            updated_at:  now.toISOString(),
        }).eq('id', req.params.id);

        res.json({
            success: true,
            message: 'Employee account created successfully',
            employee_id:   newEmployeeId,
            temp_password: tempPassword,
            employee:      emp,
        });
    } catch (err) {
        console.error('[onboarding] approve:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES — no auth middleware (must come AFTER /links/* routes above)
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/onboarding/:token — Public: get offer details ────────────────────
router.get('/:token', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employee_offer_links')
            .select('id, token, employee_name, designation, department, employment_type, salary, reporting_manager, expiry_date, notes, status, generated_by_name, accepted_at, rejected_at, submitted_at, created_at')
            .eq('token', req.params.token)
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: 'Offer link not found or invalid' });

        if (data.status === 'pending' && new Date(data.expiry_date) < new Date()) {
            await supabase.from('employee_offer_links')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('token', req.params.token);
            return res.status(410).json({
                success: false, message: 'This offer link has expired',
                offer: { ...data, status: 'expired' },
            });
        }

        res.json({ success: true, offer: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/onboarding/:token/accept ────────────────────────────────────────
router.post('/:token/accept', async (req, res) => {
    try {
        const { data } = await supabase.from('employee_offer_links')
            .select('status, expiry_date').eq('token', req.params.token).maybeSingle();
        if (!data) return res.status(404).json({ success: false, message: 'Offer not found' });
        if (data.status !== 'pending')
            return res.status(400).json({ success: false, message: `Offer is already ${data.status}` });
        if (new Date(data.expiry_date) < new Date())
            return res.status(410).json({ success: false, message: 'Offer has expired' });

        await supabase.from('employee_offer_links').update({
            status: 'accepted', accepted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('token', req.params.token);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/onboarding/:token/reject ────────────────────────────────────────
router.post('/:token/reject', async (req, res) => {
    try {
        const { confirmed_name } = req.body;
        const { data } = await supabase.from('employee_offer_links')
            .select('*').eq('token', req.params.token).maybeSingle();
        if (!data) return res.status(404).json({ success: false, message: 'Offer not found' });
        if (data.status !== 'pending')
            return res.status(400).json({ success: false, message: `Offer is already ${data.status}` });
        if (new Date(data.expiry_date) < new Date())
            return res.status(410).json({ success: false, message: 'Offer has expired' });
        if (!confirmed_name || confirmed_name.trim().toLowerCase() !== data.employee_name.trim().toLowerCase())
            return res.status(400).json({ success: false, message: 'Name confirmation does not match' });

        const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
        const ua = (req.headers['user-agent'] || '').substring(0, 255);

        await supabase.from('employee_offer_links').update({
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejected_by_ip: ip,
            rejected_by_device: ua,
            updated_at: new Date().toISOString(),
        }).eq('token', req.params.token);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/onboarding/:token/submit ────────────────────────────────────────
router.post('/:token/submit', upload.fields([
    { name: 'passport_photo',   maxCount: 1 },
    { name: 'aadhar_card_doc',  maxCount: 1 },
    { name: 'pan_card_doc',     maxCount: 1 },
    { name: 'offer_letter_doc', maxCount: 1 },
]), async (req, res) => {
    try {
        const { data: offer } = await supabase.from('employee_offer_links')
            .select('*').eq('token', req.params.token).maybeSingle();
        if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
        if (!['pending', 'accepted'].includes(offer.status))
            return res.status(400).json({ success: false, message: `Cannot submit: offer is ${offer.status}` });
        if (new Date(offer.expiry_date) < new Date())
            return res.status(410).json({ success: false, message: 'Offer has expired' });

        const { data: dup } = await supabase.from('employee_onboarding_submissions')
            .select('id').eq('offer_id', offer.id).maybeSingle();
        if (dup) return res.status(409).json({ success: false, message: 'This offer has already been submitted' });

        const {
            first_name, middle_name, last_name, email, phone, dob, gender, blood_group,
            address, city, state, pincode,
            bank_account_name, account_number, ifsc_code, branch_name,
            pan_number, aadhar_number, uan,
            emergency_contact, emergency_contact_name, emergency_contact_relation,
            joining_date,
        } = req.body;

        if (!first_name?.trim())    return res.status(400).json({ success: false, message: 'First name is required' });
        if (!last_name?.trim())     return res.status(400).json({ success: false, message: 'Last name is required' });
        if (!email?.trim())         return res.status(400).json({ success: false, message: 'Email is required' });
        if (!bank_account_name?.trim()) return res.status(400).json({ success: false, message: 'Account holder name is required' });
        if (!account_number?.trim())    return res.status(400).json({ success: false, message: 'Account number is required' });
        if (!ifsc_code?.trim())         return res.status(400).json({ success: false, message: 'IFSC code is required' });
        if (!req.files?.passport_photo)  return res.status(400).json({ success: false, message: 'Passport size photo is required' });
        if (!req.files?.aadhar_card_doc) return res.status(400).json({ success: false, message: 'Aadhar card document is required' });
        if (!req.files?.pan_card_doc)    return res.status(400).json({ success: false, message: 'PAN card document is required' });

        // Upload documents to Supabase Storage (onboarding/ folder)
        const uploadDoc = async (fieldName) => {
            const [file] = req.files[fieldName] || [];
            if (!file) return null;
            const { publicUrl } = await uploadFile(file.buffer, file.originalname, 'onboarding', file.mimetype);
            return publicUrl;
        };

        const [passport_photo_url, aadhar_card_doc_url, pan_card_doc_url, offer_letter_doc_url] = await Promise.all([
            uploadDoc('passport_photo'),
            uploadDoc('aadhar_card_doc'),
            uploadDoc('pan_card_doc'),
            uploadDoc('offer_letter_doc'),
        ]);

        const { error } = await supabase.from('employee_onboarding_submissions').insert([{
            offer_id:      offer.id,
            first_name:    first_name.trim(),
            middle_name:   middle_name?.trim() || null,
            last_name:     last_name.trim(),
            email:         email.trim().toLowerCase(),
            phone:         phone || null, dob: dob || null, gender: gender || null,
            blood_group:   blood_group || null,
            address:       address || null, city: city || null, state: state || null, pincode: pincode || null,
            designation:   offer.designation, department: offer.department,
            employment_type: offer.employment_type,
            gross_salary:  offer.salary,
            in_hand_salary: Math.max(0, offer.salary - 200),
            reporting_manager: offer.reporting_manager || null,
            joining_date:  joining_date || null,
            bank_account_name: bank_account_name.trim(), account_number: account_number.trim(),
            ifsc_code:     ifsc_code.trim(), branch_name: branch_name || null,
            pan_number:    pan_number || null, aadhar_number: aadhar_number || null, uan: uan || null,
            emergency_contact: emergency_contact || null,
            emergency_contact_name: emergency_contact_name || null,
            emergency_contact_relation: emergency_contact_relation || null,
            passport_photo:   passport_photo_url,
            aadhar_card_doc:  aadhar_card_doc_url,
            pan_card_doc:     pan_card_doc_url,
            offer_letter_doc: offer_letter_doc_url,
        }]);
        if (error) throw error;

        await supabase.from('employee_offer_links').update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq('token', req.params.token);

        res.status(201).json({ success: true, message: 'Onboarding form submitted successfully' });
    } catch (err) {
        console.error('[onboarding] submit:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
