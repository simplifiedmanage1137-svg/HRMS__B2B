const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isBirthdayToday,
  isWeekendDate,
  shouldAutoMarkBirthdayPresent,
} = require('../cron/absentEmployeeCheck');

// 2026-08-13 = Thursday, 2026-08-15 = Saturday, 2026-08-16 = Sunday (fixed reference dates
// so these tests don't depend on when they're run).
const THURSDAY = '2026-08-13';
const SATURDAY = '2026-08-15';
const SUNDAY = '2026-08-16';

test('isBirthdayToday matches month+day regardless of birth year', () => {
  assert.equal(isBirthdayToday('1995-08-13', THURSDAY), true);
  assert.equal(isBirthdayToday('2001-08-13', THURSDAY), true);
  assert.equal(isBirthdayToday('1995-08-14', THURSDAY), false);
  assert.equal(isBirthdayToday(null, THURSDAY), false);
});

test('isWeekendDate recognizes Saturday and Sunday only', () => {
  assert.equal(isWeekendDate(SATURDAY), true);
  assert.equal(isWeekendDate(SUNDAY), true);
  assert.equal(isWeekendDate(THURSDAY), false);
});

test('birthday on an ordinary working day auto-marks Present', () => {
  const notAHoliday = () => false;
  assert.equal(shouldAutoMarkBirthdayPresent('1995-08-13', THURSDAY, notAHoliday), true);
});

test('birthday on a company holiday does NOT auto-mark Present (holiday takes priority)', () => {
  const isHoliday = () => true;
  assert.equal(shouldAutoMarkBirthdayPresent('1995-08-13', THURSDAY, isHoliday), false);
});

test('birthday on a weekend does NOT auto-mark Present', () => {
  const notAHoliday = () => false;
  assert.equal(shouldAutoMarkBirthdayPresent('1995-08-15', SATURDAY, notAHoliday), false);
  assert.equal(shouldAutoMarkBirthdayPresent('1995-08-16', SUNDAY, notAHoliday), false);
});

test('non-birthday day never auto-marks Present, holiday/weekend or not', () => {
  const isHoliday = () => true;
  assert.equal(shouldAutoMarkBirthdayPresent('1995-01-01', THURSDAY, isHoliday), false);
  assert.equal(shouldAutoMarkBirthdayPresent('1995-01-01', THURSDAY, () => false), false);
});

test('holiday check is only consulted for an actual birthday (short-circuits otherwise)', () => {
  let called = false;
  const trackingHolidayFn = () => { called = true; return false; };
  shouldAutoMarkBirthdayPresent('1995-01-01', THURSDAY, trackingHolidayFn);
  assert.equal(called, false, 'isHolidayFn should not be called when it is not the employee\'s birthday');
});
