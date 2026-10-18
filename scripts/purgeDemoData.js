require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../server/config/database');
const User = require('../server/models/User');
const Report = require('../server/models/Report');
const Team = require('../server/models/Team');
const Task = require('../server/models/Task');
const Notification = require('../server/models/Notification');
const RiskArea = require('../server/models/RiskArea');
const Hotspot = require('../server/models/Hotspot');
const { refreshRiskAreas } = require('../server/services/riskAnalysis.service');
const { detectHotspots } = require('../server/services/hotspot.service');

async function purgeConfirmedDemoData() {
  await connectDB();

  console.log('[Purge] Identifying confirmed demonstration records in MongoDB...');

  // 1. Identify confirmed demo reports
  const demoReports = await Report.find({ isDemo: true });
  console.log(`[Purge] Confirmed demo reports found: ${demoReports.length}`);
  demoReports.forEach(r => {
    console.log(`  - Demo Report: ${r.reportId} | ${r.problemType} | ${r.locationName}`);
  });

  // 2. Identify genuine reports to preserve
  const genuineReports = await Report.find({ isDemo: { $ne: true } });
  console.log(`[Purge] Genuine citizen reports found: ${genuineReports.length} (will be preserved)`);
  genuineReports.forEach(r => {
    console.log(`  - Preserved Report: ${r.reportId} | Citizen: ${r.citizenName}`);
  });

  // 3. Identify demo citizen user
  const demoCitizen = await User.findOne({ email: 'citizen@example.com' });
  if (demoCitizen) {
    console.log(`[Purge] Confirmed demo citizen user found: ${demoCitizen.email} (${demoCitizen.name})`);
    await User.deleteOne({ _id: demoCitizen._id });
    console.log(`[Purge] Removed confirmed demo citizen account.`);
  }

  // 4. Preserve genuine users
  const genuineUsers = await User.find({ email: { $ne: 'citizen@example.com' } });
  console.log(`[Purge] Preserved genuine user accounts (${genuineUsers.length}):`);
  for (const u of genuineUsers) {
    // If admin has '(Demo)' in name, clean up the name
    if (u.role === 'admin' && u.name.includes('(Demo)')) {
      u.name = 'Municipal Admin Officer';
      await u.save();
    }
    console.log(`  - Preserved User: ${u.email} | Role: ${u.role} | Name: ${u.name}`);
  }

  // 5. Remove confirmed demo reports, tasks, notifications
  const deletedReports = await Report.deleteMany({ isDemo: true });
  const deletedTasks = await Task.deleteMany({ isDemo: true });
  const deletedNotifs = await Notification.deleteMany({ isDemo: true });

  console.log(`[Purge] Deleted ${deletedReports.deletedCount} demo reports.`);
  console.log(`[Purge] Deleted ${deletedTasks.deletedCount} demo tasks.`);
  console.log(`[Purge] Deleted ${deletedNotifs.deletedCount} demo notifications.`);

  // 6. Recalculate risk areas and hotspots on actual database records
  console.log('[Purge] Recalculating Risk Areas and Hotspots based on remaining real data...');
  const newRiskAreas = await refreshRiskAreas();
  const newHotspots = await detectHotspots();
  console.log(`[Purge] Updated Risk Areas: ${newRiskAreas.length}, Hotspots: ${newHotspots.length}`);

  console.log('[Purge] Confirmed demonstration data cleanup completed successfully.');
  await mongoose.disconnect();
}

if (require.main === module) {
  purgeConfirmedDemoData().catch(err => {
    console.error('[Purge Error]', err.message);
    process.exit(1);
  });
}

module.exports = { purgeConfirmedDemoData };
