import React, { useState, useEffect, useMemo } from 'react';
import {
  Container, Row, Col, Card, Table, Button, Form,
  Badge, Spinner, Alert, InputGroup, Modal
} from 'react-bootstrap';
import {
  FaMinusCircle, FaSearch, FaTrash, FaCheckSquare, FaSquare,
  FaFilter, FaDownload, FaExclamationTriangle, FaUsers
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import * as XLSX from 'xlsx';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const fmtCurrency = (v) =>
  `₹${parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const now = new Date();
const DEFAULT_MONTH = now.getMonth() + 1;
const DEFAULT_YEAR  = now.getFullYear();

export default function DeductionManager() {
  const [employees, setEmployees]       = useState([]);
  const [deductions, setDeductions]     = useState([]);
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [search, setSearch]             = useState('');
  const [filterMonth, setFilterMonth]   = useState(DEFAULT_MONTH);
  const [filterYear, setFilterYear]     = useState(DEFAULT_YEAR);
  const [formMonth, setFormMonth]       = useState(DEFAULT_MONTH);
  const [formYear, setFormYear]         = useState(DEFAULT_YEAR);
  const [amount, setAmount]             = useState('');
  const [reason, setReason]             = useState('');
  const [deductionDate, setDeductionDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => { fetchDeductions(); }, [filterMonth, filterYear]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.EMPLOYEES);
      const list = (res.data?.employees || res.data || []).filter(e => e.is_active !== false);
      setEmployees(list);
    } catch (err) {
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeductions = async () => {
    try {
      const res = await axios.get(`${API_ENDPOINTS.DEDUCTIONS}?month=${filterMonth}&year=${filterYear}`);
      setDeductions(res.data?.data || []);
    } catch (err) {
      console.error('fetch deductions error', err);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(e =>
      !q ||
      `${e.first_name} ${e.middle_name || ''} ${e.last_name}`.toLowerCase().includes(q) ||
      e.employee_id?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.designation?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map(e => e.employee_id)));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selectedIds.size) return setError('Select at least one employee.');
    if (!amount || parseFloat(amount) <= 0) return setError('Enter a valid deduction amount.');
    if (!reason.trim()) return setError('Enter a reason for deduction.');

    setSaving(true);
    try {
      await axios.post(API_ENDPOINTS.DEDUCTIONS, {
        employee_ids:   Array.from(selectedIds),
        amount:         parseFloat(amount),
        reason:         reason.trim(),
        deduction_date: deductionDate,
        month:          formMonth,
        year:           formYear,
      });
      setSuccess(`Deduction of ${fmtCurrency(amount)} applied to ${selectedIds.size} employee(s) for ${MONTHS[formMonth - 1]} ${formYear}.`);
      setSelectedIds(new Set());
      setAmount('');
      setReason('');
      // sync right-panel filter to the submitted month/year so the new entry appears immediately
      setFilterMonth(formMonth);
      setFilterYear(formYear);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save deductions');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(API_ENDPOINTS.DEDUCTION_DELETE(id));
      setDeductions(prev => prev.filter(d => d.id !== id));
      setConfirmDelete(null);
    } catch (err) {
      setError('Failed to delete deduction');
    }
  };

  const exportExcel = () => {
    const rows = deductions.map((d, i) => {
      const emp = employees.find(e => e.employee_id === d.employee_id);
      return {
        'Sr': i + 1,
        'Employee ID': d.employee_id,
        'Name': emp ? `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`.trim() : d.employee_id,
        'Department': emp?.department || '',
        'Month': MONTHS[(d.month || 1) - 1],
        'Year': d.year,
        'Deduction Date': fmtDate(d.deduction_date),
        'Amount (₹)': parseFloat(d.amount),
        'Reason': d.reason,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deductions');
    XLSX.writeFile(wb, `deductions_${MONTHS[filterMonth - 1]}_${filterYear}.xlsx`);
  };

  const years = Array.from({ length: 5 }, (_, i) => DEFAULT_YEAR - 2 + i);
  const allSelected = filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length;
  const totalDeducted = deductions.reduce((s, d) => s + parseFloat(d.amount || 0), 0);

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <div style={{ background: 'linear-gradient(135deg,#dc3545,#c82333)', borderRadius: 12, padding: '10px 14px' }}>
            <FaMinusCircle color="#fff" size={22} />
          </div>
          <div>
            <h4 className="mb-0 fw-bold">Salary Deductions</h4>
            <small className="text-muted">Apply custom deductions to employee salaries</small>
          </div>
        </div>
      </div>

      <Row className="g-4">
        {/* LEFT: Employee selector + form */}
        <Col lg={5}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white border-bottom py-3">
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-semibold">
                  <FaUsers className="me-2 text-primary" />
                  Select Employees
                  {selectedIds.size > 0 && (
                    <Badge bg="danger" className="ms-2">{selectedIds.size} selected</Badge>
                  )}
                </span>
                <Button variant="link" size="sm" className="text-secondary p-0" onClick={toggleAll}>
                  {allSelected ? <FaCheckSquare /> : <FaSquare />}
                  <span className="ms-1 small">{allSelected ? 'Deselect All' : 'Select All'}</span>
                </Button>
              </div>
              <InputGroup size="sm" className="mt-2">
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control
                  placeholder="Search by name, ID, department…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </InputGroup>
            </Card.Header>

            {/* Employee list */}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {loading ? (
                <div className="text-center py-4"><Spinner size="sm" /></div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center text-muted py-4 small">No employees found</div>
              ) : (
                <Table hover size="sm" className="mb-0">
                  <tbody>
                    {filteredEmployees.map(emp => {
                      const fullName = `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`.trim();
                      const checked  = selectedIds.has(emp.employee_id);
                      return (
                        <tr
                          key={emp.employee_id}
                          style={{ cursor: 'pointer', background: checked ? '#fff5f5' : undefined }}
                          onClick={() => toggleSelect(emp.employee_id)}
                        >
                          <td style={{ width: 36, paddingLeft: 12 }}>
                            <Form.Check
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelect(emp.employee_id)}
                              onClick={e => e.stopPropagation()}
                            />
                          </td>
                          <td>
                            <div className="fw-semibold small">{fullName}</div>
                            <div className="text-muted" style={{ fontSize: 11 }}>
                              {emp.employee_id} · {emp.department}
                            </div>
                          </td>
                          <td className="text-end pe-3">
                            <Badge bg="light" text="dark" style={{ fontSize: 10 }}>{emp.designation}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>

            {/* Deduction form */}
            <Card.Body className="border-top">
              <Form onSubmit={handleSubmit}>
                <Row className="g-2 mb-2">
                  <Col>
                    <Form.Label className="small fw-semibold mb-1">Salary Month</Form.Label>
                    <Form.Select size="sm" value={formMonth} onChange={e => setFormMonth(parseInt(e.target.value))}>
                      {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </Form.Select>
                  </Col>
                  <Col>
                    <Form.Label className="small fw-semibold mb-1">Year</Form.Label>
                    <Form.Select size="sm" value={formYear} onChange={e => setFormYear(parseInt(e.target.value))}>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </Form.Select>
                  </Col>
                </Row>

                <Form.Group className="mb-2">
                  <Form.Label className="small fw-semibold mb-1">Deduction Date</Form.Label>
                  <Form.Control
                    type="date"
                    size="sm"
                    value={deductionDate}
                    onChange={e => setDeductionDate(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label className="small fw-semibold mb-1">Amount (₹)</Form.Label>
                  <Form.Control
                    type="number"
                    size="sm"
                    min="1"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold mb-1">Reason</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    size="sm"
                    placeholder="e.g. Late fine, Misconduct penalty, Equipment damage…"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    required
                  />
                </Form.Group>

                {error   && <Alert variant="danger"  className="py-2 small mb-2">{error}</Alert>}
                {success && <Alert variant="success" className="py-2 small mb-2">{success}</Alert>}

                <Button
                  type="submit"
                  variant="danger"
                  className="w-100"
                  disabled={saving || !selectedIds.size}
                >
                  {saving ? <Spinner size="sm" className="me-2" /> : <FaMinusCircle className="me-2" />}
                  Apply Deduction to {selectedIds.size || 0} Employee{selectedIds.size !== 1 ? 's' : ''}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* RIGHT: Deductions list */}
        <Col lg={7}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-white border-bottom py-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <span className="fw-semibold">
                  <FaFilter className="me-2 text-danger" />
                  Deductions — {MONTHS[filterMonth - 1]} {filterYear}
                  {deductions.length > 0 && (
                    <Badge bg="danger" className="ms-2">{deductions.length}</Badge>
                  )}
                </span>
                <div className="d-flex gap-2 align-items-center">
                  <Form.Select size="sm" value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))} style={{ width: 110 }}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </Form.Select>
                  <Form.Select size="sm" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ width: 80 }}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </Form.Select>
                  {deductions.length > 0 && (
                    <Button size="sm" variant="outline-success" onClick={exportExcel}>
                      <FaDownload className="me-1" /> Excel
                    </Button>
                  )}
                </div>
              </div>
              {totalDeducted > 0 && (
                <div className="mt-2 d-flex gap-3 small text-muted">
                  <span>Total deducted this month: <strong className="text-danger">{fmtCurrency(totalDeducted)}</strong></span>
                  <span>Affected employees: <strong>{new Set(deductions.map(d => d.employee_id)).size}</strong></span>
                </div>
              )}
            </Card.Header>

            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {deductions.length === 0 ? (
                <div className="text-center text-muted py-5 small">
                  <FaMinusCircle size={32} className="mb-2 text-muted" style={{ opacity: 0.3 }} />
                  <div>No deductions for {MONTHS[filterMonth - 1]} {filterYear}</div>
                </div>
              ) : (
                <Table hover size="sm" className="mb-0 small">
                  <thead className="bg-light sticky-top" style={{ top: 0 }}>
                    <tr>
                      <th className="ps-3">Employee</th>
                      <th>Date</th>
                      <th className="text-end">Amount</th>
                      <th>Reason</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductions.map(d => {
                      const emp  = employees.find(e => e.employee_id === d.employee_id);
                      const name = emp
                        ? `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`.trim()
                        : d.employee_id;
                      return (
                        <tr key={d.id}>
                          <td className="ps-3">
                            <div className="fw-semibold">{name}</div>
                            <div className="text-muted" style={{ fontSize: 10 }}>
                              {d.employee_id} · {emp?.department || ''}
                            </div>
                          </td>
                          <td className="text-nowrap">{fmtDate(d.deduction_date)}</td>
                          <td className="text-end fw-bold text-danger text-nowrap">
                            -{fmtCurrency(d.amount)}
                          </td>
                          <td>
                            <span
                              title={d.reason}
                              style={{ maxWidth: 160, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {d.reason}
                            </span>
                          </td>
                          <td className="text-center">
                            <Button
                              variant="link"
                              size="sm"
                              className="text-danger p-0"
                              onClick={() => setConfirmDelete(d)}
                              title="Delete"
                            >
                              <FaTrash size={12} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Delete confirm modal */}
      <Modal show={!!confirmDelete} onHide={() => setConfirmDelete(null)} centered size="sm">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="small fw-bold text-danger">
            <FaExclamationTriangle className="me-2" /> Delete Deduction?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="small pt-2">
          <p className="mb-1">
            Remove <strong>{fmtCurrency(confirmDelete?.amount)}</strong> deduction for{' '}
            <strong>
              {(() => {
                const e = employees.find(x => x.employee_id === confirmDelete?.employee_id);
                return e ? `${e.first_name} ${e.last_name}` : confirmDelete?.employee_id;
              })()}
            </strong>?
          </p>
          <p className="text-muted mb-0" style={{ fontSize: 11 }}>Reason: {confirmDelete?.reason}</p>
          <p className="text-warning mt-2 mb-0" style={{ fontSize: 11 }}>
            If salary has already been generated, regenerate the slip to reflect the change.
          </p>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button size="sm" variant="outline-secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(confirmDelete?.id)}>Delete</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
