// src/controllers/auth.controller.js
const authService = require('../services/auth.service');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateUpdateProfile,
  validateResetPassword,
} = require('../validators/auth.validators');

// ─── POST /auth/register ──────────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const check = validateRegister(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const result = await authService.register(req.body);
  res.status(201).json({ success: true, message: 'Registration successful.', data: result });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const check = validateLogin(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const result = await authService.login(req.body);
  res.json({ success: true, message: 'Login successful.', data: result });
});

// ─── POST /auth/refresh-token ─────────────────────────────────────────────────
const refreshToken = asyncHandler(async (req, res) => {
  const check = validateRefreshToken(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const tokens = await authService.refreshTokens(req.body.refreshToken);
  res.json({ success: true, message: 'Tokens refreshed.', data: tokens });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  // refreshToken in body is optional — if omitted, all sessions are revoked
  await authService.logout(req.user.id, req.body.refreshToken);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ─── GET /auth/profile ────────────────────────────────────────────────────────
const getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  res.json({ success: true, data: user });
});

// ─── PUT /auth/profile ────────────────────────────────────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const check = validateUpdateProfile(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const user = await authService.updateProfile(req.user.id, req.body);
  res.json({ success: true, message: 'Profile updated.', data: user });
});

// ─── GET /auth/users ──────────────────────────────────────────────────────────
const getAllUsers = asyncHandler(async (req, res) => {
  const result = await authService.getAllUsers(req.query);
  res.json({ success: true, data: result.users, pagination: result.pagination });
});

// ─── PUT /auth/users/:id/deactivate ──────────────────────────────────────────
const deactivateUser = asyncHandler(async (req, res) => {
  const user = await authService.deactivateUser(req.params.id, req.user.id);
  res.json({ success: true, message: `User ${user.email} has been deactivated.`, data: user });
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────
// Two-step: (1) request a token, (2) use the token to change the password
const resetPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

  const result = await authService.requestPasswordReset(email);
  res.json({ success: true, ...result });
});

const resetPasswordConfirm = asyncHandler(async (req, res) => {
  const check = validateResetPassword(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const result = await authService.resetPassword(req.body);
  res.json({ success: true, ...result });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  getAllUsers,
  deactivateUser,
  resetPasswordRequest,
  resetPasswordConfirm,
};
