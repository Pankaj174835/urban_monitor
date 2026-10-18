require('dotenv').config();
const bcrypt = require('bcryptjs');
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

async function seedData() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  console.log('[Seed] Purging existing demonstration records...');
  await Report.deleteMany({ isDemo: true });
  await Team.deleteMany({ isDemo: true });
  await Task.deleteMany({ isDemo: true });
  await Notification.deleteMany({ isDemo: true });
  await RiskArea.deleteMany({ isDemo: true });
  await Hotspot.deleteMany({ isDemo: true });

  // 1. Seed or find Demo Users (Strictly CITIZEN and ADMIN roles only)
  await User.deleteMany({ role: 'maintenance' });
  await User.deleteMany({ email: 'team@draincare.org' });

  const citizenPass = await bcrypt.hash('Citizen@123', 10);
  const adminPass = await bcrypt.hash('Admin@123', 10);

  let citizen = await User.findOne({ email: 'citizen@example.com' });
  if (!citizen) {
    citizen = await User.create({
      name: 'Rohan Sharma (Demo Citizen)',
      email: 'citizen@example.com',
      password: citizenPass,
      role: 'citizen',
      phone: '+91 98765 43210',
      alertPreferences: {
        enabled: true,
        radiusMeters: 3000,
        preferredLocation: { latitude: 19.4630, longitude: 72.8020, address: 'Virar West Station Road' }
      }
    });
    console.log('[Seed] Created Demo Citizen account: citizen@example.com');
  } else {
    citizen.password = citizenPass;
    await citizen.save();
  }

  let admin = await User.findOne({ email: 'admin@citydrain.gov.in' });
  if (!admin) {
    admin = await User.create({
      name: 'Municipal Admin Officer (Demo)',
      email: 'admin@citydrain.gov.in',
      password: adminPass,
      role: 'admin',
      phone: '+91 98111 22334'
    });
    console.log('[Seed] Created Demo Admin account: admin@citydrain.gov.in');
  } else {
    admin.password = adminPass;
    await admin.save();
  }

  // 2. Seed Field Maintenance Teams (managed directly by Municipal Admin)
  const team1 = await Team.create({
    name: 'Virar Rapid Drainage Response Unit',
    leaderName: 'Prakash Patil',
    contactNumber: '+91 98222 33445',
    status: 'ON_DUTY',
    assignedArea: 'Virar West & Coastal Corridors',
    memberCount: 6,
    activeTasksCount: 2,
    completedTasksCount: 14,
    isDemo: true
  });

  const team2 = await Team.create({
    name: 'Vasai-Nalasopara Stormwater Taskforce',
    leaderName: 'Sanjay Deshmukh',
    contactNumber: '+91 98333 44556',
    status: 'AVAILABLE',
    assignedArea: 'Nalasopara East & Vasai Highway Corridor',
    memberCount: 5,
    activeTasksCount: 1,
    completedTasksCount: 19,
    isDemo: true
  });

  console.log('[Seed] Seeded Maintenance Teams.');

  // 3. Seed Realistic Demonstration Reports in Virar, Nalasopara, Vasai
  const sampleReports = [
    {
      reportId: 'UD-2026-0001',
      citizen: citizen._id,
      citizenName: citizen.name,
      citizenEmail: citizen.email,
      problemType: 'Blocked Drain',
      description: '[DEMONSTRATION DATA] Heavy silt and plastic accumulation blocking primary roadside stormwater drain.',
      photoUrl: '/assets/images/sample-blocked.svg',
      latitude: 19.4635,
      longitude: 72.8025,
      locationName: 'Virar West Station Road near Bazar Peth',
      waterLevel: 'High',
      status: 'SUBMITTED',
      riskScore: 78,
      riskLevel: 'HIGH',
      riskReasons: [
        'Water level reported as HIGH (+35 pts). Significant potential for road waterlogging.',
        'Debris or silt blockage causing restricted drainage flow (+15 pts).',
        'Moderate cluster: 3 nearby reports detected within 800m (+20 pts).'
      ],
      priority: 'CRITICAL',
      priorityOverrideReason: '',
      isDemo: true
    },
    {
      reportId: 'UD-2026-0002',
      citizen: citizen._id,
      citizenName: citizen.name,
      citizenEmail: citizen.email,
      problemType: 'Waterlogging',
      description: '[DEMONSTRATION DATA] Road completely waterlogged with 1.5 feet of stagnant rainwater obstructing bus movements.',
      photoUrl: '/assets/images/sample-waterlog.svg',
      latitude: 19.4650,
      longitude: 72.8040,
      locationName: 'Virar West Agashi Road Junction',
      waterLevel: 'High',
      status: 'UNDER INSPECTION',
      riskScore: 82,
      riskLevel: 'HIGH',
      riskReasons: [
        'Water level reported as HIGH (+35 pts). Significant potential for road waterlogging.',
        'Active street waterlogging obstructing vehicular and pedestrian traffic (+22 pts).',
        'Multiple unresolved drainage issues in immediate vicinity (+10 pts).'
      ],
      priority: 'HIGH',
      verificationDetails: {
        verified: true,
        verifiedBy: admin._id,
        verifiedByName: admin.name,
        verifiedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        verificationNotes: 'Site inspection confirmed backflow from main channel.'
      },
      assignedTeam: team1._id,
      assignedTeamName: team1.name,
      isDemo: true
    },
    {
      reportId: 'UD-2026-0003',
      citizen: citizen._id,
      citizenName: 'Priya Kulkarni (Citizen)',
      citizenEmail: 'priya@example.com',
      problemType: 'Drain Overflow',
      description: '[DEMONSTRATION DATA] Overflowing manhole discharging dirty water directly onto pedestrian walkway.',
      photoUrl: '/assets/images/sample-overflow.svg',
      latitude: 19.4620,
      longitude: 72.8010,
      locationName: 'Virar West Viva College Road',
      waterLevel: 'Medium',
      status: 'CLEANING STARTED',
      riskScore: 68,
      riskLevel: 'HIGH',
      riskReasons: [
        'Drain overflow poses acute flooding & sanitary hazard (+25 pts).',
        'Water level reported as MEDIUM (+20 pts).'
      ],
      priority: 'HIGH',
      assignedTeam: team1._id,
      assignedTeamName: team1.name,
      isDemo: true
    },
    {
      reportId: 'UD-2026-0004',
      citizen: citizen._id,
      citizenName: 'Amit Verma (Citizen)',
      citizenEmail: 'amit@example.com',
      problemType: 'Drainage Damage',
      description: '[DEMONSTRATION DATA] Broken concrete drain slab causing safety hazard and debris cave-in.',
      photoUrl: '/assets/images/sample-damaged.svg',
      latitude: 19.4180,
      longitude: 72.8190,
      locationName: 'Nalasopara East Achole Road near Central Park',
      waterLevel: 'Low',
      status: 'SUBMITTED',
      riskScore: 28,
      riskLevel: 'LOW',
      riskReasons: [
        'Water level reported as LOW (+8 pts).',
        'Structural drainage damage impairs discharge capacity (+18 pts).'
      ],
      priority: 'MEDIUM',
      isDemo: true
    },
    {
      reportId: 'UD-2026-0005',
      citizen: citizen._id,
      citizenName: 'Sunita Rao (Citizen)',
      citizenEmail: 'sunita@example.com',
      problemType: 'Blocked Drain',
      description: '[DEMONSTRATION DATA] Tree leaves, branches and discarded municipal waste clogging inlet screen.',
      photoUrl: '/assets/images/sample-blocked.svg',
      latitude: 19.3820,
      longitude: 72.8360,
      locationName: 'Vasai East Evershine City Main Gate',
      waterLevel: 'Medium',
      status: 'COMPLETED',
      riskScore: 35,
      riskLevel: 'MEDIUM',
      riskReasons: [
        'Water level reported as MEDIUM (+20 pts).',
        'Debris blockage causing restricted flow (+15 pts).'
      ],
      priority: 'MEDIUM',
      assignedTeam: team2._id,
      assignedTeamName: team2.name,
      resolutionDetails: {
        notes: 'Screen cleared of foliage, trash hauled away, water flowing freely.',
        completionEvidenceUrl: '/assets/images/sample-resolved.svg',
        completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        completedBy: admin._id,
        completedByName: admin.name
      },
      isDemo: true
    },
    {
      reportId: 'UD-2026-0006',
      citizen: citizen._id,
      citizenName: citizen.name,
      citizenEmail: citizen.email,
      problemType: 'Blocked Drain',
      description: '[DEMONSTRATION DATA] Second blockage near market junction causing overflow back into basements.',
      photoUrl: '/assets/images/sample-blocked.svg',
      latitude: 19.4640,
      longitude: 72.8030,
      locationName: 'Virar West Bazar Peth Crossing',
      waterLevel: 'High',
      status: 'UNDER INSPECTION',
      riskScore: 84,
      riskLevel: 'HIGH',
      riskReasons: [
        'High density cluster: 4 reports within 800m (+30 pts).',
        'Water level reported as HIGH (+35 pts).'
      ],
      priority: 'CRITICAL',
      assignedTeam: team1._id,
      assignedTeamName: team1.name,
      isDemo: true
    }
  ];

  for (const r of sampleReports) {
    const reportDoc = await Report.create({
      ...r,
      statusHistory: [
        {
          fromStatus: 'INITIAL',
          toStatus: 'SUBMITTED',
          changedBy: citizen._id,
          changedByName: r.citizenName,
          changedByRole: 'citizen',
          notes: 'Demonstration complaint logged.',
          changedAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
        },
        ...(r.status !== 'SUBMITTED' ? [{
          fromStatus: 'SUBMITTED',
          toStatus: r.status,
          changedBy: admin._id,
          changedByName: admin.name,
          changedByRole: 'admin',
          notes: `Transitioned to ${r.status} during municipal processing.`,
          changedAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
        }] : [])
      ]
    });

    // Create linked Task if assigned to team
    if (r.assignedTeam) {
      await Task.create({
        report: reportDoc._id,
        reportId: reportDoc.reportId,
        team: r.assignedTeam,
        teamName: r.assignedTeamName,
        title: `Maintenance: ${r.problemType} at ${r.locationName}`,
        instructions: 'Clear accumulated silt, remove debris, check flow integrity.',
        priority: r.priority,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        taskStatus: r.status === 'COMPLETED' ? 'COMPLETED' : (r.status === 'CLEANING STARTED' ? 'IN_PROGRESS' : 'ASSIGNED'),
        assignedBy: admin._id,
        assignedByName: admin.name,
        assignedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        completedAt: r.status === 'COMPLETED' ? new Date(Date.now() - 24 * 60 * 60 * 1000) : null,
        isDemo: true
      });
    }
  }

  console.log(`[Seed] Seeded ${sampleReports.length} realistic demonstration reports.`);

  // 4. Seed Notifications
  await Notification.create({
    recipient: citizen._id,
    type: 'HIGH_RISK_ALERT',
    title: '[DEMONSTRATION] High-Risk Drainage Alert: Virar West Cluster',
    message: 'Multiple severe waterlogging and drain blockages detected within 500m of your area. Risk Level: HIGH (84/100). Take precautions.',
    reportId: 'UD-2026-0001',
    isRead: false,
    isDemo: true
  });

  await Notification.create({
    recipient: citizen._id,
    type: 'STATUS_UPDATE',
    title: '[DEMONSTRATION] Status Update: UD-2026-0002',
    message: 'Your report UD-2026-0002 has been verified by the municipal authority and assigned to Virar Rapid Response Unit.',
    reportId: 'UD-2026-0002',
    isRead: true,
    isDemo: true
  });

  // 5. Run Risk Engine & Hotspot Clustering
  console.log('[Seed] Running AI-Assisted Risk Engine and Hotspot detection...');
  const riskAreas = await refreshRiskAreas();
  const hotspots = await detectHotspots();

  console.log(`[Seed] Successfully generated ${riskAreas.length} Risk Areas and ${hotspots.length} Recurring Hotspots.`);
  console.log('================================================================');
  console.log('DEMONSTRATION SEED COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
  console.log('Demo Credentials for Local Testing:');
  console.log('1. Citizen Portal:     citizen@example.com      / Citizen@123');
  console.log('2. Municipal Admin:    admin@citydrain.gov.in   / Admin@123');
  console.log('================================================================');
}

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}

module.exports = { seedData };
