const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'urban_drain_monitor_jwt_secret_key_2026';

let passedCount = 0;
let failedCount = 0;

function pass(testName, details = '') {
  passedCount++;
  console.log(`[PASS] ${testName}`);
  if (details) console.log(`       ${details}`);
}

function fail(testName, error) {
  failedCount++;
  console.error(`[FAIL] ${testName}`);
  console.error(`       Reason: ${error.message || error}`);
}

async function runVerification() {
  console.log('================================================================');
  console.log('URBAN DRAIN MONITOR - ADMIN REPORT & PHOTO DISPLAY VERIFICATION');
  console.log('================================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../models/User');
  const Report = require('../models/Report');

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) throw new Error('No admin user found in MongoDB');
  const adminToken = jwt.sign({ id: admin._id, role: 'admin', name: admin.name }, JWT_SECRET);

  const citizen = await User.findOne({ role: 'citizen', email: 'rahul123@gmail.com' });
  if (!citizen) throw new Error('Citizen rahul123@gmail.com not found');
  const citizenToken = jwt.sign({ id: citizen._id, role: 'citizen', name: citizen.name }, JWT_SECRET);

  // TEST 1: Admin can see reports from multiple different citizens
  try {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const citizens = [...new Set(data.reports.map(r => r.citizenName))];
    if (citizens.length < 2) throw new Error(`Expected reports from multiple citizens, got ${citizens.length}`);
    pass('TEST 1: Admin sees complaints from multiple citizens in All Citizen Reports', 
      `Admin retrieved ${data.reports.length} reports submitted by ${citizens.join(', ')}`);
  } catch (err) {
    fail('TEST 1: Admin sees complaints from multiple citizens', err);
  }

  // TEST 7: Check existing report UD-2026-0008 for existing stored image
  let report0008;
  try {
    report0008 = await Report.findOne({ reportId: 'UD-2026-0008' });
    if (!report0008) throw new Error('UD-2026-0008 not found in MongoDB');
    if (!report0008.photoUrl) throw new Error('UD-2026-0008 does not contain a photoUrl reference');
    
    // Check if file exists on disk
    const diskPath = path.join(__dirname, '../../', report0008.photoUrl);
    if (!fs.existsSync(diskPath)) throw new Error(`Image file not found on disk at ${diskPath}`);
    const fileSize = fs.statSync(diskPath).size;

    // Check if served via HTTP
    const httpRes = await fetch(`${BASE_URL}${report0008.photoUrl}`);
    if (!httpRes.ok) throw new Error(`HTTP ${httpRes.status} when fetching image file`);

    pass('TEST 7: Report UD-2026-0008 inspected and confirmed stored photo file exists',
      `Found photoUrl=${report0008.photoUrl} (${fileSize} bytes). Served with HTTP 200 ${httpRes.headers.get('content-type')}`);
  } catch (err) {
    fail('TEST 7: Report UD-2026-0008 image verification', err);
  }

  // TEST 2: Submit a new complaint using camera photo upload
  let newReportId;
  let newPhotoUrl;
  try {
    // Generate sample camera JPEG buffer
    const testJpgBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x0A, 0x00, 0x0A, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xDA, 0x00,
      0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xBF, 0x00, 0xFF, 0xD9
    ]);

    const form = new FormData();
    form.append('problemType', 'Blocked Drain');
    form.append('description', 'Severe silt build-up causing backflow near main crossing');
    form.append('locationName', 'Station Road Cross Junction, Sector 4, Vasai');
    form.append('latitude', '19.468200');
    form.append('longitude', '72.809100');
    form.append('waterLevel', 'High');
    const photoBlob = new Blob([testJpgBuffer], { type: 'image/jpeg' });
    form.append('photo', photoBlob, 'live-camera-test.jpg');

    const submitRes = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${citizenToken}`
      },
      body: form
    });

    if (!submitRes.ok) {
      const errBody = await submitRes.text();
      throw new Error(`Submission failed with HTTP ${submitRes.status}: ${errBody}`);
    }

    const submitData = await submitRes.json();
    newReportId = submitData.reportId;
    newPhotoUrl = submitData.report.photoUrl;

    pass('TEST 2: New complaint submitted with camera photograph successfully',
      `Assigned Report ID: ${newReportId}, photoUrl: ${newPhotoUrl}`);
  } catch (err) {
    fail('TEST 2: New complaint submission with camera photograph', err);
  }

  // TEST 3: Inspect MongoDB record for the new report
  try {
    const dbRecord = await Report.findOne({ reportId: newReportId });
    if (!dbRecord) throw new Error(`Report ${newReportId} not found in database`);
    if (!dbRecord.photoUrl || !dbRecord.photoUrl.startsWith('/uploads/')) {
      throw new Error(`Invalid photoUrl stored: ${dbRecord.photoUrl}`);
    }
    const filePath = path.join(__dirname, '../../', dbRecord.photoUrl);
    if (!fs.existsSync(filePath)) throw new Error(`Uploaded file not found on disk: ${filePath}`);

    pass('TEST 3: MongoDB report record confirmed with valid photo reference and on-disk file',
      `MongoDB photoUrl: ${dbRecord.photoUrl}, coords: (${dbRecord.latitude}, ${dbRecord.longitude}), status: ${dbRecord.status}`);
  } catch (err) {
    fail('TEST 3: MongoDB report record inspection', err);
  }

  // TEST 4: Open report-details API as Citizen
  try {
    const res = await fetch(`${BASE_URL}/api/reports/${newReportId}`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.report.photoUrl) throw new Error('API did not return photoUrl');
    if (data.report.latitude !== 19.4682 || data.report.longitude !== 72.8091) {
      throw new Error('Coordinates do not match submitted values');
    }
    pass('TEST 4: Report details API returns actual captured photo and coordinates to citizen',
      `photoUrl=${data.report.photoUrl}, Address="${data.report.locationName}"`);
  } catch (err) {
    fail('TEST 4: Report details API for citizen', err);
  }

  // TEST 5: Open report-details API as Municipal Admin
  try {
    const res = await fetch(`${BASE_URL}/api/reports/${newReportId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.report.photoUrl) throw new Error('Admin API did not return photoUrl');
    pass('TEST 5: Municipal Admin successfully retrieves the same photograph and location',
      `Admin access verified for ${newReportId}: photoUrl=${data.report.photoUrl}`);
  } catch (err) {
    fail('TEST 5: Admin report details API', err);
  }

  // TEST 6: Photo accessibility over HTTP
  try {
    const photoRes = await fetch(`${BASE_URL}${newPhotoUrl}`);
    if (!photoRes.ok) throw new Error(`HTTP ${photoRes.status} fetching photo`);
    pass('TEST 6: Photo remains persistently accessible over HTTP',
      `HTTP ${photoRes.status} Content-Type: ${photoRes.headers.get('content-type')}`);
  } catch (err) {
    fail('TEST 6: Photo persistent accessibility', err);
  }

  // TEST 8: Submit report with valid GPS location and check address
  try {
    const r = await Report.findOne({ reportId: newReportId });
    if (!r.locationName || r.locationName === '-') throw new Error('Location is empty or "-"');
    if (!r.latitude || !r.longitude) throw new Error('Coordinates are missing');
    pass('TEST 8: Valid GPS location and address confirmed in report details',
      `Address: "${r.locationName}", Coords: (${r.latitude}, ${r.longitude})`);
  } catch (err) {
    fail('TEST 8: GPS location & address confirmation', err);
  }

  // TEST 9: Empty-state handling for reports without photos/coords
  try {
    // Check report-details.html content to ensure empty-state elements exist
    const html = fs.readFileSync(path.join(__dirname, '../../client/report-details.html'), 'utf8');
    if (!html.includes('photo-empty-state') || !html.includes('No Photo Evidence Attached')) {
      throw new Error('Missing photo empty-state in report-details.html');
    }
    if (!html.includes('map-unavailable-msg') || !html.includes('GPS coordinates unavailable')) {
      throw new Error('Missing coordinates fallback in report-details.html');
    }
    pass('TEST 9: Honest empty-state handling verified for reports without photos or locations',
      'photo-empty-state and map-unavailable-msg components confirmed in client markup');
  } catch (err) {
    fail('TEST 9: Empty-state verification', err);
  }

  // TEST 10: Admin complaint lifecycle control: SUBMITTED -> UNDER INSPECTION -> CLEANING STARTED -> COMPLETED
  try {
    // 1. Verify -> UNDER INSPECTION
    let res = await fetch(`${BASE_URL}/api/admin/reports/${newReportId}/verify`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'VERIFY', notes: 'Verified by municipal field inspector.' })
    });
    if (!res.ok) throw new Error(`Verify failed: HTTP ${res.status}`);
    let data = await res.json();
    if (data.report.status !== 'UNDER INSPECTION') throw new Error(`Status is ${data.report.status}`);

    // 2. Status -> CLEANING STARTED
    res = await fetch(`${BASE_URL}/api/admin/reports/${newReportId}/status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLEANING STARTED', notes: 'Excavation and silt clearing begun.' })
    });
    if (!res.ok) throw new Error(`Status update failed: HTTP ${res.status}`);
    data = await res.json();
    if (data.report.status !== 'CLEANING STARTED') throw new Error(`Status is ${data.report.status}`);

    // 3. Status -> COMPLETED
    res = await fetch(`${BASE_URL}/api/admin/reports/${newReportId}/status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'COMPLETED',
        notes: 'Drain flushed, blockage cleared, water flowing freely.',
        completionNotes: 'Complete flow restoration verified with post-cleaning inspection.'
      })
    });
    if (!res.ok) throw new Error(`Completion failed: HTTP ${res.status}`);
    data = await res.json();
    if (data.report.status !== 'COMPLETED') throw new Error(`Status is ${data.report.status}`);
    if (!data.report.resolutionDetails || !data.report.resolutionDetails.completedAt) {
      throw new Error('resolutionDetails.completedAt not populated in MongoDB');
    }

    pass('TEST 10: Municipal Admin directly controls complaint lifecycle through all 4 stages',
      'Transitions: SUBMITTED -> UNDER INSPECTION -> CLEANING STARTED -> COMPLETED verified in MongoDB with resolution details');
  } catch (err) {
    fail('TEST 10: Lifecycle transitions', err);
  }

  // TEST 11: Dashboard counts and map use actual database records
  try {
    const overviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!overviewRes.ok) throw new Error(`HTTP ${overviewRes.status}`);
    const over = await overviewRes.json();
    const countInDb = await Report.countDocuments();
    if (over.stats.totalReports !== countInDb) {
      throw new Error(`Dashboard count (${over.stats.totalReports}) != MongoDB count (${countInDb})`);
    }

    const mapRes = await fetch(`${BASE_URL}/api/map/reports`);
    if (!mapRes.ok) throw new Error(`HTTP ${mapRes.status}`);
    const mapData = await mapRes.json();
    if (mapData.markers.length !== countInDb) {
      throw new Error(`Map markers count (${mapData.markers.length}) != MongoDB count (${countInDb})`);
    }

    pass('TEST 11: Admin dashboard counts and Map markers reflect real MongoDB database data',
      `Dashboard totalReports=${over.stats.totalReports}, Completed=${over.stats.completed}, Map markers count=${mapData.markers.length}`);
  } catch (err) {
    fail('TEST 11: Real MongoDB data usage for counts and map', err);
  }

  // TEST 12: Admin Navigation Links and UI Components
  try {
    const authJs = fs.readFileSync(path.join(__dirname, '../../client/assets/js/auth.js'), 'utf8');
    const requiredNav = [
      'Admin Dashboard',
      'All Citizen Reports',
      'Risk Map',
      'Heatmap',
      'Risk Areas',
      'Complaint Analytics',
      'Recurring Hotspots',
      'Notifications',
      'Sustainability Insights'
    ];
    for (const item of requiredNav) {
      if (!authJs.includes(item)) throw new Error(`Missing navigation item: "${item}" in auth.js`);
    }
    pass('TEST 12: Admin navigation items verified for all 9 required sections',
      'Confirmed: ' + requiredNav.join(' | '));
  } catch (err) {
    fail('TEST 12: Admin navigation verification', err);
  }

  console.log('================================================================');
  console.log(`SUMMARY: ${passedCount} / ${passedCount + failedCount} TESTS PASSED`);
  console.log('================================================================');

  await mongoose.disconnect();
  if (failedCount > 0) process.exit(1);
}

runVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
