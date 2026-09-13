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

/** Safe parse of the JSON column, for the UI and the certificate payload. */
export function parseTestWeights(raw: string | null | undefined): EvaluatedRow[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as EvaluatedRow[]) : [];
  } catch {
    return [];
  }
}
