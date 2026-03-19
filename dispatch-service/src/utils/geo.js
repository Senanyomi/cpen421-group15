// src/utils/geo.js

const EARTH_RADIUS_KM = 6371;

/**
 * Haversine great-circle distance between two GPS coordinates.
 * Returns distance in kilometres, rounded to 2 decimal places.
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
};

/**
 * Attach a distanceKm field to each vehicle and sort nearest first.
 * Vehicles without a known location (lat/lon is null) are placed last.
 */
const attachDistances = (refLat, refLon, vehicles) => {
  return vehicles
    .map((v) => ({
      ...v,
      distanceKm: v.latitude != null && v.longitude != null
        ? haversineDistance(refLat, refLon, v.latitude, v.longitude)
        : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
};

module.exports = { haversineDistance, attachDistances };
