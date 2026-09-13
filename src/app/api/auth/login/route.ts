import { NextResponse } from "next/server";
import { authenticate, setSessionCookie, signSession } from "@/lib/auth";
import { clientKey, rateLimit, tooMany } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Throttle password guessing. Ten attempts per five minutes is generous for a
  // person and useless for a script.
  const limit = rateLimit(clientKey(request, "login"), 10, 5 * 60_000);
  if (!limit.ok) {
    return tooMany(limit, "Too many sign-in attempts. Please wait a moment and try again.");
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
  }

  const user = await authenticate(email, password);
  if (!user) {
    // Same message for unknown email and wrong password — no account enumeration.
    return NextResponse.json({ success: false, error: "Incorrect email or password" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true, user });
  setSessionCookie(res, signSession(user));
  return res;
}
