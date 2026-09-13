"use client";

import React from "react";
import { Camera, MapPin, ExternalLink, ImageOff, ShieldCheck, Scale } from "lucide-react";
import { mapsUrl } from "@/lib/geo";
import { formatError, formatMass, parseTestWeights } from "@/lib/mpe";
import { Badge, KV, Modal, Mono, cx } from "@/components/ui";

export interface EvidenceInspection {
  id: string;
  result: string;
  notes: string | null;
  photoAttached: boolean;
  photoName: string | null;
  /** JSON array of evaluated calibration rows; "" when none were entered. */
  testWeights?: string | null;
  mpeVerdict?: "PASS" | "FAIL" | null;
  gpsCoordinates: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracyM: number | null;
  inspectedAt: string;
}

/** What HQ sees when it opens an inspected case: the calibration record, the photo, the geotag. */
export default function EvidenceModal({
  open,
  onClose,
  inspection,
  applicationNumber,
  officerName,
  serialNumber,
}: {
  open: boolean;
  onClose: () => void;
  inspection: EvidenceInspection | null;
  applicationNumber?: string;
  officerName?: string;
  serialNumber?: string;
}) {
  if (!inspection) return null;
  const hasGeo = inspection.gpsLat != null && inspection.gpsLng != null;
  const rows = parseTestWeights(inspection.testWeights);

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Camera}
      tone={inspection.result === "PASS" ? "good" : "bad"}
      title="Inspection evidence"
      subtitle={
        <>
          {applicationNumber && <Mono>{applicationNumber}</Mono>}
          {serialNumber && (
            <>
              {" · "}
              <Mono>{serialNumber}</Mono>
            </>
          )}
        </>
      }
      width="max-w-2xl"
    >
      <div className="space-y-5 px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KV
            label="Result"
            value={
              <Badge tone={inspection.result === "PASS" ? "good" : "bad"} dot>
                {inspection.result === "PASS" ? "Passed" : "Failed"}
              </Badge>
            }
          />
          <KV
            label="Inspected"
            value={new Date(inspection.inspectedAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          />
          <KV
            label="Verified by"
            value={
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-seal-700" /> {officerName ?? "—"}
              </span>
            }
          />
        </div>

        {/* Calibration record */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-ink-400" />
              <span className="eyebrow">Calibration record</span>
            </div>
            {inspection.mpeVerdict && (
              <Badge tone={inspection.mpeVerdict === "PASS" ? "good" : "bad"} dot>
                {inspection.mpeVerdict === "PASS" ? "All within MPE" : "Outside MPE"}
              </Badge>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong p-4 text-[13px] text-ink-500">
              No standard-weight table was recorded for this inspection.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    <th className="px-3 py-2 text-left">Standard</th>
                    <th className="px-3 py-2 text-right">Reading</th>
                    <th className="px-3 py-2 text-right">Error</th>
                    <th className="px-3 py-2 text-right">MPE</th>
                    <th className="px-3 py-2 text-center">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <tr key={i} className={cx(!r.pass && "bg-rose-50/50")}>
                      <td className="px-3 py-2 font-mono text-ink-900">{formatMass(r.nominalG)}</td>
                      <td className="px-3 py-2 text-right font-mono text-ink-700">{r.observedG} g</td>
                      <td className={cx("px-3 py-2 text-right font-mono", r.pass ? "text-ink-700" : "font-semibold text-rose-700")}>
                        {formatError(r.errorG)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ink-500">± {r.mpeG} g</td>
                      <td className="px-3 py-2 text-center">
                        <Badge tone={r.pass ? "good" : "bad"}>{r.pass ? "Within" : "Outside"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Photo */}
        {inspection.photoAttached ? (
          <div className="overflow-hidden rounded-xl border border-line bg-ink-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/inspections/${inspection.id}/photo`}
              alt="Lead-seal photo"
              className="mx-auto max-h-[320px] w-auto object-contain"
            />
            {inspection.photoName && (
              <div className="border-t border-line bg-white px-3 py-2 text-xs text-ink-500">
                {inspection.photoName}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 text-sm text-ink-500">
            <ImageOff className="h-5 w-5 shrink-0 text-ink-400" />
            No photo was attached to this inspection.
          </div>
        )}

        <div className="rounded-xl border border-line p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <div className="text-xs text-ink-500">Geotag</div>
              <Mono className="block text-ink-900">{inspection.gpsCoordinates ?? "Not recorded"}</Mono>
              {hasGeo && (
                <a
                  href={mapsUrl({ lat: inspection.gpsLat!, lng: inspection.gpsLng! })}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-seal-700 hover:text-seal-800"
                >
                  Open in Maps <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs text-ink-500">Inspector notes</div>
          <p className="rounded-xl border border-line bg-ink-50/60 p-4 text-[13px] leading-relaxed text-ink-800">
            {inspection.notes || "—"}
          </p>
        </div>
      </div>
    </Modal>
  );
}
