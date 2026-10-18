const Report = require('../models/Report');
const Team = require('../models/Team');
const Task = require('../models/Task');
const RiskArea = require('../models/RiskArea');
const Hotspot = require('../models/Hotspot');
const mongoose = require('mongoose');
const { notifyUser } = require('../services/notification.service');
const { refreshRiskAreas } = require('../services/riskAnalysis.service');
const { detectHotspots } = require('../services/hotspot.service');

function getReportQuery(id) {
  return mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { reportId: id }] } : { reportId: id };
}

/**
 * Get operations overview counts for Municipal Admin Dashboard
 */
exports.getOverview = async (req, res, next) => {
  try {
    const totalReports = await Report.countDocuments();
    const submitted = await Report.countDocuments({ status: 'SUBMITTED' });
    const underInspection = await Report.countDocuments({ status: 'UNDER INSPECTION' });
    const cleaningStarted = await Report.countDocuments({ status: 'CLEANING STARTED' });
    const completed = await Report.countDocuments({ status: 'COMPLETED' });
    const rejected = await Report.countDocuments({ status: 'REJECTED' });

    const highRiskReports = await Report.countDocuments({ riskLevel: 'HIGH', status: { $ne: 'COMPLETED' } });
    const criticalPriorityReports = await Report.countDocuments({ priority: 'CRITICAL', status: { $ne: 'COMPLETED' } });
    
    const highRiskAreasCount = await RiskArea.countDocuments({ riskLevel: 'HIGH' });
    const hotspotsCount = await Hotspot.countDocuments();
    const activeTeamsCount = await Team.countDocuments({ status: { $ne: 'OFF_DUTY' } });

    res.status(200).json({
      success: true,
      stats: {
        totalReports,
        submitted,
        underInspection,
        cleaningStarted,
        completed,
        rejected,
        highRiskReports,
        criticalPriorityReports,
        highRiskAreasCount,
        hotspotsCount,
        activeTeamsCount
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify or Reject a submitted complaint
 */
exports.verifyReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'VERIFY' or 'REJECT'

    const report = await Report.findOne(getReportQuery(id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const prevStatus = report.status;
    let newStatus = report.status;

    if (action === 'VERIFY' || action === 'VERIFIED') {
      newStatus = 'UNDER INSPECTION';
      report.verificationDetails = {
        verified: true,
        verifiedBy: req.user._id,
        verifiedByName: req.user.name,
        verifiedAt: new Date(),
        verificationNotes: notes || 'Verified by municipal authority.'
      };
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED';
      report.verificationDetails = {
        verified: false,
        verifiedBy: req.user._id,
        verifiedByName: req.user.name,
        verifiedAt: new Date(),
        verificationNotes: notes || 'Complaint rejected after verification.'
      };
    } else {
      return res.status(400).json({ success: false, message: 'Invalid verification action.' });
    }

    report.status = newStatus;
    report.statusHistory.push({
      fromStatus: prevStatus,
      toStatus: newStatus,
      changedBy: req.user._id,
      changedByName: req.user.name,
      changedByRole: req.user.role,
      notes: notes || `Report verification updated to ${newStatus}.`,
      changedAt: new Date()
    });

    await report.save();

    // Notify citizen
    await notifyUser(report.citizen, {
      type: 'STATUS_UPDATE',
      title: `Complaint ${report.reportId} Verified: ${newStatus}`,
      message: `Your report status is now [${newStatus}]. Note: ${notes || 'Under review by municipal authorities.'}`,
      report: report._id,
      reportId: report.reportId
    });

    res.status(200).json({
      success: true,
      message: `Report ${action.toLowerCase()}ed successfully.`,
      report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Override Complaint Priority
 */
exports.setPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { priority, reason } = req.body;

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority level.' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'A documented reason is required to override priority.' });
    }

    const report = await Report.findOne(getReportQuery(id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const prevPriority = report.priority;
    report.priority = priority;
    report.priorityOverrideReason = reason.trim();
    report.priorityHistory.push({
      previousPriority: prevPriority,
      newPriority: priority,
      updatedBy: req.user._id,
      updatedByName: req.user.name,
      reason: reason.trim(),
      updatedAt: new Date()
    });

    await report.save();

    res.status(200).json({
      success: true,
      message: `Priority updated to ${priority}.`,
      report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Assign Cleaning / Maintenance Team
 */
exports.assignTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { teamId, deadline, instructions } = req.body;

    if (!teamId) {
      return res.status(400).json({ success: false, message: 'Team ID is required.' });
    }

    const report = await Report.findOne(getReportQuery(id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Maintenance team not found.' });
    }

    report.assignedTeam = team._id;
    report.assignedTeamName = team.name;

    // Advance status to UNDER INSPECTION if currently SUBMITTED
    if (report.status === 'SUBMITTED') {
      const prev = report.status;
      report.status = 'UNDER INSPECTION';
      report.statusHistory.push({
        fromStatus: prev,
        toStatus: 'UNDER INSPECTION',
        changedBy: req.user._id,
        changedByName: req.user.name,
        changedByRole: req.user.role,
        notes: `Assigned to ${team.name}.`,
        changedAt: new Date()
      });
    }

    await report.save();

    // Create Task record
    const task = await Task.create({
      report: report._id,
      reportId: report.reportId,
      team: team._id,
      teamName: team.name,
      title: `Maintenance: ${report.problemType} at ${report.locationName}`,
      instructions: instructions || 'Inspect drain obstruction, remove blockages and clear silt.',
      priority: report.priority,
      deadline: deadline ? new Date(deadline) : new Date(Date.now() + 48 * 60 * 60 * 1000),
      taskStatus: 'ASSIGNED',
      assignedBy: req.user._id,
      assignedByName: req.user.name,
      assignedAt: new Date()
    });

    // Increment team active tasks count
    team.activeTasksCount = (team.activeTasksCount || 0) + 1;
    team.status = 'ON_DUTY';
    await team.save();

    // Notify citizen
    await notifyUser(report.citizen, {
      type: 'TASK_ASSIGNED',
      title: `Team Assigned for ${report.reportId}`,
      message: `Municipal Maintenance Team [${team.name}] has been dispatched to inspect and resolve your complaint.`,
      report: report._id,
      reportId: report.reportId
    });

    res.status(200).json({
      success: true,
      message: `Assigned to ${team.name} successfully.`,
      task,
      report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update complaint lifecycle status
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, completionEvidenceUrl } = req.body;

    const allowedStatuses = ['SUBMITTED', 'UNDER INSPECTION', 'CLEANING STARTED', 'COMPLETED', 'REJECTED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status transition.' });
    }

    const report = await Report.findOne(getReportQuery(id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const prevStatus = report.status;
    report.status = status;

    if (status === 'CLEANING STARTED') {
      await Task.updateMany(
        { report: report._id },
        { taskStatus: 'IN_PROGRESS' }
      );
    } else if (status === 'COMPLETED') {
      report.resolutionDetails = {
        notes: notes || 'Drain cleared and flow restored.',
        completionEvidenceUrl: completionEvidenceUrl || report.photoUrl,
        completedAt: new Date(),
        completedBy: req.user._id,
        completedByName: req.user.name
      };

      // Also update linked tasks to COMPLETED
      await Task.updateMany(
        { report: report._id },
        { taskStatus: 'COMPLETED', completedAt: new Date(), completionNotes: notes || 'Completed' }
      );
    }

    if (!report.statusHistory) report.statusHistory = [];
    report.statusHistory.push({
      fromStatus: prevStatus,
      toStatus: status,
      changedBy: req.user._id,
      changedByName: req.user.name,
      changedByRole: req.user.role,
      notes: notes || `Status updated from ${prevStatus} to ${status}.`,
      changedAt: new Date()
    });

    await report.save();

    // Refresh hotspots and risk areas
    await refreshRiskAreas();
    await detectHotspots();

    // Notify citizen
    await notifyUser(report.citizen, {
      type: 'STATUS_UPDATE',
      title: `Status Updated: ${report.reportId}`,
      message: `Your report status is now marked as [${status}]. ${notes ? `Note: ${notes}` : ''}`,
      report: report._id,
      reportId: report.reportId
    });

    // Realtime broadcast
    try {
      const { getSocketIO } = require('../services/notification.service');
      const io = getSocketIO();
      if (io) {
        io.emit(`report:status:${report.reportId}`, {
          reportId: report.reportId,
          status,
          notes
        });
        io.emit('report:updated', report);
      }
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}.`,
      report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark a report as duplicate
 */
exports.markDuplicate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { duplicateOf, notes } = req.body;

    const report = await Report.findOne(getReportQuery(id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.isDuplicate = true;
    report.duplicateOf = duplicateOf || report.duplicateOf;
    report.duplicateNotes = notes || `Marked as duplicate of ${duplicateOf} by ${req.user.name}`;
    await report.save();

    res.status(200).json({
      success: true,
      message: 'Report marked as duplicate.',
      report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add internal admin note
 */
exports.addAdminNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Note content is required.' });
    }

    const report = await Report.findOne(getReportQuery(id));
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.adminNotes.push({
      author: req.user._id,
      authorName: req.user.name,
      note: note.trim(),
      createdAt: new Date()
    });

    await report.save();

    res.status(200).json({
      success: true,
      message: 'Admin note added.',
      adminNotes: report.adminNotes
    });
  } catch (err) {
    next(err);
  }
};
