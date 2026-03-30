// src/services/incident.service.js
const prisma         = require('../utils/prisma');
const { publishEvent } = require('../utils/rabbitmq');
const { sortByDistance } = require('../utils/geo');
const { AppError }   = require('../middleware/error.middleware');
const logger         = require('../utils/logger');

// ─── Status transition rules ──────────────────────────────────────────────────
// Enforces a sensible lifecycle — you can't jump from REPORTED to CLOSED, etc.
const ALLOWED_TRANSITIONS = {
  REPORTED:     ['ACKNOWLEDGED', 'CLOSED'],
  ACKNOWLEDGED: ['DISPATCHED', 'CLOSED'],
  DISPATCHED:   ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS:  ['RESOLVED', 'CLOSED'],
  RESOLVED:     ['CLOSED'],
  CLOSED:       [], // terminal state
};

const assertValidTransition = (current, next) => {
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new AppError(
      `Cannot change status from ${current} to ${next}. Allowed next states: ${allowed.join(', ') || 'none'}.`,
      400
    );
  }
};

// ─── Create Incident ──────────────────────────────────────────────────────────
const createIncident = async ({ type, description, latitude, longitude, citizenName }, reportedBy) => {
  const incident = await prisma.incident.create({
    data: {
      type,
      description: description.trim(),
      latitude:  parseFloat(latitude),
      longitude: parseFloat(longitude),
      citizenName: citizenName.trim(),
      reportedBy,
      status: 'REPORTED',
    },
  });

  // ── Publish event to RabbitMQ so Dispatch + Analytics services can react ──
  publishEvent('incident.created', {
    incidentId:  incident.id,
    type:        incident.type,
    status:      incident.status,
    latitude:    incident.latitude,
    longitude:   incident.longitude,
    citizenName: incident.citizenName,
    reportedBy:  incident.reportedBy,
  });

  logger.info(`Incident created: ${incident.id} [${incident.type}] by ${reportedBy}`);
  return incident;
};

// ─── Get All Incidents ────────────────────────────────────────────────────────
const getAllIncidents = async ({ status, type, page = 1, limit = 20 }) => {
  const where = {};
  if (status) where.status = status;
  if (type)   where.type   = type;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        notes: { orderBy: { createdAt: 'desc' }, take: 1 }, // latest note only in list view
      },
    }),
    prisma.incident.count({ where }),
  ]);

  return {
    incidents,
    pagination: {
      page:  parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Get Active (Open) Incidents ──────────────────────────────────────────────
// "Open" = anything not yet resolved or closed
const getActiveIncidents = async () => {
  const incidents = await prisma.incident.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED'] },
    },
    orderBy: [
      { status: 'asc' },     // group by lifecycle stage
      { createdAt: 'asc' },  // oldest first within each group
    ],
    include: { notes: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  return incidents;
};

// ─── Get Incident by ID ───────────────────────────────────────────────────────
const getIncidentById = async (id) => {
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: 'asc' } }, // full notes in detail view
    },
  });
  if (!incident) throw new AppError('Incident not found.', 404);
  return incident;
};

// ─── Update Status ────────────────────────────────────────────────────────────
const updateStatus = async (id, status, userId) => {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) throw new AppError('Incident not found.', 404);

  assertValidTransition(incident.status, status);

  const data = { status };
  if (status === 'RESOLVED' || status === 'CLOSED') {
    data.resolvedAt = new Date();
  }

  const updated = await prisma.incident.update({ where: { id }, data });

  publishEvent('incident.status_updated', {
    incidentId:  updated.id,
    prevStatus:  incident.status,
    newStatus:   updated.status,
    updatedBy:   userId,
  });

  logger.info(`Incident ${id}: ${incident.status} → ${status}`);
  return updated;
};

// ─── Assign Responder / Vehicle ───────────────────────────────────────────────
const assignResponder = async (id, assignedVehicleId, userId) => {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) throw new AppError('Incident not found.', 404);

  if (['RESOLVED', 'CLOSED'].includes(incident.status)) {
    throw new AppError(`Cannot assign a responder to a ${incident.status} incident.`, 400);
  }

  // Automatically advance status to DISPATCHED if we're still at REPORTED or ACKNOWLEDGED
  const newStatus =
    ['REPORTED', 'ACKNOWLEDGED'].includes(incident.status) ? 'DISPATCHED' : incident.status;

  const updated = await prisma.incident.update({
    where: { id },
    data: { assignedVehicleId, status: newStatus },
  });

  publishEvent('incident.responder_assigned', {
    incidentId:        updated.id,
    assignedVehicleId,
    newStatus:         updated.status,
    assignedBy:        userId,
  });

  logger.info(`Incident ${id} assigned to vehicle ${assignedVehicleId} by ${userId}`);
  return updated;
};

// ─── Add Note ─────────────────────────────────────────────────────────────────
const addNote = async (incidentId, content, authorId) => {
  // Confirm the incident exists
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new AppError('Incident not found.', 404);

  if (incident.status === 'CLOSED') {
    throw new AppError('Cannot add notes to a CLOSED incident.', 400);
  }

  const note = await prisma.incidentNote.create({
    data: { incidentId, content: content.trim(), authorId },
  });

  publishEvent('incident.note_added', { incidentId, noteId: note.id, authorId });
  logger.info(`Note added to incident ${incidentId} by ${authorId}`);

  return note;
};

// ─── Delete Incident ──────────────────────────────────────────────────────────
const deleteIncident = async (id) => {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) throw new AppError('Incident not found.', 404);

  // Prevent deletion of active incidents — must be closed first
  if (!['RESOLVED', 'CLOSED'].includes(incident.status)) {
    throw new AppError(
      `Cannot delete an incident with status ${incident.status}. Close it first.`,
      400
    );
  }

  await prisma.incident.delete({ where: { id } });

  publishEvent('incident.deleted', { incidentId: id });
  logger.info(`Incident deleted: ${id}`);
};

// ─── Nearest Responders ───────────────────────────────────────────────────────
const getNearestResponders = async ({ lat, lon, limit = 5, type, status = 'AVAILABLE' }) => {
  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);

  // Fetch all responders matching the filters from the DB
  const where = {};
  if (status) where.status = status;
  if (type)   where.type   = type;

  const responders = await prisma.responder.findMany({ where });

  if (responders.length === 0) {
    return [];
  }

  // Sort by Haversine distance and return the nearest N
  const sorted = sortByDistance(parsedLat, parsedLon, responders);
  return sorted.slice(0, parseInt(limit));
};

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
