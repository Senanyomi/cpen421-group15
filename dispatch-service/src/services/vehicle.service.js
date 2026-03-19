// src/services/vehicle.service.js
const prisma           = require('../utils/prisma');
const { publishEvent } = require('../utils/rabbitmq');
const { attachDistances } = require('../utils/geo');
const { AppError }     = require('../middleware/error.middleware');
const logger           = require('../utils/logger');

// How many GPS pings to retain per vehicle (configurable via .env)
const GPS_HISTORY_LIMIT = parseInt(process.env.GPS_HISTORY_LIMIT) || 500;

// ─── Status transition rules ──────────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  AVAILABLE:   ['DISPATCHED', 'OFFLINE'],
  DISPATCHED:  ['ON_SCENE', 'AVAILABLE', 'OFFLINE'],
  ON_SCENE:    ['RETURNING', 'AVAILABLE', 'OFFLINE'],
  RETURNING:   ['AVAILABLE', 'OFFLINE'],
  OFFLINE:     ['AVAILABLE'],
};

const assertValidTransition = (current, next) => {
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new AppError(
      `Cannot change status from ${current} to ${next}. Allowed: ${allowed.join(', ') || 'none'}.`,
      400
    );
  }
};

// ─── Register Vehicle ─────────────────────────────────────────────────────────
const registerVehicle = async ({ callSign, type, latitude, longitude }, registeredBy) => {
  const data = {
    callSign: callSign.trim().toUpperCase(),
    type,
    status: 'AVAILABLE',
  };

  // Initial GPS position is optional at registration
  if (latitude != null && longitude != null) {
    data.latitude    = parseFloat(latitude);
    data.longitude   = parseFloat(longitude);
    data.lastUpdated = new Date();
  }

  const vehicle = await prisma.vehicle.create({ data });

  logger.info(`Vehicle registered: ${vehicle.callSign} [${vehicle.type}] by ${registeredBy}`);
  return vehicle;
};

// ─── Get All Vehicles ─────────────────────────────────────────────────────────
const getAllVehicles = async ({ status, type, page = 1, limit = 20 }) => {
  const where = {};
  if (status) where.status = status;
  if (type)   where.type   = type;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { callSign: 'asc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.vehicle.count({ where }),
  ]);

  return {
    vehicles,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  };
};

// ─── Get Vehicle by ID ────────────────────────────────────────────────────────
const getVehicleById = async (id) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      assignments: {
        where:   { status: 'ACTIVE' },
        orderBy: { assignedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!vehicle) throw new AppError('Vehicle not found.', 404);
  return vehicle;
};

// ─── Get Current Location ─────────────────────────────────────────────────────
const getVehicleLocation = async (id) => {
  const vehicle = await prisma.vehicle.findUnique({
    where:  { id },
    select: { id: true, callSign: true, type: true, status: true, latitude: true, longitude: true, lastUpdated: true },
  });
  if (!vehicle) throw new AppError('Vehicle not found.', 404);

  if (vehicle.latitude == null) {
    throw new AppError('No GPS data received yet for this vehicle.', 404);
  }

  return vehicle;
};

// ─── Update GPS Location ──────────────────────────────────────────────────────
const updateLocation = async (id, { latitude, longitude, speed, heading }) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new AppError('Vehicle not found.', 404);
  if (vehicle.status === 'OFFLINE') {
    throw new AppError('Cannot update location for an OFFLINE vehicle.', 400);
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const now = new Date();

  // 1. Update vehicle's current position
  const updated = await prisma.vehicle.update({
    where: { id },
    data:  { latitude: lat, longitude: lon, lastUpdated: now },
  });

  // 2. Record this ping in history
  await prisma.locationPing.create({
    data: {
      vehicleId: id,
      latitude:  lat,
      longitude: lon,
      speed:     speed  != null ? parseFloat(speed)   : null,
      heading:   heading != null ? parseFloat(heading) : null,
      recordedAt: now,
    },
  });

  // 3. Prune oldest pings if we've exceeded the retention limit
  //    (Keeps the history table from growing unbounded in production)
  const count = await prisma.locationPing.count({ where: { vehicleId: id } });
  if (count > GPS_HISTORY_LIMIT) {
    // Find the cutoff record at position GPS_HISTORY_LIMIT
    const cutoff = await prisma.locationPing.findMany({
      where:   { vehicleId: id },
      orderBy: { recordedAt: 'desc' },
      skip:    GPS_HISTORY_LIMIT - 1,
      take:    1,
      select:  { recordedAt: true },
    });

    if (cutoff.length > 0) {
      await prisma.locationPing.deleteMany({
        where: { vehicleId: id, recordedAt: { lt: cutoff[0].recordedAt } },
      });
    }
  }

  // 4. Publish event — Incident and Analytics services can use this
  publishEvent('vehicle.location.updated', {
    vehicleId:   updated.id,
    callSign:    updated.callSign,
    type:        updated.type,
    status:      updated.status,
    latitude:    lat,
    longitude:   lon,
    speed:       speed   ?? null,
    heading:     heading ?? null,
  });

  return updated;
};

