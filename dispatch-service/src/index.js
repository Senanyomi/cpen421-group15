// src/index.js — Dispatch Tracking Service
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');

const vehicleRoutes  = require('./routes/vehicle.routes');
const trackingRoutes = require('./routes/tracking.routes');
const { errorHandler }    = require('./middleware/error.middleware');
const { connectRabbitMQ } = require('./utils/rabbitmq');
const logger = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3003;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cpen421-group15.vercel.app/',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    service:   'dispatch-service',
    version:   '4.0.0',
    status:    'healthy',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/vehicles', vehicleRoutes);
app.use('/tracking', trackingRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
  await connectRabbitMQ();

  app.listen(PORT, () => {
    logger.info(`Dispatch Service v4 running on http://localhost:${PORT}`);
    logger.info('Endpoints:');
    logger.info('  POST  /vehicles/register             [ADMIN, DISPATCHER]');
    logger.info('  GET   /vehicles');
    logger.info('  GET   /vehicles/:id');
    logger.info('  GET   /vehicles/:id/location');
    logger.info('  PUT   /vehicles/:id/location');
    logger.info('  GET   /vehicles/:id/history');
    logger.info('  PUT   /vehicles/:id/status');
    logger.info('  PUT   /vehicles/:id/assign           [ADMIN, DISPATCHER]');
    logger.info('  GET   /tracking/active');
    logger.info('  GET   /tracking/incident/:id');
  });
};

start().catch((err) => {
  logger.error('Failed to start service', err.message);
  process.exit(1);
});
