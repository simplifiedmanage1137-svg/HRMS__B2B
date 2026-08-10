// routes/salaryRoutes.js - Alternative simple fix
const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');
const { verifyToken, isAdmin, isOwnDataOrAdmin } = require('../middleware/auth');

// Employee routes
router.get('/employee/:employee_id', verifyToken, isOwnDataOrAdmin, salaryController.getEmployeeSalarySlips);

// NOTE: literal single-segment GET paths (/bulk, /stats/summary) must be registered
// before the /:id catch-all below — otherwise Express matches them as :id="bulk" etc.
// and the request 500s trying to parse "bulk" as an integer id.
router.get('/stats/summary',  verifyToken, isAdmin, salaryController.getSalaryStatistics);
router.get('/bulk',            verifyToken, isAdmin, salaryController.getBulkPayroll);

router.get('/:id', verifyToken, salaryController.getSalarySlipById);
router.get('/:employee_id/:month/:year', verifyToken, isOwnDataOrAdmin, salaryController.getSalarySlipByMonth);

// SIMPLE FIX: Remove isOwnDataOrAdmin from generate route
// Only verify token, then let controller handle permission check
router.post('/generate', verifyToken, salaryController.generateSalarySlip);

// Admin only routes
router.post('/generate-bulk', verifyToken, isAdmin, salaryController.generateBulkSalarySlips);
router.post('/adjustment',     verifyToken, isAdmin, salaryController.saveSalaryAdjustment);
router.put('/:id/mark-paid',  verifyToken, isAdmin, salaryController.markAsPaid);
router.delete('/:id',         verifyToken, isAdmin, salaryController.deleteSalarySlip);
router.put('/:id',            verifyToken, isAdmin, salaryController.updateSalarySlip);

module.exports = router;