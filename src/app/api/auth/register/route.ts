import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { sessionFromUser, setSessionCookie, signSession } from "@/lib/auth";
import { clientKey, rateLimit, tooMany } from "@/lib/rate-limit";

/**
 * Self-registration for a user of weights and measures. Creates the business
 * and its first login together, then signs the account in, so a new trader can
 * reach their own dashboard without an administrator provisioning anything.
 *
 * Only BUSINESS accounts can be created this way. Officer, HQ and test-centre
 * logins are departmental identities and are provisioned, never self-served.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "register"), 5, 60 * 60_000);
  if (!limit.ok) {
    return tooMany(limit, "Too many accounts created from this device. Please try again later.");
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const businessName = str("businessName");
  const regNo = str("regNo").toUpperCase();
  const address = str("address");
  const contact = str("contact");
  const ownerName = str("ownerName");
  const email = str("email").toLowerCase();
  const password = typeof body.password === "string" ? (body.password as string) : "";

  const missing = Object.entries({ businessName, regNo, address, contact, ownerName, email, password })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    return NextResponse.json({ success: false, error: "All fields are required" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { success: false, error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const [emailTaken, regTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.business.findUnique({ where: { regNo }, select: { id: true } }),
  ]);
  if (emailTaken) {
    return NextResponse.json(
      { success: false, error: "An account with this email already exists", field: "email" },
      { status: 409 }
    );
  }
  if (regTaken) {
    return NextResponse.json(
      { success: false, error: "This registration number is already enrolled", field: "regNo" },
      { status: 409 }
    );
  }

  try {
    // Business and its first login are created together: a business with no way
    // to sign in, or a login with no business, would both be dead records.
    const user = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: businessName, regNo, address, contact },
      });
      return tx.user.create({
        data: {
          name: ownerName,
          email,
          role: "BUSINESS",
          businessId: business.id,
          passwordHash: hashPassword(password),
        },
      });
    });

    const session = sessionFromUser(user);
    const res = NextResponse.json({ success: true, user: session });
    setSessionCookie(res, signSession(session));
    return res;
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json({ success: false, error: "Could not create the account" }, { status: 500 });
  }
}
