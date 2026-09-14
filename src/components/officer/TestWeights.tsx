"use client";

import React, { useState } from "react";
import { Plus, Trash2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  MEASURE_STANDARD,
  STANDARD_WEIGHTS_G,
  divisionFromCapacity,
  evaluateRecord,
  formatLimit,
  formatQuantity,
  formatSignedQuantity,
  maxFromCapacity,
  measureFor,
  recordVerdict,
  type Measure,
  type TestPoint,
  type TestRecord,
} from "@/lib/mpe";
import { Badge, Label, cx } from "@/components/ui";

/** What the checker has entered so far, in canonical units (g, mL, mm). */
export interface TestDraft {
  /** Mass only: e in grams, read off the data plate when the capacity doesn't state it. */
  divisionG: number | null;
  points: TestPoint[];
}

export const EMPTY_DRAFT: TestDraft = { divisionG: null, points: [] };

/**
 * The record as it will be evaluated — used by the form for display and by the
 * payload builder, so what the checker sees is what gets sent. The server
 * evaluates it again from the raw points before anything is stored or signed.
 */
export function draftToRecord(category: string, capacity: string, draft: TestDraft): TestRecord | null {
  const measure = measureFor(category, capacity);
  const e = measure === "mass" ? divisionFromCapacity(capacity) ?? draft.divisionG : null;
  return evaluateRecord(measure, draft.points, e);
}

interface UnitOption {
  label: string;
  factor: number;
}

const UNITS: Record<Measure, UnitOption[]> = {
  mass: [
    { label: "g", factor: 1 },
    { label: "kg", factor: 1000 },
    { label: "t", factor: 1_000_000 },
  ],
  volume: [
    { label: "mL", factor: 1 },
    { label: "L", factor: 1000 },
  ],
  length: [
    { label: "mm", factor: 1 },
    { label: "cm", factor: 10 },
    { label: "m", factor: 1000 },
  ],
};

const COPY: Record<Measure, { title: string; standard: string; reading: string; add: string; notes: string }> = {
  mass: {
    title: "Calibration record — standard weights",
    standard: "Standard weight",
    reading: "Instrument reading",
    add: "Add the weights you applied:",
    notes: "weights",
  },
  volume: {
    title: "Calibration record — standard measure",
    standard: "Measure dispensed",
    reading: "Measured in the can",
    add: "Add the measures you filled:",
    notes: "measures",
  },
  length: {
    title: "Calibration record — reference lengths",
    standard: "Reference length",
    reading: "Measured length",
    add: "Add the reference lengths you checked:",
    notes: "lengths",
  },
};

const NICE_MASS_G = [
  100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5,
  1e6, 2e6, 5e6, 1e7, 2e7, 3e7, 4e7, 5e7, 6e7, 8e7, 1e8,
];

/** Test points a checker would typically apply, sized to the instrument. */
function presetsFor(measure: Measure, max: number | null): number[] {
  if (measure === "volume") {
    const all = [1000, 2000, 5000, 10000, 20000];
    return max ? all.filter((v) => v <= max) : all;
  }
  if (measure === "length") {
    const all = [100, 500, 1000, 2000, 5000, 10000, 20000, 30000, 50000];
    return max ? all.filter((v) => v <= max) : [500, 1000, 2000, 5000];
  }
  if (!max) return STANDARD_WEIGHTS_G;
  // Across the range up to full load: the five largest round values, plus max itself.
  const picks = NICE_MASS_G.filter((v) => v <= max).slice(-5);
  if (!picks.includes(max)) picks.push(max);
  return picks.sort((a, b) => a - b);
}

/** The unit readings are typed in: tonnes-scale instruments read in kg, fuel in litres. */
function entryUnit(measure: Measure, max: number | null): UnitOption {
  if (measure === "volume") return UNITS.volume[1];
  if (measure === "mass" && max != null && max >= 1_000_000) return UNITS.mass[1];
  return UNITS[measure][0];
}

const roundTo = (n: number, dp = 6) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * The checker's test record. Adapts to what is being verified: standard weights
 * on a scale or weighbridge, a standard measure at a fuel dispenser, reference
 * lengths for a length measure. Each row shows its error and limit as it is
 * typed; the verdict is computed, never chosen.
 */
