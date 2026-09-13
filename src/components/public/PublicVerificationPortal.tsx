"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  ArrowRight,
  QrCode,
  ScanLine,
  Lock,
  ShieldAlert,
} from "lucide-react";
import QrScanner from "./QrScanner";
import ReportModal from "./ReportModal";
import { Button, ButtonLink, Card, cx } from "@/components/ui";

interface DemoTokens {
  validToken: string;
  expiredToken: string;
  tamperedToken: string;
}

/**
 * A scanned sticker yields a full verification URL; a typed entry may be the
 * bare token or the whole URL. Reduce either to the token.
 */
export function tokenFromScan(text: string): string {
  const t = text.trim();
  const m = /\/verify\/([^/?#\s]+)/.exec(t);
  if (m) return decodeURIComponent(m[1]);
  return t;
}

export default function PublicVerificationPortal({
  demoTokens: initialDemoTokens,
}: {
  demoTokens?: DemoTokens;
}) {
  const [tokenInput, setTokenInput] = useState("");
  const [demoTokens, setDemoTokens] = useState(initialDemoTokens);
  const [scanning, setScanning] = useState(false);
  const [reporting, setReporting] = useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (demoTokens) return;
    fetch("/api/demo-tokens")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDemoTokens({
            validToken: data.validToken,
            expiredToken: data.expiredToken,
            tamperedToken: data.tamperedToken,
          });
        }
      })
      .catch(console.error);
  }, [demoTokens]);

  const go = useCallback(
    (raw: string) => {
      const token = tokenFromScan(raw);
      if (token) router.push(`/verify/${encodeURIComponent(token)}`);
    },
    [router]
  );

  const onScan = useCallback(
    (text: string) => {
      setScanning(false);
      go(text);
    },
    [go]
  );

  const samples: Array<{ title: string; body: string; icon: typeof ShieldCheck; token?: string; tone: string }> = [
    {
      title: "Genuine",
      body: "Signed, and inside its validity window.",
      icon: ShieldCheck,
      token: demoTokens?.validToken,
      tone: "text-seal-700 bg-seal-50 ring-seal-200",
    },
    {
      title: "Expired",
      body: "Signature real, but the year has lapsed.",
      icon: AlertTriangle,
      token: demoTokens?.expiredToken,
      tone: "text-amber-700 bg-amber-50 ring-amber-200",
    },
    {
      title: "Tampered",
      body: "Capacity edited — the signature check fails.",
      icon: XCircle,
      token: demoTokens?.tamperedToken,
      tone: "text-rose-700 bg-rose-50 ring-rose-200",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div className="text-center">
        <div className="eyebrow">Public verification</div>
        <h1 className="mx-auto mt-2 max-w-xl text-3xl font-semibold tracking-tight text-ink-900 sm:text-[38px] sm:leading-tight">
          Is this scale certified?
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-ink-500">
          Scan the QR sticker on any shop scale, weighbridge or fuel dispenser. No account, no
          app, about a second.
        </p>
      </div>

      {/* Scan is the primary action; typing the code is the fallback. */}
      <div className="mx-auto max-w-xl space-y-3">
        <Button
          size="lg"
          icon={ScanLine}
          onClick={() => setScanning(true)}
          className="h-14 w-full text-[16px]"
        >
          Scan QR sticker
        </Button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(tokenInput);
          }}
          className="flex items-center gap-2 rounded-xl border border-line bg-white p-1.5"
        >
          <QrCode className="ml-2 h-4 w-4 shrink-0 text-ink-400" />
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="…or paste the certificate code"
            className="h-9 w-full border-0 bg-transparent font-mono text-[13px] text-ink-900 placeholder:font-sans placeholder:text-ink-400 focus:outline-none"
          />
          <Button type="submit" size="sm" variant="secondary" iconRight={ArrowRight}>
            Verify
          </Button>
        </form>

        <div className="flex items-center justify-center gap-2 text-xs text-ink-500">
          <Lock className="h-3.5 w-3.5" />
          Read on your device and checked cryptographically — nothing is uploaded.
        </div>
      </div>

      {/* Demo scaffolding, clearly marked as such. */}
      <div className="rounded-2xl border border-dashed border-line-strong bg-ink-50/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="eyebrow">Sample certificates</span>
          <span className="text-xs text-ink-400">for trying it without a printed sticker</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {samples.map((s) => {
            const Icon = s.icon;
            return (
              <ButtonLink
                key={s.title}
                href={s.token ? `/verify/${s.token}` : "#"}
                variant="secondary"
                className={cx(
                  "h-auto flex-col items-start gap-1 px-3.5 py-3 text-left",
                  !s.token && "pointer-events-none opacity-50"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cx("inline-flex rounded-lg p-1.5 ring-1", s.tone)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[14px] font-semibold text-ink-900">{s.title}</span>
                </span>
                <span className="text-xs font-normal leading-snug text-ink-500">{s.body}</span>
              </ButtonLink>
            );
          })}
        </div>
      </div>

      {/* Reporting, the other half of a citizen's power here. */}
      <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-ink-900">
              No sticker, or one that has expired?
            </div>
            <p className="mt-0.5 text-[13px] text-ink-500">
              Report it to the department. No account needed, and you may stay anonymous.
            </p>
          </div>
        </div>
        <Button variant="warn" size="sm" onClick={() => setReporting(true)} className="shrink-0">
          Report an instrument
        </Button>
      </Card>

      {/* Business owner enrolment banner */}
      <Card className="flex flex-col items-start gap-3 border-seal-200 bg-seal-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-seal-600 text-white">
            <QrCode className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-seal-950">
              Are you a trader or scale owner?
            </div>
            <p className="mt-0.5 text-[13px] text-seal-700">
              Register your business to enrol instruments, apply for verification, and get cryptographically verifiable QR stickers.
            </p>
          </div>
        </div>
        <ButtonLink href="/register" size="sm" className="shrink-0">
          Enrol business →
        </ButtonLink>
      </Card>

      <QrScanner
        open={scanning}
        onClose={() => setScanning(false)}
        onResult={onScan}
        demoTokens={demoTokens}
      />
      <ReportModal open={reporting} onClose={() => setReporting(false)} />
    </div>
  );
}
