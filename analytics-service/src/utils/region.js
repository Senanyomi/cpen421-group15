// src/utils/region.js
// Converts a GPS coordinate pair into a coarse region label.
//
// Strategy: divide the world into 0.1° × 0.1° grid cells (roughly 11 km²).
// Each cell gets a label like "5.6N_0.2W". This is intentionally simple —
// in production you'd reverse-geocode to a named district/county instead.

/**
 * @param {number} lat
 * @param {number} lon
 * @returns {string}  e.g. "5.6N_0.2W"
 */
const deriveRegion = (lat, lon) => {
  if (lat == null || lon == null) return 'UNKNOWN';

  // Snap to 0.1° grid
  const latBucket = (Math.floor(Math.abs(lat)  * 10) / 10).toFixed(1);
  const lonBucket = (Math.floor(Math.abs(lon)  * 10) / 10).toFixed(1);
  const latDir    = lat >= 0 ? 'N' : 'S';
  const lonDir    = lon >= 0 ? 'E' : 'W';

  return `${latBucket}${latDir}_${lonBucket}${lonDir}`;
};

module.exports = { deriveRegion };
