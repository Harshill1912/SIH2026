import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ALERT_WINDOW_DAYS, bucketFor, daysUntil, type Bucket } from "@/lib/alerts";

export interface AlertItem {
  bucket: Bucket;
  daysRemaining: number;
  instrumentId: string;
  serialNumber: string;
  category: string;
  model: string;
  location: string;
  businessId: string;
  businessName: string;
  certificateId: string;
  certNumber: string;
  validTill: string;
  /** SUBMITTED | ASSIGNED when a renewal is already in progress, else null. */
  renewalStatus: string | null;
  lastReminder: { channel: string; trigger: string; sentAt: string } | null;
}

/**
 * Certificates expiring within 30 days, or already expired, for the caller's
 * scope: a business sees its own, HQ sees the whole jurisdiction.
 * Only an instrument's LATEST certificate counts — a re-verified instrument
 * with a fresh certificate is not "expiring" because an old one lapsed.
 */
export async function GET() {
  const auth = await requireSession("BUSINESS", "ADMIN");
  if ("error" in auth) return auth.error;

  const now = new Date();
  const horizon = new Date(now.getTime() + ALERT_WINDOW_DAYS * 86_400_000);
  const scope = auth.user.role === "BUSINESS" ? { businessId: auth.user.businessId ?? "" } : {};

  const instruments = await prisma.instrument.findMany({
    where: scope,
    include: {
      business: { select: { id: true, name: true } },
      certificates: {
        orderBy: { validTill: "desc" },
        take: 1,
        include: { reminders: { orderBy: { sentAt: "desc" }, take: 1 } },
      },
      applications: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
    },
  });

  const items: AlertItem[] = [];
  for (const inst of instruments) {
    const cert = inst.certificates[0];
    if (!cert || cert.validTill > horizon) continue;
    const daysRemaining = daysUntil(cert.validTill, now);
    const bucket = bucketFor(daysRemaining);
    if (!bucket) continue;
    const latestApp = inst.applications[0];
    const r = cert.reminders[0];
    items.push({
      bucket,
      daysRemaining,
      instrumentId: inst.id,
      serialNumber: inst.serialNumber,
      category: inst.category,
      model: inst.model,
      location: inst.location,
      businessId: inst.business.id,
      businessName: inst.business.name,
      certificateId: cert.id,
      certNumber: cert.certNumber,
      validTill: cert.validTill.toISOString(),
      renewalStatus:
        latestApp && (latestApp.status === "SUBMITTED" || latestApp.status === "ASSIGNED")
          ? latestApp.status
          : null,
      lastReminder: r ? { channel: r.channel, trigger: r.trigger, sentAt: r.sentAt.toISOString() } : null,
    });
  }
  items.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const counts: Record<Bucket, number> = { EXPIRED: 0, D7: 0, D15: 0, D30: 0 };
  for (const i of items) counts[i.bucket]++;

  const recentReminders = await prisma.reminder.findMany({
    where: scope,
    orderBy: { sentAt: "desc" },
    take: 8,
    include: {
      certificate: { select: { certNumber: true, instrument: { select: { serialNumber: true } } } },
      business: { select: { name: true } },
    },
  });

  return NextResponse.json({
    success: true,
    windowDays: ALERT_WINDOW_DAYS,
    counts,
    items,
    recentReminders: recentReminders.map((r) => ({
      id: r.id,
      threshold: r.threshold,
      trigger: r.trigger,
      channel: r.channel,
      recipient: r.recipient,
      sentAt: r.sentAt.toISOString(),
      certNumber: r.certificate.certNumber,
      serialNumber: r.certificate.instrument.serialNumber,
      businessName: r.business.name,
    })),
  });
}
