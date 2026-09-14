"use client";

import React, { useCallback, useEffect, useState } from "react";
import { MapPin, LocateFixed, ExternalLink, AlertTriangle, RefreshCw } from "lucide-react";
import { formatGeo, geoErrorMessage, mapsUrl, type GeoFix } from "@/lib/geo";
import { DEMO_LOCATION_ALLOWED } from "@/lib/geofence";
import { Button, Label, Mono, cx } from "@/components/ui";

type Status = "idle" | "locating" | "ok" | "error";

/**
 * Captures a position with the browser Geolocation API. Used by the officer
 * (inspection geotag) and by the trader (pinning their premises).
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
}) {
  const [status, setStatus] = useState<Status>(value ? "ok" : autoLocate ? "locating" : "idle");
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setError("This browser has no location support.");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? null,
          source: "device",
        });
        setStatus("ok");
      },
      (err) => {
        setStatus("error");
        setError(geoErrorMessage(err?.code));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }, [onChange]);

  // First fix on mount. setState only happens inside the geolocation
  // callbacks (or a deferred timeout), never synchronously in the effect.
  useEffect(() => {
    if (value || !autoLocate) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      const id = window.setTimeout(() => {
        setStatus("error");
        setError("This browser has no location support.");
      }, 0);
      return () => window.clearTimeout(id);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? null,
          source: "device",
        });
        setStatus("ok");
      },
      (err) => {
        setStatus("error");
        setError(geoErrorMessage(err?.code));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
    // Intentionally run once; `value` is checked so a re-mount with a fix is a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canUseManual = DEMO_LOCATION_ALLOWED && manualFix != null;
  const useManualLocation = () => {
    if (!manualFix) return;
    onChange({ lat: manualFix.lat, lng: manualFix.lng, accuracyM: null, source: "manual" });
    setStatus("ok");
    setError(null);
  };

  return (
    <div>
      <Label hint={value?.source === "device" ? "from this device" : value ? "manual · demo" : "required"}>
        {label}
      </Label>

      <div
        className={cx(
          "rounded-xl border p-3.5 transition-colors",
          status === "error" && !value
            ? "border-amber-200 bg-amber-50/60"
            : "border-line bg-white"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cx(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                value ? "bg-seal-50 text-seal-700" : status === "error" ? "bg-amber-100 text-amber-700" : "bg-ink-100 text-ink-500"
              )}
            >
              {status === "locating" && !value ? (
                <LocateFixed className="h-4 w-4 animate-pulse-soft" />
              ) : status === "error" && !value ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0">
              {value ? (
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
                  <div className="text-xs text-ink-500">Tap Capture while standing at the premises.</div>
                </>
              ) : status === "locating" ? (
                <>
                  <div className="text-sm font-medium text-ink-900">Getting a GPS fix…</div>
                  <div className="text-xs text-ink-500">Allow location access if your browser asks.</div>
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
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={status === "locating" && !value ? RefreshCw : LocateFixed}
              onClick={locate}
              disabled={status === "locating" && !value}
            >
              {value ? "Re-capture" : status === "idle" ? captureLabel : "Retry"}
            </Button>
            {canUseManual && value?.source !== "device" && (
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
