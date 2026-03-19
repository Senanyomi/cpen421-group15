// src/controllers/vehicle.controller.js
const service = require('../services/vehicle.service');
const { asyncHandler } = require('../middleware/error.middleware');
const {
  validateRegister,
  validateLocation,
  validateStatus,
  validateAssign,
} = require('../validators/dispatch.validators');

// ─── POST /vehicles/register ──────────────────────────────────────────────────
const registerVehicle = asyncHandler(async (req, res) => {
  const check = validateRegister(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const vehicle = await service.registerVehicle(req.body, req.user.userId);
  res.status(201).json({ success: true, message: 'Vehicle registered.', data: vehicle });
});

// ─── GET /vehicles ────────────────────────────────────────────────────────────
const getAllVehicles = asyncHandler(async (req, res) => {
  const result = await service.getAllVehicles(req.query);
  res.json({ success: true, data: result.vehicles, pagination: result.pagination });
});

// ─── GET /vehicles/:id ────────────────────────────────────────────────────────
const getVehicleById = asyncHandler(async (req, res) => {
  const vehicle = await service.getVehicleById(req.params.id);
  res.json({ success: true, data: vehicle });
});

// ─── GET /vehicles/:id/location ───────────────────────────────────────────────
const getVehicleLocation = asyncHandler(async (req, res) => {
  const location = await service.getVehicleLocation(req.params.id);
  res.json({ success: true, data: location });
});

// ─── PUT /vehicles/:id/location ───────────────────────────────────────────────
const updateLocation = asyncHandler(async (req, res) => {
  const check = validateLocation(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const vehicle = await service.updateLocation(req.params.id, req.body);
  res.json({ success: true, message: 'Location updated.', data: vehicle });
});

// ─── GET /vehicles/:id/history ────────────────────────────────────────────────
const getLocationHistory = asyncHandler(async (req, res) => {
  const result = await service.getLocationHistory(req.params.id, req.query);
  res.json({
    success: true,
    data:       result.history,
    vehicle:    result.vehicle,
    pagination: result.pagination,
  });
});

// ─── PUT /vehicles/:id/status ─────────────────────────────────────────────────
const updateStatus = asyncHandler(async (req, res) => {
  const check = validateStatus(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const vehicle = await service.updateStatus(req.params.id, req.body.status, req.user.userId);
  res.json({ success: true, message: `Status updated to ${vehicle.status}.`, data: vehicle });
});

// ─── PUT /vehicles/:id/assign ─────────────────────────────────────────────────
const assignVehicle = asyncHandler(async (req, res) => {
  const check = validateAssign(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const result = await service.assignVehicle(req.params.id, req.body, req.user.userId);
  res.json({ success: true, message: 'Vehicle assigned to incident.', data: result });
});

module.exports = {
  registerVehicle,
  getAllVehicles,
  getVehicleById,
  getVehicleLocation,
  updateLocation,
  getLocationHistory,
  updateStatus,
  assignVehicle,
};
