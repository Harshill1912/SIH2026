"use client";

import React from "react";
import { Hourglass } from "lucide-react";
import { Card, cx } from "@/components/ui";

export interface AgeingItem {
  createdAt: string;
  status: string;
}

/**
 * Pendency by age. A count of "12 waiting" says nothing about whether the
 * department is keeping up; twelve filed today and twelve filed last month are
 * very different problems. Buckets make the backlog's shape visible.
 */
const BUCKETS: Array<{ label: string; max: number; tone: string; bar: string }> = [
  { label: "0–3 days", max: 3, tone: "text-seal-700", bar: "bg-seal-500" },
  { label: "4–7 days", max: 7, tone: "text-sky-700", bar: "bg-sky-500" },
  { label: "8–15 days", max: 15, tone: "text-amber-700", bar: "bg-amber-500" },
  { label: "over 15 days", max: Infinity, tone: "text-rose-700", bar: "bg-rose-500" },
];

export default function PendencyBar({
  items,
  now,
}: {
  /** Applications still awaiting assignment. */
  items: AgeingItem[];
  now: Date | null;
}) {
  const counts = BUCKETS.map(() => 0);
  let oldest = 0;

  if (now) {
    for (const it of items) {
      const days = Math.floor((now.getTime() - new Date(it.createdAt).getTime()) / 86_400_000);
      oldest = Math.max(oldest, days);
      const idx = BUCKETS.findIndex((b) => days <= b.max);
      counts[idx === -1 ? BUCKETS.length - 1 : idx]++;
    }
  }

  const total = counts.reduce((a, b) => a + b, 0);
  const breached = counts[2] + counts[3]; // the department's 7-day service norm

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-ink-400" />
          <span className="eyebrow">Pendency by age</span>
        </div>
        {now && total > 0 && (
          <span className="text-xs text-ink-500">
            oldest <span className="tnum font-semibold text-ink-900">{oldest} d</span> · service
            norm 7 days
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-[13px] text-ink-500">
          {now ? "Nothing is waiting for assignment." : "Reading the clock…"}
        </p>
      ) : (
        <>
          <div className="mt-3.5 flex h-2.5 overflow-hidden rounded-full bg-ink-100">
            {BUCKETS.map((b, i) =>
              counts[i] > 0 ? (
                <div
                  key={b.label}
                  className={cx(b.bar, "transition-all")}
                  style={{ width: `${(counts[i] / total) * 100}%` }}
                  title={`${counts[i]} · ${b.label}`}
                />
              ) : null
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {BUCKETS.map((b, i) => (
              <div key={b.label} className="flex items-baseline gap-1.5">
                <span className={cx("h-2 w-2 shrink-0 rounded-full", b.bar)} />
                <span className={cx("tnum text-[15px] font-semibold", counts[i] ? b.tone : "text-ink-300")}>
                  {counts[i]}
                </span>
                <span className="text-xs text-ink-500">{b.label}</span>
              </div>
            ))}
          </div>

          {breached > 0 && (
            <p className="mt-3 text-[13px] text-rose-700">
              <span className="font-semibold">{breached}</span> past the 7-day service norm — assign
              these first.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
