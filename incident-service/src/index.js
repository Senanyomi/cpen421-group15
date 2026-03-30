// src/index.js — Emergency Incident Service entry point
require('dotenv').config();

const express  = require('express');
const cors     = require('morgan');
const morgan   = require('morgan');
const corsMiddleware = require('cors');

const incidentRoutes  = require('./routes/incident.routes');
const responderRoutes = require('./routes/responder.routes');
const { errorHandler }    = require('./middleware/error.middleware');
const { connectRabbitMQ } = require('./utils/rabbitmq');
const logger = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3002;

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
    service:   'incident-service',
    version:   '3.0.0',
    status:    'healthy',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/incidents',  incidentRoutes);
app.use('/responders', responderRoutes);

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
    logger.info(`Incident Service v3 running on http://localhost:${PORT}`);
    logger.info('Endpoints:');
    logger.info('  POST   /incidents');
    logger.info('  GET    /incidents');
    logger.info('  GET    /incidents/open');
    logger.info('  GET    /incidents/:id');
    logger.info('  PUT    /incidents/:id/status');
    logger.info('  PUT    /incidents/:id/assign');
    logger.info('  POST   /incidents/:id/notes');
    logger.info('  DELETE /incidents/:id          [ADMIN]');
    logger.info('  GET    /responders/nearest');
  });
};

start().catch((err) => {
  logger.error('Failed to start service', err.message);
  process.exit(1);
});
