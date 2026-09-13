import type { Role } from "./session-types";

/**
 * The demo logins. Plain data with no imports so the login page (client) and
 * the seed script (node) can both use it. The password is deliberately public —
 * this is a hackathon prototype and the jury needs to sign in fast.
 */
export const DEMO_PASSWORD = "demo1234";

export interface DemoAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  badgeNumber: string | null;
  businessId: string | null;
  testCentreId: string | null;
  /** Copy for the login page card. */
  title: string;
  blurb: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "user-business-01",
    name: "ABC Traders",
    email: "owner@abctraders.in",
    role: "BUSINESS",
    badgeNumber: null,
    businessId: "biz-abc-traders",
    testCentreId: null,
    title: "Business owner",
    blurb: "Registers instruments and applies for verification.",
  },
  {
    id: "user-admin-01",
    name: "Legal Metrology HQ",
    email: "admin@metrology.gov.in",
    role: "ADMIN",
    badgeNumber: "HQ-ADMIN-01",
    businessId: null,
    testCentreId: null,
    title: "Admin HQ",
    blurb: "Reviews applications and dispatches officers or test centres.",
  },
  {
    id: "user-officer-01",
    name: "Insp. Rajesh Kumar",
    email: "rajesh.kumar@metrology.gov.in",
    role: "OFFICER",
    badgeNumber: "DL-MET-402",
    businessId: null,
    testCentreId: null,
    title: "Field officer (LMO - Zone 1)",
    blurb: "Inspects on site and issues the signed certificate.",
  },
  {
    id: "user-officer-02",
    name: "Insp. Anita Sharma",
    email: "anita.sharma@metrology.gov.in",
    role: "OFFICER",
    badgeNumber: "DL-MET-508",
    businessId: null,
    testCentreId: null,
    title: "Field officer (LMO - Zone 2)",
    blurb: "Inspects on site and issues the signed certificate.",
  },
  {
    id: "user-gatc-01",
    name: "Precision Test Labs",
    email: "verify@precisiontestlabs.in",
    role: "GATC",
    badgeNumber: "GATC-DL-07",
    businessId: null,
    testCentreId: "gatc-precision-labs",
    title: "Test centre (GATC)",
    blurb: "Government Approved Test Centre verifying alongside the department.",
  },
];

export const demoAccountForRole = (role: string | undefined) =>
  DEMO_ACCOUNTS.find((a) => a.role === role) ?? null;
