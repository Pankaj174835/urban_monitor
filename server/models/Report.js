const mongoose = require('mongoose');
const { createDualModel } = require('./modelFactory');

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  citizen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  citizenName: {
    type: String,
    required: true
  },
  citizenEmail: {
    type: String
  },
  problemType: {
    type: String,
    required: [true, 'Problem type is required'],
    enum: ['Blocked Drain', 'Waterlogging', 'Drain Overflow', 'Drainage Damage', 'Other']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: 1500
  },
  photoUrl: {
    type: String,
    default: '/assets/images/placeholder-drain.svg'
  },
  latitude: {
    type: Number,
    required: [true, 'Latitude is required']
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required']
  },
  locationName: {
    type: String,
    required: [true, 'Location name or landmark is required'],
    trim: true
  },
  waterLevel: {
    type: String,
    required: [true, 'Water level is required'],
    enum: ['Low', 'Medium', 'High']
  },
  status: {
    type: String,
    enum: ['SUBMITTED', 'UNDER INSPECTION', 'CLEANING STARTED', 'COMPLETED', 'REJECTED'],
    default: 'SUBMITTED',
    index: true
  },
  statusHistory: [{
    fromStatus: String,
    toStatus: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: String,
    changedByRole: String,
    notes: String,
    changedAt: { type: Date, default: Date.now }
  }],
  riskScore: {
    type: Number,
    default: 15,
    min: 0,
    max: 100
  },
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'LOW',
    index: true
  },
  riskReasons: [{
    type: String
  }],
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW',
    index: true
  },
  priorityOverrideReason: {
    type: String,
    default: ''
  },
  priorityHistory: [{
    previousPriority: String,
    newPriority: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: String,
    reason: String,
    updatedAt: { type: Date, default: Date.now }
  }],
  assignedTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  assignedTeamName: {
    type: String,
    default: ''
  },
  verificationDetails: {
    verified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedByName: String,
    verifiedAt: Date,
    verificationNotes: String
  },
  resolutionDetails: {
    notes: String,
    completionEvidenceUrl: String,
    completedAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedByName: String
  },
  adminNotes: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorName: String,
    note: String,
    createdAt: { type: Date, default: Date.now }
  }],
  isDuplicate: {
    type: Boolean,
    default: false
  },
  duplicateOf: {
    type: String,
    default: null
  },
  duplicateNotes: {
    type: String,
    default: ''
  },
  isDemo: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

reportSchema.index({ latitude: 1, longitude: 1 });
reportSchema.index({ createdAt: -1 });

const Report = createDualModel('Report', reportSchema);

module.exports = Report;
