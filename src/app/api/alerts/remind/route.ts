import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { bucketFor, daysUntil, reminderMessage } from "@/lib/alerts";

/**
 * HQ sends one reminder about one certificate, right now. The send itself is
 * simulated (logged + recorded) — no SMS/email gateway is wired in this
 * prototype, and the UI says so.
 */
export async function POST(request: Request) {
  const auth = await requireSession("ADMIN");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const certificateId: string | undefined = body.certificateId;
  const channel: "SMS" | "EMAIL" = body.channel === "EMAIL" ? "EMAIL" : "SMS";
  if (!certificateId) {
    return NextResponse.json({ success: false, error: "certificateId is required" }, { status: 400 });
  }

  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      instrument: { include: { business: { include: { users: { take: 1 } } } } },
    },
  });
  if (!cert) {
    return NextResponse.json({ success: false, error: "Certificate not found" }, { status: 404 });
  }

  const now = new Date();
  const daysRemaining = daysUntil(cert.validTill, now);
  const bucket = bucketFor(daysRemaining) ?? "D30";
  const business = cert.instrument.business;
  const recipient =
    channel === "SMS"
      ? business.contact
      : business.users[0]?.email ?? `${business.regNo.toLowerCase()}@example.in`;
  const message = reminderMessage({
    businessName: business.name,
    category: cert.instrument.category,
    serialNumber: cert.instrument.serialNumber,
    validTill: cert.validTill,
    daysRemaining,
  });

  const reminder = await prisma.reminder.create({
    data: {
      certificateId: cert.id,
      businessId: business.id,
      threshold: bucket,
      trigger: "MANUAL",
      channel,
      recipient,
      message,
    },
  });

  // Simulated gateway.
  console.log(`[reminder:${channel}] → ${recipient}: ${message}`);

  return NextResponse.json({
    success: true,
    message: `${channel} reminder sent to ${business.name} (${recipient})`,
    reminder: { ...reminder, sentAt: reminder.sentAt.toISOString() },
  });
}
