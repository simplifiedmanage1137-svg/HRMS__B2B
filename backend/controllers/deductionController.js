const supabase = require('../config/supabase');

// Create deductions for one or more employees
exports.createDeductions = async (req, res) => {
  try {
    const { employee_ids, amount, reason, deduction_date, month, year } = req.body;

    if (!employee_ids?.length || !amount || !reason || !month || !year) {
      return res.status(400).json({ error: 'employee_ids, amount, reason, month, year are required' });
    }

    const date = deduction_date || new Date().toISOString().split('T')[0];
    const createdBy = req.user?.employeeId || req.user?.email;

    const rows = employee_ids.map(id => ({
      employee_id:    id,
      amount:         parseFloat(amount),
      reason:         reason.trim(),
      deduction_date: date,
      month:          parseInt(month),
      year:           parseInt(year),
      created_by:     createdBy,
    }));

    const { data, error } = await supabase.from('salary_deductions').insert(rows).select();
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('createDeductions error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all deductions — optionally filtered by month/year
exports.getAllDeductions = async (req, res) => {
  try {
    const { month, year } = req.query;

    let query = supabase
      .from('salary_deductions')
      .select('*')
      .order('created_at', { ascending: false });

    if (month) query = query.eq('month', parseInt(month));
    if (year)  query = query.eq('year',  parseInt(year));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get deductions for a specific employee
exports.getEmployeeDeductions = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { month, year } = req.query;

    let query = supabase
      .from('salary_deductions')
      .select('*')
      .eq('employee_id', employee_id)
      .order('created_at', { ascending: false });

    if (month) query = query.eq('month', parseInt(month));
    if (year)  query = query.eq('year',  parseInt(year));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get total custom deduction amount for an employee in a given month/year (used by salary generation)
exports.getDeductionTotal = async (employeeId, month, year) => {
  const { data, error } = await supabase
    .from('salary_deductions')
    .select('amount')
    .eq('employee_id', employeeId)
    .eq('month', parseInt(month))
    .eq('year', parseInt(year));

  if (error) {
    console.error('getDeductionTotal error:', error.message);
    return 0;
  }
  return (data || []).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
};

// Delete a deduction
exports.deleteDeduction = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('salary_deductions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
