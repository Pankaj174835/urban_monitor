const mongoose = require('mongoose');

let isMongo = false;
let connPromise = null;
let dbDetails = {
  status: 'DISCONNECTED',
  mode: 'uninitialized',
  host: '',
  dbName: '',
  collections: []
};

/**
 * Mask credentials in connection URI for safe console logging
 */
function sanitizeUri(uri) {
  if (!uri) return 'undefined';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/, '$1****$3');
}

/**
 * Explicitly create and verify all application collections and indexes
 */
async function ensureCollectionsAndIndexes() {
  const requiredCollections = [
    'users',
    'reports',
    'teams',
    'tasks',
    'notifications',
    'riskareas',
    'hotspots',
    'counters'
  ];

  try {
    const existingCollections = await mongoose.connection.db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);

    for (const colName of requiredCollections) {
      if (!existingNames.includes(colName)) {
        await mongoose.connection.db.createCollection(colName);
        console.log(`[Database] Initialized collection: '${colName}'`);
      }
    }

    // Require models lazily
    const User = require('../models/User');
    const Report = require('../models/Report');
    const Team = require('../models/Team');
    const Task = require('../models/Task');
    const Notification = require('../models/Notification');
    const RiskArea = require('../models/RiskArea');
    const Hotspot = require('../models/Hotspot');
    const Counter = require('../models/Counter');

    // Sync schema indexes
    await Promise.all([
      User.init ? User.init() : Promise.resolve(),
      Report.init ? Report.init() : Promise.resolve(),
      Team.init ? Team.init() : Promise.resolve(),
      Task.init ? Task.init() : Promise.resolve(),
      Notification.init ? Notification.init() : Promise.resolve(),
      RiskArea.init ? RiskArea.init() : Promise.resolve(),
      Hotspot.init ? Hotspot.init() : Promise.resolve(),
      Counter.init ? Counter.init() : Promise.resolve()
    ]);

    // Check if an admin exists; if not and configured via environment, bootstrap admin
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (adminEmail && adminPassword) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);
        await User.create({
          name: process.env.ADMIN_NAME || 'Municipal Admin Officer',
          email: adminEmail.toLowerCase().trim(),
          password: hashedPassword,
          role: 'admin'
        });
        console.log(`[Database] Bootstrapped authorized administrator: ${adminEmail}`);
      } else {
        console.log('[Database] Notice: No administrator found. Run admin setup or configure ADMIN_EMAIL in environment.');
      }
    }

    // Collect document counts for verified collections
    const counts = {};
    for (const colName of requiredCollections) {
      counts[colName] = await mongoose.connection.db.collection(colName).countDocuments();
    }

    dbDetails.collections = requiredCollections.map(name => ({
      name,
      count: counts[name] || 0
    }));

    return counts;
  } catch (err) {
    console.error(`[Database] Collection verification warning: ${err.message}`);
    return {};
  }
}

/**
 * Connect to MongoDB with accurate status reporting
 */
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    isMongo = true;
    return mongoose.connection;
  }

  if (connPromise) {
    return connPromise;
  }

  connPromise = (async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/urban_drain_monitor';
    const targetDbName = process.env.MONGODB_DB_NAME || 'urban_drain_monitor';

    console.log(`================================================================`);
    console.log(`[Database] Initiating connection to MongoDB...`);
    console.log(`[Database] Target URI: ${sanitizeUri(mongoUri)}`);
    console.log(`[Database] Target Database: ${targetDbName}`);

    try {
      await mongoose.connect(mongoUri, {
        dbName: targetDbName,
        serverSelectionTimeoutMS: 8000
      });

      isMongo = true;
      const activeHost = mongoose.connection.host || 'MongoDB Cluster';
      const activeDbName = mongoose.connection.name || targetDbName;

      dbDetails = {
        status: 'CONNECTED',
        mode: 'mongodb',
        host: activeHost,
        dbName: activeDbName,
        collections: []
      };

      console.log(`[Database] Connection Status: CONNECTED`);
      console.log(`[Database] Host: ${activeHost}`);
      console.log(`[Database] Active Database: ${activeDbName}`);

      // Ensure collections and indexes exist without demo data injection
      const counts = await ensureCollectionsAndIndexes();

      console.log(`[Database] Verified Collections & Record Counts:`);
      for (const [col, count] of Object.entries(counts)) {
        console.log(`  - ${col.padEnd(16)}: ${count} record(s)`);
      }
      console.log(`[Database] Mode: MONGODB ATLAS (Cloud Database Active & Operational)`);
      console.log(`================================================================`);
      return mongoose.connection;
    } catch (err) {
      isMongo = false;
      connPromise = null;
      dbDetails = {
        status: 'FAILED',
        mode: 'disconnected',
        host: '',
        dbName: targetDbName,
        error: err.message,
        collections: []
      };

      console.error(`================================================================`);
      console.error(`[Database] Connection Status: FAILED`);
      console.error(`[Database] Error: ${err.message}`);
      console.error(`[Database] Real database connection could not be established.`);
      console.error(`================================================================`);
      throw err;
    }
  })();

  return connPromise;
};

const getDbMode = () => (isMongo ? 'mongodb' : 'disconnected');

module.exports = {
  connectDB,
  isMongoConnected: () => isMongo,
  getDbMode,
  getDbDetails: () => ({ ...dbDetails })
};
