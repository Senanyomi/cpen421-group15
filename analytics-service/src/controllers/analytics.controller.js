// src/controllers/analytics.controller.js
const service = require('../services/analytics.service');
const { asyncHandler } = require('../middleware/error.middleware');

// GET /analytics/response-times
const getResponseTimes = asyncHandler(async (req, res) => {
  const data = await service.getResponseTimes(req.query);
  res.json({ success: true, data });
});

// GET /analytics/incidents-by-region
const getIncidentsByRegion = asyncHandler(async (req, res) => {
  const data = await service.getIncidentsByRegion(req.query);
  res.json({ success: true, data });
});

// GET /analytics/resource-utilization
const getResourceUtilization = asyncHandler(async (req, res) => {
  const data = await service.getResourceUtilization(req.query);
  res.json({ success: true, data });
});

// GET /analytics/summary-dashboard
const getSummaryDashboard = asyncHandler(async (req, res) => {
  const data = await service.getSummaryDashboard(req.query);
  res.json({ success: true, data });
});

module.exports = {
  getResponseTimes,
  getIncidentsByRegion,
  getResourceUtilization,
  getSummaryDashboard,
};
