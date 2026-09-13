import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { clientKey, rateLimit, tooMany } from "@/lib/rate-limit";

export const REPORT_KINDS = ["NO_STICKER", "EXPIRED", "DAMAGED", "SHORT_WEIGHT", "OTHER"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/**
 * File a complaint. Deliberately unauthenticated: a shopper standing at a
 * counter has no account, and requiring one would mean no reports at all.
 * Everything is optional except the kind, and free text is length-capped.
 */
export async function POST(request: Request) {
  // Public and unauthenticated, so it is the obvious endpoint to flood.
  const limit = rateLimit(clientKey(request, "report"), 5, 10 * 60_000);
  if (!limit.ok) {
    return tooMany(limit, "Too many reports from this device. Please try again shortly.");
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  if (!(REPORT_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ success: false, error: "Choose what you saw" }, { status: 400 });
  }

  const clip = (v: unknown, n: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

  // A certificate reference is only accepted if it actually exists; a bad one
  // is dropped rather than rejected, so a citizen never loses their report.
  let certificateId: string | null = null;
  let instrumentId: string | null = null;
  const certRef = clip(body.certificateId, 60) ?? clip(body.certNumber, 60);
  if (certRef) {
    const cert = await prisma.certificate.findFirst({
      where: { OR: [{ id: certRef }, { certNumber: certRef }] },
      select: { id: true, instrumentId: true },
    });
    if (cert) {
      certificateId = cert.id;
      instrumentId = cert.instrumentId;
    }
  }
  if (!instrumentId) {
    const serial = clip(body.serialNumber, 60);
    if (serial) {
      const inst = await prisma.instrument.findUnique({
        where: { serialNumber: serial.toUpperCase() },
        select: { id: true },
      });
      instrumentId = inst?.id ?? null;
    }
  }

  try {
    const report = await prisma.report.create({
      data: {
        kind,
        note: clip(body.note, 1000),
        placeText: clip(body.placeText, 300),
        contact: clip(body.contact, 120),
        certificateId,
        instrumentId,
      },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({
      success: true,
      reference: report.id.slice(0, 8).toUpperCase(),
      message: "Report received. The Legal Metrology Department will review it.",
    });
  } catch (error) {
    console.error("Failed to file report:", error);
    return NextResponse.json({ success: false, error: "Could not file the report" }, { status: 500 });
  }
}

/** The enforcement queue. HQ only. */
export async function GET(request: Request) {
  const auth = await requireSession("ADMIN");
  if ("error" in auth) return auth.error;

  const status = new URL(request.url).searchParams.get("status");
  const rows = await prisma.report.findMany({
    where: status && status !== "ALL" ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      instrument: { select: { serialNumber: true, category: true, business: { select: { name: true } } } },
      certificate: { select: { certNumber: true, validTill: true } },
    },
  });

  const counts = { OPEN: 0, ACTIONED: 0, CLOSED: 0 } as Record<string, number>;
  for (const r of await prisma.report.groupBy({ by: ["status"], _count: true })) {
    counts[r.status] = r._count;
  }

  return NextResponse.json({
    success: true,
    counts,
    reports: rows.map((r) => ({
      id: r.id,
      reference: r.id.slice(0, 8).toUpperCase(),
      kind: r.kind,
      note: r.note,
      placeText: r.placeText,
      contact: r.contact,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      serialNumber: r.instrument?.serialNumber ?? null,
      category: r.instrument?.category ?? null,
      businessName: r.instrument?.business.name ?? null,
      certNumber: r.certificate?.certNumber ?? null,
    })),
  });
}

/** Move a report along the queue. HQ only. */
export async function PATCH(request: Request) {
  const auth = await requireSession("ADMIN");
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!id || !["OPEN", "ACTIONED", "CLOSED"].includes(status)) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
  await prisma.report.update({ where: { id }, data: { status } });
  return NextResponse.json({ success: true, message: `Report marked ${status.toLowerCase()}` });
}
