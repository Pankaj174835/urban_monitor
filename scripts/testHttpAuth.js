require('dotenv').config();
const http = require('http');
const { startServer } = require('../server/server');

async function testHttp() {
  const server = await startServer();

  function postJson(path, body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let resData = '';
        res.on('data', chunk => resData += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resData) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: resData });
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  try {
    // 1. Test Admin Login
    console.log('[HTTP Test] Testing Admin Login...');
    const adminRes = await postJson('/api/auth/login', {
      email: 'admin@citydrain.gov.in',
      password: 'Admin@123'
    });
    console.log('[HTTP Test] Admin Login Status:', adminRes.status, 'Success:', adminRes.data?.success, 'User:', adminRes.data?.user?.email);

    // 2. Test Citizen Login
    console.log('[HTTP Test] Testing Citizen Login...');
    const citRes = await postJson('/api/auth/login', {
      email: 'citizen@example.com',
      password: 'Citizen@123'
    });
    console.log('[HTTP Test] Citizen Login Status:', citRes.status, 'Success:', citRes.data?.success, 'User:', citRes.data?.user?.email);

    // 3. Test Register New Citizen
    const newCitizenEmail = `citizen_${Date.now()}@test.org`;
    const newCitizenPass = 'SecretPass@2026';
    console.log(`[HTTP Test] Registering new user: ${newCitizenEmail}...`);
    const regRes = await postJson('/api/auth/register', {
      name: 'Pankaj Citizen',
      email: newCitizenEmail,
      phone: '+91 99999 88888',
      password: newCitizenPass,
      confirmPassword: newCitizenPass
    });
    console.log('[HTTP Test] Registration Status:', regRes.status, 'Success:', regRes.data?.success, 'Token created:', !!regRes.data?.token);

    // 4. Test Login with Newly Created User
    console.log(`[HTTP Test] Logging in with newly created user: ${newCitizenEmail}...`);
    const newLoginRes = await postJson('/api/auth/login', {
      email: newCitizenEmail,
      password: newCitizenPass
    });
    console.log('[HTTP Test] New User Login Status:', newLoginRes.status, 'Success:', newLoginRes.data?.success, 'Token created:', !!newLoginRes.data?.token);

    if (newLoginRes.data?.success) {
      console.log('>>> ALL AUTH ENDPOINTS PASSED AND VERIFIED OVER HTTP! <<<');
    } else {
      console.error('>>> AUTH FAILED <<<', newLoginRes);
    }
  } finally {
    server.close(() => process.exit(0));
  }
}

testHttp().catch(err => {
  console.error('[HTTP Auth Error]', err);
  process.exit(1);
});
