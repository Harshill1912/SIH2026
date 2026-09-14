import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { sessionFromUser, setSessionCookie, signSession } from "@/lib/auth";
import { clientKey, rateLimit, tooMany } from "@/lib/rate-limit";
import { firstRegisterError, formatPhone, normalizeEmail } from "@/lib/validation";

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

  // Password is taken as sent — trimming it would silently change the secret.
  const raw = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const input = {
    businessName: raw("businessName"),
    regNo: raw("regNo"),
    address: raw("address"),
    contact: raw("contact"),
    ownerName: raw("ownerName"),
    email: raw("email"),
    password: raw("password"),
  };

  // Same rules as the form, re-checked here: the form can be bypassed.
  const invalid = firstRegisterError(input);
  if (invalid) {
    return NextResponse.json({ success: false, error: invalid.error, field: invalid.field }, { status: 400 });
  }

  const businessName = input.businessName.trim();
  const regNo = input.regNo.trim().toUpperCase();
  const address = input.address.trim();
  const contact = formatPhone(input.contact);
  const ownerName = input.ownerName.trim().replace(/\s+/g, " ");
  const email = normalizeEmail(input.email);
  const password = input.password;

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
