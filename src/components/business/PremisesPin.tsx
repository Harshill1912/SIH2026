"use client";

import React, { useState } from "react";
import { MapPinOff, Check } from "lucide-react";
import GeoCapture from "@/components/officer/GeoCapture";
import type { GeoFix } from "@/lib/geo";
import { GEOFENCE_RADIUS_M, fixError, formatDistance } from "@/lib/geofence";
import { lookupAddress } from "@/lib/address";
import { Button, Card } from "@/components/ui";

/**
 * Shown to a business enrolled before premises location became mandatory.
 * Until it pins its location, no inspection can be recorded for it, because
 * there is nothing to check the officer's position against.
 */
export default function PremisesPin({ onPinned }: { onPinned: () => void }) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<string | null>(null);
  const problem = fixError(fix);

  const onFix = async (next: GeoFix | null) => {
    setFix(next);
    setDetected(null);
    if (!next) return;
    // Shown so the trader can confirm they really are at the shop before a one-time save.
    const r = await lookupAddress(next.lat, next.lng);
    setDetected(r.ok ? r.address : null);
  };

  const save = async () => {
    if (!fix || problem) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/business/premises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, source: fix.source }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) setError(data.error || "Could not save the location");
      else onPinned();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/40 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <MapPinOff className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink-900">Pin your premises location</h2>
          <p className="mt-0.5 text-[13px] text-ink-600">
            Officers must be on site — within {formatDistance(GEOFENCE_RADIUS_M)} of your premises — to verify your
            instruments. Until you pin it, verification can&apos;t be requested. Stand at your premises and capture it;
            it can be set only once.
          </p>

          <div className="mt-4 max-w-xl space-y-3">
            <GeoCapture
              label="Live location"
              captureLabel="Use my live location"
              autoLocate={false}
              value={fix}
              onChange={onFix}
            />
            {detected && (
              <p className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink-700">
                You appear to be at: <span className="font-medium text-ink-900">{detected}</span>
                <span className="block text-xs text-ink-400">Address data © OpenStreetMap contributors</span>
              </p>
            )}
            {fix && problem && <p className="text-[13px] text-rose-700">{problem}</p>}
            {error && <p className="text-[13px] text-rose-700">{error}</p>}
            <Button icon={Check} onClick={save} loading={saving} disabled={!fix || Boolean(problem)}>
              Save premises location
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
