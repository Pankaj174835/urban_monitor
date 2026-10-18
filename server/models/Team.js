const mongoose = require('mongoose');
const { createDualModel } = require('./modelFactory');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true
  },
  leaderName: {
    type: String,
    required: true,
    trim: true
  },
  contactNumber: {
    type: String,
    default: '+91 98200 12345'
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'ON_DUTY', 'OFF_DUTY'],
    default: 'AVAILABLE'
  },
  assignedArea: {
    type: String,
    default: 'Virar-Nalasopara-Vasai Zone'
  },
  memberCount: {
    type: Number,
    default: 5
  },
  activeTasksCount: {
    type: Number,
    default: 0
  },
  completedTasksCount: {
    type: Number,
    default: 0
  },
  isDemo: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Team = createDualModel('Team', teamSchema);

module.exports = Team;
