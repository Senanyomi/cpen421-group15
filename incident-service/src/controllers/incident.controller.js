// src/controllers/incident.controller.js
const service = require('../services/incident.service');
const { asyncHandler } = require('../middleware/error.middleware');
const {
  validateCreateIncident,
  validateUpdateStatus,
  validateAssign,
  validateNote,
  validateNearestQuery,
} = require('../validators/incident.validators');

// ─── POST /incidents ──────────────────────────────────────────────────────────
const createIncident = asyncHandler(async (req, res) => {
  const check = validateCreateIncident(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const incident = await service.createIncident(req.body, req.user.userId);
  res.status(201).json({ success: true, message: 'Incident reported.', data: incident });
});

// ─── GET /incidents ───────────────────────────────────────────────────────────
const getAllIncidents = asyncHandler(async (req, res) => {
  const result = await service.getAllIncidents(req.query);
  res.json({ success: true, data: result.incidents, pagination: result.pagination });
});

// ─── GET /incidents/open ──────────────────────────────────────────────────────
// NOTE: This route must be registered BEFORE /incidents/:id to avoid Express
//       treating "open" as an :id parameter
const getActiveIncidents = asyncHandler(async (req, res) => {
  const incidents = await service.getActiveIncidents();
  res.json({ success: true, count: incidents.length, data: incidents });
});

// ─── GET /incidents/:id ───────────────────────────────────────────────────────
const getIncidentById = asyncHandler(async (req, res) => {
  const incident = await service.getIncidentById(req.params.id);
  res.json({ success: true, data: incident });
});

// ─── PUT /incidents/:id/status ────────────────────────────────────────────────
const updateStatus = asyncHandler(async (req, res) => {
  const check = validateUpdateStatus(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const incident = await service.updateStatus(req.params.id, req.body.status, req.user.userId);
  res.json({ success: true, message: `Status updated to ${incident.status}.`, data: incident });
});

// ─── PUT /incidents/:id/assign ────────────────────────────────────────────────
const assignResponder = asyncHandler(async (req, res) => {
  const check = validateAssign(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const incident = await service.assignResponder(
    req.params.id,
    req.body.assignedVehicleId,
    req.user.userId
  );
  res.json({ success: true, message: 'Responder assigned.', data: incident });
});

// ─── POST /incidents/:id/notes ────────────────────────────────────────────────
const addNote = asyncHandler(async (req, res) => {
  const check = validateNote(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const note = await service.addNote(req.params.id, req.body.content, req.user.userId);
  res.status(201).json({ success: true, message: 'Note added.', data: note });
});

// ─── DELETE /incidents/:id ────────────────────────────────────────────────────
const deleteIncident = asyncHandler(async (req, res) => {
  await service.deleteIncident(req.params.id);
  res.json({ success: true, message: 'Incident deleted.' });
});

// ─── GET /responders/nearest ──────────────────────────────────────────────────
const getNearestResponders = asyncHandler(async (req, res) => {
  const check = validateNearestQuery(req.query);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });

  const responders = await service.getNearestResponders(req.query);
  res.json({
    success: true,
    count: responders.length,
    query: {
      lat:    parseFloat(req.query.lat),
      lon:    parseFloat(req.query.lon),
      limit:  parseInt(req.query.limit) || 5,
      status: req.query.status || 'AVAILABLE',
      type:   req.query.type || null,
    },
    data: responders,
  });
});

module.exports = {
  createIncident,
  getAllIncidents,
  getActiveIncidents,
  getIncidentById,
  updateStatus,
  assignResponder,
  addNote,
  deleteIncident,
  getNearestResponders,
};
