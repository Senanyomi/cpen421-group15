// src/index.js — Analytics & Monitoring Service
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const analyticsRoutes     = require('./routes/analytics.routes');
const { errorHandler }    = require('./middleware/error.middleware');
const { connectRabbitMQ } = require('./utils/rabbitmq');
const logger = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3004;

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
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    service:   'analytics-service',
    version:   '5.0.0',
    status:    'healthy',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/analytics', analyticsRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
  // Connect to RabbitMQ — this starts the event consumer
  await connectRabbitMQ();

  app.listen(PORT, () => {
    logger.info(`Analytics Service v5 running on http://localhost:${PORT}`);
    logger.info('Endpoints (all require JWT):');
    logger.info('  GET  /analytics/response-times');
    logger.info('  GET  /analytics/incidents-by-region');
    logger.info('  GET  /analytics/resource-utilization');
    logger.info('  GET  /analytics/summary-dashboard');
    logger.info('');
    logger.info('Consuming RabbitMQ events:');
    logger.info('  incident.created');
    logger.info('  incident.status_updated');
    logger.info('  vehicle.assigned');
    logger.info('  vehicle.location.updated');
  });
};

start().catch((err) => {
  logger.error('Failed to start', err.message);
  process.exit(1);
});
