"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  Landmark,
  Search,
  RotateCcw,
  Check,
  Scale,
  LogOut,
  LogIn,
  UserPlus,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { useRole, roleDetails, ROLE_ORDER, type UserRole } from "@/context/RoleContext";
import { cx } from "@/components/ui";

const roleIcon: Record<UserRole, LucideIcon> = {
  BUSINESS: Building2,
  ADMIN: Landmark,
  OFFICER: ShieldCheck,
  GATC: FlaskConical,
  PUBLIC: Search,
};

/** Icon-only control with an accessible label; text appears only when there is room. */
function Tool({
  icon: Icon,
  label,
  onClick,
  href,
  active,
  spinning,
  tone = "default",
  showLabelFrom,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  spinning?: boolean;
  tone?: "default" | "good";
  showLabelFrom?: string;
}) {
  const cls = cx(
    "inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-2.5 text-[13px] font-medium transition focus-ring active:scale-95",
    tone === "good"
      ? "border-seal-200 bg-seal-50 text-seal-800"
      : active
        ? "border-seal-200 bg-seal-50 text-seal-800"
        : "border-line-strong bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900"
  );
  const inner = (
    <>
      <Icon className={cx("h-4 w-4 shrink-0", spinning && "animate-spin")} />
      {showLabelFrom && <span className={cx("hidden", showLabelFrom)}>{label}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={cls} title={label} aria-label={label}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} title={label} aria-label={label}>
      {inner}
    </button>
  );
}

export default function RoleHeader() {
  const { user, role, roleInfo, goToRole, signOut } = useRole();
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const pathname = usePathname();

  const onDashboard = pathname === "/";
  const onPublic = pathname.startsWith("/verify");

  const isActive = (r: UserRole) => (r === "PUBLIC" ? onPublic : onDashboard && role === r);

  const handleReset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (res.ok) {
        setResetDone(true);
        // Full reload on purpose: every dashboard holds fetched state that the
        // reset just invalidated, and a soft refresh would leave it on screen.
        setTimeout(() => window.location.reload(), 700);
        return;
      }
    } catch (e) {
      console.error(e);
    }
    setResetting(false);
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <Link href={user ? "/" : "/verify"} className="group flex shrink-0 items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink-900 text-white transition-transform duration-200 group-hover:scale-[1.04]">
              <Scale className="h-[18px] w-[18px]" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-seal-500" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight text-ink-900">
                e-Metrology
              </span>
              <span className="hidden text-[11px] text-ink-500 sm:block">
                Legal Metrology · Digital Verification
              </span>
            </span>
          </Link>

          {/* Persona tabs — demo navigation, only meaningful once signed in.
              A citizen on the public page never sees them. */}
          {user && (
            <nav aria-label="Persona" className="hidden h-16 items-stretch md:flex">
              {ROLE_ORDER.map((r) => {
                const Icon = roleIcon[r];
                const active = isActive(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => goToRole(r)}
                    className={cx(
                      "relative flex items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors focus-ring",
                      active ? "text-ink-900" : "text-ink-500 hover:text-ink-900"
                    )}
                  >
                    <Icon className={cx("h-4 w-4", active ? "text-seal-600" : "text-ink-400")} />
                    <span className="hidden lg:inline">{roleDetails[r].label}</span>
                    <span
                      className={cx(
                        "absolute inset-x-2.5 -bottom-px h-[2px] rounded-full bg-seal-600 transition-all duration-300",
                        active ? "scale-x-100 opacity-100" : "scale-x-50 opacity-0"
                      )}
                    />
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right cluster — compact by default, labels only on wide screens */}
          <div className="flex shrink-0 items-center gap-1.5">
            {user ? (
              <>
                <Tool
                  icon={Search}
                  label="Search"
                  href="/search"
                  active={pathname.startsWith("/search")}
                  showLabelFrom="xl:inline"
                />

                <div className="hidden items-center gap-2 rounded-[10px] border border-line bg-white px-2.5 py-1.5 sm:flex">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-seal-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-seal-500" />
                  </span>
                  <span className="max-w-[140px] truncate text-[13px] font-medium text-ink-900">
                    {roleInfo.name}
                  </span>
                </div>

                <Tool
                  icon={resetDone ? Check : RotateCcw}
                  label="Reset the demo database"
                  onClick={handleReset}
                  spinning={resetting && !resetDone}
                  tone={resetDone ? "good" : "default"}
                />
                <Tool icon={LogOut} label="Sign out" onClick={() => void signOut()} />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/register"
                  className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong bg-white px-3 text-[13px] font-medium text-ink-700 transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900 focus-ring active:scale-95"
                >
                  <UserPlus className="h-4 w-4 text-seal-600" />
                  Enrol business
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-ink-900 px-3.5 text-[13px] font-medium text-white transition hover:bg-ink-800 focus-ring active:scale-95"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile persona tabs */}
        {user && (
          <div className="-mx-4 flex gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ROLE_ORDER.map((r) => {
              const Icon = roleIcon[r];
              const active = isActive(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => goToRole(r)}
                  className={cx(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
                    active ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {roleDetails[r].label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
