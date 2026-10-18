const errorHandler = (err, req, res, next) => {
  const reqContext = `${req.method} ${req.originalUrl}`;
  console.error(`[Error Handler] ${reqContext} failed with error:`, err.message || err);
  if (err.stack) {
    console.error(`[Error Handler Stack]`, err.stack);
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    console.warn(`[Error Handler] ${reqContext} - File size exceeded limit.`);
    return res.status(400).json({
      success: false,
      message: 'File size exceeds maximum allowed limit of 5MB.'
    });
  }

  // Multer invalid format or general error
  if (err.message && err.message.includes('Invalid file format')) {
    console.warn(`[Error Handler] ${reqContext} - Invalid file format.`);
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    console.warn(`[Error Handler] ${reqContext} - Validation error: ${messages.join('; ')}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed: ' + messages.join(', ')
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    console.warn(`[Error Handler] ${reqContext} - Invalid JWT: ${err.message}`);
    return res.status(401).json({
      success: false,
      message: 'Invalid session token. Please log in again.'
    });
  }

  // Default server error
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  console.error(`[Error Handler] ${reqContext} - Returning ${statusCode}: ${err.message}`);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;
