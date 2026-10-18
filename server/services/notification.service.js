const Notification = require('../models/Notification');
const User = require('../models/User');
const { calculateDistanceMeters } = require('../utils/geoUtils');

let ioInstance = null;

function setSocketIO(io) {
  ioInstance = io;
}

/**
 * Creates and persists a notification for a specific user and emits via Socket.IO
 */
async function notifyUser(userId, notificationData) {
  try {
    const notification = await Notification.create({
      recipient: userId,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      report: notificationData.report || null,
      reportId: notificationData.reportId || '',
      riskArea: notificationData.riskArea || null,
      isDemo: notificationData.isDemo || false
    });

    if (ioInstance) {
      ioInstance.emit(`notification:${userId}`, notification);
      ioInstance.emit('global:notification', notification);
    }

    return notification;
  } catch (err) {
    console.error('[NotificationService] Error notifying user:', err.message);
  }
}

/**
 * Alerts nearby citizens when a high-risk area or emergency situation is identified
 */
async function alertNearbyCitizens(riskArea) {
  try {
    const users = await User.find({ role: 'citizen' });
    const userList = Array.isArray(users) ? users : [];

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    for (const user of userList) {
      // Check preferences
      const prefs = user.alertPreferences || {};
      if (prefs.enabled === false) continue;

      const userLat = prefs.preferredLocation?.latitude || 19.4630;
      const userLon = prefs.preferredLocation?.longitude || 72.8020;
      const alertRadius = prefs.radiusMeters || 3000;

      const dist = calculateDistanceMeters(userLat, userLon, riskArea.centerLatitude, riskArea.centerLongitude);

      if (dist <= alertRadius) {
        // Cooldown check: avoid duplicate alert for same user and risk area within 2 hours
        const recentNotif = await Notification.findOne({
          recipient: user._id,
          type: 'HIGH_RISK_ALERT',
          title: { $regex: riskArea.areaName },
          createdAt: { $gte: twoHoursAgo }
        });

        if (!recentNotif) {
          await notifyUser(user._id, {
            type: 'HIGH_RISK_ALERT',
            title: `High-Risk Drainage Alert: ${riskArea.areaName}`,
            message: `A high concentration of drainage and waterlogging reports has been detected within ${Math.round(dist)}m of your registered area. Risk Level: HIGH (${riskArea.riskScore}/100). Take precautions.`,
            riskArea: riskArea._id
          });
        }
      }
    }
  } catch (err) {
    console.error('[NotificationService] Error alerting nearby citizens:', err.message);
  }
}

module.exports = {
  setSocketIO,
  getSocketIO: () => ioInstance,
  notifyUser,
  alertNearbyCitizens
};
