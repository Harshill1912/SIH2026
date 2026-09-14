"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, ExternalLink, AlertTriangle, Check } from "lucide-react";
import { formatGeo, geoErrorMessage, mapsUrl, type GeoFix } from "@/lib/geo";
import { DEMO_LOCATION_ALLOWED, MAX_GPS_ACCURACY_M } from "@/lib/geofence";
import { Button, Label, Mono, cx } from "@/components/ui";

type Status = "idle" | "locating" | "ok" | "error";

/** Stop listening as soon as a reading is this good. */
const GOOD_ACCURACY_M = 25;
/** Longest we keep listening for a better reading. */
const SAMPLE_MS = 12_000;

const toFix = (pos: GeolocationPosition): GeoFix => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracyM: pos.coords.accuracy ?? null,
  source: "device",
});

/**
 * Captures a position with the browser Geolocation API. Used by the officer
 * (inspection geotag) and by the trader (pinning their premises).
 *
 * The first reading a browser gives is usually its roughest — often a cached
 * Wi-Fi estimate. So instead of taking it, this listens for up to
 * SAMPLE_MS, shows the accuracy improving, and keeps the best reading. It stops
 * early once a reading reaches GOOD_ACCURACY_M, and the user can accept the
 * current best at any time. Only the final fix is reported to the parent.
 *
 * A manually chosen location is offered only when NEXT_PUBLIC_DEMO_LOCATION is
 * on — for laptop demos with no GPS. In production the fix must come from the
 * device, and the server refuses anything else.
 */
export default function GeoCapture({
  value,
  onChange,
  label = "Inspection geotag",
  autoLocate = true,
  manualFix = null,
  manualLabel = "Use shop location",
  captureLabel = "Capture",
  quick = false,
}: {
  value: GeoFix | null;
  onChange: (fix: GeoFix | null) => void;
  label?: string;
  /** Ask for a fix as soon as the component mounts. */
  autoLocate?: boolean;
  /** Demo-mode fallback location; ignored unless demo locations are allowed. */
  manualFix?: { lat: number; lng: number } | null;
  manualLabel?: string;
  /** Text of the button before any fix exists. */
  captureLabel?: string;
  /** Take the first reading and finish — no accuracy sampling. Used for pinning premises. */
  quick?: boolean;
}) {
  const [status, setStatus] = useState<Status>(value ? "ok" : "idle");
  const [error, setError] = useState<string | null>(null);
  /** Best accuracy seen so far while listening. */
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);
  /** Ends the current listening session; `accept` keeps the best reading, otherwise it is discarded. */
  const stopRef = useRef<((accept: boolean) => void) | null>(null);

  // Never leave the GPS radio on after the component goes away.
  useEffect(() => () => stopRef.current?.(false), []);

  const locate = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setError("This browser has no location support.");
      return;
    }
    stopRef.current?.(false);
    setStatus("locating");
    setError(null);
    setLiveAccuracy(null);

    let best: GeolocationPosition | null = null;
    let lastErrorCode: number | undefined;
    let over = false;

    const stop = (accept: boolean) => {
      if (over) return;
      over = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(timer);
      stopRef.current = null;
      if (!accept) return;
      setLiveAccuracy(null);
      if (best) {
        onChange(toFix(best));
        setStatus("ok");
      } else {
        setStatus("error");
        setError(geoErrorMessage(lastErrorCode ?? 3));
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos;
          setLiveAccuracy(pos.coords.accuracy);
        }
        if (quick || pos.coords.accuracy <= GOOD_ACCURACY_M) stop(true);
      },
      (err) => {
        lastErrorCode = err?.code;
        // Permission denied will not change by waiting; anything else, keep listening.
        if (err?.code === 1) stop(true);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: SAMPLE_MS }
    );
    const timer = window.setTimeout(() => stop(true), SAMPLE_MS);
    stopRef.current = stop;
  };

  // First capture on mount, deferred so no state is set synchronously in the effect.
  useEffect(() => {
    if (value || !autoLocate) return;
    const id = window.setTimeout(locate, 0);
    return () => window.clearTimeout(id);
    // Intentionally run once: re-running on every parent render would restart the listening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canUseManual = DEMO_LOCATION_ALLOWED && manualFix != null;
  const useManualLocation = () => {
    if (!manualFix) return;
    stopRef.current?.(false);
    onChange({ lat: manualFix.lat, lng: manualFix.lng, accuracyM: null, source: "manual" });
    setStatus("ok");
    setError(null);
    setLiveAccuracy(null);
  };

  const listening = status === "locating";
  const tooRough =
    !quick && value?.source === "device" && value.accuracyM != null && value.accuracyM > MAX_GPS_ACCURACY_M;

  return (
    <div>
      <Label hint={value?.source === "device" ? "from this device" : value ? "manual · demo" : "required"}>
        {label}
      </Label>

      <div
        className={cx(
          "rounded-xl border p-3.5 transition-colors",
          status === "error" && !value ? "border-amber-200 bg-amber-50/60" : "border-line bg-white"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cx(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                listening
                  ? "bg-ink-100 text-ink-500"
                  : value
                    ? "bg-seal-50 text-seal-700"
                    : status === "error"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-ink-100 text-ink-500"
              )}
            >
              {listening ? (
                <LocateFixed className="h-4 w-4 animate-pulse-soft" />
              ) : status === "error" && !value ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0">
              {listening ? (
                <>
                  <div className="text-sm font-medium text-ink-900">
                    {liveAccuracy == null
                      ? "Getting your location…"
                      : `Improving accuracy… ±${Math.round(liveAccuracy)} m`}
                  </div>
                  <div className="text-xs text-ink-500">
                    {liveAccuracy == null
                      ? "Allow location access if your browser asks."
                      : liveAccuracy > MAX_GPS_ACCURACY_M
                        ? `Needs ±${MAX_GPS_ACCURACY_M} m or better. Hold still; outdoors and on a phone is faster.`
                        : "Good enough — waiting a moment for a sharper reading."}
                  </div>
                </>
              ) : value ? (
                <>
                  <Mono className="block font-semibold text-ink-900">{formatGeo(value)}</Mono>
                  <a
                    href={mapsUrl(value)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-seal-700 hover:text-seal-800"
                  >
                    Open in Maps <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              ) : status === "idle" ? (
                <>
                  <div className="text-sm font-medium text-ink-900">No location captured yet</div>
                  <div className="text-xs text-ink-500">Tap the button while standing at the premises.</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-amber-950">{error}</div>
                  <div className="text-xs text-amber-800">
                    {canUseManual
                      ? "Retry, or use the demo location."
                      : "Allow location access in your browser settings, then retry."}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {listening ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={Check}
                onClick={() => stopRef.current?.(true)}
                disabled={liveAccuracy == null}
              >
                Use this reading
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" icon={LocateFixed} onClick={locate}>
                {value ? (tooRough ? "Try again" : "Re-capture") : status === "idle" ? captureLabel : "Retry"}
              </Button>
            )}
            {canUseManual && value?.source !== "device" && !listening && (
              <Button type="button" size="sm" variant="ghost" onClick={useManualLocation}>
                {manualLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
