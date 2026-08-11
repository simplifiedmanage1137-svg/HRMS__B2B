// Single source of truth for the payroll cycle boundary and late-attendance policy.
// Cycle runs CYCLE_START_DAY (previous month) → CYCLE_START_DAY - 1 (this month).

const CYCLE_START_DAY = 26;
const LATE_FREE_COUNT = 3;

// Parse date string YYYY-MM-DD as local date (avoid UTC shift)
function parseLocalDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function getCycleDates(month, year) {
    const startMonth = month - 1;
    const startYear = startMonth === 0 ? year - 1 : year;
    const actualStartMonth = startMonth === 0 ? 12 : startMonth;

    const pad = (n) => String(n).padStart(2, '0');
    const startDateStr = `${startYear}-${pad(actualStartMonth)}-${pad(CYCLE_START_DAY)}`;
    const endDateStr = `${year}-${pad(month)}-${pad(CYCLE_START_DAY - 1)}`;

    return {
        startDate: parseLocalDate(startDateStr),
        endDate: parseLocalDate(endDateStr),
        startDateStr,
        endDateStr,
        startMonth: actualStartMonth,
        startYear: startYear,
        endMonth: month,
        endYear: year
    };
}

module.exports = {
    CYCLE_START_DAY,
    LATE_FREE_COUNT,
    getCycleDates,
    parseLocalDate,
};
