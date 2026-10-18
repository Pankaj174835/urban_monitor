const mongoose = require('mongoose');
const { createDualModel } = require('./modelFactory');

const hotspotSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  locality: {
    type: String,
    required: true,
    trim: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  incidentCount: {
    type: Number,
    default: 1
  },
  unresolvedCount: {
    type: Number,
    default: 1
  },
  resolvedCount: {
    type: Number,
    default: 0
  },
  primaryProblemType: {
    type: String,
    default: 'Blocked Drain'
  },
  averageRiskScore: {
    type: Number,
    default: 50
  },
  currentRiskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'MEDIUM'
  },
  recurrenceTrend: {
    type: String,
    enum: ['Increasing', 'Stable', 'Decreasing', 'Periodic Monsoon'],
    default: 'Stable'
  },
  suggestedAction: {
    type: String,
    default: 'Repeated drainage problems reported. Schedule preventive inspection and desilting.'
  },
  associatedReportIds: [{
    type: String
  }],
  lastReportedAt: {
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

hotspotSchema.index({ latitude: 1, longitude: 1 });
hotspotSchema.index({ incidentCount: -1 });

const Hotspot = createDualModel('Hotspot', hotspotSchema);

module.exports = Hotspot;
