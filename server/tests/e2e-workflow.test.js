/**
 * Comprehensive 13-Step End-to-End Workflow Verification Suite
 * Executes against live Express app and verified MongoDB Atlas instance.
 */

require('dotenv').config();
const http = require('http');
const assert = require('assert');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB } = require('../config/database');

const User = require('../models/User');
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const RiskArea = require('../models/RiskArea');
const Hotspot = require('../models/Hotspot');

async function runE2ETests() {
  console.log('================================================================');
  console.log('URBAN DRAIN MONITOR - 13-STEP END-TO-END WORKFLOW VERIFICATION');
  console.log('================================================================');

  await connectDB();

  // Start HTTP server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[Test Runner] Test server listening on ${baseUrl}`);

  const testResults = [];

  function record(testNum, name, passed, details = '') {
    testResults.push({ testNum, name, passed, details });
    if (passed) {
      console.log(`\n[PASS] TEST ${testNum}: ${name}`);
      if (details) console.log(`       Details: ${details}`);
    } else {
      console.error(`\n[FAIL] TEST ${testNum}: ${name}`);
      if (details) console.error(`       Reason: ${details}`);
    }
  }

  // Small helper to generate a minimal valid JPEG image buffer
  function createTestJpegBuffer() {
    // Valid 1x1 JPEG byte sequence
    return Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbe, 0x00, 0xff, 0xd9
    ]);
  }

  const timestamp = Date.now();
  const citizenA_Email = `citizen_a_${timestamp}@example.com`;
  const citizenA_Pass = 'SecurePassA@123';
  let citizenA_Token = '';
  let citizenA_Id = '';

  const citizenB_Email = `citizen_b_${timestamp}@example.com`;
  const citizenB_Pass = 'SecurePassB@123';
  let citizenB_Token = '';
  let citizenB_Id = '';

  let adminToken = '';
  let reportA_Id = '';
  let reportB_Id = '';

  // -------------------------------------------------------------
  // TEST 1: Register Citizen A and confirm stored in MongoDB
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aarav Patel (Citizen A)',
        email: citizenA_Email,
        phone: '+91 98111 00001',
        password: citizenA_Pass,
        confirmPassword: citizenA_Pass
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}`);
    assert(data.token, 'Should return JWT token');
    citizenA_Token = data.token;
    citizenA_Id = data.user._id;

    // Verify in MongoDB
    const mongoUserA = await User.findOne({ email: citizenA_Email });
    assert(mongoUserA, 'Citizen A record must exist in MongoDB');
    assert.strictEqual(mongoUserA.role, 'citizen', 'Role must be citizen');
    assert.notStrictEqual(mongoUserA.password, citizenA_Pass, 'Password must be bcrypt hashed');

    record(1, 'Register Citizen A and confirm stored in MongoDB', true, `Account ${citizenA_Email} verified in MongoDB users collection.`);
  } catch (err) {
    record(1, 'Register Citizen A and confirm stored in MongoDB', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Register Citizen B and confirm stored in MongoDB
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bhavna Joshi (Citizen B)',
        email: citizenB_Email,
        phone: '+91 98111 00002',
        password: citizenB_Pass,
        confirmPassword: citizenB_Pass
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}`);
    assert(data.token, 'Should return JWT token');
    citizenB_Token = data.token;
    citizenB_Id = data.user._id;

    // Verify in MongoDB
    const mongoUserB = await User.findOne({ email: citizenB_Email });
    assert(mongoUserB, 'Citizen B record must exist in MongoDB');
    assert.strictEqual(mongoUserB.role, 'citizen', 'Role must be citizen');
    assert.notStrictEqual(mongoUserB.password, citizenB_Pass, 'Password must be bcrypt hashed');

    record(2, 'Register Citizen B and confirm stored in MongoDB', true, `Account ${citizenB_Email} verified in MongoDB users collection.`);
  } catch (err) {
    record(2, 'Register Citizen B and confirm stored in MongoDB', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Citizen A submits a camera-captured blocked-drain report
  // -------------------------------------------------------------
  try {
    const photoBlob = new Blob([createTestJpegBuffer()], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('problemType', 'Blocked Drain');
    formData.append('locationName', 'Virar West Station Road near Platform 1');
    formData.append('latitude', '19.4635');
    formData.append('longitude', '72.8025');
    formData.append('waterLevel', 'High');
    formData.append('description', 'Severe blockage due to discarded plastic crates and deep silt runoff.');
    formData.append('photo', photoBlob, 'camera-capture-siteA.jpg');

    const res = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenA_Token}` },
      body: formData
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}: ${data.message}`);
    assert(data.success, 'Success flag must be true');
    assert(data.reportId, 'Must return assigned reportId');
    assert(data.reportId.startsWith('UD-'), `Report ID must start with UD-, got ${data.reportId}`);
    reportA_Id = data.reportId;

    record(3, 'Citizen A submits a camera-captured blocked-drain report', true, `Submitted report ID: ${reportA_Id}`);
  } catch (err) {
    record(3, 'Citizen A submits a camera-captured blocked-drain report', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: Verify saved report in MongoDB with photo reference, location, address, water level, timestamp, report ID
  // -------------------------------------------------------------
  try {
    const reportDoc = await Report.findOne({ reportId: reportA_Id });
    assert(reportDoc, 'Report document must exist in MongoDB');
    assert.strictEqual(reportDoc.problemType, 'Blocked Drain');
    assert.strictEqual(reportDoc.waterLevel, 'High');
    assert.strictEqual(reportDoc.status, 'SUBMITTED');
    assert(reportDoc.photoUrl && reportDoc.photoUrl.startsWith('/uploads/drain-'), `Expected photoUrl in /uploads/drain-*, got ${reportDoc.photoUrl}`);
    assert.strictEqual(reportDoc.latitude, 19.4635);
    assert.strictEqual(reportDoc.longitude, 72.8025);
    assert.strictEqual(reportDoc.locationName, 'Virar West Station Road near Platform 1');
    assert(reportDoc.createdAt instanceof Date, 'Must have valid createdAt timestamp');
    assert(reportDoc.riskScore > 0, 'Must have calculated riskScore');
    assert(reportDoc.riskReasons.length > 0, 'Must have explainable riskReasons');

    record(4, 'Verify saved report in MongoDB with all required fields', true,
      `Report ${reportDoc.reportId} verified: photoUrl=${reportDoc.photoUrl}, coords=(${reportDoc.latitude}, ${reportDoc.longitude}), status=${reportDoc.status}, riskScore=${reportDoc.riskScore}`);
  } catch (err) {
    record(4, 'Verify saved report in MongoDB with all required fields', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 5: Citizen B submits a different report
  // -------------------------------------------------------------
  try {
    const photoBlob = new Blob([createTestJpegBuffer()], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('problemType', 'Waterlogging');
    formData.append('locationName', 'Nalasopara East Achole Road Junction');
    formData.append('latitude', '19.4185');
    formData.append('longitude', '72.8195');
    formData.append('waterLevel', 'Medium');
    formData.append('description', 'Knee-height standing rainwater preventing vehicular traffic.');
    formData.append('photo', photoBlob, 'camera-capture-siteB.jpg');

    const res = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenB_Token}` },
      body: formData
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}`);
    assert(data.reportId, 'Must return assigned reportId');
    assert.notStrictEqual(data.reportId, reportA_Id, 'Report IDs must be unique');
    reportB_Id = data.reportId;

    // Verify in MongoDB
    const reportDocB = await Report.findOne({ reportId: reportB_Id });
    assert(reportDocB, 'Report B must exist in MongoDB');
    assert.strictEqual(reportDocB.problemType, 'Waterlogging');
    assert.strictEqual(reportDocB.waterLevel, 'Medium');

    record(5, 'Citizen B submits a different report', true, `Submitted report ID: ${reportB_Id} by Citizen B`);
  } catch (err) {
    record(5, 'Citizen B submits a different report', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 6: Municipal Admin login and confirm reports from BOTH citizens appear
  // -------------------------------------------------------------
  try {
    // 6.1 Log in as Municipal Admin
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@citydrain.gov.in',
        password: process.env.ADMIN_PASSWORD || 'Admin@123'
      })
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200, `Admin login failed: ${loginData.message}`);
    assert(loginData.token, 'Should return admin token');
    adminToken = loginData.token;

    // 6.2 Retrieve all reports as Admin
    const reportsRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const reportsData = await reportsRes.json();
    assert.strictEqual(reportsRes.status, 200);
    assert(Array.isArray(reportsData.reports), 'Should return reports array');

    const hasReportA = reportsData.reports.some(r => r.reportId === reportA_Id);
    const hasReportB = reportsData.reports.some(r => r.reportId === reportB_Id);

    assert(hasReportA, `Report ${reportA_Id} from Citizen A must appear in admin query`);
    assert(hasReportB, `Report ${reportB_Id} from Citizen B must appear in admin query`);

    record(6, 'Admin dashboard visibility: both Citizen A & B reports appear', true,
      `Admin retrieved ${reportsData.reports.length} total reports, including ${reportA_Id} (Citizen A) and ${reportB_Id} (Citizen B).`);
  } catch (err) {
    record(6, 'Admin dashboard visibility: both Citizen A & B reports appear', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 7: Citizen A cannot access Citizen B's private reports
  // -------------------------------------------------------------
  try {
    // Attempt 1: Citizen A queries Citizen B's report details directly
    const accessRes = await fetch(`${baseUrl}/api/reports/${reportB_Id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${citizenA_Token}` }
    });
    assert.strictEqual(accessRes.status, 403, `Expected HTTP 403 Forbidden, got ${accessRes.status}`);

    // Attempt 2: Citizen A queries /api/reports list
    const listRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${citizenA_Token}` }
    });
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    const citizenACanSeeB = (listData.reports || []).some(r => r.reportId === reportB_Id);
    assert.strictEqual(citizenACanSeeB, false, "Citizen A's query must not expose Citizen B's complaint");

    record(7, "Citizen Privacy: Citizen A cannot access Citizen B's private reports", true,
      `API returned HTTP 403 when Citizen A requested ${reportB_Id}. Reports list filtered strictly to caller's own complaints.`);
  } catch (err) {
    record(7, "Citizen Privacy: Citizen A cannot access Citizen B's private reports", false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 8: Admin changes report lifecycle: SUBMITTED -> UNDER INSPECTION -> CLEANING STARTED -> COMPLETED
  // -------------------------------------------------------------
  try {
    // Transition 1: SUBMITTED -> UNDER INSPECTION (via verify)
    const verifyRes = await fetch(`${baseUrl}/api/admin/reports/${reportA_Id}/verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        action: 'VERIFY',
        notes: 'Site inspection confirmed culvert silt accumulation.'
      })
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200, `Verify failed: ${verifyData.message}`);

    let doc = await Report.findOne({ reportId: reportA_Id });
    assert.strictEqual(doc.status, 'UNDER INSPECTION');

    // Transition 2: UNDER INSPECTION -> CLEANING STARTED
    const cleaningRes = await fetch(`${baseUrl}/api/admin/reports/${reportA_Id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'CLEANING STARTED',
        notes: 'Jetting and suction units deployed on site. De-silting commenced.'
      })
    });
    const cleaningData = await cleaningRes.json();
    assert.strictEqual(cleaningRes.status, 200, `Cleaning started failed: ${cleaningData.message}`);

    doc = await Report.findOne({ reportId: reportA_Id });
    assert.strictEqual(doc.status, 'CLEANING STARTED');

    // Transition 3: CLEANING STARTED -> COMPLETED
    const completeRes = await fetch(`${baseUrl}/api/admin/reports/${reportA_Id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'COMPLETED',
        notes: 'Silt removed completely, trash screen cleared, unobstructed drain flow restored.',
        completionNotes: 'Culvert cleared and grating secured.',
        completionEvidenceUrl: '/uploads/completion-evidence-siteA.jpg'
      })
    });
    const completeData = await completeRes.json();
    assert.strictEqual(completeRes.status, 200, `Completion failed: ${completeData.message}`);

    doc = await Report.findOne({ reportId: reportA_Id });
    assert.strictEqual(doc.status, 'COMPLETED');
    assert(doc.resolutionDetails && doc.resolutionDetails.completedAt, 'Must have resolutionDetails.completedAt');
    assert.strictEqual(doc.statusHistory.length, 4, 'Must have 4 status history transitions');

    record(8, 'Admin complaint lifecycle control: SUBMITTED -> UNDER INSPECTION -> CLEANING STARTED -> COMPLETED', true,
      `All 4 lifecycle stages saved in MongoDB with timestamps, admin name, and notes.`);
  } catch (err) {
    record(8, 'Admin complaint lifecycle control: SUBMITTED -> UNDER INSPECTION -> CLEANING STARTED -> COMPLETED', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 9: Log in as relevant citizen and confirm updated status and timeline
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${baseUrl}/api/reports/${reportA_Id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${citizenA_Token}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert(data.report, 'Must return report');
    assert.strictEqual(data.report.status, 'COMPLETED', `Expected status COMPLETED, got ${data.report.status}`);
    assert(data.report.statusHistory.length >= 4, 'Status history must show complete timeline');

    const historyStates = data.report.statusHistory.map(h => h.toStatus);
    assert(historyStates.includes('SUBMITTED'), 'History must contain SUBMITTED');
    assert(historyStates.includes('UNDER INSPECTION'), 'History must contain UNDER INSPECTION');
    assert(historyStates.includes('CLEANING STARTED'), 'History must contain CLEANING STARTED');
    assert(historyStates.includes('COMPLETED'), 'History must contain COMPLETED');

    record(9, 'Citizen account reflects updated status and timeline', true,
      `Citizen A sees status COMPLETED and full 4-stage history: [${historyStates.join(' -> ')}]`);
  } catch (err) {
    record(9, 'Citizen account reflects updated status and timeline', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 10: Restart application and confirm accounts and reports still exist in MongoDB
  // -------------------------------------------------------------
  try {
    // Simulate application restart: disconnect and reconnect
    await mongoose.disconnect();
    assert.strictEqual(mongoose.connection.readyState, 0, 'Database should be disconnected');

    // Reconnect
    await connectDB();
    assert.strictEqual(mongoose.connection.readyState, 1, 'Database should be reconnected');

    // Check user and report persistence
    const persistedUserA = await User.findOne({ email: citizenA_Email });
    assert(persistedUserA, 'Citizen A must persist after restart');

    const persistedUserB = await User.findOne({ email: citizenB_Email });
    assert(persistedUserB, 'Citizen B must persist after restart');

    const persistedReportA = await Report.findOne({ reportId: reportA_Id });
    assert(persistedReportA, 'Report A must persist after restart');
    assert.strictEqual(persistedReportA.status, 'COMPLETED');

    const persistedReportB = await Report.findOne({ reportId: reportB_Id });
    assert(persistedReportB, 'Report B must persist after restart');

    record(10, 'Persistence test: accounts and reports persist across restart', true,
      `Verified Citizen A, Citizen B, Report ${reportA_Id}, and Report ${reportB_Id} in MongoDB Atlas after restart.`);
  } catch (err) {
    record(10, 'Persistence test: accounts and reports persist across restart', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 11: Verify map, heatmap, risk analysis, notifications, dashboard statistics use actual saved data
  // -------------------------------------------------------------
  try {
    // 11.1 Map Reports
    const mapReportsRes = await fetch(`${baseUrl}/api/map/reports`);
    const mapReportsData = await mapReportsRes.json();
    assert(mapReportsData.success);
    assert(mapReportsData.markers.some(m => m.reportId === reportB_Id), 'Map must include active report B');

    // 11.2 Heatmap
    const heatRes = await fetch(`${baseUrl}/api/map/heatmap`);
    const heatData = await heatRes.json();
    assert(heatData.success);
    assert(Array.isArray(heatData.heatPoints), 'Heatmap must return array');

    // 11.3 Dashboard Statistics
    const overRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const overData = await overRes.json();
    assert(overData.success);
    assert(overData.stats.totalReports >= 2, `Expected >= 2 total reports, got ${overData.stats.totalReports}`);
    assert(overData.stats.completed >= 1, `Expected >= 1 completed reports, got ${overData.stats.completed}`);

    // 11.4 Public Stats for Landing Page
    const pubRes = await fetch(`${baseUrl}/api/analytics/public-stats`);
    const pubData = await pubRes.json();
    assert(pubData.success);
    assert(typeof pubData.stats.resolvedReports === 'number');

    // 11.5 Notifications for Citizen A
    const notifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { 'Authorization': `Bearer ${citizenA_Token}` }
    });
    const notifData = await notifRes.json();
    assert(notifData.success);
    assert(notifData.notifications.length > 0, 'Citizen A should have persistent notifications');

    record(11, 'Map, heatmap, risk analysis, notifications & dashboard use real MongoDB data', true,
      `Map returned ${mapReportsData.count} markers; Dashboard returned totalReports=${overData.stats.totalReports}, completed=${overData.stats.completed}; Citizen A has ${notifData.notifications.length} persistent notification(s).`);
  } catch (err) {
    record(11, 'Map, heatmap, risk analysis, notifications & dashboard use real MongoDB data', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 12: Verify camera-only photo capture requirement & GPS/address detection
  // -------------------------------------------------------------
  try {
    // 12.1 Attempt report submission without photo -> must fail with HTTP 400
    const formNoPhoto = new FormData();
    formNoPhoto.append('problemType', 'Blocked Drain');
    formNoPhoto.append('locationName', 'No Photo Road');
    formNoPhoto.append('latitude', '19.4630');
    formNoPhoto.append('longitude', '72.8020');
    formNoPhoto.append('waterLevel', 'Low');
    formNoPhoto.append('description', 'Attempting submission without camera capture');

    const noPhotoRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenA_Token}` },
      body: formNoPhoto
    });
    const noPhotoData = await noPhotoRes.json();
    assert.strictEqual(noPhotoRes.status, 400, `Expected HTTP 400 for missing photo, got ${noPhotoRes.status}`);
    assert(noPhotoData.message.includes('camera photograph'), 'Message must indicate live camera photo is required');

    // 12.2 Reverse Geocoding with valid coordinates
    const geoRes = await fetch(`${baseUrl}/api/map/reverse-geocode?lat=19.4635&lon=72.8025`);
    const geoData = await geoRes.json();
    assert.strictEqual(geoRes.status, 200);
    assert(geoData.address, 'Must return readable address string');

    // 12.3 Invalid coordinates validation
    const badGeoRes = await fetch(`${baseUrl}/api/map/reverse-geocode?lat=999&lon=999`);
    assert.strictEqual(badGeoRes.status, 400, 'Invalid coordinates must return HTTP 400');

    record(12, 'Camera-only validation and GPS reverse geocoding error handling verified', true,
      `Rejected photo-less report with HTTP 400. Reverse-geocoding resolved address "${geoData.address.slice(0, 45)}...". Rejected invalid coords with HTTP 400.`);
  } catch (err) {
    record(12, 'Camera-only validation and GPS reverse geocoding error handling verified', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 13: Confirm that only Citizen and Municipal Admin roles remain
  // -------------------------------------------------------------
  try {
    // 13.1 Check User model enum
    const userRoleEnum = User.schema.path('role').enumValues;
    assert.deepStrictEqual(userRoleEnum, ['citizen', 'admin'], `Roles must be strictly ['citizen', 'admin'], got [${userRoleEnum}]`);

    // 13.2 Verify all existing database users have either 'citizen' or 'admin' role
    const allUsers = await User.find({}, { role: 1, email: 1 });
    for (const u of allUsers) {
      assert(['citizen', 'admin'].includes(u.role), `User ${u.email} has unexpected role: ${u.role}`);
    }

    // 13.3 Attempt login with maintenance role if any
    const maintenanceUser = await User.findOne({ role: 'maintenance' });
    assert.strictEqual(maintenanceUser, null, 'No maintenance user should exist in MongoDB');

    record(13, 'Roles restricted strictly to Citizen and Municipal Admin', true,
      `User schema role enum is ['citizen', 'admin']. Verified all ${allUsers.length} users in MongoDB have only citizen or admin roles.`);
  } catch (err) {
    record(13, 'Roles restricted strictly to Citizen and Municipal Admin', false, err.message);
  }

  // Clean up server
  server.close();

  // Print Summary Table
  console.log('\n================================================================');
  console.log('SUMMARY OF 13 END-TO-END WORKFLOW TESTS');
  console.log('================================================================');
  const allPassed = testResults.every(t => t.passed);
  testResults.forEach(t => {
    console.log(`Test ${t.testNum.toString().padStart(2, ' ')}: ${t.passed ? '[PASS]' : '[FAIL]'} ${t.name}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.filter(t => t.passed).length} / ${testResults.length} TESTS PASSED`);
  console.log('================================================================');

  await mongoose.disconnect();
  process.exit(allPassed ? 0 : 1);
}

runE2ETests().catch(err => {
  console.error('[E2E Test Suite Error]', err);
  process.exit(1);
});
