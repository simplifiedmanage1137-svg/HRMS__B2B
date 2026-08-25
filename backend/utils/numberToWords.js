// backend/utils/numberToWords.js
// Converts a whole rupee amount to Indian-numbering words, e.g. 1020000 ->
// "Ten Lakh Twenty Thousand" (matching the reference appointment letter's
// "Rupees Ten Lakh Twenty Thousand Only" style).

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => {
    if (n < 20) return ONES[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${TENS[t]}${o ? ' ' + ONES[o] : ''}`;
};

const threeDigits = (n) => {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${h ? ONES[h] + ' Hundred' : ''}${h && rest ? ' ' : ''}${rest ? twoDigits(rest) : ''}`;
};

const amountToIndianWords = (amount) => {
    let n = Math.round(Number(amount) || 0);
    if (n === 0) return 'Zero';

    const crore = Math.floor(n / 1_00_00_000); n %= 1_00_00_000;
    const lakh = Math.floor(n / 1_00_000); n %= 1_00_000;
    const thousand = Math.floor(n / 1_000); n %= 1_000;
    const hundreds = n;

    const parts = [];
    if (crore) parts.push(`${threeDigits(crore)} Crore`);
    if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
    if (hundreds) parts.push(threeDigits(hundreds));

    return parts.join(' ').trim();
};

module.exports = { amountToIndianWords };
