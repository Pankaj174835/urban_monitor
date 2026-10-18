const express = require('express');
const router = express.Router();
const riskController = require('../controllers/risk.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

router.get('/areas', riskController.getRiskAreas);
router.get('/explain/:reportId', riskController.explainReportRisk);
router.post('/recalculate', authenticate, authorizeRoles('admin'), riskController.recalculateRisk);

module.exports = router;
