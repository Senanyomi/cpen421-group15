// src/middleware/auth.middleware.js
// This service does NOT call the Identity Service for every request.
// It simply verifies the JWT signature using the shared JWT_ACCESS_SECRET.

const jwt = require('jsonwebtoken');
const { AppError } = require('./error.middleware');

const authenticate = (req, res, next) => {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return next(new AppError('Access token required.', 401));
    }

    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // decoded contains { userId, role, iat, exp }
    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
};

// Usage: authorize('ADMIN', 'DISPATCHER')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError(`Access denied. Required role(s): ${roles.join(', ')}.`, 403));
  }
  next();
};

module.exports = { authenticate, authorize };
