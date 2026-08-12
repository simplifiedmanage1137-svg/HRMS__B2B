const supabase = require('../config/supabase');

class NotificationService {
    
    // Create a new notification
    async createNotification({ employee_id, title, message, type, reference_id = null, metadata = null }) {
        try {
            if (!employee_id) {
                console.warn('⚠️ Notification skipped: No employee_id provided');
                return null;
            }

            const notification = {
                employee_id,
                title: title || 'Notification',
                message,
                type: type || 'info',
                reference_id,
                metadata,
                is_read: false,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('notifications')
                .insert([notification])
                .select();

            if (error) throw error;

            console.log(`✅ Notification created for ${employee_id}: ${title}`);
            return data[0];

        } catch (error) {
            console.error('❌ Error creating notification:', error);
            return null;
        }
    }

    // Create notifications for multiple employees
    async createBulkNotifications(notifications) {
        try {
            const validNotifications = notifications.filter(n => n.employee_id);
            
            if (validNotifications.length === 0) {
                return [];
            }

            const notificationsToInsert = validNotifications.map(n => ({
                employee_id: n.employee_id,
                title: n.title || 'Notification',
                message: n.message,
                type: n.type || 'info',
                reference_id: n.reference_id || null,
                metadata: n.metadata || null,
                is_read: false,
                created_at: new Date().toISOString()
            }));

            const { data, error } = await supabase
                .from('notifications')
                .insert(notificationsToInsert)
                .select();

            if (error) throw error;

            console.log(`✅ Created ${data.length} bulk notifications`);
            return data;

        } catch (error) {
            console.error('❌ Error creating bulk notifications:', error);
            return [];
        }
    }

    // Send leave approval notifications
    async sendLeaveApprovalNotifications(leave, approverType, status, comments = null) {
        try {
            const notifications = [];

            // Get employee details
            const { data: employee } = await supabase
                .from('employees')
                .select('first_name, last_name, reporting_manager')
                .eq('employee_id', leave.employee_id)
                .single();

            if (!employee) return;

            const employeeName = `${employee.first_name} ${employee.last_name}`;

            // Notification to employee
            if (status === 'approved') {
                notifications.push({
                    employee_id: leave.employee_id,
                    title: approverType === 'rm' ? 'RM Approved' : 'Leave Approved',
                    message: approverType === 'rm' 
                        ? `Your leave request has been approved by your Reporting Manager and is now pending HR approval.`
                        : `Your leave request has been fully approved!`,
                    type: 'leave_approved',
                    reference_id: leave.id,
                    metadata: { leave_id: leave.id, approver_type: approverType, status }
                });
            } else if (status === 'rejected') {
                notifications.push({
                    employee_id: leave.employee_id,
                    title: 'Leave Rejected',
                    message: `Your leave request has been rejected by ${approverType === 'rm' ? 'Reporting Manager' : 'HR'}.${comments ? ' Reason: ' + comments : ''}`,
                    type: 'leave_rejected',
                    reference_id: leave.id,
                    metadata: { leave_id: leave.id, approver_type: approverType, comments }
                });
            }

            // If RM approves, notify HR
            if (approverType === 'rm' && status === 'approved') {
                const { data: hrUsers } = await supabase
                    .from('users')
                    .select('employee_id')
                    .eq('role', 'admin');

                for (const hr of hrUsers || []) {
                    notifications.push({
                        employee_id: hr.employee_id,
                        title: 'Leave Pending HR Approval',
                        message: `${employeeName}'s leave request has been approved by RM and now requires your approval.`,
                        type: 'leave_pending_hr',
                        reference_id: leave.id,
                        metadata: { leave_id: leave.id, employee_name: employeeName }
                    });
                }
            }

            // If rejected, notify HR as well
            if (status === 'rejected') {
                const { data: hrUsers } = await supabase
                    .from('users')
                    .select('employee_id')
                    .eq('role', 'admin');

                for (const hr of hrUsers || []) {
                    notifications.push({
                        employee_id: hr.employee_id,
                        title: 'Leave Request Rejected',
                        message: `${employeeName}'s leave request has been rejected by ${approverType === 'rm' ? 'Reporting Manager' : 'HR'}.`,
                        type: 'leave_rejected_notification',
                        reference_id: leave.id,
                        metadata: { leave_id: leave.id, rejected_by: approverType, comments }
                    });
                }
            }

            return await this.createBulkNotifications(notifications);

        } catch (error) {
            console.error('❌ Error sending leave approval notifications:', error);
            return [];
        }
    }

    // Send regularization workflow notifications
    // action: 'created' | 'approved' | 'rejected' | 'cancelled'
    async sendRegularizationNotifications(request, action, { actorName = 'Someone', comments = null } = {}) {
        try {
            const notifications = [];
            const typeLabel = (request.request_type || '').replace(/_/g, ' ');

            if (action === 'created') {
                // HR/Admin should always be notified, even when the request is routed
                // directly to a manager (not just when they're the fallback approver).
                const { data: hrAdmins } = await supabase
                    .from('employees')
                    .select('employee_id')
                    .in('role', ['hr', 'admin', 'sub_admin']);
                const targets = new Set((hrAdmins || []).map(e => e.employee_id));
                if (request.pending_with_employee_id) targets.add(request.pending_with_employee_id);

                targets.forEach(id => notifications.push({
                    employee_id: id,
                    title: 'New Regularization Request',
                    message: `${actorName} submitted a ${typeLabel} request for ${request.attendance_date}.`,
                    type: 'regularization_pending',
                    reference_id: request.id,
                    metadata: { request_id: request.id, employee_id: request.employee_id, request_type: request.request_type },
                }));
            } else if (action === 'approved') {
                notifications.push({
                    employee_id: request.employee_id,
                    title: 'Regularization Approved',
                    message: `Your ${typeLabel} request for ${request.attendance_date} was approved by ${actorName}.`,
                    type: 'regularization_approved',
                    reference_id: request.id,
                    metadata: { request_id: request.id },
                });
            } else if (action === 'rejected') {
                notifications.push({
                    employee_id: request.employee_id,
                    title: 'Regularization Rejected',
                    message: `Your attendance regularization request has been rejected.${comments ? ' Reason: ' + comments : ''}`,
                    type: 'regularization_rejected',
                    reference_id: request.id,
                    metadata: { request_id: request.id, comments },
                });
            } else if (action === 'cancelled' && request.pending_with_employee_id) {
                notifications.push({
                    employee_id: request.pending_with_employee_id,
                    title: 'Regularization Withdrawn',
                    message: `${actorName} withdrew their pending request for ${request.attendance_date}.`,
                    type: 'regularization_cancelled',
                    reference_id: request.id,
                    metadata: { request_id: request.id },
                });
            }

            return await this.createBulkNotifications(notifications);
        } catch (error) {
            console.error('❌ Error sending regularization notifications:', error);
            return [];
        }
    }

    // Send support-ticket lifecycle notifications
    // action: 'created' | 'comment_from_employee' | 'comment_from_team' |
    //         'in_progress' | 'resolved' | 'reopened' | 'closed'
    async sendTicketNotifications(ticket, action, { actorEmployeeId = null, actorName = 'Someone' } = {}) {
        try {
            const notifications = [];
            const ticketRef = ticket.ticket_number || ticket.id;
            const priorityLabel = (ticket.priority || 'medium').toUpperCase();

            const getTeamRecipients = async () => {
                const [{ data: deptEmps }, { data: overseers }] = await Promise.all([
                    supabase.from('employees')
                        .select('employee_id')
                        .eq('department', ticket.department)
                        .eq('is_active', true),
                    supabase.from('employees')
                        .select('employee_id')
                        .in('role', ['admin', 'sub_admin', 'hr'])
                        .eq('is_active', true),
                ]);
                const ids = new Set([
                    ...(deptEmps || []).map(e => e.employee_id),
                    ...(overseers || []).map(e => e.employee_id),
                ]);
                if (actorEmployeeId) ids.delete(actorEmployeeId);
                return [...ids];
            };

            if (action === 'created') {
                // Team/department-wide visibility notification (everyone in the department +
                // admin/sub_admin/hr) — separate from, not a substitute for, the specific
                // assignee notification below. A team member who isn't the assignee still just
                // gets "New Ticket", never "assigned to you".
                const recipients = await getTeamRecipients();
                recipients.forEach(id => notifications.push({
                    employee_id: id,
                    title: `New Ticket: ${ticket.department}`,
                    message: `${actorName} raised "${ticket.subject}" (${ticketRef}) — Priority: ${priorityLabel}`,
                    type: 'ticket_created',
                    reference_id: ticket.id,
                    metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, department: ticket.department, priority: ticket.priority },
                }));
                // Distinct "assigned to you" notification for the specifically @mentioned
                // person, if one was selected — this is what actually tells them the ticket
                // is theirs to work, as opposed to just being visible to the whole team.
                if (ticket.assigned_to && ticket.assigned_to !== actorEmployeeId) {
                    notifications.push({
                        employee_id: ticket.assigned_to,
                        title: 'Ticket Assigned To You',
                        message: `${actorName} assigned "${ticket.subject}" (${ticketRef}) to you — Priority: ${priorityLabel}`,
                        type: 'ticket_assigned',
                        reference_id: ticket.id,
                        metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, department: ticket.department, priority: ticket.priority },
                    });
                }
            } else if (action === 'comment_from_employee') {
                const recipients = await getTeamRecipients();
                recipients.forEach(id => notifications.push({
                    employee_id: id,
                    title: 'New Reply on Ticket',
                    message: `${actorName} replied to "${ticket.subject}" (${ticketRef})`,
                    type: 'ticket_comment',
                    reference_id: ticket.id,
                    metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, department: ticket.department },
                }));
            } else if (action === 'comment_from_team') {
                if (ticket.raised_by && ticket.raised_by !== actorEmployeeId) {
                    notifications.push({
                        employee_id: ticket.raised_by,
                        title: 'New Reply on Your Ticket',
                        message: `${actorName} replied to "${ticket.subject}" (${ticketRef})`,
                        type: 'ticket_comment',
                        reference_id: ticket.id,
                        metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number },
                    });
                }
            } else if (action === 'in_progress') {
                if (ticket.raised_by && ticket.raised_by !== actorEmployeeId) {
                    notifications.push({
                        employee_id: ticket.raised_by,
                        title: 'Ticket In Progress',
                        message: `Your ticket "${ticket.subject}" (${ticketRef}) is now being processed.`,
                        type: 'ticket_status',
                        reference_id: ticket.id,
                        metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, status: 'in_progress' },
                    });
                }
            } else if (action === 'resolved') {
                if (ticket.raised_by && ticket.raised_by !== actorEmployeeId) {
                    notifications.push({
                        employee_id: ticket.raised_by,
                        title: 'Ticket Resolved — Please Confirm',
                        message: `Your ticket "${ticket.subject}" (${ticketRef}) has been marked resolved. Please confirm or reopen it.`,
                        type: 'ticket_status',
                        reference_id: ticket.id,
                        metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, status: 'resolved_pending' },
                    });
                }
            } else if (action === 'reopened') {
                const recipients = await getTeamRecipients();
                recipients.forEach(id => notifications.push({
                    employee_id: id,
                    title: 'Ticket Reopened',
                    message: `${actorName} reopened "${ticket.subject}" (${ticketRef}).`,
                    type: 'ticket_status',
                    reference_id: ticket.id,
                    metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, status: 'reopened', department: ticket.department },
                }));
            } else if (action === 'closed') {
                if (ticket.assigned_to && ticket.assigned_to !== actorEmployeeId) {
                    notifications.push({
                        employee_id: ticket.assigned_to,
                        title: 'Ticket Closed',
                        message: `"${ticket.subject}" (${ticketRef}) was confirmed resolved and closed by ${actorName}.`,
                        type: 'ticket_status',
                        reference_id: ticket.id,
                        metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, status: 'closed' },
                    });
                }
            }

            return await this.createBulkNotifications(notifications);
        } catch (error) {
            console.error('❌ Error sending ticket notifications:', error);
            return [];
        }
    }
}

module.exports = new NotificationService();