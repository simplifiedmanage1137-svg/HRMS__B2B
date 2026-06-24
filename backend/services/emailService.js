// services/emailService.js
// Resend transactional email service — API key NEVER in frontend / Vite env.

const { Resend } = require('resend');

// ─── Safe defaults (used when env var is missing or blank) ────────────────────
const DEFAULT_FROM  = 'HRMS <noreply@hrms.b2bindemand.agency>';
const DEFAULT_FRONT = 'https://hrms.b2bindemand.agency';

// Helper: returns the env value only when it is a non-empty string
const envStr = (key, fallback) => {
    const val = process.env[key];
    return (val && val.trim()) ? val.trim() : fallback;
};

// ─── Startup logs (runs once when module is first required) ───────────────────
console.log('--- [EMAIL SERVICE] startup ---');
console.log('EMAIL_FROM       :', JSON.stringify(process.env.EMAIL_FROM));
console.log('FRONTEND_URL     :', JSON.stringify(process.env.FRONTEND_URL));
console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);

const resolvedFrom  = envStr('EMAIL_FROM',  DEFAULT_FROM);
const resolvedFront = envStr('FRONTEND_URL', DEFAULT_FRONT).replace(/\/$/, '');

console.log('Resolved EMAIL_FROM  :', resolvedFrom);
console.log('Resolved FRONTEND_URL:', resolvedFront);
console.log('-------------------------------');

if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️  [EMAIL] RESEND_API_KEY not set — all emails will be skipped');
}
if (resolvedFrom === DEFAULT_FROM && !process.env.EMAIL_FROM) {
    console.warn('⚠️  [EMAIL] EMAIL_FROM not set — using hardcoded fallback:', DEFAULT_FROM);
}
if (resolvedFront === DEFAULT_FRONT && !process.env.FRONTEND_URL) {
    console.warn('⚠️  [EMAIL] FRONTEND_URL not set — using hardcoded fallback:', DEFAULT_FRONT);
}

// ─── Getters: re-read env on every call so hot-reloads / late config works ────
const getFrom  = () => envStr('EMAIL_FROM',  DEFAULT_FROM);
const getFront = () => envStr('FRONTEND_URL', DEFAULT_FRONT).replace(/\/$/, '');

// ─── Core send wrapper ────────────────────────────────────────────────────────
// Never throws — always returns { success, ... } so callers are never blocked.
const sendEmail = async ({ to, subject, html, text }) => {
    const from       = getFrom();
    const frontendUrl = getFront();
    const resend     = process.env.RESEND_API_KEY
        ? new Resend(process.env.RESEND_API_KEY)
        : null;

    // ── Send-time logs (exactly as requested) ─────────────────────────────────
    console.log('📧 Sending email');
    console.log('   Sending email from:', from);
    console.log('   Sending email to  :', to);
    console.log('   Email button URL  :', `${frontendUrl}/attendance`);
    console.log('   Subject           :', subject);

    if (!resend) {
        console.warn('⚠️  [EMAIL] RESEND_API_KEY not set — email skipped:', subject);
        return { success: false, reason: 'no_api_key' };
    }
    if (!to) {
        console.warn('⚠️  [EMAIL] No recipient — email skipped:', subject);
        return { success: false, reason: 'no_recipient' };
    }

    try {
        const result = await resend.emails.send({ from, to, subject, html, text });
        console.log('✅ Resend response:', JSON.stringify(result));
        if (result.error) {
            console.error('❌ Resend error details:', result.error);
            return { success: false, error: result.error?.message || JSON.stringify(result.error) };
        }
        return { success: true, id: result.data?.id };
    } catch (error) {
        console.error('❌ Resend email failed:', error);
        console.error('❌ Resend error details:', error?.response?.data || error?.message || error);
        return { success: false, error: error?.message || String(error) };
    }
};

