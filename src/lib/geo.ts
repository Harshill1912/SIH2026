/** Client-safe geotag helpers (no browser APIs at module level). */

export interface GeoFix {
  lat: number;
  lng: number;
  /** Metres, from the device. Null for a manually chosen location. */
  accuracyM: number | null;
  source: "device" | "manual";
}

/** Fallback for laptops without GPS / denied permission: the seeded shop. */
export const DEMO_FIX: GeoFix = {
  lat: 28.6328,
  lng: 77.2197,
  accuracyM: null,
  source: "manual",
};

/** "28.63280° N, 77.21970° E (±12 m)" — what gets signed into the certificate. */
export function formatGeo(fix: GeoFix): string {
  const lat = `${Math.abs(fix.lat).toFixed(5)}° ${fix.lat >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(fix.lng).toFixed(5)}° ${fix.lng >= 0 ? "E" : "W"}`;
  const tail =
    fix.source === "manual"
      ? " (manual)"
      : fix.accuracyM != null
        ? ` (±${Math.round(fix.accuracyM)} m)`
        : "";
  return `${lat}, ${lng}${tail}`;
}

/** Great-circle distance in metres (haversine). Accurate to well under 1% at city scale. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function mapsUrl(fix: { lat: number; lng: number }): string {
  return `https://www.google.com/maps?q=${fix.lat.toFixed(6)},${fix.lng.toFixed(6)}`;
}

/** Plain-English reason for a GeolocationPositionError code. */
export function geoErrorMessage(code: number | undefined): string {
  switch (code) {
    case 1:
      return "Location permission was denied.";
    case 2:
      return "Location is unavailable on this device.";
    case 3:
      return "Timed out waiting for a GPS fix.";
    default:
      return "Location could not be determined.";
  }
}
