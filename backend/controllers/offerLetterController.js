// backend/controllers/offerLetterController.js
const supabase = require('../config/supabase');
const emailService = require('../services/emailService');
const {
    resolveInput, getMissingFields, generateAndStoreOfferLetter,
} = require('../services/offerLetterService');
const { getCompanyInfo } = require('../config/companyInfo');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getEmployeeOrFail = async (employeeId) => {
    const { data, error } = await supabase.from('employees').select('*').eq('employee_id', employeeId).maybeSingle();
    if (error) throw error;
    return data;
};

// ── GET /api/offer-letters/employee/:employeeId/data ──────────────────────────
exports.getOfferLetterData = async (req, res) => {
    try {
        const employee = await getEmployeeOrFail(req.params.employeeId);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const resolved = resolveInput(employee, {});
        const missingFields = getMissingFields(resolved).map(f => f.label);
        const company = getCompanyInfo(employee);

        const { data: history } = await supabase
            .from('employee_offer_letters')
            .select('*')
            .eq('employee_id', employee.employee_id)
            .order('created_at', { ascending: false });

        res.json({
            success: true,
            employee,
            defaults: resolved,
            company,
            missingFields,
            history: history || [],
            latest: history?.[0] || null,
        });
    } catch (err) {
        console.error('[offer-letters] getOfferLetterData:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /api/offer-letters/employee/:employeeId/preview ──────────────────────
exports.previewOfferLetter = async (req, res) => {
    try {
        const employee = await getEmployeeOrFail(req.params.employeeId);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const generatedByName = req.user?.employeeId
            ? await (async () => {
                const { data } = await supabase.from('employees')
                    .select('first_name, last_name').eq('employee_id', req.user.employeeId).maybeSingle();
                return data ? `${data.first_name} ${data.last_name}`.trim() : req.user.employeeId;
            })()
            : null;

        const { offerLetter } = await generateAndStoreOfferLetter({
            employee,
            formInput: req.body || {},
            generatedBy: req.user?.employeeId,
            generatedByName,
        });

        res.status(201).json({ success: true, offerLetterId: offerLetter.id, pdfUrl: offerLetter.pdf_url });
    } catch (err) {
        console.error('[offer-letters] previewOfferLetter:', err);
        if (err.missingFields) {
            return res.status(400).json({ success: false, message: err.message, missingFields: err.missingFields });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

const sendById = async (req, res, { isResend }) => {
    try {
        const { id } = req.params;
        const { primaryEmail, additionalEmail } = req.body || {};

        const { data: offerLetter, error } = await supabase
            .from('employee_offer_letters').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!offerLetter) return res.status(404).json({ success: false, message: 'Offer letter not found' });

        const to = (primaryEmail || offerLetter.primary_email || '').trim();
        const additional = (additionalEmail || offerLetter.additional_email || '').trim();

        if (!to || !EMAIL_REGEX.test(to)) {
            return res.status(400).json({ success: false, message: 'A valid employee email address is required' });
        }
        if (additional && !EMAIL_REGEX.test(additional)) {
            return res.status(400).json({ success: false, message: 'The additional email address is not valid' });
        }

        const employee = await getEmployeeOrFail(offerLetter.employee_id);
        const company = offerLetter.letter_data?.company || getCompanyInfo(employee);

        const pdfResponse = await fetch(offerLetter.pdf_url);
        if (!pdfResponse.ok) throw new Error('Could not retrieve the generated PDF for sending');
        const pdfArrayBuffer = await pdfResponse.arrayBuffer();
        const pdfBase64 = Buffer.from(pdfArrayBuffer).toString('base64');

        const safeName = (offerLetter.letter_data?.employeeName || 'employee').replace(/[^a-z0-9]+/gi, '-');
        const filename = `${safeName}-Offer-Letter.pdf`;

        const result = await emailService.sendOfferLetterEmail(
            { ...employee, email: to },
            {
                pdfBase64,
                filename,
                additionalEmail: additional || null,
                designation: offerLetter.letter_data?.designation,
                companyName: company.name,
                hrEmail: company.hrEmail,
            },
        );

        const now = new Date().toISOString();
        if (!result.success) {
            await supabase.from('employee_offer_letters').update({
                status: 'failed', failed_reason: result.error || result.reason || 'Unknown email error', updated_at: now,
            }).eq('id', id);
            return res.status(502).json({ success: false, message: result.error || 'Failed to send email' });
        }

        await supabase.from('employee_offer_letters').update({
            status: 'sent', sent_at: now, primary_email: to, additional_email: additional || null,
            failed_reason: null, updated_at: now,
        }).eq('id', id);

        res.json({
            success: true,
            message: `Offer letter ${isResend ? 're' : ''}sent successfully to ${to}${additional ? ` and ${additional}` : ''}.`,
        });
    } catch (err) {
        console.error('[offer-letters] send:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /api/offer-letters/:id/send ───────────────────────────────────────────
exports.sendOfferLetter = (req, res) => sendById(req, res, { isResend: false });

// ── POST /api/offer-letters/:id/resend ─────────────────────────────────────────
exports.resendOfferLetter = (req, res) => sendById(req, res, { isResend: true });

// ── GET /api/offer-letters/employee/:employeeId/history ───────────────────────
exports.getOfferLetterHistory = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employee_offer_letters')
            .select('*')
            .eq('employee_id', req.params.employeeId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, history: data || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
