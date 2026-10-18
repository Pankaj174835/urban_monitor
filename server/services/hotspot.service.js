const Report = require('../models/Report');
const Hotspot = require('../models/Hotspot');
const { calculateDistanceMeters, calculateCentroid } = require('../utils/geoUtils');

const HOTSPOT_RADIUS_METERS = 600;
const MIN_INCIDENTS_FOR_HOTSPOT = 2;

/**
 * Evaluates all reports and detects recurring drainage hotspots
 */
async function detectHotspots() {
  const allReports = await Report.find({ status: { $ne: 'REJECTED' } });
  const reports = Array.isArray(allReports) ? allReports : [];

  if (reports.length < MIN_INCIDENTS_FOR_HOTSPOT) {
    return [];
  }

  // Geographic clustering
  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < reports.length; i++) {
    if (visited.has(i)) continue;

    const cluster = [reports[i]];
    visited.add(i);

    for (let j = i + 1; j < reports.length; j++) {
      if (visited.has(j)) continue;
      const dist = calculateDistanceMeters(
        reports[i].latitude, reports[i].longitude,
        reports[j].latitude, reports[j].longitude
      );
      if (dist <= HOTSPOT_RADIUS_METERS) {
        cluster.push(reports[j]);
        visited.add(j);
      }
    }

    // Only qualify as recurring hotspot if incident count >= MIN_INCIDENTS_FOR_HOTSPOT
    if (cluster.length >= MIN_INCIDENTS_FOR_HOTSPOT) {
      clusters.push(cluster);
    }
  }

  // Refresh Hotspot collection
  await Hotspot.deleteMany({});

  const generatedHotspots = [];

  for (const cluster of clusters) {
    const centroid = calculateCentroid(cluster);
    const incidentCount = cluster.length;
    const unresolvedCount = cluster.filter(r => r.status !== 'COMPLETED').length;
    const resolvedCount = cluster.filter(r => r.status === 'COMPLETED').length;

    // Determine primary problem type
    const problemCounts = {};
    cluster.forEach(r => {
      problemCounts[r.problemType] = (problemCounts[r.problemType] || 0) + 1;
    });
    const primaryProblem = Object.keys(problemCounts).reduce((a, b) => 
      problemCounts[a] > problemCounts[b] ? a : b, 'Blocked Drain'
    );

    // Calculate average risk score
    const avgScore = Math.round(cluster.reduce((sum, r) => sum + (r.riskScore || 20), 0) / incidentCount);
    let currentRiskLevel = 'LOW';
    if (avgScore > 60) currentRiskLevel = 'HIGH';
    else if (avgScore > 30) currentRiskLevel = 'MEDIUM';

    // Recurrence trend calculation
    let recurrenceTrend = 'Stable';
    if (unresolvedCount > resolvedCount && incidentCount >= 3) {
      recurrenceTrend = 'Increasing';
    } else if (resolvedCount > unresolvedCount && unresolvedCount === 0) {
      recurrenceTrend = 'Decreasing';
    } else {
      recurrenceTrend = 'Periodic Monsoon';
    }

    const locality = cluster[0].locationName || `Sector at ${centroid.latitude.toFixed(3)}, ${centroid.longitude.toFixed(3)}`;
    const name = `Recurring Hotspot: ${locality}`;

    let suggestedAction = 'Schedule periodic drain silt inspection and culvert clearance.';
    if (currentRiskLevel === 'HIGH' || unresolvedCount >= 3) {
      suggestedAction = 'URGENT: Deploy civil engineering review for pipe widening and immediate emergency suction clearing.';
    } else if (primaryProblem === 'Drainage Damage') {
      suggestedAction = 'Structural repair required: Inspect manhole chambers and cracked drain lining.';
    }

    // Latest reported date
    const sortedDates = cluster.map(r => new Date(r.createdAt)).sort((a, b) => b - a);
    const lastReportedAt = sortedDates[0] || new Date();

    const hotspotDoc = await Hotspot.create({
      name,
      locality,
      latitude: centroid.latitude,
      longitude: centroid.longitude,
      incidentCount,
      unresolvedCount,
      resolvedCount,
      primaryProblemType: primaryProblem,
      averageRiskScore: avgScore,
      currentRiskLevel,
      recurrenceTrend,
      suggestedAction,
      associatedReportIds: cluster.map(r => r.reportId),
      lastReportedAt,
      isDemo: cluster.some(r => r.isDemo)
    });

    generatedHotspots.push(hotspotDoc);
  }

  return generatedHotspots;
}

module.exports = {
  detectHotspots,
  HOTSPOT_RADIUS_METERS
};
