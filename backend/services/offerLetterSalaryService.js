// backend/services/offerLetterSalaryService.js
// Deterministic salary breakdown for the offer-letter Salary Annexure.
// Basic/HRA/Variable percentages (50/30/20) come from the reference appointment-letter
// template itself (a document-structure choice), NOT a statutory rule. Deductions reuse the
// same per-employee fields and defaults already used for real payroll in
// backend/controllers/salaryController.js (pf_amount default 1800, pt_amount and
// professional_tax_amount default 0 when unset) — this must never invent its own
// statutory math.

const round = (n) => Math.round(n);

const calculateSalaryBreakdown = ({ grossMonthly, pfAmount, professionalTaxAmount }) => {
    const monthlyGross = round(Number(grossMonthly) || 0);

    const basicMonthly = round(monthlyGross * 0.5);
    const hraMonthly = round(monthlyGross * 0.3);
    // Remainder (not a flat 20%) so the three components always sum exactly to monthlyGross.
    const variableMonthly = monthlyGross - basicMonthly - hraMonthly;

    const pfMonthly = pfAmount != null ? round(Number(pfAmount)) : 1800;
    // The letter's single "Professional Tax (PT)" row is exactly this value — it used to
    // silently add in the separate (and mostly unused) `pt_amount` field on top of whatever
    // was typed here, so entering 200 could render as some other number (e.g. 193) with no
    // indication why. Professional Tax on the offer letter now means exactly what was entered,
    // nothing else.
    const professionalTaxMonthly = professionalTaxAmount != null ? round(Number(professionalTaxAmount)) : 0;

    const totalDeductionsMonthly = pfMonthly + professionalTaxMonthly;
    const netMonthly = monthlyGross - totalDeductionsMonthly;

    return {
        monthly: {
            gross: monthlyGross,
            basic: basicMonthly,
            hra: hraMonthly,
            variable: variableMonthly,
            pf: pfMonthly,
            pt: professionalTaxMonthly,
            totalDeductions: totalDeductionsMonthly,
            net: netMonthly,
        },
        annual: {
            gross: monthlyGross * 12,
            basic: basicMonthly * 12,
            hra: hraMonthly * 12,
            variable: variableMonthly * 12,
            pf: pfMonthly * 12,
            pt: professionalTaxMonthly * 12,
            totalDeductions: totalDeductionsMonthly * 12,
            net: netMonthly * 12,
        },
    };
};

module.exports = { calculateSalaryBreakdown };
