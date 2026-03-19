// src/validators/dispatch.validators.js

const VALID_TYPES    = ['AMBULANCE', 'POLICE_CAR', 'FIRE_TRUCK', 'HAZMAT_UNIT', 'RESCUE_TEAM', 'COMMAND_UNIT'];
const VALID_STATUSES = ['AVAILABLE', 'DISPATCHED', 'ON_SCENE', 'RETURNING', 'OFFLINE'];

const isEmpty  = (v) => v === undefined || v === null || String(v).trim() === '';
const isFloat  = (v) => !isNaN(parseFloat(v)) && isFinite(v);

// ─── Register Vehicle ─────────────────────────────────────────────────────────
const validateRegister = (body) => {
  const { callSign, type } = body;

  if (isEmpty(callSign)) return { valid: false, message: 'callSign is required.' };
  if (callSign.trim().length < 2 || callSign.trim().length > 20) {
    return { valid: false, message: 'callSign must be 2–20 characters.' };
  }
  if (isEmpty(type)) return { valid: false, message: 'type is required.' };
  if (!VALID_TYPES.includes(type)) {
    return { valid: false, message: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}.` };
  }

  return { valid: true };
};

// ─── Update Location ──────────────────────────────────────────────────────────
const validateLocation = (body) => {
  const { latitude, longitude } = body;

  if (latitude  === undefined || latitude  === null) return { valid: false, message: 'latitude is required.'  };
  if (longitude === undefined || longitude === null) return { valid: false, message: 'longitude is required.' };
  if (!isFloat(latitude)  || parseFloat(latitude)  < -90  || parseFloat(latitude)  > 90)  return { valid: false, message: 'latitude must be between -90 and 90.'   };
  if (!isFloat(longitude) || parseFloat(longitude) < -180 || parseFloat(longitude) > 180) return { valid: false, message: 'longitude must be between -180 and 180.' };

  // speed and heading are optional
  if (body.speed !== undefined && (isNaN(body.speed) || body.speed < 0)) {
    return { valid: false, message: 'speed must be a non-negative number (km/h).' };
  }
  if (body.heading !== undefined && (isNaN(body.heading) || body.heading < 0 || body.heading > 360)) {
    return { valid: false, message: 'heading must be between 0 and 360 degrees.' };
  }

  return { valid: true };
};

// ─── Update Status ────────────────────────────────────────────────────────────
const validateStatus = (body) => {
  const { status } = body;
  if (isEmpty(status)) return { valid: false, message: 'status is required.' };
  if (!VALID_STATUSES.includes(status)) {
    return { valid: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.` };
  }
  return { valid: true };
};

// ─── Assign Vehicle ───────────────────────────────────────────────────────────
const validateAssign = (body) => {
  if (isEmpty(body.incidentId)) return { valid: false, message: 'incidentId is required.' };
  return { valid: true };
};

module.exports = { validateRegister, validateLocation, validateStatus, validateAssign };