// ─── Get Location History ─────────────────────────────────────────────────────
const getLocationHistory = async (id, { page = 1, limit = 50, from, to } = {}) => {
  const vehicle = await prisma.vehicle.findUnique({
    where:  { id },
    select: { id: true, callSign: true, type: true },
  });
  if (!vehicle) throw new AppError('Vehicle not found.', 404);

  const where = { vehicleId: id };
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = new Date(from);
    if (to)   where.recordedAt.lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [pings, total] = await Promise.all([
    prisma.locationPing.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      skip,
      take:    parseInt(limit),
    }),
    prisma.locationPing.count({ where }),
  ]);

  return {
    vehicle,
    history:    pings,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  };
};

// ─── Update Status ────────────────────────────────────────────────────────────
const updateStatus = async (id, status, userId) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new AppError('Vehicle not found.', 404);

  assertValidTransition(vehicle.status, status);

  const updated = await prisma.vehicle.update({ where: { id }, data: { status } });

  publishEvent('vehicle.status_updated', {
    vehicleId:   updated.id,
    callSign:    updated.callSign,
    prevStatus:  vehicle.status,
    newStatus:   status,
    updatedBy:   userId,
  });

  logger.info(`Vehicle ${vehicle.callSign}: ${vehicle.status} → ${status}`);
  return updated;
};

// ─── Assign Vehicle to Incident ───────────────────────────────────────────────
const assignVehicle = async (id, { incidentId }, assignedBy) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new AppError('Vehicle not found.', 404);

  if (vehicle.status !== 'AVAILABLE') {
    throw new AppError(
      `Vehicle ${vehicle.callSign} is ${vehicle.status} and cannot be assigned.`, 400
    );
  }

  // Check for duplicate active assignment to same incident
  const existing = await prisma.vehicleAssignment.findFirst({
    where: { vehicleId: id, incidentId, status: 'ACTIVE' },
  });
  if (existing) {
    throw new AppError(`Vehicle ${vehicle.callSign} is already assigned to incident ${incidentId}.`, 409);
  }

  // Create assignment + advance vehicle status in one transaction
  const [assignment, updatedVehicle] = await prisma.$transaction([
    prisma.vehicleAssignment.create({
      data: { vehicleId: id, incidentId, assignedBy, status: 'ACTIVE' },
    }),
    prisma.vehicle.update({
      where: { id },
      data:  { status: 'DISPATCHED' },
    }),
  ]);

  publishEvent('vehicle.assigned', {
    vehicleId:   vehicle.id,
    callSign:    vehicle.callSign,
    type:        vehicle.type,
    incidentId,
    assignmentId: assignment.id,
    assignedBy,
    latitude:    vehicle.latitude,
    longitude:   vehicle.longitude,
  });

  logger.info(`Vehicle ${vehicle.callSign} assigned to incident ${incidentId} by ${assignedBy}`);
  return { assignment, vehicle: updatedVehicle };
};

// ─── Get Active Vehicles ──────────────────────────────────────────────────────
// Vehicles that are DISPATCHED or ON_SCENE (i.e. actively working an incident)
const getActiveVehicles = async () => {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: { in: ['DISPATCHED', 'ON_SCENE'] } },
    include: {
      assignments: {
        where:   { status: 'ACTIVE' },
        orderBy: { assignedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { callSign: 'asc' },
  });

  return vehicles;
};

// ─── Get Vehicles for a Specific Incident ────────────────────────────────────
const getVehiclesByIncident = async (incidentId) => {
  const assignments = await prisma.vehicleAssignment.findMany({
    where: { incidentId },
    include: {
      vehicle: {
        select: { id: true, callSign: true, type: true, status: true, latitude: true, longitude: true, lastUpdated: true },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });

  if (assignments.length === 0) {
    return { incidentId, total: 0, active: 0, assignments: [] };
  }

  const active = assignments.filter((a) => a.status === 'ACTIVE').length;

  // Attach distance from incident... we'd need incident lat/lon for this.
  // For now we return the raw assignments with vehicle positions.
  return {
    incidentId,
    total:       assignments.length,
    active,
    assignments: assignments.map((a) => ({
      assignmentId:  a.id,
      status:        a.status,
      assignedAt:    a.assignedAt,
      completedAt:   a.completedAt,
      vehicle:       a.vehicle,
    })),
  };
};

module.exports = {
  registerVehicle,
  getAllVehicles,
  getVehicleById,
  getVehicleLocation,
  updateLocation,
  getLocationHistory,
  updateStatus,
  assignVehicle,
  getActiveVehicles,
  getVehiclesByIncident,
};
