const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Public utility route for duplicate proximity check
router.get('/check-duplicate', reportController.checkDuplicate);

// Authenticated report retrieval routes
// - Municipal Admin has full access to all complaints
// - Citizens can only view their own reports (Privacy Enforced)
router.get('/', authenticate, reportController.getAllReports);
router.get('/my-reports', authenticate, reportController.getMyReports);
router.get('/:id', authenticate, reportController.getReportById);

// Submit report with live camera photo verification
router.post('/', authenticate, upload.single('photo'), reportController.createReport);

module.exports = router;
