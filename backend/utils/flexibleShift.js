const normalizeFlexibleShiftField = (employee = {}) => {
  if (!employee || typeof employee !== 'object') return false;
  if (typeof employee.isFlexibleShift === 'boolean') return employee.isFlexibleShift;
  if (typeof employee.is_flexible_shift === 'boolean') return employee.is_flexible_shift;
  return Boolean(employee.isFlexibleShift || employee.is_flexible_shift);
};

const isFlexibleShiftEnabled = (employee = {}) => {
  return normalizeFlexibleShiftField(employee);
};

const getFlexibleShiftStatus = (totalMinutes = 0) => {
  if (totalMinutes >= 540) {
    return { status: 'present', skipShiftRules: true };
  }
  if (totalMinutes >= 300) {
    return { status: 'half_day', skipShiftRules: true };
  }
  return { status: 'absent', skipShiftRules: true };
};

const buildFlexibleShiftPayload = (employee = {}) => {
  const enabled = isFlexibleShiftEnabled(employee);
  return {
    isFlexibleShift: enabled,
    is_flexible_shift: enabled,
  };
};

module.exports = {
  normalizeFlexibleShiftField,
  isFlexibleShiftEnabled,
  getFlexibleShiftStatus,
  buildFlexibleShiftPayload,
};
