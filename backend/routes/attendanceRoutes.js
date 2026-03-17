// routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

module.exports = (supabase) => {
    // Employee endpoints
    router.post('/clock-in', attendanceController.clockIn);
    router.post('/clock-out', attendanceController.clockOut);
    router.post('/heartbeat', attendanceController.heartbeat);
    router.get('/today/:employee_id', attendanceController.getTodayAttendance);

    // Admin endpoints
    router.get('/report', attendanceController.getAttendanceReport);

    // Overtime endpoints
    router.get('/overtime/:employee_id/:month/:year', attendanceController.getOvertimeSummary);

    console.log('✅ Attendance routes loaded');
    return router;
};