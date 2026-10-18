const Report = require('../models/Report');
const RiskArea = require('../models/RiskArea');
const { calculateDistanceMeters, calculateCentroid } = require('../utils/geoUtils');

/**
 * AI-Assisted Risk Analysis Prototype — Rule-Based Engine
 * Normalized, explainable risk scoring system (0 to 100)
 * Evaluates water level, problem severity, geographic report clustering,
 * recent time windows, and unresolved complaints.
 */

const CLUSTER_RADIUS_METERS = parseInt(process.env.GEO_CLUSTER_RADIUS_METERS, 10) || 800;
const TIME_WINDOW_HOURS = parseInt(process.env.RISK_TIME_WINDOW_HOURS, 10) || 72;

/**
 * Calculates the individual report risk score and reasons based on local context
 */
async function calculateReportRisk(reportData) {
  const { latitude, longitude, waterLevel, problemType, createdAt } = reportData;
  const reasons = [];
  let score = 0;

  // 1. Water Level Factor (Weight: up to 35 pts)
  if (waterLevel === 'High') {
    score += 35;
    reasons.push('Water level reported as HIGH (+35 pts). Significant potential for road waterlogging.');
  } else if (waterLevel === 'Medium') {
    score += 20;
    reasons.push('Water level reported as MEDIUM (+20 pts). Moderate drainage constraint.');
  } else {
    score += 8;
    reasons.push('Water level reported as LOW (+8 pts). Normal flow obstruction.');
  }

  // 2. Problem Severity Factor (Weight: up to 25 pts)
  switch (problemType) {
    case 'Drain Overflow':
      score += 25;
      reasons.push('Drain overflow poses acute flooding & sanitary hazard (+25 pts).');
      break;
    case 'Waterlogging':
      score += 22;
      reasons.push('Active street waterlogging obstructing vehicular and pedestrian traffic (+22 pts).');
      break;
    case 'Drainage Damage':
      score += 18;
      reasons.push('Structural drainage damage impairs discharge capacity (+18 pts).');
      break;
    case 'Blocked Drain':
      score += 15;
      reasons.push('Debris or silt blockage causing restricted drainage flow (+15 pts).');
      break;
    default:
      score += 10;
      reasons.push('General municipal drainage concern (+10 pts).');
  }

  // 3. Nearby Clustering in Recent Time Window (Weight: up to 30 pts)
  const windowStart = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000);
  
  // Find all active or recent reports
  const allRecentReports = await Report.find({
    createdAt: { $gte: windowStart },
    status: { $ne: 'REJECTED' }
  });

  const nearbyReports = (Array.isArray(allRecentReports) ? allRecentReports : []).filter(r => {
    // Skip self if already saved with same ID
    if (reportData.reportId && r.reportId === reportData.reportId) return false;
    return calculateDistanceMeters(latitude, longitude, r.latitude, r.longitude) <= CLUSTER_RADIUS_METERS;
  });

  const clusterCount = nearbyReports.length;

  if (clusterCount >= 5) {
    score += 30;
    reasons.push(`High density cluster: ${clusterCount} additional reports within ${CLUSTER_RADIUS_METERS}m in the last ${TIME_WINDOW_HOURS}h (+30 pts).`);
  } else if (clusterCount >= 2) {
    score += 20;
    reasons.push(`Moderate cluster: ${clusterCount} nearby reports detected within ${CLUSTER_RADIUS_METERS}m (+20 pts).`);
  } else if (clusterCount === 1) {
    score += 10;
    reasons.push(`Corroborating report detected nearby within ${CLUSTER_RADIUS_METERS}m (+10 pts).`);
  } else {
    reasons.push('Isolated report: No other recent complaints reported within radius.');
  }

  // 4. Unresolved complaints factor (Weight: up to 10 pts)
  const unresolvedNearby = nearbyReports.filter(r => r.status !== 'COMPLETED').length;
  if (unresolvedNearby >= 2) {
    score += 10;
    reasons.push(`Multiple unresolved drainage issues (${unresolvedNearby}) in immediate vicinity (+10 pts).`);
  }

  // Normalize final score between 5 and 100
  const normalizedScore = Math.min(100, Math.max(5, Math.round(score)));

  let riskLevel = 'LOW';
  if (normalizedScore > 60) {
    riskLevel = 'HIGH';
  } else if (normalizedScore > 30) {
    riskLevel = 'MEDIUM';
  }

  return {
    riskScore: normalizedScore,
    riskLevel,
    riskReasons: reasons,
    clusterCount
  };
}

