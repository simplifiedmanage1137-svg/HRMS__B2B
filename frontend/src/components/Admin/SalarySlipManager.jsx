// Admin Salary Slip Manager — embedded in EmployeeProfileView payroll tab
import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Spinner, Modal, Button } from 'react-bootstrap';
import {
  FaFilePdf, FaEye, FaDownload, FaSync, FaCheckCircle,
  FaMoneyBillWave, FaHistory, FaPlus, FaCalendarAlt, FaRedo
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useNotification } from '../../context/NotificationContext';

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (v) =>
  v != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(v) || 0)
    : '₹0';

const fmtNum = (v) => new Intl.NumberFormat('en-IN').format(Number(v) || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

const numberToWords = (num) => {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (!num || num === 0) return 'Zero';
  const n2w = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + n2w(n % 100) : '');
    if (n < 100000) return n2w(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + n2w(n % 1000) : '');
    if (n < 10000000) return n2w(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + n2w(n % 100000) : '');
    return n2w(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + n2w(n % 10000000) : '');
  };
  return n2w(Math.abs(Math.round(num)));
};

const getAmounts = (slip, emp) => {
  const monthlySalary    = Number(slip?.monthly_salary)    || Number(emp?.in_hand_salary) || Number(emp?.gross_salary) || 0;
  const basicSalaryRaw   = Number(slip?.basic_salary) || 0;
  const netSalaryRaw     = slip?.net_salary != null ? Number(slip.net_salary) : 0;
  // Old stub fix: basic_salary=0 but net>0 means manual adjustment slip — treat net as earned base
  const basicSalary      = basicSalaryRaw > 0 ? basicSalaryRaw : (netSalaryRaw > 0 ? netSalaryRaw : monthlySalary);
  const hasEarnings      = basicSalary > 0;
  const deduction        = hasEarnings ? (Number(slip?.dt) || 200) : 0; // DT only
  const netSalary        = netSalaryRaw > 0 ? netSalaryRaw : Math.max(0, basicSalary - deduction);
  const overtimeAmount   = Number(slip?.overtime_amount)    || 0;
  const overtimeHours    = Number(slip?.overtime_hours)     || 0;
  const presentDays      = Number(slip?.present_days)       || 0;
  const absentDays       = Number(slip?.absent_days)        || 0;
  const paidLeaveDays    = Number(slip?.paid_leave_days)    || 0;
  const unpaidLeaveDays  = Number(slip?.unpaid_leave_days)  || 0;
  const halfDays         = Number(slip?.half_days)          || 0;
  const totalWorkingDays = Number(slip?.total_working_days) || 22;
  const perDaySalary     = Number(slip?.per_day_salary)     || 0;
  const unpaidDeduction  = Number(slip?.unpaid_deduction)   || 0;
  return {
    monthlySalary, basicSalary, deduction, netSalary,
    overtimeAmount, overtimeHours,
    presentDays, absentDays, paidLeaveDays, unpaidLeaveDays, halfDays,
    totalWorkingDays, perDaySalary, unpaidDeduction
  };
};

