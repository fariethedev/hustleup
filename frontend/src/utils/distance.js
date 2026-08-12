// Straight-line distance between two lat/lng points via the Haversine formula.
// No API call needed for this — Google's Distance Matrix API is for travel-time/route
// distance, which is overkill (and a paid, rate-limited call) just to show "≈3 km away".
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

// Wraps the browser Geolocation API in a Promise. Never prompts on its own — callers
// should only invoke this from a user-initiated action (e.g. a "Show distance" toggle),
// since browsers throttle/flag permission prompts that fire on page load.
export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}
