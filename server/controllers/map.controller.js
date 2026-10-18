const Report = require('../models/Report');
const RiskArea = require('../models/RiskArea');
const Hotspot = require('../models/Hotspot');

/**
 * Get map markers with sanitized public details
 */
exports.getMapReports = async (req, res, next) => {
  try {
    const { status, riskLevel, problemType } = req.query;
    const query = {};

    if (status && status !== 'ALL') query.status = status;
    if (riskLevel && riskLevel !== 'ALL') query.riskLevel = riskLevel;
    if (problemType && problemType !== 'ALL') query.problemType = problemType;

    const reports = await Report.find(query);

    const markers = (Array.isArray(reports) ? reports : []).map(r => ({
      reportId: r.reportId,
      latitude: r.latitude,
      longitude: r.longitude,
      locationName: r.locationName,
      problemType: r.problemType,
      waterLevel: r.waterLevel,
      status: r.status,
      riskLevel: r.riskLevel,
      riskScore: r.riskScore,
      priority: r.priority,
      photoUrl: r.photoUrl,
      createdAt: r.createdAt,
      isDemo: r.isDemo || false
    }));

    res.status(200).json({
      success: true,
      count: markers.length,
      markers
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get heatmap data points [latitude, longitude, intensity]
 */
exports.getHeatmapData = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { status: { $ne: 'REJECTED' } };
    if (status && status !== 'ALL') query.status = status;

    const reports = await Report.find(query);

    const heatPoints = (Array.isArray(reports) ? reports : []).map(r => {
      // Calculate heat intensity (0.2 to 1.0)
      let intensity = 0.3;
      if (r.waterLevel === 'High') intensity += 0.4;
      else if (r.waterLevel === 'Medium') intensity += 0.2;

      intensity += (r.riskScore || 20) / 200;
      intensity = Math.min(1.0, Math.max(0.2, intensity));

      return [r.latitude, r.longitude, parseFloat(intensity.toFixed(2))];
    });

    res.status(200).json({
      success: true,
      count: heatPoints.length,
      heatPoints
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get aggregated map layers (Reports + Risk Areas + Hotspots)
 */
exports.getAllMapLayers = async (req, res, next) => {
  try {
    const reports = await Report.find();
    const riskAreas = await RiskArea.find();
    const hotspots = await Hotspot.find();

    res.status(200).json({
      success: true,
      reports: (Array.isArray(reports) ? reports : []).map(r => ({
        reportId: r.reportId,
        latitude: r.latitude,
        longitude: r.longitude,
        locationName: r.locationName,
        problemType: r.problemType,
        waterLevel: r.waterLevel,
        status: r.status,
        riskLevel: r.riskLevel,
        riskScore: r.riskScore,
        priority: r.priority,
        photoUrl: r.photoUrl,
        createdAt: r.createdAt,
        isDemo: r.isDemo
      })),
      riskAreas,
      hotspots
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reverse geocode coordinates to a human-readable address
 * Uses OpenStreetMap Nominatim with proper User-Agent and fallback
 */
exports.reverseGeocode = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon || req.query.lng);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates provided. Latitude must be -90..90 and longitude -180..180.'
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'UrbanDrainMonitor/1.0 (academic-urban-flood-system; admin@citydrain.gov.in)',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const address = data.display_name || (data.address ? Object.values(data.address).filter(Boolean).join(', ') : null);
        if (address) {
          return res.status(200).json({
            success: true,
            latitude: lat,
            longitude: lon,
            address: address,
            details: data.address || {}
          });
        }
      }
    } catch (fetchErr) {
      console.warn('Nominatim reverse-geocoding notice:', fetchErr.message);
    }

    // Graceful fallback if external geocoder timed out or network offline
    return res.status(200).json({
      success: true,
      latitude: lat,
      longitude: lon,
      address: `Location near (${lat.toFixed(5)}, ${lon.toFixed(5)})`,
      isFallback: true,
      message: 'Reverse geocoding network response delayed; coordinates captured.'
    });
  } catch (err) {
    next(err);
  }
};
