"use client";

import React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Building2,
  Scale,
  Lock,
  ArrowLeft,
  MapPin,
  Printer,
  Fingerprint,
  Flag,
  Ban,
  type LucideIcon,
} from "lucide-react";
import ReportModal from "@/components/public/ReportModal";
import { Button, KV, Mono, cx } from "@/components/ui";

export type VerifyStatus = "VALID" | "EXPIRED" | "TAMPERED" | "REVOKED" | "NOT_FOUND";

export interface TokenPayload {
  certId: string;
  businessId: string;
  businessName: string;
  businessRegNo?: string;
  instrumentId: string;
  serialNumber: string;
  category: string;
  model: string;
  capacity: string;
  validFrom: string;
  validTill: string;
  officer: string;
  badgeNumber: string;
  gps?: string;
  issuedAt?: string;
}

interface Props {
  status: VerifyStatus;
  payload: TokenPayload | null;
  verificationError: string | null;
  checkedAt: string;
  /** ISO timestamp when the department withdrew this certificate, if it did. */
  revokedAt?: string | null;
  revokedReason?: string | null;
  /** False when the withdrawal list could not be reached — say so, don't imply. */
  revocationChecked?: boolean;
}

const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";

const STATUS: Record<
  VerifyStatus,
  {
    icon: LucideIcon;
    eyebrow: string;
    title: string;
    band: string;
    ring: string;
    chip: string;
    stamp: string;
  }
> = {
  VALID: {
    icon: CheckCircle2,
    eyebrow: "Signature verified",
    title: "Genuine certificate",
    band: "bg-seal-700",
    ring: "ring-seal-200",
    chip: "bg-white/15 text-white ring-white/25",
    stamp: "text-seal-700 border-seal-600",
  },
  EXPIRED: {
    icon: AlertTriangle,
    eyebrow: "Signature verified · validity lapsed",
    title: "Certificate expired",
    band: "bg-amber-600",
    ring: "ring-amber-200",
    chip: "bg-white/15 text-white ring-white/25",
    stamp: "text-amber-700 border-amber-600",
  },
  TAMPERED: {
    icon: XCircle,
    eyebrow: "Signature check failed",
    title: "Tampered or forged",
    band: "bg-rose-700",
    ring: "ring-rose-200",
    chip: "bg-white/15 text-white ring-white/25",
    stamp: "text-rose-700 border-rose-600",
  },
  REVOKED: {
    icon: Ban,
    eyebrow: "Signature valid · withdrawn by the department",
    title: "Certificate revoked",
    band: "bg-rose-700",
    ring: "ring-rose-200",
    chip: "bg-white/15 text-white ring-white/25",
    stamp: "text-rose-700 border-rose-600",
  },
  NOT_FOUND: {
    icon: XCircle,
    eyebrow: "Registry search",
    title: "Certificate not found",
    band: "bg-ink-800",
    ring: "ring-ink-200",
    chip: "bg-white/15 text-white ring-white/25",
    stamp: "text-ink-700 border-ink-600",
  },
};

