"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Landmark,
  ShieldCheck,
  FlaskConical,
  ArrowRight,
  QrCode,
  Lock,
  AlertCircle,
  KeyRound,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, demoAccountForRole } from "@/lib/demo-accounts";
import type { Role, SessionUser } from "@/lib/session-types";
import { Button, Label, Notice, cx } from "@/components/ui";

const roleIcon: Record<Role, LucideIcon> = {
  BUSINESS: Building2,
  ADMIN: Landmark,
  OFFICER: ShieldCheck,
  GATC: FlaskConical,
};

const STEPS = [
  "Register instrument",
  "Apply to verify",
  "Assign officer",
  "Inspect on site",
  "Issue certificate",
  "Public QR check",
];

export default function LoginForm({
  presetRole,
  next,
  currentUser,
}: {
  presetRole?: string;
  next: string;
  currentUser: SessionUser | null;
}) {
  const preset = demoAccountForRole(presetRole);
  const router = useRouter();
  const [email, setEmail] = useState(preset?.email ?? "");
  const [password, setPassword] = useState(preset ? DEMO_PASSWORD : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    const body = creds ?? { email, password };
    if (!body.email || !body.password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Sign-in failed");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const signInAsDemo = (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    void submit(undefined, { email: accountEmail, password: DEMO_PASSWORD });
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
      {/* Story panel */}
      <section className="relative hidden overflow-hidden rounded-2xl bg-ink-900 p-8 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-seal-500/20 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/[0.04] blur-xl"
        />
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-seal-300">
            Legal Metrology Act, 2009
          </div>
          <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">
            Every scale in the market,
            <br />
            verified and provable.
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/65">
            One workflow from application to a tamper-evident QR certificate that any shopper
            can check in a second.
          </p>
        </div>

        <ol className="relative mt-10 space-y-2.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-[13.5px]">
              <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-semibold text-white/80 ring-1 ring-white/15">
                {i + 1}
              </span>
              <span className="text-white/85">{s}</span>
            </li>
          ))}
        </ol>

        <div className="relative mt-10 flex items-center gap-2 text-xs text-white/50">
          <Lock className="h-3.5 w-3.5" />
          Sessions are HttpOnly, signed, and expire after 12 hours.
        </div>
      </section>

      {/* Form panel */}
      <section className="card p-6 sm:p-8">
        <div className="eyebrow">Sign in</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
          {preset ? `Continue as ${preset.title}` : "Welcome back"}
        </h2>
        {currentUser && (
          <p className="mt-1 text-[13px] text-ink-500">
            Currently signed in as <span className="font-medium text-ink-800">{currentUser.name}</span>.
            Signing in again switches accounts.
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && (
            <Notice tone="bad" icon={AlertCircle}>
              {error}
            </Notice>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.in"
              className="field"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="field"
            />
          </div>
          <Button type="submit" size="lg" className="w-full" loading={loading} iconRight={ArrowRight}>
            Sign in
          </Button>
        </form>

        {/* Demo accounts */}
        <div className="mt-7">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-700">Demo accounts</span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-500">
              <KeyRound className="h-3 w-3" /> {DEMO_PASSWORD}
            </span>
          </div>
          <div className="grid gap-2">
            {DEMO_ACCOUNTS.map((a) => {
              const Icon = roleIcon[a.role];
              const highlighted = preset?.id === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={loading}
                  onClick={() => signInAsDemo(a.email)}
                  className={cx(
                    "group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-150 focus-ring disabled:opacity-60",
                    highlighted
                      ? "border-seal-300 bg-seal-50/70"
                      : "border-line hover:border-ink-300 hover:bg-ink-50"
                  )}
                >
                  <span
                    className={cx(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      highlighted ? "bg-seal-600 text-white" : "bg-ink-100 text-ink-600"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[14px] font-medium text-ink-900">{a.title}</span>
                    <span className="block truncate text-xs text-ink-500">{a.blurb}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-600" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 space-y-2 border-t border-line pt-4 text-center text-[13px] text-ink-500">
          <div>
            New business?{" "}
            <Link
              href="/register"
              className="inline-flex items-center gap-1 font-medium text-seal-700 hover:text-seal-800"
            >
              <UserPlus className="h-3.5 w-3.5" /> Enrol in the register
            </Link>
          </div>
          Just checking a certificate?{" "}
          <Link
            href="/verify"
            className="inline-flex items-center gap-1 font-medium text-seal-700 hover:text-seal-800"
          >
            <QrCode className="h-3.5 w-3.5" /> Verify without signing in
          </Link>
        </div>
      </section>
    </div>
  );
}
