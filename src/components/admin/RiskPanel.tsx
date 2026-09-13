"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Radar,
  RefreshCw,
  CalendarClock,
  ScanSearch,
  MapPinOff,
  Camera,
  Target,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  LoadingState,
  Mono,
  Segmented,
  cx,
  type Tone,
} from "@/components/ui";
import type { IntegrityFlag, RiskBand, RiskFactor } from "@/lib/risk";

interface RankedInstrument {
  instrumentId: string;
  serialNumber: string;
  category: string;
  location: string;
  businessName: string;
  certNumber: string | null;
  score: number;
  band: RiskBand;
  factors: RiskFactor[];
  visit: { applicationNumber: string; status: string; scheduledFor: string | null; assignee: string | null } | null;
}

interface ReviewItem {
  inspectionId: string;
  applicationNumber: string;
  serialNumber: string;
  category: string;
  businessName: string;
  inspector: string;
  badgeNumber: string | null;
  verdict: string;
  inspectedAt: string;
  flags: IntegrityFlag[];
}

interface RiskData {
  counts: Record<RiskBand, number>;
  instruments: RankedInstrument[];
  review: ReviewItem[];
}

type View = "LIKELY" | "ALL" | "REVIEW";

const BAND: Record<RiskBand, { tone: Tone; text: string; ring: string; label: string }> = {
  HIGH: { tone: "bad", text: "text-rose-700", ring: "bg-rose-50 ring-rose-200", label: "High" },
  MEDIUM: { tone: "warn", text: "text-amber-700", ring: "bg-amber-50 ring-amber-200", label: "Medium" },
  LOW: { tone: "neutral", text: "text-ink-500", ring: "bg-ink-50 ring-line", label: "Low" },
};

const FLAG_ICON: Record<IntegrityFlag["key"], typeof MapPinOff> = {
  FAR_FROM_PREMISES: MapPinOff,
  REUSED_PHOTO: Camera,
  PERFECT_READINGS: Target,
  NO_GEOTAG: MapPinOff,
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

async function fetchRisk(): Promise<RiskData | null> {
  try {
    const res = await fetch("/api/risk");
    const d = await res.json();
    return d.success ? d : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 * Where HQ should look first. Ranks instruments by risk of failing their next
 * verification and surfaces inspections whose records warrant a second read.
 * Advisory only — it never changes a verdict or a certificate.
 */
export default function RiskPanel() {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("LIKELY");

  const load = useCallback(async () => {
    const d = await fetchRisk();
    if (d) setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Deferred so the effect body sets no state synchronously.
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const likely = data?.instruments.filter((i) => i.band !== "LOW") ?? [];
  const rows = view === "ALL" ? data?.instruments ?? [] : likely;
  const review = data?.review ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={Radar}
        title={
          <>
            Enforcement intelligence{" "}
            <span className={cx("ml-1 font-normal tnum", (data?.counts.HIGH ?? 0) > 0 ? "text-rose-600" : "text-ink-400")}>
              {data?.counts.HIGH ?? 0}
            </span>
          </>
        }
        subtitle="Ranks instruments by risk of failing, and flags inspection records worth a second look."
        actions={
          <IconButton
            icon={RefreshCw}
            label="Refresh risk scores"
            spinning={loading}
            className="h-8 w-8"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          />
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink-50/60 px-5 py-3">
        <Segmented<View>
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "LIKELY", label: `Likely to fail · ${likely.length}` },
            { value: "ALL", label: "All instruments" },
            { value: "REVIEW", label: `Inspections to review · ${review.length}` },
          ]}
        />
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
          <Info className="h-3.5 w-3.5" />
          Advisory — verdicts still come only from the readings
        </span>
      </div>

      {loading && !data ? (
        <LoadingState label="Scoring instruments" />
      ) : view === "REVIEW" ? (
        review.length === 0 ? (
          <EmptyState compact icon={CheckCircle2} title="No records to review"
            body="Inspections with an unusual geotag, a reused photo or implausibly perfect readings appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {review.map((r) => (
              <li key={r.inspectionId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono chip className="text-xs">{r.applicationNumber}</Mono>
                    <span className="text-[13px] font-medium text-ink-900">{r.businessName}</span>
                    <span className="text-[13px] text-ink-500">· {r.category}</span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {r.flags.map((f) => {
                      const Icon = FLAG_ICON[f.key];
                      return (
                        <li key={f.key} className="flex items-center gap-2 text-[13px]">
                          <Icon className={cx("h-4 w-4 shrink-0", f.severity === "high" ? "text-rose-600" : "text-amber-600")} />
                          <span className="text-ink-800">{f.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-[13px] font-medium text-ink-900">{r.inspector}</p>
                  <p className="text-xs text-ink-500">
                    {r.badgeNumber && <Mono className="text-xs">{r.badgeNumber}</Mono>} · {shortDate(r.inspectedAt)}
                  </p>
                  <Badge tone={r.flags.some((f) => f.severity === "high") ? "bad" : "warn"} className="mt-2">
                    {r.flags.some((f) => f.severity === "high") ? "Review first" : "Worth a look"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : rows.length === 0 ? (
        <EmptyState compact icon={ScanSearch} title="Nothing likely to fail"
          body="No instrument currently scores above the medium-risk threshold." />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((i) => {
            const b = BAND[i.band];
            return (
              <li key={i.instrumentId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className={cx("flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ring-inset", b.ring)}>
                  <span className={cx("text-xl font-semibold leading-none tnum", b.text)}>{i.score}</span>
                  <span className={cx("mt-1 text-[10px] font-medium uppercase tracking-wider", b.text)}>{b.label}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono chip className="text-xs">{i.serialNumber}</Mono>
                    <span className="text-[13px] font-medium text-ink-900">{i.businessName}</span>
                    <span className="text-[13px] text-ink-500">· {i.category}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {i.factors.slice(0, 3).map((f) => (
                      <span key={f.key}
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-xs text-ink-700">
                        <span className="font-mono text-[11px] text-ink-400">+{f.points}</span>
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0">
                  {i.visit ? (
                    <Badge tone="info" dot>
                      <CalendarClock className="h-3.5 w-3.5" />
                      {i.visit.scheduledFor ? `Visit ${shortDate(i.visit.scheduledFor)}` : "Awaiting assignment"}
                    </Badge>
                  ) : i.band !== "LOW" ? (
                    <Badge tone={b.tone}>No visit planned</Badge>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
