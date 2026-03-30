// src/validators/incident.validators.js

const VALID_TYPES = ['FIRE', 'MEDICAL', 'POLICE', 'NATURAL_DISASTER', 'HAZMAT', 'TRAFFIC', 'OTHER'];
const VALID_STATUSES = ['REPORTED', 'ACKNOWLEDGED', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const isEmpty  = (v) => v === undefined || v === null || String(v).trim() === '';
const isNumber = (v) => typeof v === 'number' && isFinite(v);

// ─── Create Incident ──────────────────────────────────────────────────────────
const validateCreateIncident = (body) => {
  const { type, description, latitude, longitude, citizenName } = body;

  if (isEmpty(type))        return { valid: false, message: 'type is required.' };
  if (!VALID_TYPES.includes(type)) {
    return { valid: false, message: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}.` };
  }
  if (isEmpty(description)) return { valid: false, message: 'description is required.' };
  if (description.trim().length < 10) {
    return { valid: false, message: 'description must be at least 10 characters.' };
  }
  if (isEmpty(citizenName)) return { valid: false, message: 'citizenName is required.' };
  if (citizenName.trim().length < 2) {
    return { valid: false, message: 'citizenName must be at least 2 characters.' };
  }
  if (citizenName.trim().length > 100) {
    return { valid: false, message: 'citizenName must not exceed 100 characters.' };
  }
  if (latitude === undefined || latitude === null) return { valid: false, message: 'latitude is required.' };
  if (longitude === undefined || longitude === null) return { valid: false, message: 'longitude is required.' };
  if (!isNumber(parseFloat(latitude)) || parseFloat(latitude) < -90 || parseFloat(latitude) > 90) {
    return { valid: false, message: 'latitude must be a number between -90 and 90.' };
  }
  if (!isNumber(parseFloat(longitude)) || parseFloat(longitude) < -180 || parseFloat(longitude) > 180) {
    return { valid: false, message: 'longitude must be a number between -180 and 180.' };
  }

  return { valid: true };
};

// ─── Update Status ────────────────────────────────────────────────────────────
const validateUpdateStatus = (body) => {
  const { status } = body;
  if (isEmpty(status)) return { valid: false, message: 'status is required.' };
  if (!VALID_STATUSES.includes(status)) {
    return { valid: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.` };
  }
  return { valid: true };
};

// ─── Assign Responder ─────────────────────────────────────────────────────────
const validateAssign = (body) => {
  const { assignedVehicleId } = body;
  if (isEmpty(assignedVehicleId)) return { valid: false, message: 'assignedVehicleId is required.' };
  return { valid: true };
};

// ─── Add Note ─────────────────────────────────────────────────────────────────
const validateNote = (body) => {
  const { content } = body;
  if (isEmpty(content))             return { valid: false, message: 'content is required.' };
  if (content.trim().length < 3)    return { valid: false, message: 'Note content must be at least 3 characters.' };
  if (content.trim().length > 2000) return { valid: false, message: 'Note content must not exceed 2000 characters.' };
  return { valid: true };
};

// ─── Nearest Responders ───────────────────────────────────────────────────────
const validateNearestQuery = (query) => {
  const { lat, lon } = query;
  if (isEmpty(lat)) return { valid: false, message: 'lat query parameter is required.' };
  if (isEmpty(lon)) return { valid: false, message: 'lon query parameter is required.' };

  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);

  if (!isNumber(parsedLat) || parsedLat < -90  || parsedLat > 90)  return { valid: false, message: 'lat must be between -90 and 90.' };
  if (!isNumber(parsedLon) || parsedLon < -180 || parsedLon > 180) return { valid: false, message: 'lon must be between -180 and 180.' };

  return { valid: true };
};

module.exports = {
  validateCreateIncident,
  validateUpdateStatus,
  validateAssign,
  validateNote,
  validateNearestQuery,
};
