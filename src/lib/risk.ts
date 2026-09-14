import { distanceM } from "./geo";
import { divisionFromCapacity, evaluateAll, type EvaluatedPoint, type TestWeightRow } from "./mpe";

/**
 * Enforcement intelligence: which instruments to look at first, and which
 * inspections deserve a second look.
 *
 * ADVISORY ONLY. Nothing here decides whether an instrument is lawful — that is
 * the MPE engine's job, from the officer's own readings, and it stays that way.
 * A risk score tells HQ where to send a scarce officer; an integrity flag tells
 * HQ which record to read twice. Neither blocks, fails or revokes anything.
 *
 * Phase 1 (this file) is an explainable points model built from signals the
 * platform already records, so it works on day one with no training data.
 * Every point it awards comes with a plain-English reason. Once a pilot has
 * produced labelled PASS/FAIL outcomes, a trained model can replace
 * `scoreInstrument` behind the same `RiskResult` shape — the UI does not change.
 */

// ── risk score ────────────────────────────────────────────────────────────

export interface RiskInput {
  category: string;
  capacity: string;
  /** Readings from the most recent inspection; empty if none were recorded. */
  lastReadings: TestWeightRow[];
  /**
   * Server-evaluated points from the most recent inspection, any measure. When
   * present they are used as stored — they carry the limits the verdict was
   * signed against, including a scale interval the checker read off the plate.
   */
  lastPoints?: EvaluatedPoint[] | null;
  /** Earlier FAIL verdicts for this instrument. */
  failCount: number;
  /** Days until the current certificate lapses; negative once lapsed; null if never certified. */
  daysToExpiry: number | null;
  /** Open citizen reports tied to this instrument, by kind, from the last 90 days. */
  reportKinds: string[];
}

export interface RiskFactor {
  key: "DRIFT" | "LAPSED" | "EXPIRING" | "NEVER_VERIFIED" | "PAST_FAIL" | "REPORTS" | "CATEGORY";
  label: string;
  points: number;
}

export type RiskBand = "HIGH" | "MEDIUM" | "LOW";

export interface RiskResult {
  score: number;
  band: RiskBand;
  /** Largest contribution first. */
  factors: RiskFactor[];
  /** Worst |error| / MPE across the last readings, or null with no usable readings. */
  driftRatio: number | null;
}

/**
 * Category prior. Instruments that dispense continuously or carry heavy loads
 * wear faster than a counter scale; the numbers are deliberately modest so a
 * category alone can never push an instrument into the high band.
 */
const CATEGORY_POINTS: Array<[RegExp, number, string]> = [
  [/fuel|dispens/i, 15, "Fuel dispensers see continuous use"],
  [/weighbridge/i, 12, "Weighbridges carry heavy, repeated loads"],
  [/platform/i, 8, "Platform scales see heavy use"],
  [/counter|scale/i, 4, "Counter scale"],
];

export const HIGH_RISK = 60;
export const MEDIUM_RISK = 30;

/** Worst |error| / MPE across a set of readings, re-evaluated from the capacity. */
export function driftRatio(capacity: string, readings: TestWeightRow[]): number | null {
  const e = divisionFromCapacity(capacity);
  if (e == null || readings.length === 0) return null;
  const rows = evaluateAll(readings, e).filter((r) => r.mpeG > 0);
  if (rows.length === 0) return null;
  return Math.max(...rows.map((r) => Math.abs(r.errorG) / r.mpeG));
}

/** Worst |error| / MPE across already-evaluated points, or null with none. */
export function pointsDrift(points: EvaluatedPoint[]): number | null {
  const usable = points.filter((p) => p.mpe > 0);
  return usable.length ? Math.max(...usable.map((p) => Math.abs(p.error) / p.mpe)) : null;
}

