require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB } = require('../server/config/database');
const User = require('../server/models/User');

async function repair() {
  await connectDB();

  // 1. Reset demo users with proper single-hashed passwords
  const citPass = await bcrypt.hash('Citizen@123', 10);
  const admPass = await bcrypt.hash('Admin@123', 10);

  await User.updateOne({ email: 'citizen@example.com' }, { password: citPass });
  await User.updateOne({ email: 'admin@citydrain.gov.in' }, { password: admPass });
  console.log('[Repair] Reset demo users with valid password hashes.');

  // 2. Remove failed registrations so user can register fresh
  await User.deleteOne({ email: 'pankaj123@gmail.com' });
  await User.deleteOne({ email: 'pankaj2026@gmail.com' });
  console.log('[Repair] Removed failed test registrations.');

  // 3. Verify demo citizen password
  const cit = await User.findOne({ email: 'citizen@example.com' });
  const citMatch = await bcrypt.compare('Citizen@123', cit.password);
  console.log('[Verify] Citizen password match Citizen@123:', citMatch);

  // 4. Verify demo admin password
  const adm = await User.findOne({ email: 'admin@citydrain.gov.in' });
  const admMatch = await bcrypt.compare('Admin@123', adm.password);
  console.log('[Verify] Admin password match Admin@123:', admMatch);

  // 5. Test creating a new user and verifying login
  const testEmail = `qa_test_${Date.now()}@example.com`;
  const plainPassword = 'MySecretPassword@123';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const newUser = await User.create({
    name: 'QA Test Citizen',
    email: testEmail,
    password: hashedPassword,
    role: 'citizen'
  });

  const retrieved = await User.findOne({ email: testEmail });
  const loginMatch = await bcrypt.compare(plainPassword, retrieved.password);
  console.log(`[Verify] New user creation & login match for ${testEmail}:`, loginMatch);

  // Clean up QA test user
  await User.deleteOne({ _id: newUser._id });
  console.log('[Verify] QA test user cleaned up successfully.');

  process.exit(0);
}

repair().catch(err => {
  console.error('[Repair Error]', err);
  process.exit(1);
});
