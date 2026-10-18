require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB, getDbDetails } = require('./config/database');
const { setSocketIO } = require('./services/notification.service');

const PORT = process.env.PORT || 3000;

async function startServer() {
  // Connect to database first
  await connectDB();

  const server = http.createServer(app);

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT']
    }
  });

  setSocketIO(io);

  io.on('connection', (socket) => {
    socket.on('join', (room) => {
      socket.join(room);
    });
  });

  const dbInfo = getDbDetails();

  server.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`Urban Flood Reporting & Smart Drain Monitoring System`);
    console.log(`Tagline: Early Detection. Smart Analysis. Timely Action. Safer Cities.`);
    console.log(`Database Status: ${dbInfo.status} (${dbInfo.mode.toUpperCase()} - ${dbInfo.dbName})`);
    console.log(`Server running at: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`================================================================`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
