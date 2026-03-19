// src/utils/prisma.js
const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'error' }],
});

prisma.$on('error', (e) => logger.error('Prisma error', e));

module.exports = prisma;
