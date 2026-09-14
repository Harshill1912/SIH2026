/**
 * Maximum Permissible Error (MPE) for non-automatic weighing instruments,
 * following the OIML R76 / Legal Metrology (General) Rules, 2011 verification
 * scale interval bands. Pure functions — shared by the officer form and the API.
 *
 * The rule is expressed in verification scale intervals (e). For accuracy
 * class III, which covers ordinary commercial scales, the MPE at initial
 * verification is:
 *
 *     load ≤ 500 e            →  ± 0.5 e
 *     500 e < load ≤ 2000 e   →  ± 1.0 e
 *     2000 e < load ≤ 10000 e →  ± 1.5 e
 */

export interface TestWeightRow {
  /** Nominal value of the standard weight applied, in grams. */
  nominalG: number;
  /** What the instrument displayed, in grams. */
  observedG: number;
}

export interface EvaluatedRow extends TestWeightRow {
  /** observed − nominal, in grams. Positive = the instrument over-reads. */
  errorG: number;
  /** Permitted error at this load, in grams. */
  mpeG: number;
  pass: boolean;
}

/**
 * Parse the division ("e") out of a capacity string such as "30 kg / 1 g",
 * "300 kg / 50 g" or "60 Metric Tonnes". Returns grams, or null when the
 * string carries no division the officer's form can use.
 */
export function divisionFromCapacity(capacity: string): number | null {
  const parts = capacity.split("/");
  const tail = (parts[1] ?? "").trim();
  const m = /([\d.]+)\s*(kg|g|mg)\b/i.exec(tail);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = m[2].toLowerCase();
  return unit === "kg" ? value * 1000 : unit === "mg" ? value / 1000 : value;
}

/** MPE in grams for a given load, given the instrument's division e (grams). */
export function mpeForLoad(loadG: number, divisionG: number): number {
  const e = Math.abs(loadG) / divisionG;
  const factor = e <= 500 ? 0.5 : e <= 2000 ? 1.0 : 1.5;
  return factor * divisionG;
}

export function evaluateRow(row: TestWeightRow, divisionG: number): EvaluatedRow {
  const errorG = round(row.observedG - row.nominalG);
  const mpeG = round(mpeForLoad(row.nominalG, divisionG));
  return { ...row, errorG, mpeG, pass: Math.abs(errorG) <= mpeG + 1e-9 };
}

export function evaluateAll(rows: TestWeightRow[], divisionG: number): EvaluatedRow[] {
  return rows.map((r) => evaluateRow(r, divisionG));
}

/** PASS only when every row is within its MPE. No rows = no verdict. */
export function verdictFor(rows: EvaluatedRow[]): "PASS" | "FAIL" | null {
  if (rows.length === 0) return null;
  return rows.every((r) => r.pass) ? "PASS" : "FAIL";
}

/** Standard weights an officer typically carries, in grams. */
export const STANDARD_WEIGHTS_G = [500, 1000, 2000, 5000, 10000, 20000];

export function formatMass(grams: number): string {
  if (Math.abs(grams) >= 1000) {
    const kg = grams / 1000;
    return `${trim(kg)} kg`;
  }
  return `${trim(grams)} g`;
}

