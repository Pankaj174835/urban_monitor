require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB } = require('../server/config/database');
const User = require('../server/models/User');

/**
 * Secure Administrator Bootstrap Script
 * Creates or verifies Municipal Admin in MongoDB using environment configuration.
 * Does not expose credentials or overwrite existing admin.
 */
async function setupAdmin() {
  await connectDB();

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log(`[Admin Setup] Municipal Admin account already exists: ${existingAdmin.email} (${existingAdmin.name}). Preserving existing account.`);
    await mongoose.disconnect();
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || process.argv[2];
  const adminPassword = process.env.ADMIN_PASSWORD || process.argv[3];
  const adminName = process.env.ADMIN_NAME || process.argv[4] || 'Municipal Admin Officer';

  if (!adminEmail || !adminPassword) {
    console.error('[Admin Setup] Error: Please configure ADMIN_EMAIL and ADMIN_PASSWORD in your .env file or pass them as CLI arguments:');
    console.error('  node scripts/setupAdmin.js <email> <password> [name]');
    await mongoose.disconnect();
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminPassword, salt);

  const newAdmin = await User.create({
    name: adminName.trim(),
    email: adminEmail.toLowerCase().trim(),
    password: hashedPassword,
    role: 'admin'
  });

  console.log(`[Admin Setup] Successfully created Municipal Admin account for ${newAdmin.email}.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  setupAdmin().catch(err => {
    console.error('[Admin Setup Error]', err.message);
    process.exit(1);
  });
}

module.exports = { setupAdmin };
