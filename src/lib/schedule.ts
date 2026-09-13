/**
 * Site-visit scheduling helpers. A visit is a calendar day plus a half-day
 * slot, stored as one DateTime: 10:00 local = morning, 14:00 local = afternoon.
 * Pure functions only — safe on server and client.
 */

export type Slot = "AM" | "PM";

export const SLOT_HOUR: Record<Slot, number> = { AM: 10, PM: 14 };

export const SLOT_LABEL: Record<Slot, string> = {
  AM: "Morning",
  PM: "Afternoon",
};

export const SLOT_WINDOW: Record<Slot, string> = {
  AM: "10:00 – 13:00",
  PM: "14:00 – 17:00",
};

/** "2026-09-10" for an <input type="date">, in local time. */
export function toDateInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Combine a date-input value and a slot into the stored DateTime. */
export function combineDateAndSlot(dateValue: string, slot: Slot): Date {
  const [y, m, d] = dateValue.split("-").map(Number);
  return new Date(y, m - 1, d, SLOT_HOUR[slot], 0, 0, 0);
}

export function slotOf(d: Date): Slot {
  return d.getHours() < 12 ? "AM" : "PM";
}

/** The next Monday–Friday after `from`. */
export function nextWorkingDay(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

/** "Tue, 10 Sep · Morning" */
export function formatSchedule(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${SLOT_LABEL[slotOf(d)]}`;
}

export type ScheduleStatus = "today" | "overdue" | "upcoming";

export function scheduleStatus(iso: string, now: Date): ScheduleStatus {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return "today";
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay < now ? "overdue" : "upcoming";
}
