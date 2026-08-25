// backend/services/offerLetterPdfService.js
// Renders the offer letter as a real PDF with PDFKit, matching the visual structure of the
// supplied Appointment Letter-B2BinDemand.pdf reference: bordered page, centered logo, a
// soft decorative brand-colored curve in the upper-left corner, footer with the company
// address on every page, and a Salary Annexure as the final page.
//
// PDFKit (not Puppeteer/headless Chromium) was chosen deliberately: this backend runs as a
// single Vercel serverless function serving the entire API, and a headless-browser
// dependency would risk that function's bundle size / cold-start time for every route, not
// just this one.

const PDFDocument = require('pdfkit');
const fs = require('fs');
const { buildBlocks } = require('./offerLetterContent');

const MARGIN = 56;
const BORDER_INSET = 22;
const HEADER_HEIGHT = 78;
const FOOTER_RESERVE = 46;

const FONT_BODY = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

const drawPageChrome = (doc, company) => {
    const { width: pw, height: ph } = doc.page;

    // Decorative brand-colored curve, upper-left, mostly cropped by the page edge.
    doc.save();
    doc.fillColor(company.peachColor);
    doc.circle(-30, -20, 150).fill();
    doc.circle(40, 10, 70).fill();
    doc.restore();

    // Outer page border.
    doc.save();
    doc.lineWidth(1).strokeColor('#333333');
    doc.rect(BORDER_INSET, BORDER_INSET, pw - 2 * BORDER_INSET, ph - 2 * BORDER_INSET).stroke();
    doc.restore();

    // Centered logo / company name.
    doc.save();
    if (company.logoPath && fs.existsSync(company.logoPath)) {
        const logoWidth = 150;
        doc.image(company.logoPath, (pw - logoWidth) / 2, BORDER_INSET + 14, { width: logoWidth });
    } else {
        doc.font(FONT_BOLD).fontSize(22).fillColor(company.accentColor)
            .text(company.name, 0, BORDER_INSET + 20, { align: 'center', width: pw });
    }
    doc.restore();

    // Footer — company address, centered, near the bottom border.
    doc.save();
    doc.font(FONT_BODY).fontSize(8).fillColor('#6b7280');
    const footerY = ph - BORDER_INSET - FOOTER_RESERVE + 10;
    company.addressLines.forEach((line, i) => {
        doc.text(line, MARGIN, footerY + i * 11, { align: 'center', width: pw - 2 * MARGIN });
    });
    doc.restore();

    doc.x = MARGIN;
    doc.y = BORDER_INSET + HEADER_HEIGHT;
};

const contentBottom = (doc) => doc.page.height - BORDER_INSET - FOOTER_RESERVE;

const ensureSpace = (doc, needed) => {
    if (doc.y + needed > contentBottom(doc)) {
        doc.addPage();
    }
};

const renderBlocks = (doc, blocks) => {
    const contentWidth = doc.page.width - 2 * MARGIN;

    blocks.forEach((block) => {
        switch (block.type) {
            case 'pagebreak':
                doc.addPage();
                return;

            case 'space':
                doc.moveDown((block.size || 10) / 12);
                return;

            case 'hr': {
                ensureSpace(doc, 14);
                const y = doc.y + 4;
                doc.save().lineWidth(0.5).strokeColor('#d1d5db')
                    .moveTo(MARGIN, y).lineTo(MARGIN + contentWidth, y).stroke().restore();
                doc.y = y + 10;
                return;
            }

            case 'h1': {
                doc.font(FONT_BOLD).fontSize(12);
                const h = doc.heightOfString(block.text, { width: contentWidth });
                // Keep the heading with at least a little of what follows it.
                ensureSpace(doc, h + 24);
                doc.fillColor('#111827').text(block.text, MARGIN, doc.y, { width: contentWidth });
                doc.moveDown(0.4);
                return;
            }

            case 'lead': {
                doc.font(FONT_BODY).fontSize(10);
                const fullText = `${block.num} ${block.text}`;
                const h = doc.heightOfString(fullText, { width: contentWidth });
                ensureSpace(doc, h + 4);
                const x = MARGIN, y = doc.y;
                doc.font(FONT_BOLD).fontSize(10).fillColor('#111827')
                    .text(`${block.num} `, x, y, { continued: true, width: contentWidth });
                doc.font(FONT_BODY).fontSize(10).fillColor('#1f2937')
                    .text(block.text, { width: contentWidth });
                doc.moveDown(0.35);
                return;
            }

            case 'bullet': {
                const bulletIndent = 14;
                doc.font(FONT_BODY).fontSize(10);
                const h = doc.heightOfString(`•  ${block.text}`, { width: contentWidth - bulletIndent });
                ensureSpace(doc, h + 4);
                doc.fillColor('#1f2937')
                    .text('•', MARGIN, doc.y, { continued: true, width: contentWidth })
                    .text(`  ${block.text}`, { width: contentWidth - bulletIndent, indent: bulletIndent - 8 });
                doc.moveDown(0.3);
                return;
            }

            case 'para':
            default: {
                doc.font(block.bold ? FONT_BOLD : FONT_BODY).fontSize(10);
                const h = doc.heightOfString(block.text, { width: contentWidth });
                ensureSpace(doc, h + 4);
                doc.fillColor('#1f2937').text(block.text, MARGIN, doc.y, { width: contentWidth, align: 'left' });
                doc.moveDown(0.35);
                return;
            }
        }
    });
};

