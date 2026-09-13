"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft, Scale } from "lucide-react";
import { Button } from "@/components/ui";
import type { TokenPayload } from "@/components/verify/VerifyView";

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * A verification sticker, sized to print on ordinary label stock. Three copies
 * to a page so an officer covering several instruments prints once.
 */
function Sticker({ payload, qr }: { payload: TokenPayload; qr: string }) {
  return (
    <div className="sticker relative flex w-[3.6in] gap-3 rounded-lg border-2 border-ink-900 bg-white p-3">
      <div className="flex shrink-0 flex-col items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt="Scan to verify this certificate"
          className="h-[1.5in] w-[1.5in] [image-rendering:pixelated]"
        />
        <span className="text-[6.5pt] font-semibold uppercase tracking-wider text-ink-700">
          Scan to verify
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 border-b border-ink-900 pb-1">
          <Scale className="h-3 w-3 shrink-0" />
          <span className="text-[7.5pt] font-bold uppercase leading-tight tracking-wide">
            Legal Metrology
            <span className="block text-[6pt] font-semibold tracking-normal text-ink-600">
              Verification certificate
            </span>
          </span>
        </div>

        <dl className="mt-1.5 space-y-[3px] text-[7pt] leading-tight">
          <Row k="Cert no" v={payload.certId} mono />
          <Row k="Serial" v={payload.serialNumber} mono />
          <Row k="Capacity" v={payload.capacity} />
          <Row k="Officer" v={payload.badgeNumber || payload.officer} />
        </dl>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-ink-200 pt-1.5">
          <div>
            <div className="text-[5.5pt] font-semibold uppercase tracking-wider text-ink-500">
              Valid till
            </div>
            <div className="text-[9pt] font-bold leading-none text-ink-900">
              {fmt(payload.validTill)}
            </div>
          </div>
          <div className="text-right text-[5.5pt] leading-tight text-ink-500">
            Issued
            <br />
            {fmt(payload.validFrom)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  return (
    <div className="flex gap-1.5">
      <dt className="w-[46px] shrink-0 text-ink-500">{k}</dt>
      {/* Never truncate: a half-printed certificate number is useless on a label. */}
      <dd className={`min-w-0 flex-1 break-all font-semibold leading-tight text-ink-900 ${mono ? "font-mono" : ""}`}>
        {v || "—"}
      </dd>
    </div>
  );
}

export default function StickerSheet({ payload, qr }: { payload: TokenPayload; qr: string }) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined") {
      if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
        router.back();
      } else {
        router.push("/");
      }
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">Print</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
            Verification sticker
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Three copies on one page. Print, cut, and affix to the instrument beside the
            department seal.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" icon={ArrowLeft} onClick={handleBack}>
            Back
          </Button>
          <Button icon={Printer} onClick={() => window.print()}>
            Print sheet
          </Button>
        </div>
      </div>

      <div className="sticker-sheet flex flex-col items-center gap-4 rounded-2xl border border-line bg-white p-6 print:gap-3 print:border-0 print:p-0">
        {[0, 1, 2].map((i) => (
          <Sticker key={i} payload={payload} qr={qr} />
        ))}
      </div>

      <p className="no-print mt-4 text-center text-xs text-ink-400">
        The QR encodes the signed certificate itself, so a shopper can verify it without an
        account and without this server being reachable.
      </p>
    </div>
  );
}
