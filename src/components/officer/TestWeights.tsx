"use client";

import React from "react";
import { Plus, Trash2, Scale, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  STANDARD_WEIGHTS_G,
  divisionFromCapacity,
  evaluateAll,
  formatError,
  formatMass,
  verdictFor,
  type TestWeightRow,
} from "@/lib/mpe";
import { Badge, Label, cx } from "@/components/ui";

/**
 * The calibration record: standard weights applied, what the instrument read,
 * and whether each row sits inside the Maximum Permissible Error for that load.
 * The verdict is computed, not typed, so the PASS/FAIL decision is defensible.
 */
export default function TestWeights({
  capacity,
  rows,
  onChange,
}: {
  capacity: string;
  rows: TestWeightRow[];
  onChange: (rows: TestWeightRow[]) => void;
}) {
  const divisionG = divisionFromCapacity(capacity);

  // No parsable division (e.g. a fuel dispenser measured in L/min) — the
  // weight table does not apply, so say so rather than showing a broken form.
  if (divisionG == null) {
    return (
      <div>
        <Label>Calibration record</Label>
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong p-4 text-[13px] text-ink-600">
          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>
            This instrument&apos;s capacity (<span className="font-mono">{capacity}</span>) has no
            weight division, so the standard-weight table does not apply. Record the applicable
            test in the notes below.
          </span>
        </div>
      </div>
    );
  }

  const evaluated = evaluateAll(rows, divisionG);
  const verdict = verdictFor(evaluated);
  const failing = evaluated.filter((r) => !r.pass).length;

  const setRow = (i: number, patch: Partial<TestWeightRow>) =>
    onChange(rows.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  const addRow = (nominalG: number) => onChange([...rows, { nominalG, observedG: nominalG }]);
  const removeRow = (i: number) => onChange(rows.filter((_, j) => j !== i));

  const unused = STANDARD_WEIGHTS_G.filter((w) => !rows.some((r) => r.nominalG === w));

  return (
    <div>
      <Label hint={`e = ${formatMass(divisionG)}`}>Calibration record — standard weights</Label>

      <div className="overflow-hidden rounded-xl border border-line">
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  <th className="px-3 py-2 text-left">Standard weight</th>
                  <th className="px-3 py-2 text-left">Instrument reading (g)</th>
                  <th className="px-3 py-2 text-right">Error</th>
                  <th className="px-3 py-2 text-right">MPE</th>
                  <th className="px-3 py-2 text-center">Result</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {evaluated.map((r, i) => (
                  <tr key={i} className={cx(!r.pass && "bg-rose-50/50")}>
                    <td className="px-3 py-2">
                      <span className="font-mono font-medium text-ink-900">{formatMass(r.nominalG)}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.001"
                        inputMode="decimal"
                        value={Number.isFinite(r.observedG) ? r.observedG : ""}
                        onChange={(e) => setRow(i, { observedG: Number(e.target.value) })}
                        className="field h-8 w-32 py-0 font-mono text-[13px]"
                        aria-label={`Reading for ${formatMass(r.nominalG)}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={cx("font-mono", r.pass ? "text-ink-700" : "font-semibold text-rose-700")}>
                        {formatError(r.errorG)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink-500">± {r.mpeG} g</td>
                    <td className="px-3 py-2 text-center">
                      <Badge tone={r.pass ? "good" : "bad"}>{r.pass ? "Within" : "Outside"}</Badge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="rounded-lg p-1.5 text-ink-400 transition hover:bg-rose-50 hover:text-rose-700 focus-ring"
                        aria-label={`Remove ${formatMass(r.nominalG)} row`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-ink-50/50 px-3 py-2.5">
          <span className="text-xs text-ink-500">
            {rows.length === 0 ? "Add the weights you applied:" : "Add another:"}
          </span>
          {unused.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => addRow(w)}
              className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-white px-2 py-1 font-mono text-xs text-ink-700 transition hover:border-seal-400 hover:bg-seal-50/50 focus-ring"
            >
              <Plus className="h-3 w-3" />
              {formatMass(w)}
            </button>
          ))}
          {unused.length === 0 && rows.length > 0 && (
            <span className="text-xs text-ink-400">All standard weights recorded.</span>
          )}
        </div>
      </div>

      {verdict && (
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
                All {rows.length} reading{rows.length === 1 ? "" : "s"} are within the Maximum
                Permissible Error for accuracy class III.
              </>
            ) : (
              <>
                <strong>{failing}</strong> of {rows.length} reading{rows.length === 1 ? "" : "s"}{" "}
                {failing === 1 ? "is" : "are"} outside the Maximum Permissible Error. The outcome
                below should normally be Fail.
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