// ─── Salary Annexure (final page) ─────────────────────────────────────────────
// PDFKit's standard 14 base fonts (WinAnsi encoding) have no Rupee-sign (U+20B9) glyph —
// without an embedded Unicode TTF (none is bundled in this repo, and a proprietary system
// font like Arial can't be redistributed), rendering "₹" prints garbled characters instead
// of a currency symbol. "Rs." is the safe, universally-renderable equivalent.
const fmtInr = (n) => `Rs. ${Math.round(n).toLocaleString('en-IN')}`;

const renderAnnexure = (doc, data) => {
    doc.addPage();
    const contentWidth = doc.page.width - 2 * MARGIN;

    doc.font(FONT_BOLD).fontSize(15).fillColor('#111827')
        .text('Salary Annexure', MARGIN, doc.y, { align: 'center', width: contentWidth, underline: true });
    doc.moveDown(1.2);

    const rows = [
        ['Gross Salary per Month', data.salary.monthly.gross, data.salary.annual.gross, true],
        ['Basic Salary (50%)', data.salary.monthly.basic, data.salary.annual.basic, false],
        ['House Rent Allowance (30%)', data.salary.monthly.hra, data.salary.annual.hra, false],
        ['Variable Allowance (20%)', data.salary.monthly.variable, data.salary.annual.variable, false],
        ['TOTAL GROSS SALARY', data.salary.monthly.gross, data.salary.annual.gross, true],
        ['__SPACER__', null, null, false],
        ['DEDUCTIONS', null, null, true],
        ['Provident Fund (PF)', data.salary.monthly.pf, data.salary.annual.pf, false],
        ['Professional Tax (PT)', data.salary.monthly.pt, data.salary.annual.pt, false],
        ['Total Deductions', data.salary.monthly.totalDeductions, data.salary.annual.totalDeductions, true],
        ['__SPACER__', null, null, false],
        ['NET SALARY', data.salary.monthly.net, data.salary.annual.net, true],
    ];

    const col1 = contentWidth * 0.5;
    const col2 = contentWidth * 0.25;
    const col3 = contentWidth * 0.25;
    const rowHeight = 22;
    let y = doc.y;

    const headerY = y;
    doc.save().rect(MARGIN, headerY, contentWidth, rowHeight).fill('#1e3a5f').restore();
    doc.font(FONT_BOLD).fontSize(9.5).fillColor('#ffffff');
    doc.text('Components in Salary', MARGIN + 8, headerY + 6, { width: col1 - 16 });
    doc.text('Per Month (Rs.)', MARGIN + col1, headerY + 6, { width: col2, align: 'center' });
    doc.text('Per Annum (Rs.)', MARGIN + col1 + col2, headerY + 6, { width: col3, align: 'center' });
    y += rowHeight;

    rows.forEach(([label, monthly, annual, bold]) => {
        if (label === '__SPACER__') { y += 6; return; }
        ensureSpace(doc, rowHeight);
        if (doc.y !== y) y = doc.y; // page break occurred mid-table
        const isSectionLabel = monthly === null;
        doc.save().rect(MARGIN, y, contentWidth, rowHeight)
            .fillOpacity(bold ? 0.08 : 0).fill('#1e3a5f').restore();
        doc.save().lineWidth(0.5).strokeColor('#cbd5e1')
            .rect(MARGIN, y, contentWidth, rowHeight).stroke().restore();
        doc.font(bold ? FONT_BOLD : FONT_BODY).fontSize(9.5).fillColor('#1f2937');
        doc.text(label, MARGIN + 8, y + 6, { width: col1 - 16 });
        if (!isSectionLabel) {
            doc.text(fmtInr(monthly), MARGIN + col1, y + 6, { width: col2, align: 'center' });
            doc.text(fmtInr(annual), MARGIN + col1 + col2, y + 6, { width: col3, align: 'center' });
        }
        y += rowHeight;
    });

    doc.y = y + 20;
    doc.font(FONT_BODY).fontSize(8.5).fillColor('#6b7280')
        .text('Figures are indicative and subject to applicable statutory deductions and company payroll policy in effect at the time of payment.',
            MARGIN, doc.y, { width: contentWidth });
};

const generateOfferLetterPdf = (data) => new Promise((resolve, reject) => {
    // margin: 0 — PDFKit auto-paginates text that would cross `page.height - margins.bottom`;
    // with real margins set, our footer text (drawn deliberately close to the true page
    // bottom) sat below that boundary and triggered infinite recursive addPage() calls from
    // inside drawPageChrome itself. All pagination here is handled manually via
    // ensureSpace()/addPage(), so PDFKit's own margin-based auto-pagination is not needed.
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, autoFirstPage: false });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.on('pageAdded', () => drawPageChrome(doc, data.company));
    doc.addPage(); // triggers the first chrome draw

    renderBlocks(doc, buildBlocks(data));
    renderAnnexure(doc, data);

    doc.end();
});

module.exports = { generateOfferLetterPdf };
