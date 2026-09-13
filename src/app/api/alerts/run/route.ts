import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ALERT_WINDOW_DAYS, bucketFor, daysUntil, reminderMessage } from "@/lib/alerts";

/**
 * The automated reminder job. Scans every instrument's latest certificate and
 * writes one AUTO reminder per (certificate, threshold) as it crosses 30, 15
 * and 7 days before expiry, and again on expiry. Idempotent: running it twice
 * sends nothing new.
 *
 * In production this is invoked by a scheduler (cron / EventBridge) with a
 * service token. Here HQ can press "Run reminder job" to show it working.
 */
export async function POST() {
  const auth = await requireSession("ADMIN");
  if ("error" in auth) return auth.error;

  const now = new Date();
  const horizon = new Date(now.getTime() + ALERT_WINDOW_DAYS * 86_400_000);

  const instruments = await prisma.instrument.findMany({
    include: {
      business: true,
      certificates: {
        orderBy: { validTill: "desc" },
        take: 1,
        include: { reminders: { where: { trigger: "AUTO" }, select: { threshold: true } } },
      },
    },
  });

  const created: Array<{ serialNumber: string; businessName: string; threshold: string; recipient: string }> = [];
  let scanned = 0;
  let skipped = 0;

  for (const inst of instruments) {
    const cert = inst.certificates[0];
    if (!cert || cert.validTill > horizon) continue;
    scanned++;
    const daysRemaining = daysUntil(cert.validTill, now);
    const bucket = bucketFor(daysRemaining);
    if (!bucket) continue;
    if (cert.reminders.some((r) => r.threshold === bucket)) {
      skipped++;
      continue;
    }
    const message = reminderMessage({
      businessName: inst.business.name,
      category: inst.category,
      serialNumber: inst.serialNumber,
      validTill: cert.validTill,
      daysRemaining,
    });
    await prisma.reminder.create({
      data: {
        certificateId: cert.id,
        businessId: inst.business.id,
        threshold: bucket,
        trigger: "AUTO",
        channel: "SMS",
        recipient: inst.business.contact,
        message,
      },
    });
    console.log(`[reminder:AUTO:${bucket}] → ${inst.business.contact}: ${message}`);
    created.push({
      serialNumber: inst.serialNumber,
      businessName: inst.business.name,
      threshold: bucket,
      recipient: inst.business.contact,
    });
  }

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    scanned,
    sent: created.length,
    alreadySent: skipped,
    created,
    message:
      created.length === 0
        ? `Checked ${scanned} certificate${scanned === 1 ? "" : "s"} — every due reminder was already sent.`
        : `Sent ${created.length} reminder${created.length === 1 ? "" : "s"} across ${scanned} expiring certificate${scanned === 1 ? "" : "s"}.`,
  });
}
