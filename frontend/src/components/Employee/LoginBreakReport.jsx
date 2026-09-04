// src/components/Employee/LoginBreakReport.jsx
// "Login & Break Report" export — requested by Prachi Gaikwad: a downloadable, per-day
// log of each team member's clock-in/out and break usage over a date range.
//
// Intentionally has NO useEffect and fetches nothing on mount/date-change — the backend
// call only fires from handleExport, i.e. only when the user clicks the Export button.
import React, { useState } from 'react';
import { Card, Form, Row, Col, Button, Spinner, Alert } from 'react-bootstrap';
import { FaDownload, FaFileExcel, FaInfoCircle } from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import * as XLSX from 'xlsx';

// Same "naive IST string, format for display" convention already used by
// TeamAttendanceReport.jsx's formatTime/formatDate for these attendance columns.
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (datetime) => {
    if (!datetime) return null;
    const d = new Date(datetime);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatMinutesToHM = (totalMinutes) => {
    if (!totalMinutes || totalMinutes <= 0) return '-';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
};

// One start/end column pair per fixed break type (each used at most once per
// clock-in session, so there's exactly one of each to place). Anything outside
// this fixed set — Sales' unlimited, typeless "general" breaks — falls back into
// the numbered "Other Break" pair below instead of being dropped.
const FIXED_BREAK_TYPES = [
    { type: 'tea_break_1', label: 'Tea Break 1' },
    { type: 'tea_break_2', label: 'Tea Break 2' },
    { type: 'lunch_break', label: 'Lunch Break' },
];

const EXPORT_COLUMNS = [
    'Date', 'Agent Name', 'Employee ID', 'Department',
    'Login Time', 'Logout Time', 'Total Login Hours',
    ...FIXED_BREAK_TYPES.flatMap(t => [`${t.label} Start`, `${t.label} End`]),
    'Other Break Start', 'Other Break End',
    'Total Break Duration',
];

const LoginBreakReport = () => {
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleExport = async () => {
        setError('');
        setMessage('');

        if (!startDate || !endDate) {
            setError('Please select both a start date and an end date.');
            return;
        }
        if (new Date(endDate) < new Date(startDate)) {
            setError('End date cannot be before the start date.');
            return;
        }

        setExporting(true);
        try {
            const response = await axios.get(API_ENDPOINTS.TEAM_LOGIN_BREAK_REPORT, {
                params: { start: startDate, end: endDate },
            });

            if (!response.data.success) {
                setError(response.data.message || 'Failed to fetch report');
                return;
            }

            const { team_members = [], attendance = [], breaks = [] } = response.data;

            if (team_members.length === 0) {
                setError('No team members found to report on.');
                return;
            }

            const empMap = {};
            team_members.forEach(e => { empMap[e.employee_id] = e; });

            // Group breaks by employee+date so multiple breaks in one day collapse into one row.
            const breaksByKey = {};
            breaks.forEach(b => {
                const dateKey = b.attendance_date ? b.attendance_date.split('T')[0] : b.attendance_date;
                const key = `${b.employee_id}||${dateKey}`;
                (breaksByKey[key] = breaksByKey[key] || []).push(b);
            });

            const attendanceByKey = {};
            attendance.forEach(a => {
                const dateKey = a.attendance_date ? a.attendance_date.split('T')[0] : a.attendance_date;
                attendanceByKey[`${a.employee_id}||${dateKey}`] = a;
            });

            // Only report on (employee, date) combinations that actually have activity —
            // an employee absent all day shouldn't pad the sheet with a blank row.
            const allKeys = new Set([...Object.keys(attendanceByKey), ...Object.keys(breaksByKey)]);

            const rows = [...allKeys].map(key => {
                const sepIdx = key.indexOf('||');
                const empId = key.substring(0, sepIdx);
                const dateKey = key.substring(sepIdx + 2);
                const emp = empMap[empId];
                const att = attendanceByKey[key];
                const dayBreaksRaw = breaksByKey[key] || [];
                const totalBreakMinutes = dayBreaksRaw.reduce((sum, b) => sum + (b.break_duration_minutes || 0), 0);

                const startEndFor = (b) => b
                    ? [formatTime(b.break_start) || '--:--', formatTime(b.break_end) || (b.break_start ? 'Ongoing' : '--:--')]
                    : ['-', '-'];

                const row = {
                    _sortDate: dateKey,
                    _sortName: emp ? `${emp.first_name} ${emp.last_name}`.trim() : empId,
                    'Date': formatDate(dateKey),
                    'Agent Name': emp ? `${emp.first_name} ${emp.last_name}`.trim() : empId,
                    'Employee ID': empId,
                    'Department': emp?.department || '-',
                    'Login Time': formatTime(att?.clock_in_ist || att?.clock_in) || '--:--',
                    'Logout Time': formatTime(att?.clock_out_ist || att?.clock_out) || '--:--',
                    'Total Login Hours': att?.total_hours ? formatMinutesToHM(Math.round(att.total_hours * 60)) : '-',
                    'Total Break Duration': formatMinutesToHM(totalBreakMinutes),
                };

                FIXED_BREAK_TYPES.forEach(t => {
                    const [start, end] = startEndFor(dayBreaksRaw.find(b => b.break_type === t.type));
                    row[`${t.label} Start`] = start;
                    row[`${t.label} End`] = end;
                });

                const fixedTypeSet = new Set(FIXED_BREAK_TYPES.map(t => t.type));
                const otherBreaks = dayBreaksRaw
                    .filter(b => !fixedTypeSet.has(b.break_type))
                    .sort((a, b) => new Date(a.break_start) - new Date(b.break_start));
                row['Other Break Start'] = otherBreaks.length
                    ? otherBreaks.map((b, i) => `Break ${i + 1}: ${formatTime(b.break_start) || '--:--'}`).join(' | ')
                    : '-';
                row['Other Break End'] = otherBreaks.length
                    ? otherBreaks.map((b, i) => `Break ${i + 1}: ${formatTime(b.break_end) || (b.break_start ? 'Ongoing' : '--:--')}`).join(' | ')
                    : '-';

                return row;
            }).sort((a, b) => a._sortDate.localeCompare(b._sortDate) || a._sortName.localeCompare(b._sortName));

            const exportData = rows.map(({ _sortDate, _sortName, ...rest }) => rest);

            const ws = XLSX.utils.json_to_sheet(exportData, { header: EXPORT_COLUMNS });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Login & Break Report');
            XLSX.writeFile(wb, `Login_Break_Report_${startDate}_to_${endDate}.xlsx`);

            setMessage(`Report exported successfully — ${exportData.length} row(s).`);
        } catch (err) {
            console.error('Login & Break report export error:', err);
            setError(err.response?.data?.message || 'Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
            <div className="mb-3">
                <h5 className="mb-1 d-flex align-items-center">
                    <FaFileExcel className="me-2 text-success" />
                    Login & Break Report
                </h5>
                <p className="text-muted mb-0 small">
                    Pick a date range and export each team member's login/logout times and break usage to Excel.
                </p>
            </div>

            {message && <Alert variant="success" className="mb-3 py-2" dismissible onClose={() => setMessage('')}>{message}</Alert>}
            {error && <Alert variant="danger" className="mb-3 py-2" dismissible onClose={() => setError('')}>{error}</Alert>}

            <Card className="border-0 shadow-sm">
                <Card.Body className="p-3">
                    <Row className="g-2 align-items-end">
                        <Col xs={12} sm={6} md={3}>
                            <Form.Label className="small text-muted mb-1">Start Date</Form.Label>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={startDate}
                                max={endDate || undefined}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </Col>
                        <Col xs={12} sm={6} md={3}>
                            <Form.Label className="small text-muted mb-1">End Date</Form.Label>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={endDate}
                                min={startDate || undefined}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </Col>
                        <Col xs={12} md="auto">
                            <Button variant="success" size="sm" onClick={handleExport} disabled={exporting}>
                                {exporting
                                    ? <><Spinner animation="border" size="sm" className="me-1" /> Exporting...</>
                                    : <><FaDownload className="me-1" size={12} /> Export to Excel</>}
                            </Button>
                        </Col>
                    </Row>
                    <div className="mt-2 text-muted small">
                        <FaInfoCircle className="me-1" size={10} />
                        Data is fetched only when you click Export. Range is capped at 92 days.
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
};

export default LoginBreakReport;
