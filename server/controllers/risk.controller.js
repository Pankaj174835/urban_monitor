const RiskArea = require('../models/RiskArea');
const Report = require('../models/Report');
const { refreshRiskAreas, calculateReportRisk } = require('../services/riskAnalysis.service');
const { alertNearbyCitizens } = require('../services/notification.service');

/**
 * Retrieve Risk Areas with optional risk level filter
 */
exports.getRiskAreas = async (req, res, next) => {
  try {
    const { riskLevel } = req.query;
    const query = {};
    if (riskLevel && riskLevel !== 'ALL') {
      query.riskLevel = riskLevel;
    }

    const areas = await RiskArea.find(query).sort({ riskScore: -1 });

    res.status(200).json({
      success: true,
      count: areas.length,
      areas,
      notice: 'AI-Assisted Risk Analysis Prototype — Rule-Based Engine. Based on real application data.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Trigger full recalculation of Risk Areas
 */
exports.recalculateRisk = async (req, res, next) => {
  try {
    const areas = await refreshRiskAreas();

    // Alert nearby citizens for high-risk zones
    const highRiskAreas = areas.filter(a => a.riskLevel === 'HIGH');
    for (const h of highRiskAreas) {
      await alertNearbyCitizens(h);
    }

    res.status(200).json({
      success: true,
      message: `Risk engine completed analysis. Generated ${areas.length} risk cluster areas.`,
      count: areas.length,
      areas
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Explain the calculated risk for a specific report
 */
exports.explainReportRisk = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const mongoose = require('mongoose');
    const query = mongoose.isValidObjectId(reportId) ? { $or: [{ _id: reportId }, { reportId }] } : { reportId };
    const report = await Report.findOne(query);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const analysis = await calculateReportRisk(report);

    res.status(200).json({
      success: true,
      reportId: report.reportId,
      currentRiskScore: report.riskScore,
      currentRiskLevel: report.riskLevel,
      currentReasons: report.riskReasons,
      recalculatedScore: analysis.riskScore,
      recalculatedLevel: analysis.riskLevel,
      recalculatedReasons: analysis.riskReasons,
      engineLabel: 'AI-Assisted Risk Analysis Prototype — Rule-Based Engine'
    });
  } catch (err) {
    next(err);
  }
};
