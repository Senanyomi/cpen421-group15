// src/validators/auth.validators.js
// All validators return { valid: true } or { valid: false, message: '...' }

const VALID_ROLES = ['ADMIN', 'DISPATCHER', 'OPERATOR', 'RESPONDER', 'ANALYST'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

// Password rules: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char
const isStrongPassword = (str) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(str);

const isEmpty = (str) => !str || String(str).trim().length === 0;

// ─── Register ─────────────────────────────────────────────────────────────────
const validateRegister = (body) => {
  const { name, email, password, role } = body;

  if (isEmpty(name))    return { valid: false, message: 'Name is required.' };
  if (name.trim().length < 2) return { valid: false, message: 'Name must be at least 2 characters.' };
  if (isEmpty(email))   return { valid: false, message: 'Email is required.' };
  if (!isEmail(email))  return { valid: false, message: 'Invalid email address.' };
  if (isEmpty(password)) return { valid: false, message: 'Password is required.' };
  if (!isStrongPassword(password)) {
    return {
      valid: false,
      message:
        'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
    };
  }
  if (role && !VALID_ROLES.includes(role)) {
    return { valid: false, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.` };
  }

  return { valid: true };
};

// ─── Login ────────────────────────────────────────────────────────────────────
const validateLogin = (body) => {
  const { email, password } = body;
  if (isEmpty(email))   return { valid: false, message: 'Email is required.' };
  if (!isEmail(email))  return { valid: false, message: 'Invalid email address.' };
  if (isEmpty(password)) return { valid: false, message: 'Password is required.' };
  return { valid: true };
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const validateRefreshToken = (body) => {
  if (isEmpty(body.refreshToken)) return { valid: false, message: 'refreshToken is required.' };
  return { valid: true };
};

// ─── Update Profile ───────────────────────────────────────────────────────────
const validateUpdateProfile = (body) => {
  const { name, email } = body;
  if (name !== undefined && isEmpty(name)) return { valid: false, message: 'Name cannot be empty.' };
  if (name !== undefined && name.trim().length < 2) return { valid: false, message: 'Name must be at least 2 characters.' };
  if (email !== undefined) {
    if (isEmpty(email)) return { valid: false, message: 'Email cannot be empty.' };
    if (!isEmail(email)) return { valid: false, message: 'Invalid email address.' };
  }
  return { valid: true };
};

// ─── Reset Password ───────────────────────────────────────────────────────────
const validateResetPassword = (body) => {
  const { token, newPassword } = body;
  if (isEmpty(token))       return { valid: false, message: 'Reset token is required.' };
  if (isEmpty(newPassword)) return { valid: false, message: 'New password is required.' };
  if (!isStrongPassword(newPassword)) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
    };
  }
  return { valid: true };
};

module.exports = {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateUpdateProfile,
  validateResetPassword,
};
