// src/middleware/auth.middleware.js
const { verifyAccessToken } = require('../utils/jwt');
const prisma = require('../utils/prisma');
const { AppError } = require('./error.middleware');

// ─── Authenticate ─────────────────────────────────────────────────────────────
// Verifies the access token and attaches the user to req.user
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return next(new AppError('Access token required.', 401));
    }

    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Confirm user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!user)          return next(new AppError('User not found.', 401));
    if (!user.isActive) return next(new AppError('Account is deactivated.', 403));

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// ─── Authorize ────────────────────────────────────────────────────────────────
// Usage: authorize('ADMIN', 'DISPATCHER')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(
      new AppError(`Access denied. Required role(s): ${roles.join(', ')}.`, 403)
    );
  }
  next();
};

module.exports = { authenticate, authorize };
