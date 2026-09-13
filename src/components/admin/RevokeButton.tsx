"use client";

import React, { useState } from "react";
import { Ban, RotateCcw, AlertTriangle } from "lucide-react";
import { Button, Label, Modal, Mono, Notice } from "@/components/ui";

/**
 * Withdraw a certificate before it expires, or restore one withdrawn in error.
 * A reason is mandatory: revocation is an enforcement act and needs a record.
 */
export default function RevokeButton({
  certificateId,
  certNumber,
  revokedAt,
  onDone,
}: {
  certificateId: string;
  certNumber: string;
  revokedAt?: string | null;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRevoked = Boolean(revokedAt);

  const submit = async (restore: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/certificates/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateId, reason, restore }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Failed");
        return;
      }
      setOpen(false);
      setReason("");
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={isRevoked ? "secondary" : "danger"}
        icon={isRevoked ? RotateCcw : Ban}
        onClick={() => setOpen(true)}
      >
        {isRevoked ? "Restore" : "Revoke"}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        icon={isRevoked ? RotateCcw : Ban}
        tone={isRevoked ? "neutral" : "bad"}
        title={isRevoked ? "Restore this certificate" : "Revoke this certificate"}
        subtitle={<Mono>{certNumber}</Mono>}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant={isRevoked ? "primary" : "danger"}
              loading={busy}
              disabled={!isRevoked && !reason.trim()}
              onClick={() => void submit(isRevoked)}
            >
              {isRevoked ? "Restore certificate" : "Revoke certificate"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 px-6 py-5">
          {error && <Notice tone="bad" icon={AlertTriangle}>{error}</Notice>}

          {isRevoked ? (
            <p className="text-[14px] leading-relaxed text-ink-700">
              This certificate will verify as genuine again on the public page. Do this only if it
              was withdrawn in error.
            </p>
          ) : (
            <>
              <p className="text-[14px] leading-relaxed text-ink-700">
                The signature stays mathematically valid — it always will. Revoking adds the
                certificate to the withdrawal list, so the public page shows it as withdrawn
                whenever it can reach this server.
              </p>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <textarea
                  id="reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Instrument found tampered with during a follow-up inspection"
                  className="field resize-y text-[13px]"
                />
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
