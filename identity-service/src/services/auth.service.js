// src/services/auth.service.js
// All business logic lives here — controllers just call these functions.

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prisma');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} = require('../utils/jwt');
const { publishEvent } = require('../utils/rabbitmq');
const { AppError } = require('../middleware/error.middleware');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// ─── Safe user shape (never return password) ──────────────────────────────────
const safeUser = (user) => ({
  id:        user.id,
  name:      user.name,
  email:     user.email,
  role:      user.role,
  isActive:  user.isActive,
  createdAt: user.createdAt,
});

// ─── Token pair helper ────────────────────────────────────────────────────────
const issueTokens = async (user) => {
  const payload = { userId: user.id, role: user.role };

  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Persist refresh token so we can revoke it on logout
  await prisma.refreshToken.create({
    data: {
      token:     refreshToken,
      userId:    user.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return { accessToken, refreshToken };
};

// ─── Register ─────────────────────────────────────────────────────────────────
const register = async ({ name, email, password, role }) => {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { name: name.trim(), email: email.toLowerCase(), password: hash, role: role || 'OPERATOR' },
  });

  const tokens = await issueTokens(user);

  publishEvent('user.registered', { userId: user.id, role: user.role });
  logger.info(`User registered: ${user.email} [${user.role}]`);

  return { user: safeUser(user), ...tokens };
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Use constant-time comparison even when user not found to prevent timing attacks
  const dummyHash = '$2a$12$invalidhashfortimingprotectiononly000000000000000000000';
  const isMatch = await bcrypt.compare(password, user?.password || dummyHash);

  if (!user || !isMatch) throw new AppError('Invalid email or password.', 401);
  if (!user.isActive)    throw new AppError('Account is deactivated. Contact an administrator.', 403);

  const tokens = await issueTokens(user);

  publishEvent('user.logged_in', { userId: user.id });
  logger.info(`User logged in: ${user.email}`);

  return { user: safeUser(user), ...tokens };
};

// ─── Refresh Tokens ───────────────────────────────────────────────────────────
const refreshTokens = async (incomingRefreshToken) => {
  // 1. Verify the JWT signature and expiry
  const decoded = verifyRefreshToken(incomingRefreshToken);

  // 2. Check it exists in the DB (not yet revoked)
  const stored = await prisma.refreshToken.findUnique({
    where: { token: incomingRefreshToken },
    include: { user: true },
  });

  if (!stored)                        throw new AppError('Refresh token not recognised.', 401);
  if (stored.expiresAt < new Date())  throw new AppError('Refresh token has expired.', 401);
  if (!stored.user.isActive)          throw new AppError('Account is deactivated.', 403);

  // 3. Rotate: delete the old token and issue a fresh pair
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const tokens = await issueTokens(stored.user);

  logger.info(`Tokens refreshed for user: ${stored.user.email}`);
  return tokens;
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (userId, refreshToken) => {
  if (refreshToken) {
    // Revoke the specific refresh token the client sent
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken, userId } });
  } else {
    // No token sent — revoke ALL refresh tokens for this user (logout everywhere)
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  publishEvent('user.logged_out', { userId });
  logger.info(`User logged out: ${userId}`);
};

// ─── Get profile ──────────────────────────────────────────────────────────────
const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found.', 404);
  return safeUser(user);
};

// ─── Update profile ───────────────────────────────────────────────────────────
const updateProfile = async (userId, { name, email }) => {
  const data = {};
  if (name)  data.name  = name.trim();
  if (email) data.email = email.toLowerCase();

  if (Object.keys(data).length === 0) {
    throw new AppError('No valid fields provided to update.', 400);
  }

  const user = await prisma.user.update({ where: { id: userId }, data });

  logger.info(`Profile updated: ${user.email}`);
  return safeUser(user);
};

// ─── Get all users (admin) ────────────────────────────────────────────────────
const getAllUsers = async ({ page = 1, limit = 20, role, isActive } = {}) => {
  const where = {};
  if (role)                         where.role = role;
  if (typeof isActive !== 'undefined') where.isActive = isActive === 'true' || isActive === true;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page:  parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Deactivate user ──────────────────────────────────────────────────────────
const deactivateUser = async (targetId, requesterId) => {
  if (targetId === requesterId) {
    throw new AppError('You cannot deactivate your own account.', 400);
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { isActive: false },
  });

  // Revoke all refresh tokens so active sessions are terminated immediately
  await prisma.refreshToken.deleteMany({ where: { userId: targetId } });

  publishEvent('user.deactivated', { userId: targetId });
  logger.info(`User deactivated: ${user.email} by ${requesterId}`);
  return safeUser(user);
};

// ─── Request password reset ───────────────────────────────────────────────────
const requestPasswordReset = async (email) => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Always return success — don't leak whether the email exists
  if (!user || !user.isActive) {
    logger.warn(`Password reset requested for unknown/inactive email: ${email}`);
    return { message: 'If that email is registered, a reset token has been generated.' };
  }

  // Invalidate any previous reset tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = uuidv4();
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId:    user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  // In production: send this via email. Here we return it for development.
  logger.info(`Password reset token generated for: ${user.email}`);
  publishEvent('user.password_reset_requested', { userId: user.id });

  return {
    message: 'Password reset token generated.',
    // Remove `resetToken` from the response in production — email it instead
    resetToken: process.env.NODE_ENV === 'development' ? token : undefined,
  };
};

// ─── Confirm password reset ───────────────────────────────────────────────────
const resetPassword = async ({ token, newPassword }) => {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record)               throw new AppError('Invalid or expired reset token.', 400);
  if (record.usedAt)         throw new AppError('This reset token has already been used.', 400);
  if (record.expiresAt < new Date()) throw new AppError('Reset token has expired.', 400);

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update password and mark the token as used in one transaction
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Revoke all sessions — user must log in again
    prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  logger.info(`Password reset complete for userId: ${record.userId}`);
  return { message: 'Password has been reset successfully. Please log in again.' };
};

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  getProfile,
  updateProfile,
  getAllUsers,
  deactivateUser,
  requestPasswordReset,
  resetPassword,
};
