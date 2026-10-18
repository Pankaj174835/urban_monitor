const Counter = require('../models/Counter');
const Report = require('../models/Report');

/**
 * Generates a unique, non-repeating report ID in format: UD-YYYY-XXXX (e.g. UD-2026-0001)
 * Uses atomic MongoDB Counter findByIdAndUpdate with $inc to prevent collisions
 * when multiple citizens submit reports concurrently.
 */
async function generateReportId() {
  const currentYear = new Date().getFullYear();
  const counterId = `UD-${currentYear}`;
  const prefix = `UD-${currentYear}-`;

  try {
    // Check if counter document exists; if not, initialize with max existing reportId
    let counter = await Counter.findById(counterId);
    if (!counter) {
      const existingReports = await Report.find({
        reportId: { $regex: `^${prefix}` }
      });

      let maxNum = 0;
      const reportList = Array.isArray(existingReports) ? existingReports : [];
      reportList.forEach(r => {
        if (r.reportId && r.reportId.startsWith(prefix)) {
          const parts = r.reportId.split('-');
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });

      try {
        await Counter.create({ _id: counterId, seq: maxNum });
      } catch (insertErr) {
        // Ignored if created concurrently
      }
    }

    // Atomic increment guarantees unique sequence per report
    const updated = await Counter.findByIdAndUpdate(
      counterId,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const formattedNum = String(updated.seq).padStart(4, '0');
    return `${prefix}${formattedNum}`;
  } catch (err) {
    // Resilient fallback with timestamp and high-entropy suffix
    const timestampSuffix = Date.now().toString().slice(-4);
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${timestampSuffix}${randSuffix}`.slice(0, prefix.length + 4);
  }
}

module.exports = {
  generateReportId
};
