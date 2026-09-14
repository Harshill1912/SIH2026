"use client";

import React, { useRef, useState } from "react";
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
  Eye,
  EyeOff,
  Circle,
} from "lucide-react";
import { Button, Label, Notice, cx } from "@/components/ui";
import type { SessionUser } from "@/lib/session-types";
import GeoCapture from "@/components/officer/GeoCapture";
import type { GeoFix } from "@/lib/geo";
import { GEOFENCE_RADIUS_M, fixError, formatDistance } from "@/lib/geofence";
import { lookupAddress } from "@/lib/address";

type AddressLookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "filled" }
  | { status: "suggested"; address: string }
  | { status: "error"; message: string };

/** Demo-mode stand-in for the quick-fill trader's shop in Rohini. */
const DEMO_PREMISES = { lat: 28.7353, lng: 77.118 };
import {
  businessErrors,
  loginErrors,
  passwordRules,
  type RegisterField,
} from "@/lib/validation";

const STEP_ONE_FIELDS: RegisterField[] = ["businessName", "regNo", "address", "contact"];
const STEP_TWO_FIELDS: RegisterField[] = ["ownerName", "email", "password"];

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-rose-700">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

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
  /** Errors show only once a field has been left, or its step has been submitted. */
  const [touched, setTouched] = useState<Partial<Record<RegisterField | "location", boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [premises, setPremises] = useState<GeoFix | null>(null);
  const [lookup, setLookup] = useState<AddressLookupState>({ status: "idle" });
  /** Increments per capture, so a slow lookup can't overwrite a newer one. */
  const lookupSeq = useRef(0);

  const applyDetectedAddress = (address: string) => {
    setF((prev) => ({ ...prev, address }));
    setTouched((t) => ({ ...t, address: true }));
    setLookup({ status: "filled" });
  };

  const onPremisesFix = async (fix: GeoFix | null) => {
    setPremises(fix);
    if (badField === "location") {
      setBadField(null);
      setError(null);
    }
    if (!fix) {
      setLookup({ status: "idle" });
      return;
    }
    const seq = ++lookupSeq.current;
    // Decided now: an address the trader already typed is never overwritten silently.
    const addressWasEmpty = !f.address.trim();
    setLookup({ status: "loading" });
    const result = await lookupAddress(fix.lat, fix.lng);
    if (seq !== lookupSeq.current) return;
    if (!result.ok) setLookup({ status: "error", message: result.error });
    else if (addressWasEmpty) applyDetectedAddress(result.address);
    else setLookup({ status: "suggested", address: result.address });
  };

  const quickFill = () => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    setF({
      businessName: "Verma Grocery & Mart",
      regNo: `VGM-DL-2026-${suffix}`,
      address: "Shop 28, Sector 14 Market, Rohini, New Delhi 110085",
      contact: "9871122334",
      ownerName: "Sunil Verma",
      email: `trader.${suffix}@vermagrocery.in`,
      password: `Grocery#${suffix}Mart`,
    });
    setError(null);
    setBadField(null);
    setTouched({});
  };

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let v = e.target.value;
    if (k === "regNo") v = v.toUpperCase();
    // The +91 is fixed beside the box, so the box itself only ever holds 10 digits.
    if (k === "contact") v = v.replace(/\D/g, "").slice(0, 10);
    setF((prev) => ({ ...prev, [k]: v }));
    if (badField === k) {
      setBadField(null);
      setError(null);
    }
  };

  const blur = (k: RegisterField) => () => setTouched((t) => ({ ...t, [k]: true }));

  const errors: Record<RegisterField, string | null> = { ...businessErrors(f), ...loginErrors(f) };
  const show = (k: RegisterField) => (touched[k] ? errors[k] : null);
  const invalid = (k: RegisterField) => Boolean(show(k)) || badField === k;
  const fieldClass = (k: RegisterField, extra = "") =>
    cx("field", extra, invalid(k) && "border-rose-500 focus:border-rose-500");
  const a11y = (k: RegisterField) => ({
    "aria-invalid": invalid(k) || undefined,
    "aria-describedby": show(k) ? `${k}-error` : undefined,
  });

  const locationProblem = fixError(premises);
  const locationShown = (touched.location ? locationProblem : null) ?? (badField === "location" ? error : null);
  const step1Ready = STEP_ONE_FIELDS.every((k) => !errors[k]) && !locationProblem;
  const step2Ready = STEP_TWO_FIELDS.every((k) => !errors[k]);
  const rules = passwordRules(f.password);

  const touchAll = (fields: Array<RegisterField | "location">) =>
    setTouched((t) => ({ ...t, ...Object.fromEntries(fields.map((k) => [k, true])) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      touchAll([...STEP_ONE_FIELDS, "location"]);
      if (step1Ready) setStep(2);
      return;
    }
    touchAll(STEP_TWO_FIELDS);
    if (!step2Ready) return;
    setLoading(true);
    setError(null);
    setBadField(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          lat: premises?.lat ?? null,
          lng: premises?.lng ?? null,
          accuracyM: premises?.accuracyM ?? null,
          source: premises?.source ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Registration failed");
        setBadField(data.field ?? null);
        // A server-side rejection of a step-one field — take them back to it.
        if (STEP_ONE_FIELDS.includes(data.field) || data.field === "location") setStep(1);
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

        {/* noValidate: our inline messages replace the browser's tooltips. */}
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
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
                  maxLength={120}
                  value={f.businessName}
                  onChange={set("businessName")}
                  onBlur={blur("businessName")}
                  placeholder="ABC Traders"
                  className={fieldClass("businessName")}
                  {...a11y("businessName")}
                />
                <FieldError id="businessName-error" message={show("businessName")} />
              </div>
              <div>
                <Label htmlFor="regNo" hint="trade / GST registration">
                  Registration number
                </Label>
                <input
                  id="regNo"
                  required
                  maxLength={30}
                  value={f.regNo}
                  onChange={set("regNo")}
                  onBlur={blur("regNo")}
                  placeholder="ABC-DL-2024-9871"
                  className={fieldClass("regNo", "font-mono")}
                  {...a11y("regNo")}
                />
                <FieldError id="regNo-error" message={show("regNo")} />
              </div>
              <div>
                <Label htmlFor="address">Premises address</Label>
                <textarea
                  id="address"
                  required
                  rows={2}
                  maxLength={300}
                  value={f.address}
                  onChange={set("address")}
                  onBlur={blur("address")}
                  placeholder="Shop 14, Main Market, Connaught Place, New Delhi 110001"
                  className={fieldClass("address", "resize-y")}
                  {...a11y("address")}
                />
                <FieldError id="address-error" message={show("address")} />

                <div className="mt-3">
                  <GeoCapture
                    label="Live location"
                    captureLabel="Use my live location"
                    autoLocate={false}
                    value={premises}
                    onChange={onPremisesFix}
                    manualFix={DEMO_PREMISES}
                    manualLabel="Use demo location"
                  />
                  {lookup.status === "loading" && (
                    <p className="mt-1.5 text-[12.5px] text-ink-500">Looking up the address at this location…</p>
                  )}
                  {lookup.status === "filled" && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-seal-800">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Address filled from your location — check it and add the shop number if missing.
                    </p>
                  )}
                  {lookup.status === "suggested" && (
                    <div className="mt-1.5 rounded-lg border border-line bg-ink-50/60 px-3 py-2 text-[12.5px] text-ink-700">
                      Detected here: <span className="text-ink-900">{lookup.address}</span>{" "}
                      <button
                        type="button"
                        onClick={() => applyDetectedAddress(lookup.address)}
                        className="font-medium text-seal-700 hover:text-seal-800 hover:underline"
                      >
                        Use this address
                      </button>
                    </div>
                  )}
                  {lookup.status === "error" && (
                    <p className="mt-1.5 text-[12.5px] text-amber-800">{lookup.message}</p>
                  )}
                  <p className="mt-1.5 text-[12px] text-ink-500">
                    Do this while standing at your premises. Verification officers must be on site — within{" "}
                    {formatDistance(GEOFENCE_RADIUS_M)} of this point — to certify your instruments.
                    {(lookup.status === "filled" || lookup.status === "suggested") && " Address data © OpenStreetMap contributors."}
                  </p>
                  <FieldError id="location-error" message={locationShown} />
                </div>
              </div>
              <div>
                <Label htmlFor="contact" hint="10-digit mobile, for SMS reminders">
                  Mobile number
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[14px] font-medium text-ink-500">
                    +91
                  </span>
                  <input
                    id="contact"
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    value={f.contact}
                    onChange={set("contact")}
                    onBlur={blur("contact")}
                    placeholder="98765 43210"
                    className={fieldClass("contact", "pl-12 font-mono tracking-wide")}
                    {...a11y("contact")}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs tnum text-ink-400">
                    {f.contact.length}/10
                  </span>
                </div>
                <FieldError id="contact-error" message={show("contact")} />
              </div>
              <Button type="submit" size="lg" className="w-full" iconRight={ArrowRight}>
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
                  autoComplete="name"
                  maxLength={80}
                  value={f.ownerName}
                  onChange={set("ownerName")}
                  onBlur={blur("ownerName")}
                  placeholder="Ramesh Gupta"
                  className={fieldClass("ownerName")}
                  {...a11y("ownerName")}
                />
                <FieldError id="ownerName-error" message={show("ownerName")} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={254}
                  value={f.email}
                  onChange={set("email")}
                  onBlur={blur("email")}
                  placeholder="owner@abctraders.in"
                  className={fieldClass("email")}
                  {...a11y("email")}
                />
                <FieldError id="email-error" message={show("email")} />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    maxLength={128}
                    value={f.password}
                    onChange={set("password")}
                    onBlur={blur("password")}
                    placeholder="••••••••"
                    className={fieldClass("password", "pr-11")}
                    {...a11y("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-400 hover:text-ink-700 focus-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2" aria-label="Password requirements">
                  {rules.map((r) => (
                    <li
                      key={r.key}
                      className={cx("flex items-center gap-1.5 text-[12.5px]", r.ok ? "text-seal-700" : "text-ink-500")}
                    >
                      {r.ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
                      {r.label}
                    </li>
                  ))}
                </ul>
                {/* The checklist covers the character rules; this catches the rest (common, contains your name). */}
                <FieldError
                  id="password-error"
                  message={touched.password && rules.every((r) => r.ok) ? errors.password : null}
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
