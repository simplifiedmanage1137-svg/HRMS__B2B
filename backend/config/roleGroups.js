// Single source of truth for "which `employees.role` values count as X" —
// this app's role naming is NOT self-explanatory, confirmed directly from
// frontend/src/components/Layout/Sidebar.jsx (the one place that already displays
// these labels to users):
//   role === 'sub_admin'   -> displayed/labeled as "Manager"
//   role === 'manager'     -> displayed/labeled as "Team Leader (TL)"
//   role === 'hr'          -> HR
// Getting this backwards silently sends "new joiner" / manual-email group sends to
// the wrong population, so every "All Managers"/"All Team Leaders"/"All HR" lookup
// in the backend should import these arrays rather than re-guessing the mapping.

const MANAGER_ROLES     = ['sub_admin'];
const TEAM_LEADER_ROLES = ['manager'];
const HR_ROLES          = ['hr'];
const ADMIN_ROLES       = ['admin'];

module.exports = {
    MANAGER_ROLES,
    TEAM_LEADER_ROLES,
    HR_ROLES,
    ADMIN_ROLES,
};
