// src/middleware/auth.middleware.js
const jwt      = require('jsonwebtoken');
const { AppError } = require('./error.middleware');

const authenticate = (req, res, next) => {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return next(new AppError('Access token required.', 401));
    }
    const token   = header.split(' ')[1];
    req.user      = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError(`Access denied. Required role(s): ${roles.join(', ')}.`, 403));
  }
  next();
};

module.exports = { authenticate, authorize };
