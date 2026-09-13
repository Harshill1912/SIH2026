/** Shared, import-free types so the proxy, server code and client code agree. */

/**
 * ADMIN   - Legal Metrology HQ: reviews applications, dispatches work.
 * OFFICER - departmental Legal Metrology Officer (LMO) doing field verification.
 * GATC    - Government Approved Test Centre, notified to verify alongside LMOs.
 * BUSINESS- the user of weights and measures applying for verification.
 */
export type Role = "ADMIN" | "OFFICER" | "GATC" | "BUSINESS";

/** Roles that carry out inspections and therefore share the field view. */
export const VERIFIER_ROLES: Role[] = ["OFFICER", "GATC"];
export const isVerifier = (r: Role) => r === "OFFICER" || r === "GATC";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  badgeNumber: string | null;
  /** Set for BUSINESS accounts — the enterprise this login acts for. */
  businessId: string | null;
  /** Set for GATC accounts — the notified test centre this login acts for. */
  testCentreId: string | null;
}

export const SESSION_COOKIE = "em_session";

/**
 * Session tokens are signed with a secret DERIVED from the certificate secret,
 * so a leaked session can never be replayed as a certificate or vice versa.
 * Override with SESSION_SECRET in production.
 */
export const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  `${process.env.JWT_SECRET || "sih26036-legal-metrology-hmac-secret-key-2026"}::session`;

export const SESSION_TTL_SECONDS = 12 * 60 * 60;