/** Signed error, always with a sign so a reader can see the direction. */
export function formatError(grams: number): string {
  const s = grams > 0 ? "+" : grams < 0 ? "−" : "±";
  return `${s}${trim(Math.abs(grams))} g`;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const trim = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Mass rows of a stored calibration record, in the original row shape. Reads
 * both the legacy array format and the TestRecord format below, so older
 * inspections keep working.
 */
export function parseTestWeights(raw: string | null | undefined): EvaluatedRow[] {
  const record = parseTestRecord(raw);
  if (!record || record.measure !== "mass") return [];
  return record.points.map((p) => ({
    nominalG: p.nominal,
    observedG: p.observed,
    errorG: p.error,
    mpeG: p.mpe,
    pass: p.pass,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Every instrument type, not just scales
//
// A checker tests a scale with standard weights, a fuel dispenser with a
// certified standard measure, and a length measure against a reference length.
// Each gets its own limit; all share one record shape so the form, the API, the
// evidence view and the risk engine handle them the same way.
//
// Canonical units: mass in grams, volume in millilitres, length in millimetres.
// ─────────────────────────────────────────────────────────────────────────────

export type Measure = "mass" | "volume" | "length";

export interface TestPoint {
  /** Value of the standard applied (weight, measure or reference length). */
  nominal: number;
  /** What the instrument showed or delivered. */
  observed: number;
}

export interface EvaluatedPoint extends TestPoint {
  /** observed − nominal. Negative volume means the customer was given short measure. */
  error: number;
  mpe: number;
  pass: boolean;
}

export interface TestRecord {
  measure: Measure;
  /** Mass only: the verification scale interval e, in grams. */
  divisionG?: number;
  points: EvaluatedPoint[];
}

/** Which physical quantity an instrument measures, from its category and capacity. */
export function measureFor(category: string, capacity: string): Measure {
  const text = `${category} ${capacity}`;
  if (/fuel|dispens|petrol|diesel|litre|liter|\d\s*(?:l|ml)\s*(?:\/|$|\s)/i.test(text)) return "volume";
  if (/length|linear|tape|\d\s*(?:mm|cm|m)\b(?!\s*t)/i.test(text) && !/weigh|scale|kg|tonne/i.test(text)) {
    return "length";
  }
  return "mass";
}

/**
 * Maximum capacity in canonical units, from strings like "30 kg / 1 g",
 * "60 Metric Tonnes" or "30 m". Null when the string has no usable maximum
 * (a flow rate such as "45 L/min" is not a capacity).
 */
export function maxFromCapacity(capacity: string, measure: Measure): number | null {
  const head = capacity.split("/")[0];
  if (measure === "mass") {
    const m = /([\d.]+)\s*(metric\s*tonnes?|tonnes?|t|kg|g|mg)\b/i.exec(head);
    if (!m) return null;
    const unit = m[2].toLowerCase();
    const factor = unit.startsWith("t") || unit.startsWith("metric") ? 1_000_000 : unit === "kg" ? 1000 : unit === "mg" ? 0.001 : 1;
    const v = Number(m[1]) * factor;
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  if (measure === "length") {
    const m = /([\d.]+)\s*(mm|cm|m)\b/i.exec(head);
    if (!m) return null;
    const v = Number(m[1]) * ({ mm: 1, cm: 10, m: 1000 } as Record<string, number>)[m[2].toLowerCase()];
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  if (/\/\s*min|\/\s*h/i.test(capacity)) return null;
  const m = /([\d.]+)\s*(ml|l)\b/i.exec(head);
  if (!m) return null;
  const v = Number(m[1]) * (m[2].toLowerCase() === "ml" ? 1 : 1000);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Fuel dispensers: ±0.5% of the volume delivered — ±25 mL on the 5 L test
 * measure inspectors use at the pump. OIML R117, accuracy class 0.5.
 */
export function volumeMpeMl(nominalMl: number): number {
  return round(Math.abs(nominalMl) * 0.005);
}

/**
 * Length measures: ±(a + b·L), L the nominal length in metres rounded up to a
 * whole metre. OIML R35-1 accuracy class II: a = 0.3 mm, b = 0.2 mm per metre.
 */
export function lengthMpeMm(nominalMm: number): number {
  const L = Math.max(1, Math.ceil(Math.abs(nominalMm) / 1000));
  return round(0.3 + 0.2 * L);
}

/**
 * Evaluate a set of test points for an instrument. Returns null for a mass
 * record with no scale interval, since there is then no lawful limit to test
 * against.
 */
export function evaluateRecord(
  measure: Measure,
  points: TestPoint[],
  divisionG?: number | null
): TestRecord | null {
  if (measure === "mass") {
    if (divisionG == null || !(divisionG > 0)) return null;
    const rows = evaluateAll(points.map((p) => ({ nominalG: p.nominal, observedG: p.observed })), divisionG);
    return {
      measure,
      divisionG,
      points: rows.map((r) => ({ nominal: r.nominalG, observed: r.observedG, error: r.errorG, mpe: r.mpeG, pass: r.pass })),
    };
  }
  const limit = measure === "volume" ? volumeMpeMl : lengthMpeMm;
  return {
    measure,
    points: points.map((p) => {
      const error = round(p.observed - p.nominal);
      const mpe = limit(p.nominal);
      return { ...p, error, mpe, pass: Math.abs(error) <= mpe + 1e-9 };
    }),
  };
}

/** PASS only when every point is within its limit. No points = no verdict. */
export function recordVerdict(record: TestRecord | null): "PASS" | "FAIL" | null {
  if (!record || record.points.length === 0) return null;
  return record.points.every((p) => p.pass) ? "PASS" : "FAIL";
}

/** Safe parse of the stored column: the TestRecord object, or the legacy mass-row array. */
export function parseTestRecord(raw: string | null | undefined): TestRecord | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (Array.isArray(v)) {
    const rows = v as EvaluatedRow[];
    return {
      measure: "mass",
      points: rows.map((r) => ({ nominal: r.nominalG, observed: r.observedG, error: r.errorG, mpe: r.mpeG, pass: r.pass })),
    };
  }
  if (v && typeof v === "object" && Array.isArray((v as TestRecord).points)) {
    const rec = v as TestRecord;
    if (rec.measure === "mass" || rec.measure === "volume" || rec.measure === "length") return rec;
  }
  return null;
}

export const UNIT: Record<Measure, string> = { mass: "g", volume: "mL", length: "mm" };

/** "20 kg", "60 t", "5 L", "250 mL", "2 m", "500 mm". */
export function formatQuantity(value: number, measure: Measure): string {
  const a = Math.abs(value);
  if (measure === "mass") return a >= 1_000_000 ? `${trim(value / 1_000_000)} t` : formatMass(value);
  if (measure === "volume") return a >= 1000 ? `${trim(value / 1000)} L` : `${trim(value)} mL`;
  return a >= 1000 ? `${trim(value / 1000)} m` : `${trim(value)} mm`;
}

/**
 * A recorded reading at full precision, in the unit it was read in: grams on a
 * scale ("5000.8 g"), kilograms on a weighbridge, litres at the pump ("4.98 L").
 */
export function formatReading(value: number, measure: Measure): string {
  if (measure === "mass") return Math.abs(value) >= 1_000_000 ? `${trim(value / 1000)} kg` : `${trim(value)} g`;
  if (measure === "volume") return `${Math.round(value) / 1000} L`;
  return `${trim(value)} mm`;
}

/** An error or limit in a readable small unit: "20 mL", "0.4 g", "10 kg" on a weighbridge. */
function small(value: number, measure: Measure): string {
  const a = Math.abs(value);
  if (measure === "mass" && a >= 1000) return `${trim(a / 1000)} kg`;
  return `${trim(a)} ${UNIT[measure]}`;
}

/** Signed error, e.g. "−20 mL", "+0.4 g", "±0 mm". */
export function formatSignedQuantity(value: number, measure: Measure): string {
  const s = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${s}${small(value, measure)}`;
}

/** A permissible error, e.g. "± 25 mL". */
export function formatLimit(value: number, measure: Measure): string {
  return `± ${small(value, measure)}`;
}

/** The limit standard behind each measure, for labels. */
export const MEASURE_STANDARD: Record<Measure, string> = {
  mass: "OIML R76 · accuracy class III",
  volume: "OIML R117 · ±0.5% of volume",
  length: "OIML R35 · accuracy class II",
};
