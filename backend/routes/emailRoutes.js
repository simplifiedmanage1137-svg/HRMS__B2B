// routes/emailRoutes.js — Admin/HR manual "Email" section.
// Recipient directory reuses the existing GET /api/employees (already returns every
// employee's role/email/name) — no separate directory endpoint needed here.
const express = require('express');
const router  = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const emailController = require('../controllers/emailController');

// isAdmin = admin/sub_admin/hr (see backend/middleware/auth.js) — the same role set every
// other admin-tools page in this app is gated by (Deductions, Leave Balance, Broadcast,
// etc.), so this "Email" section is reachable from both the Admin Panel and the HR Panel
// exactly like those.
router.post('/send', verifyToken, isAdmin, emailController.sendManualEmail);

module.exports = router;
