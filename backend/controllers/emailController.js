// controllers/emailController.js
// Manual email compose — Admin/HR "Email" section. Recipients are always resolved
// server-side from employee_id (never trusts an email address handed in directly by the
// client) — this is what stops an authorized-but-malicious request from using the
// company's Resend account to spam an arbitrary external address.
const supabase = require('../config/supabase');
const { sendManualEmail } = require('../services/emailService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 10000;

// Validates a list of free-typed CC/BCC address strings — unlike `to` recipients (always
// resolved server-side from employee_id, see below), CC/BCC are allowed to be any address
// the admin types (e.g. an external recruiter) since the sender is already an authenticated,
// role-gated admin/HR user — this mirrors what a normal email client lets you do.
const cleanEmailList = (list) => Array.isArray(list)
    ? [...new Set(list.map(a => (a || '').trim().toLowerCase()).filter(a => a && EMAIL_REGEX.test(a)))]
    : [];

exports.sendManualEmail = async (req, res) => {
    try {
        const { recipient_ids, subject, message, cc, bcc } = req.body;

        if (!Array.isArray(recipient_ids) || recipient_ids.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one recipient is required' });
        }

        const trimmedSubject = (subject || '').trim();
        const trimmedMessage = (message || '').trim();
        if (!trimmedSubject) return res.status(400).json({ success: false, message: 'Subject is required' });
        if (!trimmedMessage) return res.status(400).json({ success: false, message: 'Message is required' });
        if (trimmedSubject.length > MAX_SUBJECT_LENGTH) {
            return res.status(400).json({ success: false, message: `Subject is too long (max ${MAX_SUBJECT_LENGTH} characters)` });
        }
        if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ success: false, message: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` });
        }

        // Dedupe employee_ids before the query — prevents the same person being queried/
        // emailed twice just because the frontend accidentally included them twice (e.g.
        // selected individually AND via "All Managers").
        const uniqueIds = [...new Set(recipient_ids.filter(Boolean))];

        const { data: employees, error } = await supabase
            .from('employees')
            .select('employee_id, email, first_name, last_name')
            .in('employee_id', uniqueIds)
            .eq('is_active', true);
        if (error) throw error;

        // Second dedupe pass on the resolved email address itself (two employee_ids could
        // theoretically share an email in bad data) + basic format validation — anything
        // invalid/missing is skipped and reported back, never silently dropped without a count.
        const seenEmails = new Set();
        const validRecipients = [];
        let skippedInvalid = 0;
        (employees || []).forEach(e => {
            if (!e.email || !EMAIL_REGEX.test(e.email)) { skippedInvalid++; return; }
            const key = e.email.toLowerCase();
            if (seenEmails.has(key)) return;
            seenEmails.add(key);
            validRecipients.push(e);
        });

        if (validRecipients.length === 0) {
            return res.status(400).json({ success: false, message: 'None of the selected recipients have a valid email address on file' });
        }

        const { data: sender } = await supabase
            .from('employees')
            .select('first_name, last_name')
            .eq('employee_id', req.user.employeeId)
            .maybeSingle();
        const sentByName = sender ? `${sender.first_name} ${sender.last_name}`.trim() : (req.user.email || 'HRMS Admin');

        const ccList  = cleanEmailList(cc);
        const bccList = cleanEmailList(bcc);

        const result = await sendManualEmail(validRecipients, {
            subject: trimmedSubject,
            message: trimmedMessage,
            sentByName,
            cc: ccList,
            bcc: bccList,
        });

        console.log(
            `📧 [MANUAL EMAIL] ${req.user.employeeId} (${req.user.role}) → ${validRecipients.length} recipient(s) ` +
            `(cc: ${ccList.length}, bcc: ${bccList.length}): ` +
            `${result.sent} sent, ${result.failed} failed, ${skippedInvalid} skipped (invalid email)`
        );

        return res.json({
            success: true,
            message: result.failed > 0
                ? `Sent to ${result.sent} of ${validRecipients.length} recipient(s) — ${result.failed} failed to deliver.`
                : `Email sent successfully to ${result.sent} recipient(s).`,
            sent: result.sent,
            failed: result.failed,
            total_recipients: validRecipients.length,
            skipped_invalid: skippedInvalid,
        });
    } catch (err) {
        console.error('❌ [email] send error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to send email' });
    }
};
