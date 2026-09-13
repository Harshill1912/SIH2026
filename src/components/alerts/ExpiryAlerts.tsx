"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BellRing,
  Send,
  PlayCircle,
  ShieldCheck,
  RefreshCw,
  MessageSquareText,
  Mail,
} from "lucide-react";
import {
  BUCKET_LABEL,
  BUCKET_ORDER,
  BUCKET_SHORT,
  BUCKET_TONE,
  type Bucket,
} from "@/lib/alerts";
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
} from "@/components/ui";

interface AlertItem {
  bucket: Bucket;
  daysRemaining: number;
  instrumentId: string;
  serialNumber: string;
  category: string;
  model: string;
  location: string;
  businessId: string;
  businessName: string;
  certificateId: string;
  certNumber: string;
  validTill: string;
  renewalStatus: string | null;
  lastReminder: { channel: string; trigger: string; sentAt: string } | null;
}

interface RecentReminder {
  id: string;
  threshold: string;
  trigger: string;
  channel: string;
  recipient: string;
  sentAt: string;
  certNumber: string;
  serialNumber: string;
  businessName: string;
}

interface AlertsData {
  windowDays: number;
  counts: Record<Bucket, number>;
  items: AlertItem[];
  recentReminders: RecentReminder[];
}

type Filter = "ALL" | Bucket;

