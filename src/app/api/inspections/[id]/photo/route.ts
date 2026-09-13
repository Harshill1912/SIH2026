import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

/**
 * Serve the evidence photo for one inspection as an image. Staff can see any
 * photo; a business can see photos of its own instruments only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    select: { photoData: true, application: { select: { businessId: true } } },
  });

  if (!inspection?.photoData) {
    return NextResponse.json({ success: false, error: "No photo on this inspection" }, { status: 404 });
  }
  if (auth.user.role === "BUSINESS" && inspection.application.businessId !== auth.user.businessId) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(inspection.photoData);
  if (!match) {
    return NextResponse.json({ success: false, error: "Stored photo is malformed" }, { status: 500 });
  }
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=300",
    },
  });
}
