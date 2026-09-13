import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "./prisma";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demo-accounts";
import { hashPassword, verifyPassword } from "./password";
import {
  SESSION_COOKIE,
  SESSION_SECRET,
  SESSION_TTL_SECONDS,
  type Role,
  type SessionUser,
} from "./session-types";

/* ── Token ──────────────────────────────────────────────────────────────── */

export function signSession(user: SessionUser): string {
  const { id, ...claims } = user;
  return jwt.sign({ sub: id, ...claims }, SESSION_SECRET, {
    algorithm: "HS256",
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export function parseSession(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, SESSION_SECRET) as jwt.JwtPayload & Omit<SessionUser, "id">;
    if (!p.sub || !p.role) return null;
    return {
      id: p.sub,
      name: p.name,
      email: p.email,
      role: p.role,
      badgeNumber: p.badgeNumber ?? null,
      businessId: p.businessId ?? null,
      testCentreId: p.testCentreId ?? null,
    };
  } catch {
    return null;
  }
}

/* ── Cookie ─────────────────────────────────────────────────────────────── */

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

/* ── Server-side session access ─────────────────────────────────────────── */

/** Current user from the request cookie, or null. Server components + routes. */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return parseSession(jar.get(SESSION_COOKIE)?.value);
}

type Guard = { user: SessionUser } | { error: NextResponse };

/**
 * Route-handler guard. Returns the user, or a ready-made 401/403 response.
 *
 *   const auth = await requireSession("ADMIN");
 *   if ("error" in auth) return auth.error;
 */
export async function requireSession(...roles: Role[]): Promise<Guard> {
  const user = await getSession();
  if (!user) {
    return {
      error: NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 }),
    };
  }
  if (roles.length > 0 && !roles.includes(user.role)) {
    return {
      error: NextResponse.json(
        { success: false, error: `This action needs the ${roles.join(" or ")} role` },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/* ── Credentials ────────────────────────────────────────────────────────── */

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const normEmail = email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email: normEmail } });

  if (!user) {
    const demo = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === normEmail);
    if (demo && password === DEMO_PASSWORD) {
      user = await prisma.user.create({
        data: {
          id: demo.id,
          name: demo.name,
          email: demo.email,
          role: demo.role,
          badgeNumber: demo.badgeNumber,
          businessId: demo.businessId,
          testCentreId: demo.testCentreId,
          passwordHash: hashPassword(DEMO_PASSWORD),
        },
      });
    }
  }

  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    badgeNumber: user.badgeNumber,
    businessId: user.businessId,
    testCentreId: user.testCentreId,
  };
}

/** Build a session for a freshly registered account (no password re-check). */
export function sessionFromUser(user: {
  id: string; name: string; email: string; role: string;
  badgeNumber: string | null; businessId: string | null; testCentreId: string | null;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    badgeNumber: user.badgeNumber,
    businessId: user.businessId,
    testCentreId: user.testCentreId,
  };
}
