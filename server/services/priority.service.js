/**
 * Priority Management Service
 * Decision aid for municipal maintenance scheduling.
 * Prioritizes complaints into LOW, MEDIUM, HIGH, CRITICAL.
 */

function calculatePriority(report) {
  let score = 0;
  const reasons = [];

  // Water level
  if (report.waterLevel === 'High') {
    score += 40;
    reasons.push('High water level reported: immediate risk of overflow/inundation (+40)');
  } else if (report.waterLevel === 'Medium') {
    score += 20;
    reasons.push('Moderate water level (+20)');
  } else {
    score += 5;
    reasons.push('Low water level (+5)');
  }

  // Risk Score influence
  if (report.riskScore >= 70) {
    score += 35;
    reasons.push(`High risk score context (${report.riskScore}/100) (+35)`);
  } else if (report.riskScore >= 40) {
    score += 20;
    reasons.push(`Medium risk score context (${report.riskScore}/100) (+20)`);
  } else {
    score += 5;
  }

  // Problem Type
  if (report.problemType === 'Drain Overflow' || report.problemType === 'Waterlogging') {
    score += 20;
    reasons.push(`Critical problem type (${report.problemType}) affecting public thoroughfares (+20)`);
  } else if (report.problemType === 'Drainage Damage') {
    score += 15;
    reasons.push('Structural damage requiring engineering maintenance (+15)');
  }

  // Priority classification
  let priority = 'LOW';
  if (score >= 75) {
    priority = 'CRITICAL';
  } else if (score >= 50) {
    priority = 'HIGH';
  } else if (score >= 25) {
    priority = 'MEDIUM';
  }

  return {
    priority,
    score,
    reason: reasons.join('; ')
  };
}

module.exports = {
  calculatePriority
};
