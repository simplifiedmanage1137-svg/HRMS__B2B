// Single source of truth for paid-leave eligibility/accrual policy.
// Any change to these numbers should only ever need to happen here.

const PAID_LEAVE_ELIGIBILITY_MONTHS = 3;
const MONTHLY_ACCRUAL_RATE = 2;
const COMP_OFF_EXPIRY_DAYS = 45;

// Leave types that draw from the pooled accrual balance (gated by eligibility, deducted on approval).
const PAID_LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Maternity', 'Paternity', 'Bereavement'];

// Full enum, mirrors the DB CHECK constraint (backend/scripts/fix-leave-type-check-birthday.sql)
const LEAVE_TYPES = [...PAID_LEAVE_TYPES, 'Unpaid', 'Comp-Off', 'Birthday'];

/**
 * Total whole months completed since joining, as of currentDate.
 */
function getTotalMonthsFromJoining(joiningDate, currentDate = new Date()) {
    const join = new Date(joiningDate);
    const today = new Date(currentDate);

    if (today < join) return 0;

    let totalMonths = (today.getFullYear() - join.getFullYear()) * 12 +
                      (today.getMonth() - join.getMonth());

    if (today.getDate() < join.getDate()) {
        totalMonths = Math.max(0, totalMonths - 1);
    }

    return totalMonths;
}

function isProbationComplete(joiningDate, currentDate = new Date()) {
    return getTotalMonthsFromJoining(joiningDate, currentDate) >= PAID_LEAVE_ELIGIBILITY_MONTHS;
}

/**
 * Date the employee becomes eligible to apply for paid leave.
 */
function getEligibleFromDate(joiningDate) {
    const eligibleDate = new Date(joiningDate);
    eligibleDate.setMonth(eligibleDate.getMonth() + PAID_LEAVE_ELIGIBILITY_MONTHS);
    return eligibleDate.toISOString().split('T')[0];
}

/**
 * Months completed within the current calendar year (resets at Jan 1), used for
 * the current-year accrual display/upsert in getLeaveBalance.
 */
function getCompletedMonthsInCurrentYear(joiningDate, currentDate = new Date()) {
    const today = new Date(currentDate);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const join = new Date(joiningDate);

    if (join.getFullYear() > currentYear) {
        return 0;
    }

    let completedMonths = 0;

    if (join.getFullYear() === currentYear) {
        const joinMonth = join.getMonth();
        for (let month = joinMonth; month < currentMonth; month++) {
            completedMonths++;
        }
    } else {
        for (let month = 0; month < currentMonth; month++) {
            completedMonths++;
        }
    }

    return Math.max(0, completedMonths);
}

function calculateCurrentYearAccruedLeaves(joiningDate, currentDate = new Date()) {
    const completedMonths = getCompletedMonthsInCurrentYear(joiningDate, currentDate);
    return completedMonths * MONTHLY_ACCRUAL_RATE;
}

module.exports = {
    PAID_LEAVE_ELIGIBILITY_MONTHS,
    MONTHLY_ACCRUAL_RATE,
    COMP_OFF_EXPIRY_DAYS,
    PAID_LEAVE_TYPES,
    LEAVE_TYPES,
    getTotalMonthsFromJoining,
    isProbationComplete,
    getEligibleFromDate,
    getCompletedMonthsInCurrentYear,
    calculateCurrentYearAccruedLeaves,
};