// ─── Shared template shell ────────────────────────────────────────────────────
const shell = (title, bodyHtml) => {
    const frontendUrl = getFront();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1e3a5f;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">B2BinDemand HRMS</h1>
            <p style="margin:4px 0 0;color:#94b8d6;font-size:13px;">${title}</p>
          </td>
        </tr>
        <tr><td style="padding:32px;">${bodyHtml}</td></tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e8ecf0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              This is an automated message from B2BinDemand HRMS. Please do not reply.<br/>
              <a href="${frontendUrl}" style="color:#1e3a5f;text-decoration:none;">Visit HRMS Portal</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// ─── HTML helpers ─────────────────────────────────────────────────────────────
const row = (label, value, highlight = false) => `
<tr>
  <td style="padding:8px 12px;font-size:13px;color:#64748b;width:40%;border-bottom:1px solid #f1f5f9;">${label}</td>
  <td style="padding:8px 12px;font-size:13px;color:${highlight ? '#1e3a5f' : '#1e293b'};font-weight:${highlight ? '700' : '500'};border-bottom:1px solid #f1f5f9;">${value ?? '—'}</td>
</tr>`;

const tbl = (rows) => `
<table width="100%" cellpadding="0" cellspacing="0"
  style="background:#f8fafc;border-radius:8px;overflow:hidden;margin:16px 0;border:1px solid #e2e8f0;">
  <tbody>${rows}</tbody>
</table>`;

const badge = (text, color) =>
    `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${color};color:#fff;">${text}</span>`;

const h2 = (text) =>
    `<h2 style="margin:0 0 16px;font-size:16px;color:#1e293b;font-weight:700;">${text}</h2>`;

const para = (text) =>
    `<p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.6;">${text}</p>`;

const btn = (text, url) => `
<div style="text-align:center;margin:24px 0;">
  <a href="${url}" style="display:inline-block;padding:12px 28px;background:#1e3a5f;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">${text}</a>
</div>`;

// ─── 1. SHIFT CHANGE ─────────────────────────────────────────────────────────
const sendShiftChangeEmail = async (employee, shiftDetails) => {
    const { to, name } = resolveRecipient(employee);
    const { oldShift, newShift, effectiveFrom, effectiveUntil, changedBy } = shiftDetails;
    const frontendUrl = getFront();

    const html = shell('Shift Schedule Updated', `
        ${h2('Your Shift Has Been Updated')}
        ${para(`Hi ${name}, your work shift has been changed by your manager.`)}
        ${tbl(
            row('Employee', name) +
            row('Previous Shift', oldShift || 'Not recorded') +
            row('New Shift', newShift, true) +
            row('Effective From', effectiveFrom || new Date().toLocaleDateString('en-IN')) +
            (effectiveUntil ? row('Effective Until', effectiveUntil) : '') +
            (changedBy ? row('Changed By', changedBy) : '') +
            row('Updated On', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST')
        )}
        ${para('If you have any questions, please contact your manager or HR.')}
        ${btn('View My Attendance', `${frontendUrl}/attendance`)}
    `);

    return sendEmail({
        to,
        subject: `Shift Updated: ${newShift}`,
        html,
        text: `Hi ${name}, your shift has been updated to ${newShift} effective ${effectiveFrom || 'immediately'}.`,
    });
};

// ─── 2. LEAVE STATUS ─────────────────────────────────────────────────────────
const sendLeaveStatusEmail = async (employee, leaveDetails) => {
    const { to, name } = resolveRecipient(employee);
    const { status, leaveType, startDate, endDate, daysCount, remarks, approvedBy } = leaveDetails;
    const frontendUrl = getFront();

    const isApproved = status === 'approved';
    const color = isApproved ? '#16a34a' : status === 'cancelled' ? '#64748b' : '#dc2626';
    const label = isApproved ? 'APPROVED' : status === 'cancelled' ? 'CANCELLED' : 'REJECTED';

    const html = shell(`Leave Request ${label}`, `
        ${h2(`Leave Request ${label}`)}
        ${para(`Hi ${name}, your leave request has been <strong>${label.toLowerCase()}</strong>.`)}
        ${tbl(
            row('Status', badge(label, color)) +
            row('Leave Type', leaveType) +
            row('From', startDate) +
            row('To', endDate) +
            row('Total Days', daysCount) +
            (approvedBy ? row('Actioned By', approvedBy) : '') +
            (remarks ? row('Remarks', remarks) : '') +
            row('Updated On', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST')
        )}
        ${isApproved
            ? para('Your leave balance has been updated accordingly.')
            : para('Your leave balance remains unchanged. You may apply again or contact HR for clarification.')}
        ${btn('View My Leaves', `${frontendUrl}/apply-leave`)}
    `);

    return sendEmail({
        to,
        subject: `Leave ${label}: ${leaveType} (${startDate} – ${endDate})`,
        html,
        text: `Hi ${name}, your ${leaveType} leave from ${startDate} to ${endDate} has been ${status}.${remarks ? ' Remarks: ' + remarks : ''}`,
    });
};

// ─── 3. EMPLOYEE PROFILE UPDATE APPROVAL ─────────────────────────────────────
const sendEmployeeUpdateEmail = async (employee, updateDetails) => {
    const { to, name } = resolveRecipient(employee);
    const { action, fields, isDocumentUpdate, documentTypes, remarks } = updateDetails;
    const frontendUrl = getFront();

    const isApproved = action === 'approve';
    const label = isApproved ? 'APPROVED' : 'REJECTED';
    const color = isApproved ? '#16a34a' : '#dc2626';
    const what  = isDocumentUpdate
        ? `Documents: ${(documentTypes || []).map(d => d.replace(/_/g, ' ').toUpperCase()).join(', ')}`
        : `Fields: ${(fields || []).join(', ')}`;

    const html = shell(`Profile Update ${label}`, `
        ${h2(`Your Profile Update Has Been ${label}`)}
        ${para(`Hi ${name}, your profile update request has been reviewed.`)}
        ${tbl(
            row('Status', badge(label, color)) +
            row('Update Type', isDocumentUpdate ? 'Document Upload' : 'Information Update') +
            row('Details', what, true) +
            (remarks ? row('Remarks', remarks) : '') +
            row('Reviewed On', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST')
        )}
        ${isApproved
            ? para('Your profile has been updated successfully.')
            : para('Please contact HR if you need clarification on the rejection reason.')}
        ${btn('View My Profile', `${frontendUrl}/profile`)}
    `);

    return sendEmail({
        to,
        subject: `Profile Update ${label}`,
        html,
        text: `Hi ${name}, your profile update request (${what}) has been ${action}d.${remarks ? ' Remarks: ' + remarks : ''}`,
    });
};

// ─── 4. NOTICE BOARD ─────────────────────────────────────────────────────────
const sendNoticeBoardEmail = async (employeeList, noticeDetails) => {
    const { title, message, createdBy } = noticeDetails;
    const frontendUrl = getFront();

    const results = await Promise.allSettled(
        (employeeList || []).filter(e => e?.email).map(e => {
            const name = `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Employee';
            const html = shell('New Notice Published', `
                ${h2('📢 ' + title)}
                ${para(`Hi ${name}, a new notice has been published on the HRMS notice board.`)}
                <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0;">
                  <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;">${message}</p>
                </div>
                ${tbl(
                    (createdBy ? row('Published By', createdBy) : '') +
                    row('Published On', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST')
                )}
                ${btn('View Notice Board', `${frontendUrl}/attendance`)}
            `);
            return sendEmail({ to: e.email, subject: `Notice: ${title}`, html, text: `Hi ${name}, new notice: ${title}\n\n${message}` });
        })
    );

    const sent   = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.length - sent;
    console.log(`📧 Notice emails: ${sent} sent, ${failed} failed`);
    return { sent, failed };
};

// ─── 5. ANNOUNCEMENT ─────────────────────────────────────────────────────────
const sendAnnouncementEmail = async (employeeList, announcementDetails) => {
    const { title, message, type, priority, createdBy } = announcementDetails;
    const frontendUrl = getFront();
    const priorityColor = priority === 'urgent' ? '#dc2626' : priority === 'high' ? '#ea580c' : '#1e3a5f';

    const results = await Promise.allSettled(
        (employeeList || []).filter(e => e?.email).map(e => {
            const name = `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Employee';
            const html = shell('New Announcement', `
                ${h2('📣 ' + title)}
                ${para(`Hi ${name}, there is a new announcement from management.`)}
                ${priority && priority !== 'normal'
                    ? `<div style="margin-bottom:12px;">${badge(priority.toUpperCase(), priorityColor)}</div>`
                    : ''}
                <div style="background:#f0f4ff;border-left:4px solid #1e3a5f;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0;">
                  <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;">${message}</p>
                </div>
                ${tbl(
                    row('Type', type || 'Announcement') +
                    (createdBy ? row('From', createdBy) : '') +
                    row('Date', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST')
                )}
                ${btn('Open HRMS Portal', frontendUrl)}
            `);
            return sendEmail({
                to: e.email,
                subject: `[${(priority || 'announcement').toUpperCase()}] ${title}`,
                html,
                text: `Hi ${name}, new announcement: ${title}\n\n${message}`,
            });
        })
    );

    const sent   = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.length - sent;
    console.log(`📧 Announcement emails: ${sent} sent, ${failed} failed`);
    return { sent, failed };
};

// ─── 6. HOLIDAY NOTIFICATION ─────────────────────────────────────────────────
const sendHolidayEmail = async (employeeList, holidayDetails) => {
    const { name: holidayName, date, action: act } = holidayDetails;
    const frontendUrl = getFront();
    const actionLabel = act === 'added' ? 'Added' : act === 'updated' ? 'Updated' : 'Removed';

    const results = await Promise.allSettled(
        (employeeList || []).filter(e => e?.email).map(e => {
            const empName = `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Employee';
            const html = shell(`Holiday ${actionLabel}: ${holidayName}`, `
                ${h2(`🗓️ Holiday ${actionLabel}`)}
                ${para(`Hi ${empName}, the holiday calendar has been updated.`)}
                ${tbl(
                    row('Holiday', holidayName, true) +
                    row('Date', date) +
                    row('Action', actionLabel) +
                    row('Updated On', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST')
                )}
                ${para('Please plan your schedule accordingly.')}
                ${btn('View HRMS Portal', frontendUrl)}
            `);
            return sendEmail({
                to: e.email,
                subject: `Holiday ${actionLabel}: ${holidayName} on ${date}`,
                html,
                text: `Hi ${empName}, holiday "${holidayName}" on ${date} has been ${act}.`,
            });
        })
    );

    const sent   = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.length - sent;
    console.log(`📧 Holiday emails: ${sent} sent, ${failed} failed`);
    return { sent, failed };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const resolveRecipient = (employee) => {
    if (!employee) return { to: null, name: 'Employee' };
    const name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Employee';
    return { to: employee.email || null, name };
};

module.exports = {
    sendEmail,
    sendShiftChangeEmail,
    sendLeaveStatusEmail,
    sendEmployeeUpdateEmail,
    sendNoticeBoardEmail,
    sendAnnouncementEmail,
    sendHolidayEmail,
};
