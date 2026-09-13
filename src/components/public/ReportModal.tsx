"use client";

import React, { useState } from "react";
import { Flag, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { Button, Label, Modal, Mono, Notice, cx } from "@/components/ui";

const KINDS = [
  { value: "NO_STICKER", label: "No sticker on the scale", hint: "nothing to scan at all" },
  { value: "EXPIRED", label: "Sticker has expired", hint: "past its valid-till date" },
  { value: "DAMAGED", label: "QR is damaged or unreadable", hint: "torn, faded or covered" },
  { value: "SHORT_WEIGHT", label: "I suspect short weight", hint: "the reading looks wrong" },
  { value: "OTHER", label: "Something else", hint: "" },
] as const;

/**
 * A citizen's complaint, filed without an account. Everything except the kind
 * is optional — asking a shopper for a registration number they cannot see is
 * how you end up with no reports.
 */
export default function ReportModal({
  open,
  onClose,
  certNumber,
  serialNumber,
}: {
  open: boolean;
  onClose: () => void;
  certNumber?: string;
  serialNumber?: string;
}) {
  const [kind, setKind] = useState<string>("");
  const [placeText, setPlaceText] = useState("");
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const reset = () => {
    setKind(""); setPlaceText(""); setNote(""); setContact("");
    setError(null); setReference(null); setBusy(false);
  };
  const close = () => { reset(); onClose(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kind) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, placeText, note, contact, certNumber, serialNumber }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Could not file the report");
        return;
      }
      setReference(d.reference);
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      icon={reference ? CheckCircle2 : ShieldAlert}
      tone={reference ? "good" : "warn"}
      title={reference ? "Report filed" : "Report this instrument"}
      subtitle={
        reference
          ? undefined
          : certNumber
            ? <>About <Mono>{certNumber}</Mono></>
            : "Tell the department what you saw"
      }
      footer={
        reference ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" type="button" onClick={close}>Cancel</Button>
            <Button type="submit" form="report-form" variant="warn" loading={busy} disabled={!kind}>
              File report
            </Button>
          </>
        )
      }
    >
      {reference ? (
        <div className="space-y-4 px-6 py-6 text-center">
          <p className="text-[15px] text-ink-800">
            Thank you. The Legal Metrology Department will review this.
          </p>
          <div>
            <div className="text-xs text-ink-500">Your reference</div>
            <Mono chip className="mt-1 inline-block text-[15px] font-semibold">{reference}</Mono>
          </div>
          <p className="text-[13px] leading-relaxed text-ink-500">
            Keep it if you want to follow up. Reports about the same trader are grouped, so
            repeated complaints raise its priority for inspection.
          </p>
        </div>
      ) : (
        <form id="report-form" onSubmit={submit} className="space-y-4 px-6 py-5">
          {error && <Notice tone="bad" icon={AlertCircle}>{error}</Notice>}

          <div>
            <Label>What did you see?</Label>
            <div className="grid gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={cx(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition focus-ring",
                    kind === k.value
                      ? "border-amber-400 bg-amber-50"
                      : "border-line hover:border-ink-300 hover:bg-ink-50"
                  )}
                >
                  <span
                    className={cx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                      kind === k.value ? "border-amber-600" : "border-ink-300"
                    )}
                  >
                    {kind === k.value && <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-ink-900">{k.label}</span>
                    {k.hint && <span className="block text-xs text-ink-500">{k.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="place" hint="optional">Where was it?</Label>
            <input
              id="place"
              value={placeText}
              onChange={(e) => setPlaceText(e.target.value)}
              placeholder="Shop name, market or street"
              className="field"
            />
          </div>

          <div>
            <Label htmlFor="note" hint="optional">Anything else</Label>
            <textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What made you suspicious?"
              className="field resize-y text-[13px]"
            />
          </div>

          <div>
            <Label htmlFor="contact" hint="optional — leave blank to stay anonymous">
              Your phone or email
            </Label>
            <input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Only if you want an update"
              className="field"
            />
          </div>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
            <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No account is needed. False reports waste inspection time, so please only report what
            you actually saw.
          </p>
        </form>
      )}
    </Modal>
  );
}