// ── PDF HTML template ──────────────────────────────────────────────────────────
const buildPDFHTML = (slip, emp, a, monthName, logoBase64) => {
  const cycleLabel = slip.cycle_start_date && slip.cycle_end_date
    ? `${new Date(slip.cycle_start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(slip.cycle_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : `${monthName} ${slip.year}`;

  return `
    <div style="border:1px solid #e2e8f0;padding:32px 36px;font-size:13px;color:#1e293b;font-family:Arial,sans-serif;">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e3a5f;padding-bottom:20px;margin-bottom:20px;">
        <div>
          ${logoBase64
            ? `<img src="data:image/jpeg;base64,${logoBase64}" style="height:52px;width:auto;object-fit:contain;" />`
            : `<div style="font-size:20px;font-weight:900;color:#1e3a5f;letter-spacing:1px;">B2BinDemand</div>`}
          <div style="font-size:11px;color:#64748b;margin-top:6px;max-width:280px;">8th Floor SkyVista, 805, Mhada Colony, Viman Nagar, Pune, Maharashtra 411014</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#1e3a5f;">Salary Slip</div>
          <div style="font-size:13px;color:#475569;margin-top:4px;">${monthName} ${slip.year}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Pay Cycle: ${cycleLabel}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12.5px;background:#f8fafc;border-radius:8px;">
        <tr>
          <td style="padding:8px 14px;width:50%;"><span style="color:#64748b;">Employee Name</span><br/><b style="color:#1e293b;">${(emp?.first_name || '')} ${(emp?.last_name || '')}</b></td>
          <td style="padding:8px 14px;width:50%;"><span style="color:#64748b;">Employee Code</span><br/><b style="color:#1e293b;">${emp?.employee_id || ''}</b></td>
        </tr>
        <tr>
          <td style="padding:8px 14px;"><span style="color:#64748b;">Designation</span><br/><b style="color:#1e293b;">${emp?.designation || emp?.position || 'N/A'}</b></td>
          <td style="padding:8px 14px;"><span style="color:#64748b;">Department</span><br/><b style="color:#1e293b;">${emp?.department || 'N/A'}</b></td>
        </tr>
        <tr>
          <td style="padding:8px 14px;"><span style="color:#64748b;">Date of Joining</span><br/><b style="color:#1e293b;">${emp?.joining_date ? new Date(emp.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</b></td>
          <td style="padding:8px 14px;"><span style="color:#64748b;">Bank Account</span><br/><b style="color:#1e293b;">${emp?.account_number ? `****${String(emp.account_number).slice(-4)}` : 'N/A'}</b></td>
        </tr>
        ${emp?.pan_number ? `<tr>
          <td style="padding:8px 14px;"><span style="color:#64748b;">PAN Number</span><br/><b style="color:#1e293b;">${emp.pan_number}</b></td>
          <td style="padding:8px 14px;"></td>
        </tr>` : ''}
      </table>

      <div style="background:#f1f5f9;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
        <div style="font-weight:700;font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Attendance Summary</div>
        <table style="width:100%;border-collapse:collapse;text-align:center;font-size:12px;">
          <tr>
            <th style="padding:6px;color:#64748b;font-weight:600;">Working Days</th>
            <th style="padding:6px;color:#64748b;font-weight:600;">Present</th>
            <th style="padding:6px;color:#64748b;font-weight:600;">Paid Leave</th>
            <th style="padding:6px;color:#64748b;font-weight:600;">Unpaid Leave</th>
            <th style="padding:6px;color:#64748b;font-weight:600;">Half Days</th>
            <th style="padding:6px;color:#64748b;font-weight:600;">Absent</th>
          </tr>
          <tr>
            <td style="padding:6px;font-weight:800;font-size:15px;color:#1e3a5f;">${a.totalWorkingDays}</td>
            <td style="padding:6px;font-weight:800;font-size:15px;color:#16a34a;">${a.presentDays}</td>
            <td style="padding:6px;font-weight:800;font-size:15px;color:#0369a1;">${a.paidLeaveDays}</td>
            <td style="padding:6px;font-weight:800;font-size:15px;color:#d97706;">${a.unpaidLeaveDays}</td>
            <td style="padding:6px;font-weight:800;font-size:15px;color:#7c3aed;">${a.halfDays}</td>
            <td style="padding:6px;font-weight:800;font-size:15px;color:#dc2626;">${a.absentDays}</td>
          </tr>
        </table>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr style="vertical-align:top;">
          <td style="width:49%;">
            <div style="font-weight:700;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Earnings</div>
            <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
              <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:7px 0;color:#475569;">Monthly Salary (CTC)</td><td style="padding:7px 0;text-align:right;">₹${fmtNum(a.monthlySalary)}</td></tr>
              <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:7px 0;color:#475569;">Earned Salary (${a.presentDays + a.paidLeaveDays} paid days)</td><td style="padding:7px 0;text-align:right;">₹${fmtNum(a.basicSalary)}</td></tr>
              ${a.overtimeAmount > 0 ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:7px 0;color:#16a34a;">Overtime (${a.overtimeHours}h @ ₹150/h)</td><td style="padding:7px 0;text-align:right;color:#16a34a;font-weight:700;">+₹${fmtNum(a.overtimeAmount)}</td></tr>` : ''}
              <tr style="background:#f8fafc;"><td style="padding:8px 4px;font-weight:700;color:#1e293b;">Gross Earnings</td><td style="padding:8px 4px;text-align:right;font-weight:700;color:#1e293b;">₹${fmtNum(a.basicSalary + a.overtimeAmount)}</td></tr>
            </table>
          </td>
          <td style="width:2%;"></td>
          <td style="width:49%;">
            <div style="font-weight:700;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Deductions</div>
            <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
              <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:7px 0;color:#475569;">Provident Fund (PF)</td><td style="padding:7px 0;text-align:right;">₹0</td></tr>
              <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:7px 0;color:#475569;">Professional Tax</td><td style="padding:7px 0;text-align:right;">₹0</td></tr>
              <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:7px 0;color:#475569;">TDS</td><td style="padding:7px 0;text-align:right;">₹0</td></tr>
              ${(a.absentDays + a.unpaidLeaveDays) > 0 ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:7px 0;color:#dc2626;font-weight:600;">Absent Deduction (${a.absentDays > 0 ? a.absentDays + ' absent' : ''}${a.unpaidLeaveDays > 0 ? (a.absentDays > 0 ? ' + ' : '') + a.unpaidLeaveDays + ' unpaid leave' : ''} × ₹${fmtNum(a.perDaySalary)}/day)</td><td style="padding:7px 0;text-align:right;color:#dc2626;font-weight:700;">₹${fmtNum((a.absentDays + a.unpaidLeaveDays) * a.perDaySalary)}</td></tr>` : ''}
              <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:7px 0;color:#b45309;font-weight:600;">DT (Fixed Deduction)</td><td style="padding:7px 0;text-align:right;color:#b45309;font-weight:700;">₹${fmtNum(a.deduction)}</td></tr>
              <tr style="background:#f8fafc;"><td style="padding:8px 4px;font-weight:700;color:#dc2626;">Total Deductions</td><td style="padding:8px 4px;text-align:right;font-weight:700;color:#dc2626;">₹${fmtNum(a.deduction + (a.absentDays + a.unpaidLeaveDays) * a.perDaySalary)}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <div style="background:#1e3a5f;color:#fff;padding:18px 24px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <div style="font-size:10px;opacity:0.7;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Net Salary Payable</div>
          <div style="font-size:11px;opacity:0.6;">Rupees ${numberToWords(Math.round(a.netSalary))} Only</div>
        </div>
        <div style="font-size:28px;font-weight:900;">₹${fmtNum(a.netSalary)}</div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;">
        <div style="text-align:center;"><div style="border-top:1px solid #94a3b8;width:160px;margin-bottom:8px;"></div><div style="color:#64748b;">Employee Signature</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #94a3b8;width:160px;margin-bottom:8px;"></div><div style="color:#64748b;">Authorized Signatory</div></div>
      </div>
      <div style="text-align:center;margin-top:16px;font-size:10px;color:#94a3b8;">
        This is a computer-generated salary slip. No physical signature required. | Generated: ${new Date().toLocaleString('en-IN')}
      </div>
    </div>
  `;
};

// ── Stat pill ──────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, color }) => (
  <div style={{ textAlign: 'center', padding: '6px 12px', background: '#f8fafc', borderRadius: 8, minWidth: 72 }}>
    <div style={{ fontWeight: 800, fontSize: 20, color, lineHeight: 1 }}>{value}</div>
    <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 4 }}>{label}</div>
  </div>
);

// ── Salary row ─────────────────────────────────────────────────────────────────
const SalaryRow = ({ label, value, bold, accent, last }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    padding: '7px 14px',
    borderBottom: last ? 'none' : '1px solid #f1f5f9',
    fontWeight: bold ? 700 : 400,
    background: bold ? '#f8fafc' : 'transparent',
  }}>
    <span style={{ color: accent || (bold ? '#1e293b' : '#475569'), fontSize: 12.5 }}>{label}</span>
    <span style={{ color: accent || (bold ? '#1e293b' : '#475569'), fontSize: 12.5 }}>₹{fmtNum(value)}</span>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════
const OT_RATE     = 150; // ₹ per hour
const OT_STEP     = 50;  // increment step in ₹

const fmtOTHours = (amount) => {
  const totalMins = Math.round((amount / OT_RATE) * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0 && m === 0) return '0 hrs';
  if (m === 0) return `${h} hr${h !== 1 ? 's' : ''}`;
  if (h === 0) return `${m} min`;
  return `${h} hr ${m} min`;
};

const SalarySlipManager = ({ employee }) => {
  const { showNotification } = useNotification();

  const [slips, setSlips]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [generating, setGenerating]     = useState(null);
  const [downloading, setDownloading]   = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewSlip, setViewSlip]         = useState(null);
  const [showModal, setShowModal]       = useState(false);

  // OT amount per "year-month" key (in ₹, multiples of ₹50, rate = ₹150/hr)
  const [otInputs, setOtInputs]   = useState({});
  const [otSubmitting, setOtSubmitting] = useState(null);

  const years = (() => {
    const end   = new Date().getFullYear();
    const start = employee?.joining_date
      ? new Date(employee.joining_date).getFullYear()
      : end;
    const ys = [];
    for (let y = end; y >= start; y--) ys.push(y);
    return ys;
  })();

  const monthCards = (() => {
    if (!employee?.joining_date) return [];
    const joining = new Date(employee.joining_date);
    const now     = new Date();
    const result  = [];
    for (let m = 1; m <= 12; m++) {
      const d = new Date(selectedYear, m - 1, 1);
      if (d < new Date(joining.getFullYear(), joining.getMonth(), 1)) continue;
      if (d > new Date(now.getFullYear(), now.getMonth(), 1)) continue;
      const slip = slips.find(s => Number(s.month) === m && Number(s.year) === selectedYear) || null;
      result.push({ month: m, name: MONTHS[m - 1], slip });
    }
    return result;
  })();

  const history = [...slips].sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month
  );

  const fetchSlips = useCallback(async () => {
    if (!employee?.employee_id) return;
    setLoading(true);
    try {
      const res = await axios.get(API_ENDPOINTS.SALARY_EMPLOYEE(employee.employee_id));
      const data = res.data.salarySlips || res.data.data || [];
      setSlips(data);
      // Seed OT inputs from saved overtime_amount
      setOtInputs(prev => {
        const next = { ...prev };
        data.forEach(s => {
          const k = `${s.year}-${s.month}`;
          if (next[k] === undefined) {
            next[k] = Number(s.overtime_amount) || 0;
          }
        });
        return next;
      });
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, [employee?.employee_id]);

  useEffect(() => { fetchSlips(); }, [fetchSlips]);

  // Submit OT amount — saves directly at ₹150/hr, refreshes slips
  const handleSubmitOT = async (month, year) => {
    const key = `${year}-${month}`;
    const amount = Number(otInputs[key]) || 0;
    setOtSubmitting(key);
    try {
      await axios.post(API_ENDPOINTS.SALARY_ADJUSTMENT, {
        employee_id:    employee.employee_id,
        month,
        year,
        overtime_amount: amount,
      });
      showNotification(
        amount > 0
          ? `OT ₹${amount} (${fmtOTHours(amount)}) saved for ${MONTHS[month - 1]} ${year}`
          : `OT cleared for ${MONTHS[month - 1]} ${year}`,
        'success'
      );
      await fetchSlips();
    } catch (err) {
      const d = err.response?.data;
      showNotification(d?.message || 'Failed to save overtime', 'danger');
    } finally {
      setOtSubmitting(null);
    }
  };

  const handleGenerate = async (month, year) => {
    const key = `${year}-${month}`;
    setGenerating(key);
    try {
      // 1. Generate from attendance — sets present/absent/half days + basic net salary
      const res = await axios.post(API_ENDPOINTS.SALARY_GENERATE, {
        employee_id: employee.employee_id, month, year
      });

      // 2. If OT was set before regenerate, re-apply it on top of fresh slip
      const otAmount = Number(otInputs[key]) || 0;
      if (otAmount > 0) {
        await axios.post(API_ENDPOINTS.SALARY_ADJUSTMENT, {
          employee_id:    employee.employee_id, month, year,
          overtime_amount: otAmount,
        }).catch(() => {});
      }

      showNotification(`Salary slip generated for ${MONTHS[month - 1]} ${year}`, 'success');
      await fetchSlips();
      if (res.data.salarySlip) {
        setViewSlip(res.data.salarySlip);
        setShowModal(true);
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to generate salary slip', 'danger');
    } finally {
      setGenerating(null);
    }
  };

  const handleDownload = async (slip) => {
    if (!slip || !employee) return;
    setDownloading(slip.id);
    try {
      const a = getAmounts(slip, employee);
      const monthName = MONTHS[Number(slip.month) - 1];

      let logoBase64 = '';
      try {
        const r    = await fetch('/images/b2bindemand_logo.jfif');
        const blob = await r.blob();
        logoBase64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result.split(',')[1]);
          reader.onerror  = rej;
          reader.readAsDataURL(blob);
        });
      } catch { /* logo optional */ }

      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#fff;';
      div.innerHTML = buildPDFHTML(slip, employee, a, monthName, logoBase64);
      document.body.appendChild(div);

      const canvas = await html2canvas(div, {
        scale: 2, backgroundColor: '#ffffff',
        logging: false, useCORS: true, windowWidth: 860
      });
      document.body.removeChild(div);

      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait', unit: 'px',
        format: [canvas.width * 0.75, canvas.height * 0.75]
      });
      pdf.addImage(img, 'PNG', 0, 0, canvas.width * 0.75, canvas.height * 0.75);
      pdf.save(`Salary_Slip_${employee.employee_id}_${monthName}_${slip.year}.pdf`);

      showNotification('PDF downloaded successfully', 'success');
    } catch {
      showNotification('Failed to download PDF', 'danger');
    } finally {
      setDownloading(null);
    }
  };

  // ── Slip modal view ────────────────────────────────────────────────────────
  const SlipView = ({ slip }) => {
    const a = getAmounts(slip, employee);
    const monthName = MONTHS[Number(slip.month) - 1];
    const cycleLabel = slip.cycle_start_date && slip.cycle_end_date
      ? `${fmtDate(slip.cycle_start_date)} – ${fmtDate(slip.cycle_end_date)}`
      : `${monthName} ${slip.year}`;

    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #1e3a5f', paddingBottom: 18, marginBottom: 20 }}>
          <div>
            <img
              src="/images/b2bindemand_logo.jfif" alt="logo"
              style={{ height: 44, objectFit: 'contain', display: 'block', marginBottom: 6 }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div style={{ fontSize: 11, color: '#64748b', maxWidth: 260 }}>8th Floor SkyVista, 805, Mhada Colony, Viman Nagar, Pune, Maharashtra 411014</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: 1.5 }}>Salary Slip</div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{monthName} {slip.year}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Pay Cycle: {cycleLabel}</div>
          </div>
        </div>

        {/* Employee Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginBottom: 20, background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
          {[
            ['Employee Name', `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim()],
            ['Employee Code', employee?.employee_id],
            ['Designation',   employee?.designation || employee?.position],
            ['Department',    employee?.department],
            ['Date of Joining', employee?.joining_date ? fmtDate(employee.joining_date) : 'N/A'],
            ['Bank Account',  employee?.account_number ? `****${String(employee.account_number).slice(-4)}` : 'N/A'],
            ...(employee?.pan_number ? [['PAN Number', employee.pan_number]] : []),
          ].map(([l, v]) => (
            <div key={l}>
              <div style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{l}</div>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 12.5 }}>{v || 'N/A'}</div>
            </div>
          ))}
        </div>

        {/* Attendance */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaCalendarAlt size={10} color="#6366f1" /> Attendance Summary
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatPill label="Working Days" value={a.totalWorkingDays} color="#1e3a5f" />
            <StatPill label="Present"      value={a.presentDays}      color="#16a34a" />
            <StatPill label="Paid Leave"   value={a.paidLeaveDays}    color="#0369a1" />
            <StatPill label="Unpaid Leave" value={a.unpaidLeaveDays}  color="#d97706" />
            <StatPill label="Half Days"    value={a.halfDays}         color="#7c3aed" />
            <StatPill label="Absent"       value={a.absentDays}       color="#dc2626" />
          </div>
        </div>

        {/* Earnings & Deductions */}
        <Row className="g-2 mb-3">
          <Col xs={12} sm={6}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#1e3a5f', color: '#fff', padding: '9px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Earnings
              </div>
              <SalaryRow label="Monthly Salary (CTC)" value={a.monthlySalary} />
              <SalaryRow label={`Earned Salary (${a.presentDays + a.paidLeaveDays} days)`} value={a.basicSalary} />
              {a.overtimeAmount > 0 && (
                <SalaryRow label={`Overtime (${a.overtimeHours}h @ ₹150/h)`} value={a.overtimeAmount} accent="#16a34a" />
              )}
              <SalaryRow label="Gross Earnings" value={a.basicSalary + a.overtimeAmount} bold last />
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#1e3a5f', color: '#fff', padding: '9px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Deductions
              </div>
              <SalaryRow label="Provident Fund (PF)"  value={0} />
              <SalaryRow label="Professional Tax"      value={0} />
              <SalaryRow label="TDS"                   value={0} />
              {(a.absentDays + a.unpaidLeaveDays) > 0 && (
                <SalaryRow
                  label={`Absent Deduction (${a.absentDays > 0 ? `${a.absentDays} absent` : ''}${a.unpaidLeaveDays > 0 ? `${a.absentDays > 0 ? ' + ' : ''}${a.unpaidLeaveDays} unpaid` : ''} × ₹${fmtNum(a.perDaySalary)}/day)`}
                  value={(a.absentDays + a.unpaidLeaveDays) * a.perDaySalary}
                  accent="#dc2626"
                />
              )}
              <SalaryRow label="DT (Fixed Deduction)"  value={a.deduction} accent="#b45309" />
              <SalaryRow label="Total Deductions"      value={a.deduction + (a.absentDays + a.unpaidLeaveDays) * a.perDaySalary} bold accent="#dc2626" last />
            </div>
          </Col>
        </Row>

        {/* Net Salary */}
        <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: 10, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.65, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Net Salary Payable</div>
            <div style={{ fontSize: 11, opacity: 0.55 }}>Rupees {numberToWords(Math.round(a.netSalary))} Only</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{fmt(a.netSalary)}</div>
        </div>

        {a.perDaySalary > 0 && (
          <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '7px 14px', fontSize: 11, color: '#0369a1', marginBottom: 10 }}>
            Per-day rate: {fmt(a.perDaySalary)} &nbsp;·&nbsp; Working days in cycle: {a.totalWorkingDays}
          </div>
        )}

        <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
          Computer-generated salary slip — no physical signature required
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading && slips.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spinner animation="border" size="sm" style={{ color: '#6366f1' }} />
        <div style={{ marginTop: 12, fontSize: 13, color: '#94a3b8' }}>Loading salary data…</div>
      </div>
    );
  }

  return (
    <div>

      {/* ── Section 1: Month Cards ───────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaMoneyBillWave size={13} color="#6366f1" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Salary Slips</span>
            <span style={{ background: '#eef2ff', color: '#6366f1', borderRadius: 10, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>
              {slips.length} Generated
            </span>
          </div>
          <button
            onClick={fetchSlips}
            disabled={loading}
            style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 12px', fontSize: 11, cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {loading ? <Spinner size="sm" style={{ width: 10, height: 10 }} animation="border" /> : <FaSync size={9} />}
            Refresh
          </button>
        </div>

        {/* Year tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              style={{
                padding: '5px 18px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                background: selectedYear === y ? '#1e3a5f' : '#f1f5f9',
                color:      selectedYear === y ? '#fff'    : '#475569',
              }}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Month cards */}
        {monthCards.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 28 }}>
            No eligible months in {selectedYear}
          </div>
        ) : (
          <Row className="g-2">
            {monthCards.map(({ month, name, slip }) => {
              const genKey        = `${selectedYear}-${month}`;
              const isGenerating  = generating === genKey;
              const isDownloading = downloading === slip?.id;
              const hasSlip    = !!slip;
              const otAmount   = Number(otInputs[genKey]) || 0;
              const isOTSubmit = otSubmitting === genKey;

              return (
                <Col xs={6} sm={4} md={3} lg={2} key={month}>
                  <div style={{
                    border: `1px solid ${hasSlip ? '#bbf7d0' : '#e2e8f0'}`,
                    borderRadius: 12,
                    padding: '14px 10px 10px',
                    textAlign: 'center',
                    background: hasSlip ? '#f0fdf4' : '#fafafa',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 200,
                    transition: 'box-shadow 0.15s',
                  }}>
                    {/* Month name */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{name}</div>

                    {/* Status / net amount */}
                    {hasSlip ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontSize: 10, fontWeight: 600 }}>
                          <FaCheckCircle size={9} /> Generated
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f' }}>{fmt(slip.net_salary)}</div>
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>
                          {slip.generated_date ? fmtDate(slip.generated_date) : ''}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Not generated</div>
                    )}

                    {/* ── OT Input (₹150/hr, ₹50 increments) ───────── */}
                    <div style={{ width: '100%' }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, textAlign: 'left' }}>
                        Overtime (₹150/hr)
                      </div>
                      {/* Stepper row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                        <button
                          onClick={() => setOtInputs(prev => ({ ...prev, [genKey]: Math.max(0, (Number(prev[genKey]) || 0) - OT_STEP) }))}
                          disabled={otAmount <= 0}
                          style={{
                            width: 26, height: 26, borderRadius: 6, border: '1.5px solid #e2e8f0',
                            background: otAmount <= 0 ? '#f8fafc' : '#fff',
                            color: otAmount <= 0 ? '#cbd5e1' : '#1e3a5f',
                            fontWeight: 800, fontSize: 14, cursor: otAmount <= 0 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}
                        >−</button>
                        <div style={{
                          flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 13,
                          color: otAmount > 0 ? '#1e3a5f' : '#94a3b8',
                          background: '#fff', border: '1.5px solid #e2e8f0',
                          borderRadius: 7, padding: '3px 0',
                        }}>
                          {otAmount > 0 ? `₹${otAmount}` : '₹0'}
                        </div>
                        <button
                          onClick={() => setOtInputs(prev => ({ ...prev, [genKey]: (Number(prev[genKey]) || 0) + OT_STEP }))}
                          style={{
                            width: 26, height: 26, borderRadius: 6, border: '1.5px solid #e2e8f0',
                            background: '#fff', color: '#1e3a5f',
                            fontWeight: 800, fontSize: 14, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}
                        >+</button>
                      </div>
                      {/* Hours display */}
                      {otAmount > 0 && (
                        <div style={{ marginTop: 3, fontSize: 9.5, color: '#0891b2', fontWeight: 600, textAlign: 'center' }}>
                          {fmtOTHours(otAmount)} OT
                        </div>
                      )}
                      {/* Submit OT button */}
                      <button
                        onClick={() => handleSubmitOT(month, selectedYear)}
                        disabled={isOTSubmit}
                        style={{
                          marginTop: 6, width: '100%', padding: '5px 0', fontSize: 11, fontWeight: 700,
                          borderRadius: 7, border: 'none',
                          background: isOTSubmit ? '#e2e8f0' : '#1e3a5f',
                          color:      isOTSubmit ? '#94a3b8' : '#fff',
                          cursor:     isOTSubmit ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        }}
                      >
                        {isOTSubmit
                          ? <><Spinner size="sm" style={{ width: 10, height: 10 }} animation="border" /> Saving…</>
                          : '✓ Submit OT'}
                      </button>
                    </div>

                    {/* Action buttons: View | PDF | Regenerate (or Generate) */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                      {hasSlip ? (
                        <>
                          <button
                            onClick={() => { setViewSlip(slip); setShowModal(true); }}
                            title="View slip"
                            style={btnStyle('#0ea5e9', '#f0f9ff')}
                          >
                            <FaEye size={9} /> View
                          </button>
                          <button
                            onClick={() => handleDownload(slip)}
                            disabled={isDownloading}
                            title="Download PDF"
                            style={{ ...btnStyle('#6366f1', '#eef2ff'), opacity: isDownloading ? 0.7 : 1, cursor: isDownloading ? 'wait' : 'pointer' }}
                          >
                            {isDownloading ? <Spinner size="sm" style={{ width: 9, height: 9 }} animation="border" /> : <FaDownload size={9} />}
                            PDF
                          </button>
                          <button
                            onClick={() => handleGenerate(month, selectedYear)}
                            disabled={!!generating}
                            title="Regenerate with latest attendance"
                            style={{ ...btnStyle('#d97706', '#fffbeb'), opacity: generating && !isGenerating ? 0.6 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
                          >
                            {isGenerating
                              ? <><Spinner size="sm" style={{ width: 9, height: 9 }} animation="border" /> …</>
                              : <><FaRedo size={9} /> Regenerate</>}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleGenerate(month, selectedYear)}
                          disabled={!!generating}
                          style={{
                            ...btnStyle('#fff', '#1e3a5f'),
                            background: isGenerating ? '#e2e8f0' : '#1e3a5f',
                            color:      isGenerating ? '#94a3b8' : '#fff',
                            border:     'none',
                            opacity:    generating && !isGenerating ? 0.6 : 1,
                            cursor:     generating ? 'not-allowed' : 'pointer',
                            padding:    '4px 12px',
                          }}
                        >
                          {isGenerating
                            ? <><Spinner size="sm" style={{ width: 9, height: 9 }} animation="border" /> Generating…</>
                            : <><FaPlus size={8} /> Generate</>}
                        </button>
                      )}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        )}
      </div>

      {/* ── Section 2: History Table ─────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaHistory size={13} color="#22c55e" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Salary History</span>
          <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 10, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>
            {slips.length} records
          </span>
        </div>

        {slips.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 32, fontSize: 13 }}>
            No salary slips generated yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Month', 'Year', 'Pay Cycle', 'Monthly Salary', 'Earned', 'OT', 'Deductions', 'Net Salary', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((s, i) => {
                  const a = getAmounts(s, employee);
                  const isDown = downloading === s.id;
                  const genKey = `${s.year}-${s.month}`;
                  const isRegen = generating === genKey;
                  const cycleLabel = s.cycle_start_date
                    ? `${new Date(s.cycle_start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(s.cycle_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                    : '—';
                  return (
                    <tr key={s.id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>{MONTHS[Number(s.month) - 1]}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.year}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>{cycleLabel}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{fmt(a.monthlySalary)}</td>
                      <td style={{ padding: '10px 12px', color: '#6366f1', fontWeight: 600 }}>{fmt(a.basicSalary)}</td>
                      <td style={{ padding: '10px 12px', color: '#16a34a' }}>{a.overtimeAmount > 0 ? fmt(a.overtimeAmount) : '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#dc2626' }}>{fmt(a.deduction)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#1e3a5f', fontSize: 13 }}>{fmt(a.netSalary)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: s.is_paid ? '#dcfce7' : '#fef9c3',
                          color:      s.is_paid ? '#16a34a' : '#854d0e',
                          borderRadius: 10, padding: '2px 9px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap'
                        }}>
                          {s.is_paid ? '✓ Paid' : '⏳ Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => { setViewSlip(s); setShowModal(true); }}
                            style={btnStyle('#0ea5e9', '#f0f9ff')}
                          >
                            <FaEye size={9} /> View
                          </button>
                          <button
                            onClick={() => handleDownload(s)}
                            disabled={isDown}
                            style={{ ...btnStyle('#6366f1', '#eef2ff'), opacity: isDown ? 0.7 : 1, cursor: isDown ? 'wait' : 'pointer' }}
                          >
                            {isDown ? <Spinner size="sm" style={{ width: 9, height: 9 }} animation="border" /> : <FaFilePdf size={9} />}
                            PDF
                          </button>
                          <button
                            onClick={() => handleGenerate(Number(s.month), Number(s.year))}
                            disabled={!!generating}
                            title="Regenerate with latest attendance"
                            style={{ ...btnStyle('#d97706', '#fffbeb'), opacity: generating && !isRegen ? 0.6 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
                          >
                            {isRegen ? <Spinner size="sm" style={{ width: 9, height: 9 }} animation="border" /> : <FaRedo size={9} />}
                            {isRegen ? '' : 'Regen'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Slip View Modal ──────────────────────────────────────────────────── */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered scrollable>
        <Modal.Header
          style={{ background: '#1e3a5f', color: '#fff', border: 'none', padding: '14px 22px' }}
          closeVariant="white"
          closeButton
        >
          <Modal.Title style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaFilePdf size={13} />
            Salary Slip — {viewSlip ? `${MONTHS[Number(viewSlip.month) - 1]} ${viewSlip.year}` : ''}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ padding: 24 }}>
          {viewSlip && <SlipView slip={viewSlip} />}
        </Modal.Body>

        <Modal.Footer style={{ border: 'none', background: '#f8fafc', gap: 8, padding: '12px 22px' }}>
          <Button
            variant="light" size="sm"
            onClick={() => setShowModal(false)}
            style={{ fontSize: 12, borderRadius: 8, fontWeight: 600 }}
          >
            Close
          </Button>
          {viewSlip && (
            <Button
              size="sm"
              onClick={() => handleDownload(viewSlip)}
              disabled={downloading === viewSlip?.id}
              style={{ fontSize: 12, borderRadius: 8, background: '#1e3a5f', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {downloading === viewSlip?.id
                ? <><Spinner size="sm" style={{ width: 12, height: 12 }} animation="border" /> Downloading…</>
                : <><FaDownload size={11} /> Download PDF</>}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// ── Shared button style helper ─────────────────────────────────────────────────
const btnStyle = (color, bg) => ({
  fontSize: 10,
  padding: '3px 8px',
  borderRadius: 6,
  border: `1px solid ${color}`,
  background: bg,
  color,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  fontWeight: 500,
  whiteSpace: 'nowrap',
});

export default SalarySlipManager;
