// src/utils/jwt.js
const jwt = require('jsonwebtoken');

// ─── Access Token (short-lived, 15 min default) ───────────────────────────────
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

// ─── Refresh Token (long-lived, 7 days default) ───────────────────────────────
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// ─── Calculate expiry Date for DB storage ────────────────────────────────────
const getRefreshTokenExpiry = () => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  
  // Parse the JWT expiry format (e.g., "7d", "7h", "3m", "3600s")
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  if (!match) {
    throw new Error(`Invalid JWT_REFRESH_EXPIRES_IN format: ${expiresIn}. Expected format: "7d", "24h", "3600s", etc.`);
  }
  
  const [, amount, unit] = match;
  const ms = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  }[unit];
  
  return new Date(Date.now() + parseInt(amount) * ms);
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
};
