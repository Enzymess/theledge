const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Multer file errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
  }

  // Validation errors (express-validator)
  if (err.type === 'validation') {
    return res.status(422).json({ error: err.message, fields: err.fields });
  }

  // Log unexpected errors (but never log req.body — may contain passwords)
  logger.error(err.message, {
    stack:  err.stack,
    method: req.method,
    path:   req.path,
    ip:     req.ip,
  });

  const status  = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Something went wrong. Please try again.'
    : err.message;

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
