/** Expiry-alert buckets. Pure helpers shared by the API and the UI. */

export type Bucket = "EXPIRED" | "D7" | "D15" | "D30";

export const BUCKET_ORDER: Bucket[] = ["EXPIRED", "D7", "D15", "D30"];

export const BUCKET_LABEL: Record<Bucket, string> = {
  EXPIRED: "Expired",
  D7: "Within 7 days",
  D15: "Within 15 days",
  D30: "Within 30 days",
};

export const BUCKET_SHORT: Record<Bucket, string> = {
  EXPIRED: "Expired",
  D7: "≤ 7 d",
  D15: "≤ 15 d",
  D30: "≤ 30 d",
};

export const BUCKET_TONE: Record<Bucket, "bad" | "warn" | "info"> = {
  EXPIRED: "bad",
  D7: "warn",
  D15: "warn",
  D30: "info",
};

export const ALERT_WINDOW_DAYS = 30;

export function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

/** Buckets are exclusive: a certificate with 5 days left is D7, not D15 or D30. */
export function bucketFor(daysRemaining: number): Bucket | null {
  if (daysRemaining < 0) return "EXPIRED";
  if (daysRemaining <= 7) return "D7";
  if (daysRemaining <= 15) return "D15";
  if (daysRemaining <= ALERT_WINDOW_DAYS) return "D30";
  return null;
}

export function reminderMessage(p: {
  businessName: string;
  category: string;
  serialNumber: string;
  validTill: Date;
  daysRemaining: number;
}): string {
  const date = p.validTill.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const when =
    p.daysRemaining < 0
      ? `expired on ${date}`
      : p.daysRemaining === 0
        ? `expires today (${date})`
        : `expires on ${date} (${p.daysRemaining} day${p.daysRemaining === 1 ? "" : "s"} left)`;
  return `Legal Metrology: verification of ${p.category} ${p.serialNumber} at ${p.businessName} ${when}. Apply for re-verification on e-Metrology to stay compliant under the Legal Metrology Act, 2009.`;
}
