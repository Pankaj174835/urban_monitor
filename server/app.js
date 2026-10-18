const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const reportRoutes = require('./routes/report.routes');
const adminRoutes = require('./routes/admin.routes');
const riskRoutes = require('./routes/risk.routes');
const teamRoutes = require('./routes/team.routes');
const taskRoutes = require('./routes/task.routes');
const notificationRoutes = require('./routes/notification.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const mapRoutes = require('./routes/map.routes');
const hotspotRoutes = require('./routes/hotspot.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Trust reverse proxy for accurate client IP resolution and HTTPS cookies on Vercel
app.set('trust proxy', 1);

// Security and utility middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serverless Database Connection Middleware
// Ensures MongoDB Atlas is actively connected before processing any incoming request
app.use(async (req, res, next) => {
  try {
    const { connectDB } = require('./config/database');
    await connectDB();
  } catch (err) {
    console.error('[Database Middleware] Connection error:', err.message);
  }
  next();
});

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});
app.use('/api', apiLimiter);

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/uploads', (req, res) => {
  res.status(404).json({ success: false, message: 'Upload not found on server.' });
});

// Serve frontend client
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/hotspots', hotspotRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const { getDbDetails, isMongoConnected } = require('./config/database');
  const dbInfo = getDbDetails();
  res.status(200).json({
    success: true,
    status: 'ONLINE',
    project: 'Urban Flood Reporting & Smart Drain Monitoring System',
    database: {
      connected: isMongoConnected(),
      mode: dbInfo.mode,
      name: dbInfo.dbName,
      status: dbInfo.status
    },
    timestamp: new Date()
  });
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
