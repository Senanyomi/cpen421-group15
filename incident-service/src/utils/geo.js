// src/utils/geo.js
// Pure functions — no side effects, easy to test

const EARTH_RADIUS_KM = 6371;

/**
 * Haversine formula — calculates the great-circle distance
 * between two GPS coordinates in kilometres.
 *
 * @param {number} lat1  Origin latitude  (degrees)
 * @param {number} lon1  Origin longitude (degrees)
 * @param {number} lat2  Target latitude  (degrees)
 * @param {number} lon2  Target longitude (degrees)
 * @returns {number} Distance in kilometres (rounded to 2 decimals)
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  // Convert degrees → radians
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_KM * c * 100) / 100; // 2 decimal places
};

/**
 * Given an incident location and a list of responders,
 * return the responders sorted by distance (nearest first).
 *
 * @param {number} incidentLat
 * @param {number} incidentLon
 * @param {Array}  responders   Each must have { latitude, longitude }
 * @returns {Array} Responders with an added `distanceKm` field, sorted ascending
 */
const sortByDistance = (incidentLat, incidentLon, responders) => {
  return responders
    .map((r) => ({
      ...r,
      distanceKm: haversineDistance(incidentLat, incidentLon, r.latitude, r.longitude),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
};

module.exports = { haversineDistance, sortByDistance };
