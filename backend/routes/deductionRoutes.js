const express = require('express');
const router  = express.Router();
const { verifyToken, isAdmin, isOwnDataOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/deductionController');

// Admin: create deductions for selected employees
router.post('/',                            verifyToken, isAdmin, ctrl.createDeductions);

// Admin: list all deductions (with optional ?month=&year= filter)
router.get('/',                             verifyToken, isAdmin, ctrl.getAllDeductions);

// Employee/Admin: get deductions for a specific employee
router.get('/employee/:employee_id',        verifyToken, isOwnDataOrAdmin, ctrl.getEmployeeDeductions);

// Admin: delete a deduction entry
router.delete('/:id',                       verifyToken, isAdmin, ctrl.deleteDeduction);

module.exports = router;
