// src/utils/dateRange.js
// Parses ?from= and ?to= query params into a Prisma-compatible date filter.
// Falls back to sensible defaults when params are missing.

/**
 * @param {object} query  Express req.query
 * @param {string} field  The DB column name (for the Prisma where clause key)
 * @returns {{ gte: Date, lte: Date }}
 */
const parseDateRange = (query, field = 'createdAt') => {
  const now = new Date();

  // Default: last 30 days
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = query.from ? new Date(query.from) : defaultFrom;
  const to   = query.to   ? new Date(query.to)   : now;

  if (isNaN(from.getTime())) throw new Error('Invalid "from" date.');
  if (isNaN(to.getTime()))   throw new Error('Invalid "to" date.');
  if (from > to)             throw new Error('"from" must be before "to".');

  return { gte: from, lte: to };
};

/**
 * Format seconds into a human-readable string, e.g. 125 → "2m 5s"
 */
const formatDuration = (seconds) => {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

module.exports = { parseDateRange, formatDuration };
