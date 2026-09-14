import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { fixError } from "@/lib/geofence";

/**
 * Pin the business's premises location — once. Businesses enrolled before
 * location became mandatory have none, and every inspection is geofenced
 * against it, so they are blocked from verification until they pin it.
 *
 * Deliberately one-shot: if the trader could move the pin at will, a trader and
 * officer together could place it wherever the officer happens to be. Moving an
 * existing pin is an HQ correction, not a self-service action.
 */
export async function POST(request: Request) {
  const auth = await requireSession("BUSINESS");
  if ("error" in auth) return auth.error;
  if (!auth.user.businessId) {
    return NextResponse.json({ success: false, error: "No business is linked to this account" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
  const num = (k: string) => (typeof body[k] === "number" && Number.isFinite(body[k]) ? (body[k] as number) : null);
  const fix = {
    lat: num("lat"),
    lng: num("lng"),
    accuracyM: num("accuracyM"),
    source: body.source === "manual" ? ("manual" as const) : ("device" as const),
  };
  const problem = fixError(fix, { checkAccuracy: false });
  if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 });

  // Conditional update: only succeeds while no pin exists, so two concurrent
  // requests cannot both set it.
  const { count } = await prisma.business.updateMany({
    where: { id: auth.user.businessId, lat: null },
    data: { lat: fix.lat, lng: fix.lng },
  });
  if (count === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Your premises location is already pinned. Contact Legal Metrology HQ to correct it.",
      },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true, lat: fix.lat, lng: fix.lng });
}
