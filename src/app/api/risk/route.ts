import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { parseTestWeights } from "@/lib/mpe";
import { integrityFlags, scoreInstrument } from "@/lib/risk";

const DAY = 86_400_000;
const REPORT_WINDOW_DAYS = 90;

/**
 * Enforcement intelligence for HQ: every instrument ranked by risk of failing,
 * and recent inspections carrying integrity flags. Read-only and advisory — see
 * src/lib/risk.ts. ADMIN only: the ranking is a targeting tool, and a trader
 * seeing their own score would learn how to game it.
 */
export async function GET() {
  const auth = await requireSession("ADMIN");
  if ("error" in auth) return auth.error;

  const now = Date.now();
  const since = new Date(now - REPORT_WINDOW_DAYS * DAY);

  const [instruments, inspections] = await Promise.all([
    prisma.instrument.findMany({
      select: {
        id: true,
        serialNumber: true,
        category: true,
        capacity: true,
        location: true,
        business: { select: { name: true } },
        certificates: { orderBy: { validTill: "desc" }, take: 1, select: { certNumber: true, validTill: true } },
        applications: {
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            applicationNumber: true,
            scheduledFor: true,
            assignedOfficer: { select: { name: true } },
            assignedCentre: { select: { name: true } },
            inspection: { select: { result: true, mpeVerdict: true, testWeights: true, inspectedAt: true } },
          },
        },
        reports: {
          where: { status: { not: "CLOSED" }, createdAt: { gte: since } },
          select: { kind: true },
        },
      },
    }),
    prisma.inspection.findMany({
      orderBy: { inspectedAt: "desc" },
      take: 200,
      select: {
        id: true,
        mpeVerdict: true,
        result: true,
        testWeights: true,
        gpsLat: true,
        gpsLng: true,
        photoHash: true,
        inspectedAt: true,
        officer: { select: { name: true, badgeNumber: true } },
        application: {
          select: {
            applicationNumber: true,
            assignedCentre: { select: { name: true } },
            instrument: { select: { serialNumber: true, category: true, capacity: true } },
            business: { select: { name: true, lat: true, lng: true } },
          },
        },
      },
    }),
  ]);

  const ranked = instruments
    .map((inst) => {
      const inspected = inst.applications
        .filter((a) => a.inspection)
        .sort((a, b) => b.inspection!.inspectedAt.getTime() - a.inspection!.inspectedAt.getTime());
      const last = inspected[0]?.inspection ?? null;
      const failed = (i: { result: string; mpeVerdict: string | null }) =>
        i.mpeVerdict === "FAIL" || i.result === "FAIL";
      const cert = inst.certificates[0] ?? null;
      const open = inst.applications.find((a) => a.status === "SUBMITTED" || a.status === "ASSIGNED");

      const risk = scoreInstrument({
        category: inst.category,
        capacity: inst.capacity,
        lastReadings: last ? parseTestWeights(last.testWeights) : [],
        failCount: inspected.slice(1).filter((a) => failed(a.inspection!)).length,
        daysToExpiry: cert ? Math.ceil((cert.validTill.getTime() - now) / DAY) : null,
        reportKinds: inst.reports.map((r) => r.kind),
      });

      return {
        instrumentId: inst.id,
        serialNumber: inst.serialNumber,
        category: inst.category,
        location: inst.location,
        businessName: inst.business.name,
        certNumber: cert?.certNumber ?? null,
        ...risk,
        visit: open
          ? {
              applicationNumber: open.applicationNumber,
              status: open.status,
              scheduledFor: open.scheduledFor?.toISOString() ?? null,
              assignee: open.assignedOfficer?.name ?? open.assignedCentre?.name ?? null,
            }
          : null,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Which application numbers share each photo fingerprint.
  const byHash = new Map<string, string[]>();
  for (const i of inspections) {
    if (!i.photoHash) continue;
    byHash.set(i.photoHash, [...(byHash.get(i.photoHash) ?? []), i.application.applicationNumber]);
  }

  const review = inspections
    .map((i) => {
      const b = i.application.business;
      const flags = integrityFlags({
        capacity: i.application.instrument.capacity,
        readings: parseTestWeights(i.testWeights),
        geotag: i.gpsLat != null && i.gpsLng != null ? { lat: i.gpsLat, lng: i.gpsLng } : null,
        premises: b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : null,
        photoSharedWith: i.photoHash
          ? (byHash.get(i.photoHash) ?? []).filter((n) => n !== i.application.applicationNumber)
          : [],
      });
      return {
        inspectionId: i.id,
        applicationNumber: i.application.applicationNumber,
        serialNumber: i.application.instrument.serialNumber,
        category: i.application.instrument.category,
        businessName: b.name,
        inspector: i.application.assignedCentre?.name ?? i.officer.name,
        badgeNumber: i.officer.badgeNumber,
        verdict: i.mpeVerdict ?? i.result,
        inspectedAt: i.inspectedAt.toISOString(),
        flags,
      };
    })
    .filter((r) => r.flags.length > 0);

  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of ranked) counts[r.band]++;

  return NextResponse.json({
    success: true,
    generatedAt: new Date(now).toISOString(),
    model: "rules-v1",
    counts,
    instruments: ranked,
    review,
  });
}
