// src/controllers/tracking.controller.js
const service = require('../services/vehicle.service');
const { asyncHandler } = require('../middleware/error.middleware');

// ─── GET /tracking/active ─────────────────────────────────────────────────────
const getActiveVehicles = asyncHandler(async (req, res) => {
  const vehicles = await service.getActiveVehicles();
  res.json({
    success: true,
    count:   vehicles.length,
    data:    vehicles,
  });
});

// ─── GET /tracking/incident/:id ───────────────────────────────────────────────
const getVehiclesByIncident = asyncHandler(async (req, res) => {
  const result = await service.getVehiclesByIncident(req.params.id);
  res.json({ success: true, data: result });
});

module.exports = { getActiveVehicles, getVehiclesByIncident };