export function scoreInstrument(input: RiskInput): RiskResult {
  const factors: RiskFactor[] = [];
  const add = (key: RiskFactor["key"], points: number, label: string) => {
    if (points > 0) factors.push({ key, points, label });
  };

  // Drift: the strongest early signal. A scale that read at 90% of its limit
  // last year is the one most likely to be outside it this year.
  const drift = input.lastPoints?.length
    ? pointsDrift(input.lastPoints)
    : driftRatio(input.capacity, input.lastReadings);
  if (drift != null) {
    const pct = Math.round(drift * 100);
    if (drift > 1) add("DRIFT", 40, `Last reading was outside its limit (${pct}% of MPE)`);
    else if (drift >= 0.9) add("DRIFT", 35, `Last reading was at ${pct}% of its limit`);
    else if (drift >= 0.7) add("DRIFT", 22, `Last reading was at ${pct}% of its limit`);
    else if (drift >= 0.5) add("DRIFT", 10, `Last reading was at ${pct}% of its limit`);
  }

  // Validity.
  const d = input.daysToExpiry;
  if (d == null) add("NEVER_VERIFIED", 15, "Never verified");
  else if (d < 0) add("LAPSED", 25, `Certificate lapsed ${-d} day${-d === 1 ? "" : "s"} ago`);
  else if (d <= 15) add("EXPIRING", 10, `Certificate expires in ${d} day${d === 1 ? "" : "s"}`);

  // History.
  if (input.failCount > 0) {
    add("PAST_FAIL", Math.min(30, input.failCount * 15),
      `Failed ${input.failCount} earlier verification${input.failCount === 1 ? "" : "s"}`);
  }

  // The public. A short-weight complaint is direct evidence; a missing or
  // damaged sticker is circumstantial.
  if (input.reportKinds.length > 0) {
    const pts = input.reportKinds.reduce((n, k) => n + (k === "SHORT_WEIGHT" ? 25 : 10), 0);
    const n = input.reportKinds.length;
    const short = input.reportKinds.includes("SHORT_WEIGHT");
    add("REPORTS", Math.min(30, pts),
      `${n} citizen report${n === 1 ? "" : "s"} in 90 days${short ? " — incl. short weight" : ""}`);
  }

  const cat = CATEGORY_POINTS.find(([re]) => re.test(input.category));
  if (cat) add("CATEGORY", cat[1], cat[2]);

  factors.sort((a, b) => b.points - a.points);
  const score = Math.min(100, factors.reduce((n, f) => n + f.points, 0));
  const band: RiskBand = score >= HIGH_RISK ? "HIGH" : score >= MEDIUM_RISK ? "MEDIUM" : "LOW";
  return { score, band, factors, driftRatio: drift };
}

// ── inspection integrity ──────────────────────────────────────────────────

export interface IntegrityInput {
  capacity: string;
  readings: TestWeightRow[];
  geotag: { lat: number; lng: number } | null;
  /** The business's registered premises, when known. */
  premises: { lat: number; lng: number } | null;
  /** Other inspections whose seal photo has byte-identical content. */
  photoSharedWith: string[];
  /** Server-evaluated points, any measure; preferred over re-deriving from `readings`. */
  points?: EvaluatedPoint[] | null;
}

export type FlagSeverity = "high" | "medium";

export interface IntegrityFlag {
  key: "FAR_FROM_PREMISES" | "REUSED_PHOTO" | "PERFECT_READINGS" | "NO_GEOTAG";
  severity: FlagSeverity;
  label: string;
}

/** Beyond this, a geotag is not plausibly "at the shop", even with poor GPS. */
export const PREMISES_RADIUS_M = 500;

/**
 * Patterns worth a second look. Each has an innocent explanation — a GPS fix
 * taken in the car park, a scale that genuinely read true — which is exactly
 * why these are flags for a person to read and never automatic outcomes.
 */
export function integrityFlags(input: IntegrityInput): IntegrityFlag[] {
  const flags: IntegrityFlag[] = [];

  if (!input.geotag) {
    flags.push({ key: "NO_GEOTAG", severity: "medium", label: "No geotag recorded for this inspection" });
  } else if (input.premises) {
    const m = distanceM(input.geotag, input.premises);
    if (m > PREMISES_RADIUS_M) {
      const far = m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
      flags.push({ key: "FAR_FROM_PREMISES", severity: "high", label: `Geotag is ${far} from the registered premises` });
    }
  }

  if (input.photoSharedWith.length > 0) {
    flags.push({
      key: "REUSED_PHOTO",
      severity: "high",
      label: `Seal photo is identical to ${input.photoSharedWith.join(", ")}`,
    });
  }

  // Real instruments carry some error. Three or more readings that all land
  // exactly on the nominal value is what a copied or invented record looks like.
  const e = divisionFromCapacity(input.capacity);
  const errors = input.points?.length
    ? input.points.map((p) => p.error)
    : e != null
      ? evaluateAll(input.readings, e).map((r) => r.errorG)
      : [];
  if (errors.length >= 3 && errors.every((err) => err === 0)) {
    flags.push({
      key: "PERFECT_READINGS",
      severity: "medium",
      label: `All ${errors.length} readings exactly on the nominal value`,
    });
  }

  const rank = { high: 0, medium: 1 };
  return flags.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
