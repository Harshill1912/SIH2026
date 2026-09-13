"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Inbox,
  MapPin,
  Phone,
  ArrowRight,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  LoadingState,
  Mono,
  Notice,
  Segmented,
  cx,
  type Tone,
} from "@/components/ui";

interface Report {
  id: string;
  reference: string;
  kind: string;
  note: string | null;
  placeText: string | null;
  contact: string | null;
  status: "OPEN" | "ACTIONED" | "CLOSED";
  createdAt: string;
  serialNumber: string | null;
  category: string | null;
  businessName: string | null;
  certNumber: string | null;
}

const KIND_LABEL: Record<string, string> = {
  NO_STICKER: "No sticker",
  EXPIRED: "Expired sticker",
  DAMAGED: "Damaged QR",
  SHORT_WEIGHT: "Suspected short weight",
  OTHER: "Other",
};

const KIND_TONE: Record<string, Tone> = {
  NO_STICKER: "bad",
  EXPIRED: "warn",
  DAMAGED: "warn",
  SHORT_WEIGHT: "bad",
  OTHER: "neutral",
};

type Filter = "OPEN" | "ACTIONED" | "CLOSED" | "ALL";

const timeAgo = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
};

/** Citizen complaints, and what HQ does about them. */
export default function ReportsQueue() {
  const [reports, setReports] = useState<Report[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (f: Filter) => {
    try {
      const res = await fetch(`/api/reports?status=${f}`);
      const d = await res.json();
      if (d.success) {
        setReports(d.reports);
        setCounts(d.counts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // Deferred so the effect body sets no state synchronously.
    const id = window.setTimeout(() => {
      if (!alive) return;
      setLoading(true);
      void load(filter);
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [filter, load]);

  const move = async (id: string, status: Report["status"]) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const d = await res.json();
      if (d.success) {
        setNotice(d.message);
        setTimeout(() => setNotice(null), 3000);
        void load(filter);
      }
    } finally {
      setBusyId(null);
    }
  };

  const open = counts.OPEN ?? 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={ShieldAlert}
        title={
          <>
            Citizen reports{" "}
            <span className={cx("ml-1 font-normal tnum", open > 0 ? "text-rose-600" : "text-ink-400")}>
              {open}
            </span>
          </>
        }
        subtitle="Filed from the public verification page — no account, so anyone who sees a missing or lapsed sticker can raise one."
        actions={
          <IconButton
            icon={RefreshCw}
            label="Refresh reports"
            spinning={loading}
            className="h-8 w-8"
            onClick={() => {
              setLoading(true);
              void load(filter);
            }}
          />
        }
      />

      {notice && (
        <div className="px-5 pt-4">
          <Notice tone="good" icon={CheckCircle2}>
            {notice}
          </Notice>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink-50/60 px-5 py-3">
        <Segmented<Filter>
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "OPEN", label: `Open · ${counts.OPEN ?? 0}` },
            { value: "ACTIONED", label: `Actioned · ${counts.ACTIONED ?? 0}` },
            { value: "CLOSED", label: `Closed · ${counts.CLOSED ?? 0}` },
            { value: "ALL", label: "All" },
          ]}
        />
        <span className="text-xs text-ink-500">Newest first</span>
      </div>

      {loading && reports.length === 0 ? (
        <LoadingState label="Loading reports" />
      ) : reports.length === 0 ? (
        <EmptyState
          compact
          icon={Inbox}
          title={filter === "OPEN" ? "No open reports" : "Nothing here"}
          body="Complaints raised by the public appear here for enforcement follow-up."
        />
      ) : (
        <ul className="divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={KIND_TONE[r.kind] ?? "neutral"} dot>
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </Badge>
                  <Mono chip className="text-xs">{r.reference}</Mono>
                  {r.status !== "OPEN" && (
                    <Badge tone={r.status === "CLOSED" ? "neutral" : "info"}>
                      {r.status === "CLOSED" ? "Closed" : "Actioned"}
                    </Badge>
                  )}
                  <span className="text-xs text-ink-400">{timeAgo(r.createdAt)}</span>
                </div>

                {(r.serialNumber || r.certNumber) && (
                  <div className="mt-1.5 text-[13px] text-ink-800">
                    {r.serialNumber && <Mono className="font-semibold">{r.serialNumber}</Mono>}
                    {r.businessName && <span className="text-ink-600"> · {r.businessName}</span>}
                    {r.category && <span className="text-ink-500"> · {r.category}</span>}
                  </div>
                )}

                {r.note && <p className="mt-1 max-w-2xl text-[13px] text-ink-700">“{r.note}”</p>}

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                  {r.placeText && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {r.placeText}
                    </span>
                  )}
                  {r.contact ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {r.contact}
                    </span>
                  ) : (
                    <span className="text-ink-400">Anonymous</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                {r.status === "OPEN" && (
                  <Button
                    size="sm"
                    variant="accent"
                    iconRight={ArrowRight}
                    loading={busyId === r.id}
                    onClick={() => move(r.id, "ACTIONED")}
                  >
                    Mark actioned
                  </Button>
                )}
                {r.status !== "CLOSED" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyId === r.id}
                    onClick={() => move(r.id, "CLOSED")}
                  >
                    Close
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
