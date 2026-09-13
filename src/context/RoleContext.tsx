"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Role, SessionUser } from "@/lib/session-types";

export type { Role, SessionUser };

/** The personas the UI knows about. PUBLIC is "not signed in". */
export type UserRole = Role | "PUBLIC";

export interface RoleInfo {
  name: string;
  description: string;
  badge: string;
  /** Short persona label used in the header tabs. */
  label: string;
  /** Workflow steps (1–6) this persona owns. */
  steps: number[];
}

export const roleDetails: Record<UserRole, RoleInfo> = {
  BUSINESS: {
    name: "Business",
    description: "Registers instruments and applies for verification",
    badge: "Applicant",
    label: "Business",
    steps: [1, 2],
  },
  ADMIN: {
    name: "Legal Metrology HQ",
    description: "Central administration & work dispatch",
    badge: "Controller",
    label: "Admin HQ",
    steps: [3],
  },
  OFFICER: {
    name: "Field officer",
    description: "On-site verification and certificate issuance",
    badge: "Field Officer",
    label: "Field Officer",
    steps: [4, 5],
  },
  GATC: {
    name: "Test centre",
    description: "Government Approved Test Centre verification",
    badge: "GATC",
    label: "Test Centre",
    steps: [4, 5],
  },
  PUBLIC: {
    name: "Public verifier",
    description: "Citizen & consumer certificate check",
    badge: "Citizen",
    label: "Public",
    steps: [6],
  },
};

export const ROLE_ORDER: UserRole[] = ["BUSINESS", "ADMIN", "OFFICER", "GATC", "PUBLIC"];

interface RoleContextType {
  /** Signed-in user, or null on public pages. */
  user: SessionUser | null;
  /** Effective persona — the user's role, or PUBLIC when signed out. */
  role: UserRole;
  roleInfo: RoleInfo;
  /**
   * Navigate to a persona. Your own role → the dashboard; another role → the
   * login page pre-filled with that demo account; PUBLIC → the verify portal.
   */
  goToRole: (role: UserRole) => void;
  signOut: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const role: UserRole = user?.role ?? "PUBLIC";

  const roleInfo = useMemo<RoleInfo>(
    () => ({ ...roleDetails[role], name: user?.name ?? roleDetails[role].name }),
    [role, user?.name]
  );

  const goToRole = useCallback(
    (target: UserRole) => {
      if (target === "PUBLIC") return router.push("/verify");
      if (user?.role === target) return router.push("/");
      router.push(`/login?as=${target}`);
    },
    [router, user?.role]
  );

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  return (
    <RoleContext.Provider value={{ user, role, roleInfo, goToRole, signOut }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
