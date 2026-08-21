// backend/utils/employeeLookup.js
// Centralized employee/hierarchy lookups — moved out of attendanceController.js
// so regularizationService.js (and anything else) can reuse them without
// duplicating the same name-matching logic yet again.

const supabase = require('../config/supabase');

const normalizeName = (value) => {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

const getEmployeeById = async (employeeId) => {
    if (!employeeId) return null;
    const { data, error } = await supabase
        .from('employees')
        .select('employee_id, first_name, last_name, reporting_manager')
        .eq('employee_id', employeeId)
        .maybeSingle();
    if (error) {
        console.error(`❌ Error fetching employee ${employeeId}:`, error);
        return null;
    }
    return data;
};

const getTeamEmployeeIdsByManagerName = async (managerName) => {
    if (!managerName) return [];
    const { data, error } = await supabase
        .from('employees')
        .select('employee_id, reporting_manager');
    if (error || !data) {
        console.error('❌ Error fetching team members for manager:', error);
        return [];
    }
    const normalizedManager = normalizeName(managerName);
    return (data || [])
        .filter(emp => normalizeName(emp.reporting_manager) === normalizedManager)
        .map(emp => emp.employee_id);
};

// Manager Dashboard team filter: given the employee_id typed into the "View Team"
// dropdown, resolve it to that manager's team member employee_ids. Composed from the
// two primitives above rather than re-deriving reporting_manager matching again.
// Returns null for a falsy/'ALL' managerId (meaning "no scope — company-wide"), and
// [] if the manager_id doesn't resolve to anyone or has no direct reports (empty team).
const getTeamEmployeeIdsByEmployeeId = async (managerId) => {
    if (!managerId || managerId === 'ALL') return null;
    const manager = await getEmployeeById(managerId);
    if (!manager) return [];
    const fullName = `${manager.first_name} ${manager.last_name}`.trim();
    return getTeamEmployeeIdsByManagerName(fullName);
};

const employeeHasDirectReports = async (employeeName) => {
    if (!employeeName) return false;
    const { data, error } = await supabase
        .from('employees')
        .select('employee_id, reporting_manager');
    if (error || !data) {
        console.error('❌ Error checking direct reports for:', employeeName, error);
        return false;
    }
    const normalizedManager = normalizeName(employeeName);
    return (data || []).some(emp => normalizeName(emp.reporting_manager) === normalizedManager);
};

module.exports = { normalizeName, getEmployeeById, getTeamEmployeeIdsByManagerName, getTeamEmployeeIdsByEmployeeId, employeeHasDirectReports };
