// backend/utils/onboardingTickets.js
// Auto-raises IT + Marketing tickets whenever a new employee account is created
// (via onboarding-link approval or manual Add Employee). Never throws — a
// failure here must not block or roll back employee creation.

const generateTicketNumber = async (supabase) => {
    const today = new Date();
    const ymd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase.from('support_tickets')
        .select('*', { count: 'exact', head: true });
    const seq = String((count || 0) + 1).padStart(4, '0');
    return `TKT-${ymd}-${seq}`;
};

const findDeptManager = async (supabase, department) => {
    const { data } = await supabase.from('employees')
        .select('employee_id, first_name, last_name')
        .eq('department', department)
        .eq('role', 'manager')
        .eq('is_active', true);
    return (data && data[0]) || null;
};

const TICKET_SPECS = [
    {
        department: 'IT',
        issue_type: 'New Employee – Assign System Access',
        subject: (name) => `New Employee Onboarded – Please Assign System for ${name}`,
        description: (name, designation, employeeId) =>
            `${name} (${employeeId})${designation ? `, ${designation},` : ''} has been onboarded. Please assign a system/laptop and set up login access.`,
    },
    {
        department: 'Marketing',
        issue_type: 'New Employee – Issue ID Card',
        subject: (name) => `New Employee Onboarded – Please Issue ID Card for ${name}`,
        description: (name, designation, employeeId) =>
            `${name} (${employeeId})${designation ? `, ${designation},` : ''} has been onboarded. Please prepare and issue a new employee ID card.`,
    },
];

async function createOnboardingTickets(supabase, { employee, actor }) {
    try {
        if (!employee || !actor) return;

        const { data: actorEmp } = await supabase.from('employees')
            .select('first_name, last_name, email')
            .eq('employee_id', actor.employeeId)
            .maybeSingle();

        const actorName  = actorEmp ? `${actorEmp.first_name} ${actorEmp.last_name}`.trim() : actor.employeeId;
        const actorEmail = actorEmp?.email || actor.email || '';
        const empName    = `${employee.first_name} ${employee.last_name}`.trim();

        for (const spec of TICKET_SPECS) {
            const manager = await findDeptManager(supabase, spec.department);
            const ticketNumber = await generateTicketNumber(supabase);

            const { data: ticket, error } = await supabase.from('support_tickets').insert({
                ticket_number:    ticketNumber,
                subject:          spec.subject(empName),
                description:      spec.description(empName, employee.designation, employee.employee_id),
                department:       spec.department,
                issue_type:       spec.issue_type,
                priority:         'high',
                status:           'open',
                raised_by:        actor.employeeId,
                raised_by_email:  actorEmail,
                raised_by_name:   actorName,
                assigned_to:      manager?.employee_id || null,
                assigned_to_name: manager ? `${manager.first_name} ${manager.last_name}`.trim() : null,
                tagged_employees: [],
            }).select().maybeSingle();

            if (error) {
                console.error(`[onboardingTickets] failed to create ${spec.department} ticket:`, error);
                continue;
            }

            await supabase.from('ticket_history').insert({
                ticket_id:         ticket.id,
                action:            'created',
                message:           `Auto-raised on employee onboarding by ${actorName}`,
                old_status:        null,
                new_status:        'open',
                performed_by:      actor.employeeId,
                performed_by_name: actorName,
            });
        }
    } catch (err) {
        console.error('[onboardingTickets] unexpected error:', err);
    }
}

module.exports = { createOnboardingTickets };
