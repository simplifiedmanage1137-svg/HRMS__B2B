const test = require('node:test');
const assert = require('node:assert/strict');

const { isFlexibleShiftEnabled, getFlexibleShiftStatus, buildFlexibleShiftPayload } = require('../utils/flexibleShift');

test('defaults to disabled when no flexible-shift flag is present', () => {
  assert.equal(isFlexibleShiftEnabled({}), false);
  assert.equal(isFlexibleShiftEnabled({ is_flexible_shift: false }), false);
});

test('recognizes either snake-case or camelCase flexible-shift flags', () => {
  assert.equal(isFlexibleShiftEnabled({ is_flexible_shift: true }), true);
  assert.equal(isFlexibleShiftEnabled({ isFlexibleShift: true }), true);
});

test('uses working-hours-only attendance status for flexible shifts', () => {
  assert.deepEqual(getFlexibleShiftStatus(540), { status: 'present', skipShiftRules: true });
  assert.deepEqual(getFlexibleShiftStatus(300), { status: 'half_day', skipShiftRules: true });
  assert.deepEqual(getFlexibleShiftStatus(240), { status: 'absent', skipShiftRules: true });
});

test('serializes flexible-shift payload fields for API responses', () => {
  const payload = buildFlexibleShiftPayload({ is_flexible_shift: true });
  assert.equal(payload.isFlexibleShift, true);
  assert.equal(payload.is_flexible_shift, true);
});
