"use client";

import React from "react";
import { CalendarClock } from "lucide-react";
import { formatSchedule, scheduleStatus } from "@/lib/schedule";
import { Badge, cx } from "@/components/ui";

/** "Tue, 10 Sep · Morning" with a Today / Overdue marker. */
export default function ScheduleChip({
  iso,
  now,
  className,
  muted,
}: {
  iso: string | null | undefined;
  now: Date | null;
  className?: string;
  /** Quieter styling for secondary placements (table sub-lines). */
  muted?: boolean;
}) {
  if (!iso) {
    return <span className={cx("text-xs text-ink-400", className)}>Visit not scheduled</span>;
  }
  const status = now ? scheduleStatus(iso, now) : null;
  return (
    <span
      className={cx(
        "inline-flex flex-wrap items-center gap-1.5",
        muted ? "text-xs text-ink-500" : "text-[13px] text-ink-700",
        className
      )}
    >
      <CalendarClock className={cx("shrink-0", muted ? "h-3.5 w-3.5 text-ink-400" : "h-4 w-4 text-ink-400")} />
      <span className={status === "overdue" ? "text-rose-700" : undefined}>{formatSchedule(iso)}</span>
      {status === "today" && (
        <Badge tone="good" dot pulse className="px-2 py-0.5 text-[11px]">
          Today
        </Badge>
      )}
      {status === "overdue" && (
        <Badge tone="bad" dot className="px-2 py-0.5 text-[11px]">
          Overdue
        </Badge>
      )}
    </span>
  );
}
