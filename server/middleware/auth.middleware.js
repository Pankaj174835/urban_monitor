const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_urban_drain_2026_academic_lab';

/**
 * Verifies JWT token from Authorization header or cookie
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      console.warn(`[Auth Middleware] No token provided for ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to continue.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      console.warn(`[Auth Middleware] User ID ${decoded.id} from token not found in database for ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid session or user no longer exists.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.warn(`[Auth Middleware] Token verification failed for ${req.method} ${req.originalUrl}: ${err.message}`);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token. Please log in again.'
    });
  }
};

/**
 * Restricts access to specific user roles
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      console.warn(`[Auth Middleware] Forbidden: user ${req.user ? req.user.email : 'anonymous'} (role: ${req.user ? req.user.role : 'none'}) attempted to access restricted route ${req.method} ${req.originalUrl}. Allowed: [${roles.join(', ')}]`);
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${roles.join(', ')}] roles.`
      });
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorizeRoles
};
