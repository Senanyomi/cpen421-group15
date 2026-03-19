// src/utils/logger.js
const log = (level, msg, meta) => {
  const ts  = new Date().toISOString();
  const tag = `[${ts}] ${level.toUpperCase().padEnd(5)} [dispatch-service]`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  meta ? out(tag, msg, meta) : out(tag, msg);
};

module.exports = {
  info:  (msg, meta) => log('info',  msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
