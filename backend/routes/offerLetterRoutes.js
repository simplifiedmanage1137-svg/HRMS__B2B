// backend/routes/offerLetterRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const controller = require('../controllers/offerLetterController');

// isAdmin already covers ['admin', 'sub_admin', 'hr'] — this app's HR/Admin roles
// (see backend/middleware/auth.js) — so every route here is HR/Admin-only.
router.use(verifyToken, isAdmin);

router.get('/employee/:employeeId/data', controller.getOfferLetterData);
router.get('/employee/:employeeId/history', controller.getOfferLetterHistory);
router.post('/employee/:employeeId/preview', controller.previewOfferLetter);
router.post('/:id/send', controller.sendOfferLetter);
router.post('/:id/resend', controller.resendOfferLetter);

module.exports = router;
