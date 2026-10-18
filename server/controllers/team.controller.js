const Team = require('../models/Team');

/**
 * Get all maintenance teams
 */
exports.getAllTeams = async (req, res, next) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: teams.length,
      teams
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new maintenance team (Admin)
 */
exports.createTeam = async (req, res, next) => {
  try {
    const { name, leaderName, contactNumber, assignedArea, memberCount } = req.body;

    if (!name || !leaderName) {
      return res.status(400).json({ success: false, message: 'Team name and leader name are required.' });
    }

    const team = await Team.create({
      name: name.trim(),
      leaderName: leaderName.trim(),
      contactNumber: contactNumber || '+91 98200 12345',
      assignedArea: assignedArea || 'Virar-Nalasopara-Vasai Zone',
      memberCount: parseInt(memberCount, 10) || 5,
      status: 'AVAILABLE'
    });

    res.status(201).json({
      success: true,
      message: 'Maintenance team created successfully.',
      team
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update team details
 */
exports.updateTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const team = await Team.findByIdAndUpdate(id, req.body, { new: true });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Team updated successfully.',
      team
    });
  } catch (err) {
    next(err);
  }
};
