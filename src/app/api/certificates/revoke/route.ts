import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

/**
 * Void a certificate before its expiry, or restore one voided in error.
 *
 * The signature on an issued token stays valid forever — that is what makes
 * offline verification possible — so revocation is the only way to withdraw
 * trust early, for instance when an instrument is found tampered with after
 * issue. The public page consults this list whenever the server is reachable.
 */
export async function POST(request: Request) {
  const auth = await requireSession("ADMIN");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const certificateId = String(body.certificateId ?? "");
  const restore = body.restore === true;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";

  if (!certificateId) {
    return NextResponse.json({ success: false, error: "certificateId is required" }, { status: 400 });
  }
  if (!restore && !reason) {
    return NextResponse.json(
      { success: false, error: "A reason is required to revoke a certificate" },
      { status: 400 }
    );
  }

  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    select: { id: true, certNumber: true, revokedAt: true },
  });
  if (!cert) {
    return NextResponse.json({ success: false, error: "Certificate not found" }, { status: 404 });
  }

  const updated = await prisma.certificate.update({
    where: { id: certificateId },
    data: restore
      ? { revokedAt: null, revokedReason: null, revokedById: null }
      : { revokedAt: new Date(), revokedReason: reason, revokedById: auth.user.id },
    select: { certNumber: true, revokedAt: true },
  });

  return NextResponse.json({
    success: true,
    message: restore
      ? `${updated.certNumber} restored — it will verify as genuine again.`
      : `${updated.certNumber} revoked. The public page will now show it as withdrawn.`,
    revokedAt: updated.revokedAt?.toISOString() ?? null,
  });
}
