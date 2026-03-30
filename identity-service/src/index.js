// src/index.js — Identity & Authentication Service entry point
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const authRoutes  = require('./routes/auth.routes');
const { errorHandler } = require('./middleware/error.middleware');
const { apiLimiter }   = require('./middleware/rateLimiter.middleware');
const { connectRabbitMQ } = require('./utils/rabbitmq');
const logger = require('./utils/logger');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cpen421-group15.vercel.app',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(apiLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    service:   'identity-service',
    version:   '2.0.0',
    status:    'healthy',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
  // Try to connect to RabbitMQ — service starts even if RabbitMQ is unavailable
  await connectRabbitMQ();

  app.listen(PORT, () => {
    logger.info(`Identity Service v2 running on http://localhost:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info('Endpoints:');
    logger.info('  POST   /auth/register');
    logger.info('  POST   /auth/login');
    logger.info('  POST   /auth/refresh-token');
    logger.info('  POST   /auth/logout');
    logger.info('  GET    /auth/profile');
    logger.info('  PUT    /auth/profile');
    logger.info('  GET    /auth/users               [ADMIN]');
    logger.info('  PUT    /auth/users/:id/deactivate [ADMIN]');
    logger.info('  POST   /auth/reset-password');
    logger.info('  POST   /auth/reset-password/confirm');
  });
};

start().catch((err) => {
  logger.error('Failed to start service', err.message);
  process.exit(1);
});
