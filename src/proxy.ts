import { NextResponse, type NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { SESSION_COOKIE, SESSION_SECRET } from "@/lib/session-types";

/**
 * Auth gate. Runs on the Node runtime (Next 16 default for proxy), so the
 * session JWT can be verified here rather than merely checked for presence.
 * Route handlers still call `requireSession()` for role checks — this layer
 * only decides "signed in or not".
 */
const PUBLIC_PATHS: RegExp[] = [
  /^\/login(\/|$)/,
  /^\/register(\/|$)/,
  /^\/verify(\/|$)/,  // public certificate portal + /verify/<token>
  /^\/sticker(\/|$)/, // printable sticker for a certificate the holder already has
  /^\/api\/reports$/, // a citizen files a complaint without an account
  /^\/api\/auth\//,
  /^\/api\/demo-tokens(\/|$)/,
  // PWA and crawler metadata must be readable before sign-in, or the app is
  // not installable and link previews break.
  /^\/manifest\.webmanifest$/,
  /^\/(robots\.txt|sitemap\.xml)$/,
];

function isSignedIn(req: NextRequest): boolean {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    jwt.verify(token, SESSION_SECRET);
    return true;
  } catch {
    return false;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) return NextResponse.next();
  if (isSignedIn(req)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|webmanifest)$).*)",
  ],
};
