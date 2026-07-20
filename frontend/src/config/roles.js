// Central role display mapping.
// Internal role keys (stored in DB and used in all logic) are NEVER changed.
// Only the labels shown to users change here.

export const ROLE_LABELS = {
  admin:           'Admin',
  sub_admin:       'Manager',
  manager:         'TL',
  employee:        'Employee',
  desktop_support: 'Desktop Support',
  hr:              'HR',
};

/** Returns the display label for a role key. Falls back to the raw key. */
export const getRoleLabel = (role) => ROLE_LABELS[role] ?? role ?? '';

/** All selectable roles for dropdowns (shown to admins). */
export const ROLE_OPTIONS = [
  { value: 'employee',         label: 'Employee' },
  { value: 'manager',          label: 'TL' },
  { value: 'sub_admin',        label: 'Manager' },
  { value: 'admin',            label: 'Admin' },
  { value: 'hr',                label: 'HR' },
  { value: 'desktop_support',  label: 'Desktop Support' },
];
