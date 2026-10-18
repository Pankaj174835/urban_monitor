const Task = require('../models/Task');
const Report = require('../models/Report');
const Team = require('../models/Team');
const { notifyUser } = require('../services/notification.service');
const { refreshRiskAreas } = require('../services/riskAnalysis.service');
const { detectHotspots } = require('../services/hotspot.service');

/**
 * List maintenance tasks
 */
exports.getAllTasks = async (req, res, next) => {
  try {
    const { status, priority, teamId } = req.query;
    const query = {};

    if (status && status !== 'ALL') query.taskStatus = status;
    if (priority && priority !== 'ALL') query.priority = priority;
    if (teamId) query.team = teamId;

    const tasks = await Task.find(query).sort({ deadline: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single task details
 */
exports.getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const report = await Report.findById(task.report);

    res.status(200).json({
      success: true,
      task,
      report
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update Task Status and propagate to complaint lifecycle
 */
exports.updateTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { taskStatus, progressNote, completionEvidenceUrl, completionNotes } = req.body;

    const allowed = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(taskStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid task status.' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const prevTaskStatus = task.taskStatus;
    task.taskStatus = taskStatus;

    if (!task.progressNotes) task.progressNotes = [];
    if (progressNote && progressNote.trim()) {
      task.progressNotes.push({
        note: progressNote.trim(),
        author: req.user.name,
        recordedAt: new Date()
      });
    }

    const report = await Report.findById(task.report);

    if (taskStatus === 'IN_PROGRESS') {
      if (report && report.status !== 'CLEANING STARTED') {
        const prevRepStatus = report.status;
        report.status = 'CLEANING STARTED';
        if (!report.statusHistory) report.statusHistory = [];
        report.statusHistory.push({
          fromStatus: prevRepStatus,
          toStatus: 'CLEANING STARTED',
          changedBy: req.user._id,
          changedByName: req.user.name,
          changedByRole: req.user.role,
          notes: progressNote || `Maintenance work begun by ${task.teamName}.`,
          changedAt: new Date()
        });
        await report.save();

        // Notify citizen
        await notifyUser(report.citizen, {
          type: 'STATUS_UPDATE',
          title: `Cleaning Started: ${report.reportId}`,
          message: `Maintenance team has arrived on site at ${report.locationName} and started cleaning.`,
          report: report._id,
          reportId: report.reportId
        });
      }
    } else if (taskStatus === 'COMPLETED') {
      task.completedAt = new Date();
      task.completionNotes = completionNotes || progressNote || 'Cleaning work verified and finalized.';
      if (completionEvidenceUrl) {
        task.completionEvidenceUrl = completionEvidenceUrl;
      }

      if (report) {
        const prevRepStatus = report.status;
        report.status = 'COMPLETED';
        report.resolutionDetails = {
          notes: completionNotes || 'Drain cleared, obstructions removed, and normal flow restored.',
          completionEvidenceUrl: completionEvidenceUrl || report.photoUrl,
          completedAt: new Date(),
          completedBy: req.user._id,
          completedByName: req.user.name
        };
        if (!report.statusHistory) report.statusHistory = [];
        report.statusHistory.push({
          fromStatus: prevRepStatus,
          toStatus: 'COMPLETED',
          changedBy: req.user._id,
          changedByName: req.user.name,
          changedByRole: req.user.role,
          notes: completionNotes || 'Cleaning operations completed successfully.',
          changedAt: new Date()
        });
        await report.save();

        // Notify citizen
        await notifyUser(report.citizen, {
          type: 'WORK_COMPLETED',
          title: `Drainage Issue Resolved: ${report.reportId}`,
          message: `The maintenance team has resolved the drainage issue at ${report.locationName}. Thank you for reporting!`,
          report: report._id,
          reportId: report.reportId
        });
      }

      // Decrement team active tasks, increment completed
      const team = await Team.findById(task.team);
      if (team) {
        team.activeTasksCount = Math.max(0, (team.activeTasksCount || 1) - 1);
        team.completedTasksCount = (team.completedTasksCount || 0) + 1;
        if (team.activeTasksCount === 0) team.status = 'AVAILABLE';
        await team.save();
      }

      // Re-run risk analysis and hotspot detection
      await refreshRiskAreas();
      await detectHotspots();
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: `Task updated to ${taskStatus}.`,
      task,
      report
    });
  } catch (err) {
    next(err);
  }
};
