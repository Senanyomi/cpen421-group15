// src/utils/logger.js
// Lightweight logger — swap for Winston/Pino in production

const levels = { info: 'INFO', warn: 'WARN', error: 'ERROR' };

const log = (level, message, meta) => {
  const ts = new Date().toISOString();
  const tag = `[${ts}] ${levels[level]} [identity-service]`;
  if (meta) {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](tag, message, meta);
  } else {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](tag, message);
  }
};

module.exports = {
  info:  (msg, meta) => log('info',  msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