export default function TestWeights({
  category,
  capacity,
  value,
  onChange,
}: {
  category: string;
  capacity: string;
  value: TestDraft;
  onChange: (draft: TestDraft) => void;
}) {
  const measure = measureFor(category, capacity);
  const copy = COPY[measure];
  const max = maxFromCapacity(capacity, measure);
  const statedE = measure === "mass" ? divisionFromCapacity(capacity) : null;
  const unit = entryUnit(measure, max);

  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState(unit.label);
  const [customError, setCustomError] = useState<string | null>(null);
  const [eValue, setEValue] = useState(value.divisionG != null ? String(value.divisionG) : "");
  const [eUnit, setEUnit] = useState("g");

  const needsE = measure === "mass" && statedE == null;
  const e = statedE ?? value.divisionG;
  const eProblem =
    needsE && eValue !== ""
      ? !(Number(eValue) > 0)
        ? "Enter a positive number"
        : max != null && Number(eValue) * (eUnit === "kg" ? 1000 : 1) > max / 100
          ? "That interval is too coarse for this capacity — check the data plate"
          : null
      : null;
  const locked = measure === "mass" && e == null;

  const record = locked ? null : evaluateRecord(measure, value.points, e);
  const verdict = recordVerdict(record);
  const failing = record?.points.filter((p) => !p.pass).length ?? 0;

  const setPoints = (points: TestPoint[]) => onChange({ ...value, points });
  const setObserved = (i: number, typed: string) =>
    setPoints(value.points.map((p, j) => (i === j ? { ...p, observed: roundTo(Number(typed) * unit.factor) } : p)));
  const addPoint = (nominal: number) => setPoints([...value.points, { nominal, observed: nominal }]);
  const removePoint = (i: number) => setPoints(value.points.filter((_, j) => j !== i));

  const setDivision = (raw: string, u: string) => {
    setEValue(raw);
    setEUnit(u);
    const g = Number(raw) * (u === "kg" ? 1000 : 1);
    const ok = raw !== "" && g > 0 && !(max != null && g > max / 100);
    // Points were evaluated against the old interval — keep them, re-evaluated live.
    onChange({ ...value, divisionG: ok ? g : null });
  };

  const addCustom = () => {
    const factor = UNITS[measure].find((u) => u.label === customUnit)?.factor ?? 1;
    const nominal = roundTo(Number(customValue) * factor);
    if (!(nominal > 0)) return setCustomError("Enter the value of the standard you applied");
    if (max != null && nominal > max) {
      return setCustomError(`That's more than the instrument's capacity (${formatQuantity(max, measure)})`);
    }
    if (value.points.some((p) => p.nominal === nominal)) {
      return setCustomError(`${formatQuantity(nominal, measure)} is already recorded`);
    }
    addPoint(nominal);
    setCustomValue("");
    setCustomError(null);
  };

  const presets = presetsFor(measure, max).filter((v) => !value.points.some((p) => p.nominal === v));

  return (
    <div>
      <Label hint={statedE != null ? `e = ${formatQuantity(statedE, "mass")}` : MEASURE_STANDARD[measure]}>
        {copy.title}
      </Label>

      {needsE && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
          <div className="flex items-start gap-2 text-[13px] text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The recorded capacity (<span className="font-mono">{capacity}</span>) doesn&apos;t state the
              verification scale interval. Read <strong>e</strong> off the instrument&apos;s data plate — the limits
              depend on it.
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <label htmlFor="division-e" className="text-xs font-medium text-ink-700">
              Scale interval e
            </label>
            <input
              id="division-e"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={eValue}
              onChange={(ev) => setDivision(ev.target.value, eUnit)}
              placeholder={max != null && max >= 1_000_000 ? "20" : "1"}
              className={cx("field h-8 w-24 py-0 font-mono text-[13px]", eProblem && "border-rose-500")}
            />
            <select
              aria-label="Scale interval unit"
              value={eUnit}
              onChange={(ev) => setDivision(eValue, ev.target.value)}
              className="field h-8 w-auto py-0 text-[13px]"
            >
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
            {eProblem && <span className="text-xs text-rose-700">{eProblem}</span>}
          </div>
        </div>
      )}

      <div className={cx("overflow-hidden rounded-xl border border-line", locked && "opacity-60")}>
        {record && record.points.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  <th className="px-3 py-2 text-left">{copy.standard}</th>
                  <th className="px-3 py-2 text-left">
                    {copy.reading} ({unit.label})
                  </th>
                  <th className="px-3 py-2 text-right">Error</th>
                  <th className="px-3 py-2 text-right">MPE</th>
                  <th className="px-3 py-2 text-center">Result</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {record.points.map((p, i) => {
                  const label = formatQuantity(p.nominal, measure);
                  return (
                    <tr key={p.nominal} className={cx(!p.pass && "bg-rose-50/50")}>
                      <td className="px-3 py-2">
                        <span className="font-mono font-medium text-ink-900">{label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={Number.isFinite(p.observed) ? roundTo(p.observed / unit.factor) : ""}
                          onChange={(ev) => setObserved(i, ev.target.value)}
                          className="field h-8 w-32 py-0 font-mono text-[13px]"
                          aria-label={`Reading for ${label}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={cx("font-mono", p.pass ? "text-ink-700" : "font-semibold text-rose-700")}>
                          {formatSignedQuantity(p.error, measure)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ink-500">{formatLimit(p.mpe, measure)}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge tone={p.pass ? "good" : "bad"}>{p.pass ? "Within" : "Outside"}</Badge>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removePoint(i)}
                          className="rounded-lg p-1.5 text-ink-400 transition hover:bg-rose-50 hover:text-rose-700 focus-ring"
                          aria-label={`Remove ${label} row`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-2 border-t border-line bg-ink-50/50 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-500">
              {locked
                ? "Enter the scale interval above to start recording."
                : value.points.length === 0
                  ? copy.add
                  : "Add another:"}
            </span>
            {!locked &&
              presets.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => addPoint(v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-white px-2 py-1 font-mono text-xs text-ink-700 transition hover:border-seal-400 hover:bg-seal-50/50 focus-ring"
                >
                  <Plus className="h-3 w-3" />
                  {formatQuantity(v, measure)}
                </button>
              ))}
          </div>

          {!locked && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-500">Other value:</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={customValue}
                onChange={(ev) => {
                  setCustomValue(ev.target.value);
                  setCustomError(null);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    ev.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="e.g. 250"
                aria-label={`Value of the ${COPY[measure].notes.slice(0, -1)} to add`}
                className={cx("field h-8 w-28 py-0 font-mono text-[13px]", customError && "border-rose-500")}
              />
              <select
                aria-label="Unit"
                value={customUnit}
                onChange={(ev) => setCustomUnit(ev.target.value)}
                className="field h-8 w-auto py-0 text-[13px]"
              >
                {UNITS[measure].filter((u) => max == null || u.factor <= max).map((u) => (
                  <option key={u.label} value={u.label}>
                    {u.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addCustom}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line-strong bg-white px-2.5 text-xs font-medium text-ink-700 transition hover:border-seal-400 hover:bg-seal-50/50 focus-ring"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
              {max != null && (
                <span className="text-xs text-ink-400">up to {formatQuantity(max, measure)}</span>
              )}
              {customError && <span className="w-full text-xs text-rose-700">{customError}</span>}
            </div>
          )}
        </div>
      </div>

      {verdict && record && (
        <div
          className={cx(
            "mt-2 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px]",
            verdict === "PASS"
              ? "border-seal-200 bg-seal-50/70 text-seal-900"
              : "border-rose-200 bg-rose-50/70 text-rose-900"
          )}
        >
          {verdict === "PASS" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-seal-700" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
          )}
          <span>
            {verdict === "PASS" ? (
              <>
                {record.points.length === 1 ? "The reading is" : `All ${record.points.length} readings are`} within
                the Maximum Permissible Error ({MEASURE_STANDARD[measure]}).
              </>
            ) : (
              <>
                <strong>{failing}</strong> of {record.points.length} reading
                {record.points.length === 1 ? "" : "s"} {failing === 1 ? "is" : "are"} outside the Maximum
                Permissible Error. The outcome below should normally be Fail.
              </>
            )}
          </span>
        </div>
      )}

    </div>
  );
}
