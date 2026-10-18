const Report = require('../models/Report');
const { generateReportId } = require('../utils/reportIdGenerator');
const { calculateDistanceMeters } = require('../utils/geoUtils');
const { calculateReportRisk, refreshRiskAreas } = require('../services/riskAnalysis.service');
const { calculatePriority } = require('../services/priority.service');
const { detectHotspots } = require('../services/hotspot.service');
const { notifyUser, alertNearbyCitizens, getSocketIO } = require('../services/notification.service');

const DUPLICATE_DISTANCE_METERS = parseInt(process.env.DUPLICATE_DISTANCE_METERS, 10) || 100;
const DUPLICATE_TIME_WINDOW_HOURS = parseInt(process.env.DUPLICATE_TIME_WINDOW_HOURS, 10) || 24;

/**
 * Check if a similar report exists in proximity
 */
exports.checkDuplicate = async (req, res, next) => {
  try {
    const { latitude, longitude, problemType } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const windowStart = new Date(Date.now() - DUPLICATE_TIME_WINDOW_HOURS * 60 * 60 * 1000);

    const recentReports = await Report.find({
      createdAt: { $gte: windowStart },
      status: { $ne: 'REJECTED' }
    });

    const duplicates = (Array.isArray(recentReports) ? recentReports : []).filter(r => {
      const dist = calculateDistanceMeters(lat, lon, r.latitude, r.longitude);
      const isNearby = dist <= DUPLICATE_DISTANCE_METERS;
      const isSimilarProblem = !problemType || r.problemType === problemType;
      return isNearby && isSimilarProblem;
    });

    res.status(200).json({
      success: true,
      hasPotentialDuplicate: duplicates.length > 0,
      count: duplicates.length,
      duplicates: duplicates.map(d => ({
        reportId: d.reportId,
        problemType: d.problemType,
        status: d.status,
        distanceMeters: calculateDistanceMeters(lat, lon, d.latitude, d.longitude),
        createdAt: d.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Submit a new drainage report (Citizen Report Submission)
 * Enforces camera-captured photo, GPS coordinates, location address, water level,
 * collision-proof reportId generation, AI risk scoring, and real persistence.
 */
exports.createReport = async (req, res, next) => {
  try {
    const { problemType, description, latitude, longitude, locationName, waterLevel } = req.body;

    if (!problemType || !description || !latitude || !longitude || !locationName || !waterLevel) {
      return res.status(400).json({
        success: false,
        message: 'All fields (Problem Type, Description, Latitude, Longitude, Location, Water Level) are required.'
      });
    }

    const validProblems = ['Blocked Drain', 'Waterlogging', 'Drain Overflow', 'Drainage Damage', 'Other'];
    if (!validProblems.includes(problemType)) {
      return res.status(400).json({ success: false, message: 'Invalid problem type specified.' });
    }

    const validLevels = ['Low', 'Medium', 'High'];
    if (!validLevels.includes(waterLevel)) {
      return res.status(400).json({ success: false, message: 'Invalid water level specified.' });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ success: false, message: 'Valid GPS latitude and longitude coordinates are required.' });
    }

    // Photo validation: Live camera captured image
    let photoUrl = '';
    if (req.file) {
      if (req.file.buffer) {
        const mime = req.file.mimetype || 'image/jpeg';
        photoUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
      } else {
        photoUrl = `/uploads/${req.file.filename}`;
      }
    } else if (req.body.photoUrl && (req.body.photoUrl.startsWith('/uploads/') || req.body.photoUrl.startsWith('data:image/'))) {
      photoUrl = req.body.photoUrl;
    } else {
      return res.status(400).json({
        success: false,
        message: 'A live camera photograph of the drainage problem is required.'
      });
    }

    // Generate atomic, unique collision-free Report ID
    const reportId = await generateReportId();

    // Initial Risk Assessment (Explainable rule-based prototype)
    const riskAnalysis = await calculateReportRisk({
      reportId,
      latitude: lat,
      longitude: lon,
      waterLevel,
      problemType,
      createdAt: new Date()
    });

    // Initial Priority
    const priorityAnalysis = calculatePriority({
      waterLevel,
      riskScore: riskAnalysis.riskScore,
      problemType
    });

    // Duplicate proximity check
    const windowStart = new Date(Date.now() - DUPLICATE_TIME_WINDOW_HOURS * 60 * 60 * 1000);
    const existingReports = await Report.find({
      createdAt: { $gte: windowStart },
      status: { $ne: 'REJECTED' }
    });

    const duplicateMatch = (Array.isArray(existingReports) ? existingReports : []).find(r => {
      return calculateDistanceMeters(lat, lon, r.latitude, r.longitude) <= DUPLICATE_DISTANCE_METERS;
    });

    const isDuplicate = !!duplicateMatch;
    const duplicateOf = duplicateMatch ? duplicateMatch.reportId : null;
    const duplicateNotes = duplicateMatch ? `Flagged as possible duplicate of ${duplicateMatch.reportId} within ${DUPLICATE_DISTANCE_METERS}m.` : '';

    const newReport = await Report.create({
      reportId,
      citizen: req.user._id,
      citizenName: req.user.name,
      citizenEmail: req.user.email,
      problemType,
      description: description.trim(),
      photoUrl,
      latitude: lat,
      longitude: lon,
      locationName: locationName.trim(),
      waterLevel,
      status: 'SUBMITTED',
      statusHistory: [{
        fromStatus: 'INITIAL',
        toStatus: 'SUBMITTED',
        changedBy: req.user._id,
        changedByName: req.user.name,
        changedByRole: req.user.role,
        notes: 'Complaint submitted by citizen.',
        changedAt: new Date()
      }],
      riskScore: riskAnalysis.riskScore,
      riskLevel: riskAnalysis.riskLevel,
      riskReasons: riskAnalysis.riskReasons,
      priority: priorityAnalysis.priority,
      priorityHistory: [{
        previousPriority: 'NONE',
        newPriority: priorityAnalysis.priority,
        updatedBy: req.user._id,
        updatedByName: 'System (Automated Priority)',
        reason: priorityAnalysis.reason,
        updatedAt: new Date()
      }],
      isDuplicate,
      duplicateOf,
      duplicateNotes,
      isDemo: false
    });

    // Real-time broadcast to administrator console
    try {
      const io = getSocketIO();
      if (io) {
        io.emit('report:new', newReport);
        io.emit('global:notification', {
          type: 'NEW_REPORT',
          title: `New Complaint: ${reportId}`,
          message: `${problemType} reported at ${locationName}. Severity: ${waterLevel}.`
        });
      }
    } catch (e) {}

    // Send confirmation notification to citizen
    await notifyUser(req.user._id, {
      type: 'STATUS_UPDATE',
      title: `Report Submitted: ${reportId}`,
      message: `Your drainage complaint for ${locationName} has been recorded with ID ${reportId}. Risk Level: ${riskAnalysis.riskLevel}.`,
      report: newReport._id,
      reportId: reportId
    });

    // Asynchronous cluster refresh and hotspot detection
    try {
      const riskAreas = await refreshRiskAreas();
      await detectHotspots();

      const highRiskArea = riskAreas.find(a => a.riskLevel === 'HIGH' && a.reportIds && a.reportIds.includes(reportId));
      if (highRiskArea) {
        await alertNearbyCitizens(highRiskArea);
      }
    } catch (bgErr) {
      console.warn('[Report] Risk engine notice:', bgErr.message);
    }

    console.log(`[Report Controller] New report created successfully: ${reportId} (${problemType} at ${locationName}, Risk: ${riskAnalysis.riskLevel}, Priority: ${priorityAnalysis.priority})`);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully.',
      reportId,
      report: newReport
    });
  } catch (err) {
    console.error('[Report Controller] Failed to create report:', err.message);
    next(err);
  }
};

/**
 * Get reports with filters, search, and strict role-based privacy enforcement:
 * - Municipal Admin: retrieves ALL complaints across the city
 * - Citizen: retrieves ONLY their own complaints
 */
exports.getAllReports = async (req, res, next) => {
  try {
    const { status, problemType, waterLevel, riskLevel, priority, search, page = 1, limit = 100 } = req.query;
    const query = {};

    // Privacy Protection: Citizen only sees their own complaints
    if (req.user && req.user.role === 'citizen') {
      query.citizen = req.user._id;
    }

    if (status && status !== 'ALL') query.status = status;
    if (problemType && problemType !== 'ALL') query.problemType = problemType;
    if (waterLevel && waterLevel !== 'ALL') query.waterLevel = waterLevel;
    if (riskLevel && riskLevel !== 'ALL') query.riskLevel = riskLevel;
    if (priority && priority !== 'ALL') query.priority = priority;

    if (search) {
      query.$or = [
        { reportId: { $regex: search, $options: 'i' } },
        { locationName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { citizenName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Report.countDocuments(query);
    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.status(200).json({
      success: true,
      count: reports.length,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      reports
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get reports submitted by authenticated citizen
 */
exports.getMyReports = async (req, res, next) => {
  try {
    const reports = await Report.find({ citizen: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single report details by ID or reportId
 * Enforces privacy: Only admin or the report owner citizen can view private report details.
 */
exports.getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');
    const query = mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { reportId: id }] }
      : { reportId: id };

    const report = await Report.findOne(query);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Citizen Privacy Authorization check:
    const isOwner = req.user && String(req.user._id) === String(report.citizen);
    const isAdmin = req.user && req.user.role === 'admin';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You are not authorized to access another citizen's private report."
      });
    }

    res.status(200).json({
      success: true,
      report
    });
  } catch (err) {
    next(err);
  }
};
