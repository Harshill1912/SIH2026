import { distanceM } from "./geo";

/**
 * On-site enforcement. A verification is lawful only if the officer was at the
 * instrument, so an inspection — and the certificate it produces — is accepted
 * only when the officer's GPS fix is within a set distance of the business's
 * registered premises. Pure and client-safe: the form uses it to explain why
 * Submit is disabled, the API uses it to refuse the request.
 *
 * Configured with public env vars so the browser and the server always agree:
 *   NEXT_PUBLIC_GEOFENCE_RADIUS_M    how close is "on site"             (default 200)
 *   NEXT_PUBLIC_MAX_GPS_ACCURACY_M   worst GPS accuracy accepted        (default 300)
 *   NEXT_PUBLIC_DEMO_LOCATION=true   allow a manually chosen location, for laptop
 *                                    demos with no GPS. Off by default; never in production.
 *
 * Limits, stated plainly: a determined user can spoof browser GPS. The fence
 * stops the honest shortcut — issuing from the office — and every fix, with its
 * accuracy, is kept on the inspection for audit.
 */

const positive = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const GEOFENCE_RADIUS_M = positive(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS_M, 200);
export const MAX_GPS_ACCURACY_M = positive(process.env.NEXT_PUBLIC_MAX_GPS_ACCURACY_M, 300);
export const DEMO_LOCATION_ALLOWED = process.env.NEXT_PUBLIC_DEMO_LOCATION === "true";

export type FixSource = "device" | "manual";

export interface LocationFix {
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  source?: FixSource | null;
}

export interface GeofenceOptions {
  radiusM?: number;
  maxAccuracyM?: number;
  allowManual?: boolean;
  /** False for pinning premises: the reading is saved as given, however rough. */
  checkAccuracy?: boolean;
}

/** "35 m", "1.4 km". */
export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/** Why a location fix is unusable, or null when it can be used. */
export function fixError(fix: LocationFix | null | undefined, opts: GeofenceOptions = {}): string | null {
  const maxAccuracyM = opts.maxAccuracyM ?? MAX_GPS_ACCURACY_M;
  const allowManual = opts.allowManual ?? DEMO_LOCATION_ALLOWED;

  if (!fix || fix.lat == null || fix.lng == null) return "Location is required — capture a GPS fix first";
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || Math.abs(fix.lat) > 90 || Math.abs(fix.lng) > 180) {
    return "The location is not valid — capture it again";
  }
  if (fix.source === "manual") {
    return allowManual ? null : "Location must come from this device's GPS, not be chosen by hand";
  }
  if (opts.checkAccuracy === false) return null;
  if (fix.accuracyM == null || !Number.isFinite(fix.accuracyM) || fix.accuracyM <= 0) {
    return "GPS accuracy is unknown — capture the location again";
  }
  if (fix.accuracyM > maxAccuracyM) {
    return `Location is too rough (±${Math.round(fix.accuracyM)} m) — it needs to be within ±${maxAccuracyM} m. Tap "Try again" and hold still. Laptops estimate location from Wi-Fi and are often this rough; a phone's GPS is far more precise.`;
  }
  return null;
}

export type GeofenceResult =
  | { status: "inside"; distanceM: number; radiusM: number }
  | { status: "outside"; distanceM: number; radiusM: number; message: string }
  | { status: "no-premises"; message: string }
  | { status: "bad-fix"; message: string };

/** Whether an inspection at `fix` counts as on site for `premises`. */
export function checkGeofence(
  fix: LocationFix | null | undefined,
  premises: { lat: number | null; lng: number | null } | null | undefined,
  opts: GeofenceOptions = {}
): GeofenceResult {
  const radiusM = opts.radiusM ?? GEOFENCE_RADIUS_M;

  const bad = fixError(fix, opts);
  if (bad) return { status: "bad-fix", message: bad };

  if (!premises || premises.lat == null || premises.lng == null) {
    return {
      status: "no-premises",
      message:
        "This business has not pinned its premises location, so an on-site inspection can't be confirmed. The trader must pin it from their dashboard first.",
    };
  }

  const d = distanceM({ lat: fix!.lat!, lng: fix!.lng! }, { lat: premises.lat, lng: premises.lng });
  if (d > radiusM) {
    return {
      status: "outside",
      distanceM: d,
      radiusM,
      message: `You are ${formatDistance(d)} from the registered premises. Inspections and certificates can only be recorded on site — within ${formatDistance(radiusM)}.`,
    };
  }
  return { status: "inside", distanceM: d, radiusM };
}