async function loadAlerts(): Promise<AlertsData | null> {
  try {
    const res = await fetch("/api/alerts");
    const data = await res.json();
    return data.success ? data : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function daysLabel(d: number): string {
  if (d < 0) return `${Math.abs(d)} d overdue`;
  if (d === 0) return "expires today";
  return `${d} d left`;
}

/**
 * Expiry alerts, in four exclusive buckets. Business scope: renew from here.
 * Admin scope: send reminders, run the automated reminder job, see the log.
 *
 * `refreshToken` — bump it when something upstream changes (e.g. a renewal
 * was filed) so the panel reloads without owning that state.
 */
export default function ExpiryAlerts({
  scope,
  onRenew,
  renewingId,
  refreshToken = 0,
}: {
  scope: "business" | "admin";
  onRenew?: (instrumentId: string) => void;
  renewingId?: string | null;
  refreshToken?: number;
}) {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [runningJob, setRunningJob] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "info"; text: string } | null>(null);

  const apply = useCallback((d: AlertsData | null) => {
    if (d) setData(d);
    setLoading(false);
  }, []);

  const reload = useCallback(() => loadAlerts().then(apply), [apply]);

  useEffect(() => {
    let alive = true;
    loadAlerts().then((d) => alive && apply(d));
    return () => {
      alive = false;
    };
  }, [apply, refreshToken]);

  const flash = (tone: "good" | "info", text: string) => {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const sendReminder = async (item: AlertItem, channel: "SMS" | "EMAIL") => {
    setSendingId(item.certificateId + channel);
    try {
      const res = await fetch("/api/alerts/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateId: item.certificateId, channel }),
      });
      const d = await res.json();
      if (d.success) {
        flash("good", d.message);
        void reload();
      } else alert(d.error || "Failed to send reminder");
    } finally {
      setSendingId(null);
    }
  };

  const runJob = async () => {
    setRunningJob(true);
    try {
      const res = await fetch("/api/alerts/run", { method: "POST" });
      const d = await res.json();
      if (d.success) {
        flash(d.sent > 0 ? "good" : "info", d.message);
        void reload();
      } else alert(d.error || "Job failed");
    } finally {
      setRunningJob(false);
    }
  };

  const total = data ? BUCKET_ORDER.reduce((n, b) => n + data.counts[b], 0) : 0;
  const items = data ? (filter === "ALL" ? data.items : data.items.filter((i) => i.bucket === filter)) : [];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={BellRing}
        title={
          <>
            Expiry alerts{" "}
            {data && (
              <span className={cx("ml-1 font-normal tnum", total > 0 ? "text-rose-600" : "text-ink-400")}>
                {total}
              </span>
            )}
          </>
        }
        subtitle={
          scope === "admin"
            ? "Certificates across the jurisdiction lapsing within 30 days. Reminders go out automatically at 30, 15 and 7 days and on expiry."
            : "Your certificates lapsing within 30 days. The department reminds you at 30, 15 and 7 days — renew early to avoid a gap."
        }
        actions={
          <>
            {scope === "admin" && (
              <Button size="sm" variant="accent" icon={PlayCircle} loading={runningJob} onClick={runJob}>
                Run reminder job
              </Button>
            )}
            <IconButton icon={RefreshCw} label="Refresh alerts" spinning={loading} onClick={() => { setLoading(true); void reload(); }} className="h-8 w-8" />
          </>
        }
      />

      {notice && (
        <div className="px-5 pt-4">
          <Notice tone={notice.tone} icon={notice.tone === "good" ? Send : ShieldCheck}>
            {notice.text}
          </Notice>
        </div>
      )}

      {loading && !data ? (
        <LoadingState label="Checking certificate validity" />
      ) : !data || total === 0 ? (
        <EmptyState
          compact
          icon={ShieldCheck}
          title="Nothing expiring in the next 30 days"
          body={
            scope === "admin"
              ? "Every certificate in the jurisdiction is more than 30 days from lapsing."
              : "All your certificates are healthy. You'll see alerts here 30 days before any of them lapse."
          }
        />
      ) : (
        <>
          {/* Bucket filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink-50/60 px-5 py-3">
            <Segmented<Filter>
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "ALL", label: `All · ${total}` },
                ...BUCKET_ORDER.map((b) => ({
                  value: b,
                  label: `${BUCKET_SHORT[b]} · ${data.counts[b]}`,
                })),
              ]}
            />
            <span className="text-xs text-ink-500">Sorted soonest first</span>
          </div>

          {items.length === 0 ? (
            <EmptyState compact icon={ShieldCheck} title={`Nothing in "${filter === "ALL" ? "All" : BUCKET_LABEL[filter]}"`} />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const tone = BUCKET_TONE[item.bucket];
                return (
                  <li key={item.certificateId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cx(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tnum",
                          tone === "bad"
                            ? "bg-rose-50 text-rose-700"
                            : tone === "warn"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-sky-50 text-sky-700"
                        )}
                        title={BUCKET_LABEL[item.bucket]}
                      >
                        {item.daysRemaining < 0 ? "!" : item.daysRemaining}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Mono chip className="font-semibold">{item.serialNumber}</Mono>
                          <Badge tone={tone} dot pulse={item.bucket === "D7" || item.bucket === "EXPIRED"}>
                            {daysLabel(item.daysRemaining)}
                          </Badge>
                          {item.renewalStatus && (
                            <Badge tone="good">Renewal {item.renewalStatus === "ASSIGNED" ? "scheduled" : "filed"}</Badge>
                          )}
                        </div>
                        <div className="mt-1 text-[13px] text-ink-700">
                          {item.category} · {item.model}
                          {scope === "admin" && (
                            <>
                              {" · "}
                              <span className="font-medium text-ink-900">{item.businessName}</span>
                            </>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                          <span>
                            {item.daysRemaining < 0 ? "Expired" : "Expires"} {fmtDate(item.validTill)}
                          </span>
                          <Mono className="text-ink-500">{item.certNumber}</Mono>
                          {item.lastReminder ? (
                            <span className="inline-flex items-center gap-1 text-seal-700">
                              {item.lastReminder.channel === "EMAIL" ? <Mail className="h-3 w-3" /> : <MessageSquareText className="h-3 w-3" />}
                              {item.lastReminder.trigger === "AUTO" ? "Auto reminder" : "Reminder"} · {timeAgo(item.lastReminder.sentAt)}
                            </span>
                          ) : (
                            <span className="text-ink-400">No reminder yet</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                      {scope === "business" && onRenew && !item.renewalStatus && (
                        <Button
                          size="sm"
                          variant={item.bucket === "EXPIRED" ? "danger" : "accent"}
                          loading={renewingId === item.instrumentId}
                          onClick={() => onRenew(item.instrumentId)}
                        >
                          {item.bucket === "EXPIRED" ? "Re-verify now" : "Renew early"}
                        </Button>
                      )}
                      {scope === "admin" && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={MessageSquareText}
                            loading={sendingId === item.certificateId + "SMS"}
                            onClick={() => sendReminder(item, "SMS")}
                          >
                            SMS
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={Mail}
                            loading={sendingId === item.certificateId + "EMAIL"}
                            onClick={() => sendReminder(item, "EMAIL")}
                          >
                            Email
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* Reminder log */}
      {data && data.recentReminders.length > 0 && (
        <div className="border-t border-line bg-ink-50/40 px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">{scope === "admin" ? "Recent reminders sent" : "Reminders you've received"}</span>
            <span className="text-[11px] text-ink-400">Simulated gateway — no SMS/email leaves this prototype</span>
          </div>
          <ul className="space-y-1.5">
            {data.recentReminders.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-600">
                {r.channel === "EMAIL" ? <Mail className="h-3 w-3 text-ink-400" /> : <MessageSquareText className="h-3 w-3 text-ink-400" />}
                <span className="font-medium text-ink-800">{r.trigger === "AUTO" ? "Auto" : "HQ"}</span>
                <span>·</span>
                <Mono>{r.serialNumber}</Mono>
                {scope === "admin" && (
                  <>
                    <span>·</span>
                    <span>{r.businessName}</span>
                  </>
                )}
                <span>·</span>
                <span>{BUCKET_SHORT[r.threshold as Bucket] ?? r.threshold}</span>
                <span>·</span>
                <span className="text-ink-400">{r.recipient}</span>
                <span className="ml-auto text-ink-400">{timeAgo(r.sentAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