/**
 * Re-evaluates and clusters all reports into geographic RiskAreas
 */
async function refreshRiskAreas() {
  const reports = await Report.find({ status: { $ne: 'REJECTED' } });
  const reportList = Array.isArray(reports) ? reports : [];

  if (reportList.length === 0) {
    return [];
  }

  // Simple geographic clustering within CLUSTER_RADIUS_METERS
  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < reportList.length; i++) {
    if (visited.has(i)) continue;

    const current = reportList[i];
    const currentCluster = [current];
    visited.add(i);

    for (let j = i + 1; j < reportList.length; j++) {
      if (visited.has(j)) continue;
      const other = reportList[j];
      const dist = calculateDistanceMeters(current.latitude, current.longitude, other.latitude, other.longitude);
      if (dist <= CLUSTER_RADIUS_METERS) {
        currentCluster.push(other);
        visited.add(j);
      }
    }

    clusters.push(currentCluster);
  }

  // Clear existing calculated risk areas (preserve demo flag if applicable)
  await RiskArea.deleteMany({});

  const generatedAreas = [];

  for (const cluster of clusters) {
    const centroid = calculateCentroid(cluster);
    const reportCount = cluster.length;
    const unresolvedCount = cluster.filter(r => r.status !== 'COMPLETED').length;
    
    // Average risk score
    const avgScore = Math.round(cluster.reduce((sum, r) => sum + (r.riskScore || 20), 0) / reportCount);
    
    let areaRiskLevel = 'LOW';
    if (avgScore > 60) areaRiskLevel = 'HIGH';
    else if (avgScore > 30) areaRiskLevel = 'MEDIUM';

    // Water level majority
    const waterCounts = { High: 0, Medium: 0, Low: 0 };
    cluster.forEach(r => {
      if (r.waterLevel) waterCounts[r.waterLevel] = (waterCounts[r.waterLevel] || 0) + 1;
    });
    const maxWaterLevel = Object.keys(waterCounts).reduce((a, b) => waterCounts[a] > waterCounts[b] ? a : b, 'Medium');

    const areaName = cluster[0].locationName || `Zone near ${centroid.latitude.toFixed(3)}, ${centroid.longitude.toFixed(3)}`;

    const reasons = [
      `${reportCount} citizen report(s) clustered within ${CLUSTER_RADIUS_METERS}m radius.`,
      `${unresolvedCount} active unresolved drainage issues currently recorded.`,
      `Predominant water level: ${maxWaterLevel}.`,
      `Aggregated cluster risk score: ${avgScore}/100 (${areaRiskLevel} Risk).`
    ];

    const riskAreaDoc = await RiskArea.create({
      areaName,
      centerLatitude: centroid.latitude,
      centerLongitude: centroid.longitude,
      radiusMeters: CLUSTER_RADIUS_METERS,
      reportCount,
      unresolvedCount,
      averageWaterLevel: maxWaterLevel,
      riskScore: avgScore,
      riskLevel: areaRiskLevel,
      riskReasons: reasons,
      reportIds: cluster.map(r => r.reportId),
      lastAnalysisTimestamp: new Date(),
      isDemo: cluster.some(r => r.isDemo)
    });

    generatedAreas.push(riskAreaDoc);
  }

  return generatedAreas;
}

module.exports = {
  calculateReportRisk,
  refreshRiskAreas,
  CLUSTER_RADIUS_METERS,
  TIME_WINDOW_HOURS
};
