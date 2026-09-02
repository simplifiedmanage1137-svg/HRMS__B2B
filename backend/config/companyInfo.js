// backend/config/companyInfo.js
// Single source of truth for company branding used in generated documents
// (currently: offer letters). No company-settings DB table exists in this app —
// branding is resolved per-employee the same way frontend/src/utils/salarySlipTemplate.js
// already does for salary slips: `isPropCulture(emp) = emp.pf_amount === 0`.
// Keep this rule in sync with that file if it ever changes.

const path = require('path');

const isPropCulture = (employee) =>
    employee?.pf_amount != null && parseInt(employee.pf_amount, 10) === 0;

const COMPANY = {
    b2b: {
        name: 'B2BinDemand',
        legalName: 'B2BinDemand Pvt. Ltd.',
        addressLines: [
            'Office no. B - 404, 4th Floor, Anand Square Building,',
            'Opp. to Symbiosis college,',
            'Viman Nagar, Pune, Maharashtra 15',
        ],
        accentColor: '#1e3a5f',
        peachColor: '#fbe4d5',
        hrEmail: 'hr@b2bindemand.com',
        signatoryName: 'Swekcha Tiwari',
        signatoryDesignation: 'HR Manager',
        logoPath: path.join(__dirname, '..', 'assets', 'b2b_logo.png'),
        stampPath: path.join(__dirname, '..', 'assets', 'b2b_stamp.png'),
    },
    pc: {
        name: 'PropCulture',
        legalName: 'PropCulture Pvt. Ltd.',
        addressLines: ['Pune, Maharashtra'],
        accentColor: '#0d7b6f',
        peachColor: '#d9f0ec',
        hrEmail: 'hr@b2bindemand.com',
        signatoryName: 'Swekcha Tiwari',
        signatoryDesignation: 'HR Manager',
        logoPath: null,
        stampPath: null,
    },
};

// Defaults every offer letter falls back to unless HR overrides them in the form.
const DEFAULT_PROBATION_PERIOD = 'three (3) months';
const DEFAULT_NOTICE_PERIOD = 'one (1) month (30 days)';
const DEFAULT_WORK_LOCATION = 'Pune, Maharashtra';

const getCompanyInfo = (employee) => {
    const co = isPropCulture(employee) ? COMPANY.pc : COMPANY.b2b;
    return {
        ...co,
        defaultProbationPeriod: DEFAULT_PROBATION_PERIOD,
        defaultNoticePeriod: DEFAULT_NOTICE_PERIOD,
        defaultWorkLocation: DEFAULT_WORK_LOCATION,
    };
};

module.exports = { getCompanyInfo, isPropCulture, COMPANY };
