"use client";

import React, { useState } from "react";
import { UserCheck, CalendarClock, ShieldCheck, FlaskConical, AlertTriangle } from "lucide-react";
import { SLOT_LABEL, SLOT_WINDOW, combineDateAndSlot, type Slot } from "@/lib/schedule";
import { Button, KV, Label, Modal, Mono, Segmented, cx } from "@/components/ui";

export interface Officer {
  id: string;
  name: string;
  badgeNumber: string;
}

export interface Centre {
  id: string;
  name: string;
  notifyNo: string;
  address: string;
  /** Instrument categories this centre is notified to verify. */
  categories: string[];
}

export type VerifierKind = "OFFICER" | "GATC";

export interface AssignInitial {
  kind: VerifierKind;
  officerId: string;
  centreId: string;
  date: string; // yyyy-mm-dd
  slot: Slot;
}

/**
 * HQ picks who goes and when. The work can go to a departmental officer or to
 * a notified Government Approved Test Centre, which is the two-track dispatch
 * the Legal Metrology rules actually describe.
 *
 * Mount with a `key` per application so the initial values reset.
 */
export default function AssignModal({
  open,
  onClose,
  mode,
  officers,
  centres,
  summary,
  initial,
  minDate,
  busy,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  mode: "assign" | "reschedule";
  officers: Officer[];
  centres: Centre[];
  summary: {
    applicationNumber: string;
    businessName: string;
    serialNumber: string;
    location: string;
    category: string;
  } | null;
  initial: AssignInitial;
  minDate: string;
  busy: boolean;
  onConfirm: (v: { officerId?: string; centreId?: string; scheduledFor: string }) => void;
}) {
  const [kind, setKind] = useState<VerifierKind>(initial.kind);
  const [officerId, setOfficerId] = useState(initial.officerId);
  const [centreId, setCentreId] = useState(initial.centreId || centres[0]?.id || "");
  const [date, setDate] = useState(initial.date);
  const [slot, setSlot] = useState<Slot>(initial.slot);

  const centre = centres.find((c) => c.id === centreId) ?? null;
  // A centre is only notified for certain instrument categories; warn rather
  // than block, since the notification list here is demo data.
  const outOfScope =
    kind === "GATC" && centre != null && summary != null && centre.categories.length > 0
      ? !centre.categories.includes(summary.category)
      : false;

  const canConfirm = Boolean(date && (kind === "OFFICER" ? officerId : centreId));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;
    onConfirm({
      ...(kind === "OFFICER" ? { officerId } : { centreId }),
      scheduledFor: combineDateAndSlot(date, slot).toISOString(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={mode === "assign" ? UserCheck : CalendarClock}
      tone="accent"
      title={mode === "assign" ? "Assign verification" : "Reschedule site visit"}
      subtitle={summary && <Mono>{summary.applicationNumber}</Mono>}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="assign-form" variant="accent" loading={busy} disabled={!canConfirm}>
            {mode === "assign" ? "Assign & schedule" : "Save new schedule"}
          </Button>
        </>
      }
    >
      <form id="assign-form" onSubmit={submit} className="space-y-5 px-6 py-5">
        {summary && (
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-ink-50/60 p-4 sm:grid-cols-3">
            <KV label="Business" value={summary.businessName} />
            <KV label="Instrument" value={summary.serialNumber} mono />
            <KV label="Category" value={summary.category} />
          </div>
        )}

        <div>
          <Label>Assign to</Label>
          <Segmented<VerifierKind>
            className="w-full [&>button]:flex-1"
            value={kind}
            onChange={setKind}
            options={[
              { value: "OFFICER", label: "Field officer", icon: ShieldCheck },
              { value: "GATC", label: "Test centre (GATC)", icon: FlaskConical },
            ]}
          />
        </div>

        {kind === "OFFICER" ? (
          <div>
            <Label htmlFor="officer">Legal Metrology Officer</Label>
            <select id="officer" value={officerId} onChange={(e) => setOfficerId(e.target.value)} className="field">
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.badgeNumber}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <Label htmlFor="centre" hint={centre ? `Notification ${centre.notifyNo}` : undefined}>
              Government Approved Test Centre
            </Label>
            <select id="centre" value={centreId} onChange={(e) => setCentreId(e.target.value)} className="field">
              {centres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.notifyNo}
                </option>
              ))}
            </select>
            {centre && (
              <p className="mt-1.5 text-xs text-ink-500">
                {centre.address}
                {centre.categories.length > 0 && (
                  <>
                    {" · Notified for: "}
                    {centre.categories.join(", ")}
                  </>
                )}
              </p>
            )}
            {outOfScope && (
              <div className={cx("mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900")}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  This centre is not notified for <strong>{summary?.category}</strong>. Assign anyway
                  only if the notification has since been extended.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="visit-date">Visit date</Label>
            <input
              id="visit-date"
              type="date"
              required
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <Label hint={SLOT_WINDOW[slot]}>Slot</Label>
            <Segmented<Slot>
              className="w-full [&>button]:flex-1"
              value={slot}
              onChange={setSlot}
              options={[
                { value: "AM", label: SLOT_LABEL.AM },
                { value: "PM", label: SLOT_LABEL.PM },
              ]}
            />
          </div>
        </div>

        <p className="text-xs text-ink-500">
          The assigned verifier sees this visit in their queue; the business sees it against the
          instrument. Slots are half-days so one verifier can cover two sites a day.
        </p>
      </form>
    </Modal>
  );
}