export default function VerifyView({
  status,
  payload,
  verificationError,
  checkedAt,
  revokedAt,
  revokedReason,
  revocationChecked = true,
}: Props) {
  const s = (status && STATUS[status]) || STATUS.NOT_FOUND || STATUS.VALID;
  const Icon = s?.icon || CheckCircle2;
  const [reporting, setReporting] = React.useState(false);

  // Measured against the server's clock at verification time, not the
  // browser's — the two must agree on what "valid" meant.
  const daysLeft = payload?.validTill
    ? Math.ceil((new Date(payload.validTill).getTime() - new Date(checkedAt).getTime()) / 86_400_000)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print flex items-center justify-between">
        <Link
          href="/verify"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Verify another
        </Link>
      </div>

      {/* The certificate sheet */}
      <article className={cx("sheet ring-1 animate-scale-in", s.ring)}>
        {/* Status band */}
        <header className={cx("relative px-7 py-7 text-white sm:px-9", s.band)}>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/[0.06]"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <Icon className="h-8 w-8" />
              </span>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">
                  {s.eyebrow}
                </div>
                <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-[30px] sm:leading-tight">
                  {s.title}
                </h1>
              </div>
            </div>
            <div className={cx("inline-flex items-center gap-2 self-start rounded-lg px-3 py-1.5 font-mono text-xs ring-1", s.chip)}>
              <Lock className="h-3.5 w-3.5" />
              HMAC-SHA256
            </div>
          </div>
        </header>

        <div className="space-y-7 px-7 py-7 sm:px-9">
          {/* Status-specific lead */}
          {status === "VALID" && (
            <div className="flex flex-col gap-4 rounded-xl border border-seal-200 bg-seal-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-seal-700" />
                <p className="text-sm leading-relaxed text-seal-900">
                  This instrument was verified by a Legal Metrology officer and the certificate
                  has not been altered since it was signed.
                </p>
              </div>
              {daysLeft !== null && (
                <div className="shrink-0 text-right">
                  <div className="tnum text-2xl font-semibold text-seal-800">{daysLeft}</div>
                  <div className="text-xs text-seal-700">days remaining</div>
                </div>
              )}
            </div>
          )}

          {status === "REVOKED" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-950">
                <Ban className="h-4 w-4 text-rose-700" />
                Withdrawn by the Legal Metrology Department
              </p>
              <p className="mt-1 text-sm leading-relaxed text-rose-900">
                The signature on this certificate is genuine, but the department has since
                withdrawn it{revokedAt && <> on <strong>{fmt(revokedAt)}</strong></>}. Do not rely
                on it. The instrument must be re-verified before it is used in trade.
              </p>
              {revokedReason && (
                <p className="mt-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[13px] text-rose-900">
                  Reason: {revokedReason}
                </p>
              )}
            </div>
          )}

          {!revocationChecked && status !== "TAMPERED" && (
            <p className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[13px] text-amber-900">
              The signature was checked offline. The withdrawal list could not be reached, so this
              certificate could have been revoked since it was issued.
            </p>
          )}

          {status === "EXPIRED" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-sm font-semibold text-amber-950">
                Legal Metrology Act, 2009 — re-verification overdue
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900">
                The verification period ended on <strong>{fmt(payload?.validTill)}</strong>. Trading
                with an instrument whose verification has lapsed is an offence. Ask the seller
                for a current certificate.
              </p>
            </div>
          )}

          {status === "TAMPERED" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-950">
                <Fingerprint className="h-4 w-4 text-rose-700" />
                The signature does not match the certificate contents
              </p>
              <p className="mt-1 text-sm leading-relaxed text-rose-900">
                Someone changed this certificate after it was issued, or it was never issued by
                the department. Do not rely on the details below — they are shown only so you can
                report what was presented to you.
              </p>
              {verificationError && (
                <Mono className="mt-3 block rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-rose-700">
                  {verificationError}
                </Mono>
              )}
            </div>
          )}

          {status === "NOT_FOUND" && (
            <div className="rounded-xl border border-ink-200 bg-ink-50/80 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                <XCircle className="h-4 w-4 text-ink-600" />
                No certificate found in the official register
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                {verificationError ||
                  "No certificate matching this number was found in the Legal Metrology database. Please check that you entered the number exactly as printed, or scan the QR sticker with your camera."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-ink-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Try searching another certificate
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setReporting(true)}
                  icon={Flag}
                >
                  Report unverified instrument
                </Button>
              </div>
            </div>
          )}

          {payload && (
            <>
              {/* Certificate identity */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-ink-50/60 p-4 sm:grid-cols-3">
                <KV
                  label="Certificate number"
                  value={<span className={cx(status === "TAMPERED" && "line-through decoration-rose-400")}>{payload.certId}</span>}
                  mono
                />
                <KV label="Issued on" value={fmt(payload.validFrom)} />
                <KV
                  label="Valid till"
                  value={
                    <span className={status === "VALID" ? "text-seal-700" : status === "EXPIRED" ? "text-amber-700" : ""}>
                      {fmt(payload.validTill)}
                    </span>
                  }
                />
              </div>

              {/* Business */}
              <Section icon={Building2} title="Business">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <KV
                    label="Trading name"
                    value={
                      <span className={cx("text-[15px]", status === "TAMPERED" && "text-rose-700")}>
                        {payload.businessName}
                      </span>
                    }
                  />
                  <KV label="Registration" value={payload.businessRegNo || "—"} mono />
                </div>
              </Section>

              {/* Instrument */}
              <Section icon={Scale} title="Instrument">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <KV label="Serial number" value={payload.serialNumber} mono />
                  <KV label="Category" value={payload.category} />
                  <KV label="Make / model" value={payload.model} />
                  <KV
                    label="Capacity"
                    value={<span className={cx(status === "TAMPERED" && "text-rose-700")}>{payload.capacity}</span>}
                    mono
                  />
                </div>
              </Section>

              {/* Officer signature line */}
              <div className="flex flex-col gap-4 border-t border-dashed border-line-strong pt-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs text-ink-500">Inspected and signed by</div>
                    <div className="text-[15px] font-semibold text-ink-900">{payload.officer}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                      <Mono>{payload.badgeNumber}</Mono>
                      {payload.gps && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {payload.gps}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stamp */}
                <div
                  className={cx(
                    "inline-flex -rotate-3 select-none items-center gap-2 self-start rounded-md border-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] sm:self-auto",
                    s.stamp
                  )}
                >
                  {status === "VALID"
                    ? "Verified"
                    : status === "EXPIRED"
                      ? "Expired"
                      : status === "REVOKED"
                        ? "Revoked"
                        : "Void"}
                </div>
              </div>
            </>
          )}

          {!payload && (
            <p className="text-sm text-ink-500">
              The code could not be decoded at all. It is not a certificate issued by this system.
            </p>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-line bg-ink-50/60 px-7 py-3 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-9">
          <span>
            Checked {new Date(checkedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <span className="font-mono">e-Metrology · Legal Metrology Department</span>
        </footer>
      </article>

      <div className="no-print flex flex-wrap items-center justify-center gap-2">
        <Button variant="ghost" size="sm" icon={Printer} onClick={() => window.print()}>
          Print this page
        </Button>
        <Button variant="ghost" size="sm" icon={Flag} onClick={() => setReporting(true)}>
          {status === "VALID" ? "Something looks wrong" : "Report this instrument"}
        </Button>
      </div>

      <ReportModal
        open={reporting}
        onClose={() => setReporting(false)}
        certNumber={payload?.certId}
        serialNumber={payload?.serialNumber}
      />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-ink-400" />
        <h2 className="eyebrow">{title}</h2>
      </div>
      <div className="rounded-xl border border-line p-4">{children}</div>
    </section>
  );
}


