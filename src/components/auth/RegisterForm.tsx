"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Building2,
  UserPlus,
  Lock,
  Check,
  Sparkles,
} from "lucide-react";
import { Button, Label, Notice, cx } from "@/components/ui";
import type { SessionUser } from "@/lib/session-types";

interface Fields {
  businessName: string;
  regNo: string;
  address: string;
  contact: string;
  ownerName: string;
  email: string;
  password: string;
}

const EMPTY: Fields = {
  businessName: "",
  regNo: "",
  address: "",
  contact: "",
  ownerName: "",
  email: "",
  password: "",
};

/**
 * Self-registration for a user of weights and measures. Two steps so the form
 * never presents fourteen empty boxes at once: the enterprise, then the login.
 */
export default function RegisterForm({
  currentUser,
}: {
  currentUser?: SessionUser | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [f, setF] = useState<Fields>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badField, setBadField] = useState<string | null>(null);

  const quickFill = () => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    setF({
      businessName: "Verma Grocery & Mart",
      regNo: `VGM-DL-2026-${suffix}`,
      address: "Shop 28, Sector 14 Market, Rohini, New Delhi 110085",
      contact: "+91 98711 22334",
      ownerName: "Sunil Verma",
      email: `trader.${suffix}@vermagrocery.in`,
      password: "demo1234",
    });
    setError(null);
    setBadField(null);
  };

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = k === "regNo" ? e.target.value.toUpperCase() : e.target.value;
    setF((prev) => ({ ...prev, [k]: v }));
    if (badField === k) setBadField(null);
  };

  const step1Ready = f.businessName.trim() && f.regNo.trim() && f.address.trim() && f.contact.trim();
  const step2Ready = f.ownerName.trim() && f.email.trim() && f.password.length >= 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (step1Ready) setStep(2);
      return;
    }
    if (!step2Ready) return;
    setLoading(true);
    setError(null);
    setBadField(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Registration failed");
        setBadField(data.field ?? null);
        // A duplicate registration number belongs to step 1 — take them back.
        if (data.field === "regNo") setStep(1);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-stretch">
      {/* Story panel */}
      <section className="relative hidden overflow-hidden rounded-2xl bg-ink-900 p-8 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-seal-500/20 blur-2xl" />
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-seal-300">
            Stakeholder registration
          </div>
          <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight">
            Enrol your business
            <br />
            in the metrology register.
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/65">
            Every weighing or measuring instrument used in trade must be verified and stamped
            before use. Enrol once, then register each instrument and apply for verification
            online.
          </p>
        </div>

        <ul className="relative mt-10 space-y-3">
          {[
            "Register every instrument you trade with",
            "Apply for verification and re-verification",
            "Get a QR certificate any customer can check",
            "Be reminded before a certificate lapses",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-white/85">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-seal-300" />
              {t}
            </li>
          ))}
        </ul>

        <div className="relative mt-10 flex items-center gap-2 text-xs text-white/50">
          <Lock className="h-3.5 w-3.5" />
          Officer, HQ and test-centre logins are issued by the department, not self-served.
        </div>
      </section>

      {/* Form panel */}
      <section className="card p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Create account</div>
          <div className="flex items-center gap-1.5">
            {[1, 2].map((n) => (
              <span
                key={n}
                className={cx(
                  "h-1.5 rounded-full transition-all",
                  step === n ? "w-6 bg-seal-600" : n < step ? "w-6 bg-seal-300" : "w-3 bg-ink-200"
                )}
              />
            ))}
          </div>
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
          {step === 1 ? "Your business" : "Your login"}
        </h2>
        <p className="mt-1 text-[13px] text-ink-500">
          {step === 1
            ? "As recorded on your trade or GST registration."
            : "The person who will manage instruments for this business."}
        </p>

        {currentUser && (
          <p className="mt-2 rounded-lg border border-line bg-ink-50/70 px-3 py-2 text-[12px] text-ink-600">
            Currently signed in as <strong className="text-ink-900">{currentUser.name}</strong>. Enrolling a new business will register the account and switch your session.
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && (
            <Notice tone="bad" icon={AlertCircle}>
              {error}
            </Notice>
          )}

          {step === 1 ? (
            <>
              <div className="flex items-center justify-between rounded-xl border border-seal-200 bg-seal-50/60 px-3.5 py-2.5 text-xs text-seal-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-seal-600" />
                  <span>Evaluating the prototype?</span>
                </div>
                <button
                  type="button"
                  onClick={quickFill}
                  className="font-semibold text-seal-700 hover:text-seal-800 hover:underline"
                >
                  Quick-fill demo trader ⚡
                </button>
              </div>

              <div>
                <Label htmlFor="businessName">Business name</Label>
                <input
                  id="businessName"
                  required
                  value={f.businessName}
                  onChange={set("businessName")}
                  placeholder="ABC Traders"
                  className="field"
                />
              </div>
              <div>
                <Label htmlFor="regNo" hint="trade / GST registration">
                  Registration number
                </Label>
                <input
                  id="regNo"
                  required
                  value={f.regNo}
                  onChange={set("regNo")}
                  placeholder="ABC-DL-2024-9871"
                  className={cx("field font-mono", badField === "regNo" && "border-rose-500")}
                />
              </div>
              <div>
                <Label htmlFor="address">Premises address</Label>
                <textarea
                  id="address"
                  required
                  rows={2}
                  value={f.address}
                  onChange={set("address")}
                  placeholder="Shop 14, Main Market, Connaught Place, New Delhi 110001"
                  className="field resize-y"
                />
              </div>
              <div>
                <Label htmlFor="contact">Contact number</Label>
                <input
                  id="contact"
                  required
                  value={f.contact}
                  onChange={set("contact")}
                  placeholder="+91 98765 43210"
                  className="field"
                />
              </div>
              <Button type="submit" size="lg" className="w-full" iconRight={ArrowRight} disabled={!step1Ready}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-line bg-ink-50/60 p-3.5">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
                <div className="min-w-0 text-[13px]">
                  <div className="font-medium text-ink-900">{f.businessName}</div>
                  <div className="font-mono text-xs text-ink-500">{f.regNo}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="ml-auto shrink-0 text-xs font-medium text-seal-700 hover:text-seal-800 focus-ring"
                >
                  Edit
                </button>
              </div>
              <div>
                <Label htmlFor="ownerName">Your name</Label>
                <input
                  id="ownerName"
                  required
                  value={f.ownerName}
                  onChange={set("ownerName")}
                  placeholder="Ramesh Gupta"
                  className="field"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={f.email}
                  onChange={set("email")}
                  placeholder="owner@abctraders.in"
                  className={cx("field", badField === "email" && "border-rose-500")}
                />
              </div>
              <div>
                <Label htmlFor="password" hint="at least 8 characters">
                  Password
                </Label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={f.password}
                  onChange={set("password")}
                  placeholder="••••••••"
                  className="field"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="lg" icon={ArrowLeft} onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1"
                  icon={UserPlus}
                  loading={loading}
                  disabled={!step2Ready}
                >
                  Create account
                </Button>
              </div>
            </>
          )}
        </form>

        <div className="mt-6 border-t border-line pt-4 text-center text-[13px] text-ink-500">
          Already enrolled?{" "}
          <Link href="/login" className="font-medium text-seal-700 hover:text-seal-800">
            Sign in
          </Link>
        </div>
      </section>
    </div>
  );
}
