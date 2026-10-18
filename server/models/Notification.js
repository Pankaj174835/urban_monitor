const mongoose = require('mongoose');
const { createDualModel } = require('./modelFactory');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['STATUS_UPDATE', 'HIGH_RISK_ALERT', 'TASK_ASSIGNED', 'WORK_COMPLETED', 'SYSTEM_ANNOUNCEMENT'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  report: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  },
  reportId: {
    type: String,
    default: ''
  },
  riskArea: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RiskArea'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isDemo: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = createDualModel('Notification', notificationSchema);

module.exports = Notification;
