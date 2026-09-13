"use client";

import React from "react";
import { X, ShieldCheck, ExternalLink, Printer, Lock } from "lucide-react";
import { ButtonLink, KV, Modal, Mono } from "@/components/ui";

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: {
    certNumber: string;
    token: string;
    qrCode: string;
    validFrom: string;
    validTill: string;
    businessName?: string;
    serialNumber?: string;
    category?: string;
  } | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default function CertificateModal({ isOpen, onClose, certificate }: CertificateModalProps) {
  if (!certificate) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      width="max-w-xl"
      header={
        <div className="relative overflow-hidden bg-seal-700 px-6 py-6 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-seal-100">
                  Certificate issued
                </div>
                <h3 className="mt-0.5 text-xl font-semibold tracking-tight">
                  Verification complete
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      }
      footer={
        <>
          <ButtonLink
            href={`/verify/${certificate.token}`}
            target="_blank"
            variant="ghost"
            iconRight={ExternalLink}
          >
            Public page
          </ButtonLink>
          <ButtonLink href={`/sticker/${certificate.token}`} target="_blank" icon={Printer}>
            Print sticker
          </ButtonLink>
        </>
      }
    >
      <div className="px-6 py-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-2xl border border-line bg-white p-3 shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={certificate.qrCode} alt="Verification QR code" className="h-40 w-40 object-contain" />
          </div>
          <div className="w-full space-y-4">
            <div>
              <div className="text-xs text-ink-500">Certificate number</div>
              <Mono className="mt-1 block text-[15px] font-semibold text-seal-800">
                {certificate.certNumber}
              </Mono>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <KV label="Valid from" value={fmt(certificate.validFrom)} />
              <KV label="Valid till" value={<span className="text-seal-700">{fmt(certificate.validTill)}</span>} />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-seal-200 bg-seal-50 px-3 py-2 text-[13px] text-seal-800">
              <Lock className="h-4 w-4 shrink-0" />
              Signed with HMAC-SHA256. Any change to the payload invalidates this QR.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
