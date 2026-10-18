const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

router.get('/public-stats', analyticsController.getPublicStats);
router.get('/dashboard', analyticsController.getDashboardAnalytics);
router.get('/sustainability', analyticsController.getSustainabilityMetrics);
router.get('/prevention', analyticsController.getPreventionInsights);

module.exports = router;
