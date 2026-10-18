/**
 * Geolocation and Haversine distance utilities
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates distance between two coordinates in meters using the Haversine formula
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} distance in meters
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Checks if two points are within a specified radius
 */
function isWithinRadius(lat1, lon1, lat2, lon2, radiusMeters) {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2) <= radiusMeters;
}

/**
 * Calculates geographic centroid of an array of points
 */
function calculateCentroid(points) {
  if (!points || points.length === 0) return { latitude: 0, longitude: 0 };
  
  let totalLat = 0;
  let totalLon = 0;

  for (const pt of points) {
    totalLat += Number(pt.latitude);
    totalLon += Number(pt.longitude);
  }

  return {
    latitude: Number((totalLat / points.length).toFixed(6)),
    longitude: Number((totalLon / points.length).toFixed(6))
  };
}

module.exports = {
  calculateDistanceMeters,
  isWithinRadius,
  calculateCentroid
};
