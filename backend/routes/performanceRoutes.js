// backend/routes/performanceRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/performanceController');

module.exports = (authenticateToken) => {
  // Who can I review + existing reviews this month
  router.get('/reviewable',          authenticateToken, ctrl.getReviewableEmployees);

  // Submit / override a review
  router.post('/submit',             authenticateToken, ctrl.submitReview);

  // My own rating (dashboard card)
  router.get('/my-latest',           authenticateToken, ctrl.getMyLatestReview);

  // My full history
  router.get('/my-history',          authenticateToken, ctrl.getMyHistory);

  // Any employee's history (admin / manager)
  router.get('/employee/:employeeId', authenticateToken, ctrl.getEmployeeReviews);

  // Dashboard stats for manager / TL / sub_admin
  router.get('/team-stats',          authenticateToken, ctrl.getTeamStats);

  // Admin analytics
  router.get('/analytics',           authenticateToken, ctrl.getAnalytics);

  // Admin: all reviews
  router.get('/all',                 authenticateToken, ctrl.getAllReviews);

  return router;
};
