// How far from the site a named venue may be and still count as the one a plan names: the
// OpenStreetMap check, Qloo name search and the /check copy all use it.
export const SEARCH_RADIUS_KM = 25;

// Great-circle distance in kilometres.
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
