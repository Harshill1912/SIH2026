"use client";

import React, { useCallback, useEffect, useState } from "react";
import { MapPin, LocateFixed, ExternalLink, AlertTriangle, RefreshCw } from "lucide-react";
import { DEMO_FIX, formatGeo, geoErrorMessage, mapsUrl, type GeoFix } from "@/lib/geo";
import { Button, Label, Mono, cx } from "@/components/ui";

type Status = "locating" | "ok" | "error";

/**
 * Captures the officer's position with the browser Geolocation API. Asks once
 * on mount, can be re-captured, and always offers the seeded shop location as
 * a manual fallback so a laptop demo never gets stuck on a permission prompt.
 */
export default function GeoCapture({
  value,
  onChange,
}: {
  value: GeoFix | null;
  onChange: (fix: GeoFix | null) => void;
}) {
  const [status, setStatus] = useState<Status>(value ? "ok" : "locating");
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
    if (value) return;
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

  const useDemoLocation = () => {
    onChange(DEMO_FIX);
    setStatus("ok");
    setError(null);
  };

  return (
    <div>
      <Label hint={value?.source === "device" ? "from this device" : value ? "manual" : undefined}>
        Inspection geotag
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
              ) : status === "locating" ? (
                <>
                  <div className="text-sm font-medium text-ink-900">Getting a GPS fix…</div>
                  <div className="text-xs text-ink-500">Allow location access if your browser asks.</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-amber-950">{error}</div>
                  <div className="text-xs text-amber-800">
                    Retry, or use the registered shop location for this demo.
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
              {value ? "Re-capture" : "Retry"}
            </Button>
            {(status === "error" || value?.source === "manual") && !(value?.source === "device") && (
              <Button type="button" size="sm" variant="ghost" onClick={useDemoLocation}>
                Use shop location
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
