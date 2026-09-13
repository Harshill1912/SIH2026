"use client";

import React from "react";
import {
  PackagePlus,
  FileInput,
  UserCheck,
  ClipboardCheck,
  BadgeCheck,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import { useRole, type UserRole } from "@/context/RoleContext";
import { cx } from "@/components/ui";

interface Step {
  n: number;
  label: string;
  owner: UserRole;
  icon: LucideIcon;
}

const STEPS: Step[] = [
  { n: 1, label: "Register instrument", owner: "BUSINESS", icon: PackagePlus },
  { n: 2, label: "Apply to verify", owner: "BUSINESS", icon: FileInput },
  { n: 3, label: "Assign officer", owner: "ADMIN", icon: UserCheck },
  { n: 4, label: "Inspect on site", owner: "OFFICER", icon: ClipboardCheck },
  { n: 5, label: "Issue certificate", owner: "OFFICER", icon: BadgeCheck },
  { n: 6, label: "Public QR check", owner: "PUBLIC", icon: QrCode },
];

/**
 * The end-to-end workflow, always visible. The active persona's steps are lit;
 * clicking any step jumps to the persona that performs it. This replaces the
 * old page-level role dock — it tells the story instead of duplicating the tabs.
 */
export default function FlowStrip() {
  const { role, goToRole } = useRole();
  /** A test centre performs the same two steps as a departmental officer. */
  const ownsStep = (owner: UserRole) =>
    owner === role || (owner === "OFFICER" && role === "GATC");

  return (
    <div className="no-print">
      <ol className="flex items-stretch gap-0 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STEPS.map((s, i) => {
          const active = ownsStep(s.owner);
          const Icon = s.icon;
          const isLast = i === STEPS.length - 1;
          return (
            <li key={s.n} className="flex min-w-[168px] flex-1 items-center">
              <button
                type="button"
                onClick={() => goToRole(s.owner)}
                aria-current={active ? "step" : undefined}
                className={cx(
                  "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus-ring",
                  active
                    ? "border-seal-200 bg-white shadow-card"
                    : "border-transparent hover:border-line hover:bg-white/70"
                )}
              >
                <span
                  className={cx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold tnum transition-colors",
                    active
                      ? "bg-seal-600 text-white"
                      : "bg-ink-100 text-ink-500 group-hover:bg-ink-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span
                    className={cx(
                      "block text-[11px] font-medium tnum",
                      active ? "text-seal-700" : "text-ink-400"
                    )}
                  >
                    Step {s.n}
                  </span>
                  <span
                    className={cx(
                      "block truncate text-[13px] font-medium",
                      active ? "text-ink-900" : "text-ink-600"
                    )}
                  >
                    {s.label}
                  </span>
                </span>
              </button>
              {!isLast && (
                <span
                  aria-hidden
                  className={cx(
                    "mx-1 h-px w-3 shrink-0 sm:w-4",
                    active && ownsStep(STEPS[i + 1].owner) ? "bg-seal-300" : "bg-line-strong"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
