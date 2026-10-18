const Hotspot = require('../models/Hotspot');
const { detectHotspots } = require('../services/hotspot.service');

/**
 * Get all detected recurring hotspots
 */
exports.getAllHotspots = async (req, res, next) => {
  try {
    const hotspots = await Hotspot.find().sort({ incidentCount: -1, averageRiskScore: -1 });

    res.status(200).json({
      success: true,
      count: hotspots.length,
      hotspots,
      notice: 'Recurring drainage hotspots derived from clustering proximity and historical incident reports.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Trigger manual detection of hotspots
 */
exports.recalculateHotspots = async (req, res, next) => {
  try {
    const hotspots = await detectHotspots();
    res.status(200).json({
      success: true,
      message: `Detected ${hotspots.length} recurring drainage hotspots.`,
      count: hotspots.length,
      hotspots
    });
  } catch (err) {
    next(err);
  }
};
