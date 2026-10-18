const mongoose = require('mongoose');
const { createDualModel } = require('./modelFactory');

const riskAreaSchema = new mongoose.Schema({
  areaName: {
    type: String,
    required: true,
    trim: true
  },
  centerLatitude: {
    type: Number,
    required: true
  },
  centerLongitude: {
    type: Number,
    required: true
  },
  radiusMeters: {
    type: Number,
    default: 800
  },
  reportCount: {
    type: Number,
    default: 0
  },
  unresolvedCount: {
    type: Number,
    default: 0
  },
  averageWaterLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    required: true
  },
  riskReasons: [{
    type: String
  }],
  reportIds: [{
    type: String
  }],
  lastAnalysisTimestamp: {
    type: Date,
    default: Date.now
  },
  isDemo: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

riskAreaSchema.index({ centerLatitude: 1, centerLongitude: 1 });
riskAreaSchema.index({ riskScore: -1 });

const RiskArea = createDualModel('RiskArea', riskAreaSchema);

module.exports = RiskArea;
