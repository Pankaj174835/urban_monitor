const express = require('express');
const router = express.Router();
const mapController = require('../controllers/map.controller');

router.get('/reports', mapController.getMapReports);
router.get('/heatmap', mapController.getHeatmapData);
router.get('/layers', mapController.getAllMapLayers);
router.get('/reverse-geocode', mapController.reverseGeocode);

module.exports = router;
