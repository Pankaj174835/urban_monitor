const mongoose = require('mongoose');
const { createDualModel } = require('./modelFactory');

const taskSchema = new mongoose.Schema({
  report: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true
  },
  reportId: {
    type: String,
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  teamName: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  instructions: {
    type: String,
    default: ''
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  deadline: {
    type: Date
  },
  taskStatus: {
    type: String,
    enum: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'ASSIGNED',
    index: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedByName: {
    type: String,
    default: 'Municipal Admin'
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  progressNotes: [{
    note: String,
    author: String,
    recordedAt: { type: Date, default: Date.now }
  }],
  completionEvidenceUrl: {
    type: String,
    default: ''
  },
  completionNotes: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date
  },
  isDemo: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Task = createDualModel('Task', taskSchema);

module.exports = Task;
