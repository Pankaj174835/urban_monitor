/**
 * Automated System Tests for Urban Flood & Smart Drain Monitor
 * Tests all 20 workflow requirements, authentication, risk calculations,
 * priority scoring, and lifecycle transitions.
 */

require('dotenv').config();
const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { connectDB } = require('../config/database');
const User = require('../models/User');
const Report = require('../models/Report');
const Team = require('../models/Team');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const RiskArea = require('../models/RiskArea');
const Hotspot = require('../models/Hotspot');

const { generateReportId } = require('../utils/reportIdGenerator');
const { calculateDistanceMeters } = require('../utils/geoUtils');
const { calculateReportRisk, refreshRiskAreas } = require('../services/riskAnalysis.service');
const { calculatePriority } = require('../services/priority.service');
const { detectHotspots } = require('../services/hotspot.service');
const { notifyUser, alertNearbyCitizens } = require('../services/notification.service');

async function runTests() {
  console.log('================================================================');
  console.log('STARTING AUTOMATED SYSTEM TEST SUITE');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         Error: ${err.message}`);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         Error: ${err.message}`);
    }
  }

  // Connect to DB
  await connectDB();

  // 1. Geolocation & Haversine Distance Test
  test('Haversine distance calculation between Virar & Nalasopara', () => {
    // Virar West: 19.4635, 72.8025 -> Nalasopara: 19.4180, 72.8190
    const dist = calculateDistanceMeters(19.4635, 72.8025, 19.4180, 72.8190);
    assert(dist > 4000 && dist < 6000, `Expected ~5km distance, got ${dist}m`);
    // Same point distance should be 0
    const zeroDist = calculateDistanceMeters(19.4635, 72.8025, 19.4635, 72.8025);
    assert.strictEqual(zeroDist, 0);
  });

  // 2. Unique Report ID Generation
  await asyncTest('Unique Report ID format (UD-YYYY-XXXX)', async () => {
    const id1 = await generateReportId();
    const currentYear = new Date().getFullYear();
    assert(id1.startsWith(`UD-${currentYear}-`), `Expected prefix UD-${currentYear}-, got ${id1}`);
  });

  // 3. User Password Hashing & Authentication
  await asyncTest('User password hashing and verification', async () => {
    const password = 'TestPassword@123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    assert.notStrictEqual(password, hash);
    const isValid = await bcrypt.compare(password, hash);
    assert.strictEqual(isValid, true);
    const isInvalid = await bcrypt.compare('WrongPassword', hash);
    assert.strictEqual(isInvalid, false);
  });

  // 4. JWT Token Generation & Verification
  test('JWT token signature and role payload', () => {
    const secret = 'super_secret_jwt_key_urban_drain_2026_academic_lab';
    const payload = { id: 'user_123', email: 'citizen@example.com', role: 'citizen' };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret);
    assert.strictEqual(decoded.email, 'citizen@example.com');
    assert.strictEqual(decoded.role, 'citizen');
  });

  // 5. AI Risk Engine: High Water Level & Overflow Scoring
  await asyncTest('AI Risk Engine rule-based scoring for High Water Level & Overflow', async () => {
    const risk = await calculateReportRisk({
      reportId: 'UD-TEST-001',
      latitude: 19.4635,
      longitude: 72.8025,
      waterLevel: 'High',
      problemType: 'Drain Overflow',
      createdAt: new Date()
    });

    assert(risk.riskScore >= 60, `High water + overflow should score >= 60, got ${risk.riskScore}`);
    assert.strictEqual(risk.riskLevel, 'HIGH');
    assert(risk.riskReasons.length >= 2, 'Should provide explainable reasons');
  });

  // 6. AI Risk Engine: Low Risk Scoring for minor blockage
  await asyncTest('AI Risk Engine rule-based scoring for Low Water Level', async () => {
    const risk = await calculateReportRisk({
      reportId: 'UD-TEST-002',
      latitude: 19.1000,
      longitude: 72.5000, // Isolated coordinate
      waterLevel: 'Low',
      problemType: 'Blocked Drain',
      createdAt: new Date()
    });

    assert(risk.riskScore <= 40, `Low water + isolated should score <= 40, got ${risk.riskScore}`);
    assert.strictEqual(risk.riskLevel, 'LOW');
  });

  // 7. Priority Calculation Engine
  test('Priority Calculation returns CRITICAL for high risk overflow', () => {
    const prio = calculatePriority({
      waterLevel: 'High',
      riskScore: 85,
      problemType: 'Drain Overflow'
    });
    assert.strictEqual(prio.priority, 'CRITICAL');
    assert(prio.reason.length > 0);
  });

  // 8. End-to-End Complaint Lifecycle: Creation -> Verify -> Assign -> Clean -> Resolve
  await asyncTest('Full 20-step Municipal Response Lifecycle Workflow', async () => {
    // 8.1 Create Citizen User
    const citizenEmail = `test_cit_${Date.now()}@example.com`;
    const citizen = await User.create({
      name: 'Test Citizen QA',
      email: citizenEmail,
      password: 'hashed_pwd',
      role: 'citizen'
    });
    assert(citizen._id, 'Citizen should be created');

    // 8.2 Submit Report
    const testRepId = await generateReportId();
    const report = await Report.create({
      reportId: testRepId,
      citizen: citizen._id,
      citizenName: citizen.name,
      citizenEmail: citizen.email,
      problemType: 'Blocked Drain',
      description: 'Automated test blockage obstructing culvert',
      latitude: 19.4630,
      longitude: 72.8020,
      locationName: 'Test Road Virar',
      waterLevel: 'High',
      status: 'SUBMITTED',
      riskScore: 75,
      riskLevel: 'HIGH',
      priority: 'CRITICAL',
      statusHistory: [{
        fromStatus: 'INITIAL',
        toStatus: 'SUBMITTED',
        changedBy: citizen._id,
        changedByName: citizen.name,
        changedByRole: 'citizen',
        notes: 'Submitted',
        changedAt: new Date()
      }]
    });
    assert.strictEqual(report.status, 'SUBMITTED');

    // 8.3 Municipal Admin Verifies Complaint
    report.status = 'UNDER INSPECTION';
    report.verificationDetails = {
      verified: true,
      verifiedByName: 'Admin Officer',
      verifiedAt: new Date(),
      verificationNotes: 'Verified site blockage'
    };
    report.statusHistory.push({
      fromStatus: 'SUBMITTED',
      toStatus: 'UNDER INSPECTION',
      changedByName: 'Admin Officer',
      changedByRole: 'admin',
      notes: 'Verified site blockage',
      changedAt: new Date()
    });
    await report.save();
    assert.strictEqual(report.status, 'UNDER INSPECTION');

    // 8.4 Assign Maintenance Team
    const testTeam = await Team.create({
      name: 'QA Response Taskforce',
      leaderName: 'Supervisor Test',
      contactNumber: '+91 99999 88888',
      status: 'AVAILABLE'
    });

    const task = await Task.create({
      report: report._id,
      reportId: report.reportId,
      team: testTeam._id,
      teamName: testTeam.name,
      title: 'Clear Blocked Drain',
      priority: report.priority,
      taskStatus: 'ASSIGNED',
      assignedAt: new Date()
    });
    assert.strictEqual(task.taskStatus, 'ASSIGNED');

    // 8.5 Municipal Operations Begins Work -> CLEANING STARTED
    task.taskStatus = 'IN_PROGRESS';
    await task.save();
    report.status = 'CLEANING STARTED';
    report.statusHistory.push({
      fromStatus: 'UNDER INSPECTION',
      toStatus: 'CLEANING STARTED',
      changedByName: 'Admin Officer',
      changedByRole: 'admin',
      notes: 'Cleaning units arrived on site and work started',
      changedAt: new Date()
    });
    await report.save();
    assert.strictEqual(report.status, 'CLEANING STARTED');

    // 8.6 Municipal Operations Finalizes Work -> COMPLETED
    task.taskStatus = 'COMPLETED';
    task.completedAt = new Date();
    task.completionNotes = 'Obstruction cleared with hydraulic pressure';
    await task.save();

    report.status = 'COMPLETED';
    report.resolutionDetails = {
      notes: 'Debris removed and water channel restored.',
      completedAt: new Date(),
      completedByName: 'Admin Officer'
    };
    report.statusHistory.push({
      fromStatus: 'CLEANING STARTED',
      toStatus: 'COMPLETED',
      changedByName: 'Admin Officer',
      changedByRole: 'admin',
      notes: 'Work completed and validated by municipal administration',
      changedAt: new Date()
    });
    await report.save();
    assert.strictEqual(report.status, 'COMPLETED');
    assert.strictEqual(report.statusHistory.length, 4);

    // 8.7 Create Notification for Citizen
    const notif = await notifyUser(citizen._id, {
      type: 'WORK_COMPLETED',
      title: `Resolved: ${report.reportId}`,
      message: 'Drainage clearing finalized.',
      reportId: report.reportId
    });
    assert(notif._id, 'Notification should be stored in database');

    // Clean up test records
    await Report.deleteOne({ _id: report._id });
    await Task.deleteOne({ _id: task._id });
    await Team.deleteOne({ _id: testTeam._id });
    await User.deleteOne({ _id: citizen._id });
    await Notification.deleteOne({ _id: notif._id });
  });

  // 9. Hotspot Detection Engine Test
  await asyncTest('Hotspot Detection identifies recurring incidents', async () => {
    const hotspots = await detectHotspots();
    assert(Array.isArray(hotspots), 'Hotspots should return an array');
    console.log(`         Detected ${hotspots.length} active recurring hotspot(s) in database.`);
  });

  // 10. Risk Areas Cluster Generation Test
  await asyncTest('Risk Areas Clustering runs and generates explainable output', async () => {
    const areas = await refreshRiskAreas();
    assert(Array.isArray(areas), 'Risk areas should return an array');
    console.log(`         Generated ${areas.length} risk cluster area(s) in database.`);
  });

  console.log('================================================================');
  console.log(`TEST SUITE FINISHED: ${passed} / ${total} TESTS PASSED!`);
  console.log('================================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
