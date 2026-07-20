// backend/controllers/performanceController.js
const supabase = require('../config/supabase');

// Internal role → the role it can review
const REVIEWABLE_ROLE = {
  admin:     'sub_admin',
  hr:        'sub_admin',
  sub_admin: 'manager',
  manager:   'employee',
};

// Rating labels per spec
const RATING_LABELS = {
  5: 'Excellent Performer',
  4: 'Very Good Performer',
  3: 'Meets Expectations',
  2: 'Performance Improvement Plan (PIP)',
  1: 'Termination Recommended',
};

const getRatingLabel = (r) => RATING_LABELS[r] || 'Not Rated';

const normalizeName = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

const getEmployee = async (employeeId) => {
  if (!employeeId) return null;
  const { data } = await supabase
    .from('employees')
    .select('employee_id, first_name, last_name, department, designation, role, reporting_manager')
    .eq('employee_id', employeeId)
    .maybeSingle();
  return data;
};

// Returns employees the caller is allowed to review this month
const getReviewableEmployees = async (req, res) => {
  try {
    const callerId   = req.user?.employeeId;
    const callerRole = req.user?.role;
    const targetRole = REVIEWABLE_ROLE[callerRole];

    if (!targetRole) {
      return res.status(403).json({ success: false, message: 'Your role cannot submit performance reviews' });
    }

    // Fetch all employees with the target role
    const { data: candidates, error } = await supabase
      .from('employees')
      .select('employee_id, first_name, last_name, department, designation, role, reporting_manager')
      .eq('role', targetRole)
      .order('first_name', { ascending: true });

    if (error) throw error;

    // For managers: filter to direct reports only
    let eligible = candidates || [];
    if (callerRole === 'manager') {
      const caller = await getEmployee(callerId);
      if (caller) {
        const callerName = normalizeName(`${caller.first_name} ${caller.last_name}`);
        eligible = eligible.filter(e => normalizeName(e.reporting_manager) === callerName);
      }
    }

    // Fetch existing reviews this month
    const now          = new Date();
    const month        = now.getMonth() + 1;
    const year         = now.getFullYear();

    let existingReviews = [];
    if (eligible.length > 0) {
      const { data: reviews } = await supabase
        .from('performance_reviews')
        .select('id, employee_id, rating, remarks, reviewer_id')
        .in('employee_id', eligible.map(e => e.employee_id))
        .eq('review_month', month)
        .eq('review_year', year);
      existingReviews = reviews || [];
    }

    const result = eligible.map(emp => {
      const review = existingReviews.find(r => r.employee_id === emp.employee_id);
      return {
        ...emp,
        full_name:    `${emp.first_name} ${emp.last_name}`.trim(),
        review_id:    review?.id || null,
        rating:       review?.rating || null,
        rating_label: review ? getRatingLabel(review.rating) : null,
        remarks:      review?.remarks || null,
        reviewed_by_me: review ? review.reviewer_id === callerId : false,
        has_review:   !!review,
      };
    });

    res.json({
      success: true,
      employees:     result,
      current_month: month,
      current_year:  year,
      month_name:    now.toLocaleString('default', { month: 'long' }),
    });
  } catch (err) {
    console.error('❌ getReviewableEmployees:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Submit or override a review
const submitReview = async (req, res) => {
  try {
    const callerId   = req.user?.employeeId;
    const callerRole = req.user?.role;
    const targetRole = REVIEWABLE_ROLE[callerRole];

    if (!targetRole) {
      return res.status(403).json({ success: false, message: 'Your role cannot submit performance reviews' });
    }

    const { employee_id, rating, remarks, review_month, review_year } = req.body;

    if (!employee_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Valid employee and rating (1–5) are required' });
    }

    // Verify target employee exists and has the correct role
    const target = await getEmployee(employee_id);
    if (!target) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (target.role !== targetRole) {
      return res.status(403).json({ success: false, message: `You can only review ${targetRole} employees` });
    }

    // For managers: enforce direct-report check
    if (callerRole === 'manager') {
      const caller     = await getEmployee(callerId);
      const callerName = normalizeName(`${caller.first_name} ${caller.last_name}`);
      if (normalizeName(target.reporting_manager) !== callerName) {
        return res.status(403).json({ success: false, message: 'You can only review your direct reports' });
      }
    }

    const month = review_month || new Date().getMonth() + 1;
    const year  = review_year  || new Date().getFullYear();

    // Check for existing review this month
    const { data: existing } = await supabase
      .from('performance_reviews')
      .select('id, reviewer_id')
      .eq('employee_id', employee_id)
      .eq('review_month', month)
      .eq('review_year', year)
      .maybeSingle();

    // Non-admins cannot override another person's review
    if (existing && callerRole !== 'admin' && existing.reviewer_id !== callerId) {
      return res.status(409).json({
        success: false,
        message: 'A review already exists for this employee this month. Only admin can override it.',
      });
    }

    let saved;
    if (existing) {
      const { data, error } = await supabase
        .from('performance_reviews')
        .update({ reviewer_id: callerId, reviewer_role: callerRole, rating, remarks, updated_at: new Date() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase
        .from('performance_reviews')
        .insert({
          reviewer_id:   callerId,
          reviewer_role: callerRole,
          employee_id,
          employee_role: target.role,
          rating,
          remarks,
          review_month:  month,
          review_year:   year,
        })
        .select()
        .single();
      if (error) throw error;
      saved = data;
    }

    // Notify the reviewed employee
    try {
      await supabase.from('notifications').insert({
        employee_id,
        type:    'performance_review',
        title:   'Performance Review Submitted',
        message: `Your performance review for ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year} has been submitted. Rating: ${rating}/5 – ${getRatingLabel(rating)}.`,
        is_read: false,
      });
    } catch (_) { /* notification failure is non-fatal */ }

    res.json({
      success: true,
      message: existing ? 'Review updated' : 'Review submitted',
      review:  { ...saved, rating_label: getRatingLabel(saved.rating) },
    });
  } catch (err) {
    console.error('❌ submitReview:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get the latest review for the logged-in employee (dashboard card)
const getMyLatestReview = async (req, res) => {
  try {
    const employeeId = req.user?.employeeId;

    const { data, error } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('employee_id', employeeId)
      .order('review_year',  { ascending: false })
      .order('review_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) return res.json({ success: true, review: null });

    const reviewer = await getEmployee(data.reviewer_id);
    const reviewerName = reviewer
      ? `${reviewer.first_name} ${reviewer.last_name}`.trim()
      : 'Unknown';

    res.json({
      success: true,
      review: {
        ...data,
        rating_label:  getRatingLabel(data.rating),
        reviewer_name: reviewerName,
        month_name:    new Date(data.review_year, data.review_month - 1)
                         .toLocaleString('default', { month: 'long' }),
      },
    });
  } catch (err) {
    console.error('❌ getMyLatestReview:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Full review history for the logged-in employee
const getMyHistory = async (req, res) => {
  try {
    const employeeId = req.user?.employeeId;

    const { data, error } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('employee_id', employeeId)
      .order('review_year',  { ascending: false })
      .order('review_month', { ascending: false });

    if (error) throw error;

    const reviews = await Promise.all((data || []).map(async (r) => {
      const reviewer = await getEmployee(r.reviewer_id);
      return {
        ...r,
        rating_label:  getRatingLabel(r.rating),
        reviewer_name: reviewer ? `${reviewer.first_name} ${reviewer.last_name}`.trim() : 'Unknown',
        month_name:    new Date(r.review_year, r.review_month - 1).toLocaleString('default', { month: 'long' }),
      };
    }));

    res.json({ success: true, reviews });
  } catch (err) {
    console.error('❌ getMyHistory:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// View any employee's reviews (admin / the reviewer)
const getEmployeeReviews = async (req, res) => {
  try {
    const callerId   = req.user?.employeeId;
    const callerRole = req.user?.role;
    const { employeeId } = req.params;

    if (callerId !== employeeId && !['admin', 'sub_admin', 'manager'].includes(callerRole)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { data, error } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('employee_id', employeeId)
      .order('review_year',  { ascending: false })
      .order('review_month', { ascending: false });

    if (error) throw error;

    const reviews = await Promise.all((data || []).map(async (r) => {
      const reviewer = await getEmployee(r.reviewer_id);
      return {
        ...r,
        rating_label:  getRatingLabel(r.rating),
        reviewer_name: reviewer ? `${reviewer.first_name} ${reviewer.last_name}`.trim() : 'Unknown',
        month_name:    new Date(r.review_year, r.review_month - 1).toLocaleString('default', { month: 'long' }),
      };
    }));

    res.json({ success: true, reviews });
  } catch (err) {
    console.error('❌ getEmployeeReviews:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Team stats for Manager/TL dashboard card
const getTeamStats = async (req, res) => {
  try {
    const callerId   = req.user?.employeeId;
    const callerRole = req.user?.role;
    const targetRole = REVIEWABLE_ROLE[callerRole];

    if (!targetRole) return res.json({ success: true, stats: null });

    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    // Get eligible employees
    let { data: candidates } = await supabase
      .from('employees')
      .select('employee_id, first_name, last_name, reporting_manager')
      .eq('role', targetRole);

    if (callerRole === 'manager' && candidates) {
      const caller     = await getEmployee(callerId);
      const callerName = normalizeName(`${caller.first_name} ${caller.last_name}`);
      candidates = candidates.filter(e => normalizeName(e.reporting_manager) === callerName);
    }

    const total = (candidates || []).length;
    if (total === 0) return res.json({ success: true, stats: { total: 0, reviewed: 0, pending: 0, avg_rating: null } });

    const { data: reviews } = await supabase
      .from('performance_reviews')
      .select('employee_id, rating')
      .in('employee_id', candidates.map(e => e.employee_id))
      .eq('review_month', month)
      .eq('review_year',  year);

    const reviewed   = (reviews || []).length;
    const avgRating  = reviewed > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviewed).toFixed(1)
      : null;

    res.json({
      success: true,
      stats: {
        total,
        reviewed,
        pending:    total - reviewed,
        avg_rating: avgRating,
        month_name: now.toLocaleString('default', { month: 'long' }),
        year,
      },
    });
  } catch (err) {
    console.error('❌ getTeamStats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin analytics
const getAnalytics = async (req, res) => {
  try {
    const callerRole = req.user?.role;
    if (!['admin', 'sub_admin', 'hr'].includes(callerRole)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    // All reviews this month
    const { data: monthReviews } = await supabase
      .from('performance_reviews')
      .select('employee_id, rating, employee_role')
      .eq('review_month', month)
      .eq('review_year',  year);

    const reviews = monthReviews || [];
    const totalReviewed = reviews.length;
    const avgRating = totalReviewed > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / totalReviewed).toFixed(1)
      : null;

    const pip          = reviews.filter(r => r.rating === 2).length;
    const termination  = reviews.filter(r => r.rating === 1).length;

    // Top performers (rating 5)
    const topRated = reviews.filter(r => r.rating === 5).map(r => r.employee_id);

    // Count pending by role
    const targetRoles = (callerRole === 'admin' || callerRole === 'hr')
      ? ['sub_admin', 'manager', 'employee']
      : ['manager', 'employee'];

    const { data: allEmployees } = await supabase
      .from('employees')
      .select('employee_id, role')
      .in('role', targetRoles);

    const totalEmployees = (allEmployees || []).length;
    const reviewedIds    = new Set(reviews.map(r => r.employee_id));
    const pending        = (allEmployees || []).filter(e => !reviewedIds.has(e.employee_id)).length;

    res.json({
      success: true,
      analytics: {
        total_employees: totalEmployees,
        reviewed:        totalReviewed,
        pending,
        avg_rating:      avgRating,
        pip_count:       pip,
        termination_count: termination,
        top_rated_count: topRated.length,
        month_name:      now.toLocaleString('default', { month: 'long' }),
        year,
      },
    });
  } catch (err) {
    console.error('❌ getAnalytics:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: get all reviews
const getAllReviews = async (req, res) => {
  try {
    const callerRole = req.user?.role;
    if (!['admin', 'sub_admin', 'hr'].includes(callerRole)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { month, year } = req.query;
    let query = supabase.from('performance_reviews').select('*')
      .order('review_year',  { ascending: false })
      .order('review_month', { ascending: false });

    if (month) query = query.eq('review_month', parseInt(month));
    if (year)  query = query.eq('review_year',  parseInt(year));

    const { data, error } = await query;
    if (error) throw error;

    const reviews = await Promise.all((data || []).map(async (r) => {
      const [emp, rev] = await Promise.all([getEmployee(r.employee_id), getEmployee(r.reviewer_id)]);
      return {
        ...r,
        rating_label:    getRatingLabel(r.rating),
        employee_name:   emp  ? `${emp.first_name}  ${emp.last_name}`.trim()  : r.employee_id,
        department:      emp?.department || '—',
        reviewer_name:   rev  ? `${rev.first_name}  ${rev.last_name}`.trim()  : r.reviewer_id,
        month_name:      new Date(r.review_year, r.review_month - 1).toLocaleString('default', { month: 'long' }),
      };
    }));

    res.json({ success: true, reviews, total: reviews.length });
  } catch (err) {
    console.error('❌ getAllReviews:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getReviewableEmployees,
  submitReview,
  getMyLatestReview,
  getMyHistory,
  getEmployeeReviews,
  getTeamStats,
  getAnalytics,
  getAllReviews,
};
