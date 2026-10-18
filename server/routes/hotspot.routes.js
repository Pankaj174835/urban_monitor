const express = require('express');
const router = express.Router();
const hotspotController = require('../controllers/hotspot.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

router.get('/', hotspotController.getAllHotspots);
router.post('/recalculate', authenticate, authorizeRoles('admin'), hotspotController.recalculateHotspots);

module.exports = router;
