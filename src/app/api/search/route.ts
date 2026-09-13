import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { daysUntil } from "@/lib/alerts";

export interface SearchHit {
  kind: "instrument" | "certificate" | "business" | "application";
  id: string;
  title: string;
  subtitle: string;
  meta: string[];
  /** Where a click should go, when there is somewhere to go. */
  href?: string;
  status?: { label: string; tone: "good" | "warn" | "bad" | "info" | "neutral" };
}

const LIMIT = 12;

/**
 * One search box over the whole register: instrument serial numbers,
 * certificate numbers, business names and registration numbers, and
 * application numbers.
 *
 * Scope follows the role. A business searches its own records only; HQ, an
 * officer and a test centre search the whole jurisdiction, which is what the
 * enforcement use case in the problem statement needs.
 */
export async function GET(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ success: true, query: q, hits: [], tooShort: true });
  }

  const own = auth.user.role === "BUSINESS" ? auth.user.businessId ?? "__none__" : null;
  const scopeInstrument = own ? { businessId: own } : {};
  const now = new Date();
  const hits: SearchHit[] = [];

  // SQLite's `contains` is already case-insensitive for ASCII, which is all the
  // identifiers in this register use.
  const [instruments, certificates, businesses, applications] = await Promise.all([
    prisma.instrument.findMany({
      where: {
        ...scopeInstrument,
        OR: [
          { serialNumber: { contains: q } },
          { model: { contains: q } },
          { category: { contains: q } },
          { location: { contains: q } },
        ],
      },
      include: {
        business: { select: { id: true, name: true } },
        certificates: { orderBy: { validTill: "desc" }, take: 1 },
      },
      take: LIMIT,
      orderBy: { serialNumber: "asc" },
    }),
    prisma.certificate.findMany({
      where: {
        certNumber: { contains: q },
        ...(own ? { instrument: { businessId: own } } : {}),
      },
      include: { instrument: { include: { business: { select: { name: true } } } } },
      take: LIMIT,
      orderBy: { validTill: "desc" },
    }),
    own
      ? Promise.resolve([])
      : prisma.business.findMany({
          where: { OR: [{ name: { contains: q } }, { regNo: { contains: q } }, { address: { contains: q } }] },
          include: { _count: { select: { instruments: true } } },
          take: LIMIT,
          orderBy: { name: "asc" },
        }),
    prisma.application.findMany({
      where: { applicationNumber: { contains: q }, ...(own ? { businessId: own } : {}) },
      include: {
        business: { select: { name: true } },
        instrument: { select: { serialNumber: true } },
        assignedOfficer: { select: { name: true } },
        assignedCentre: { select: { name: true } },
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  for (const i of instruments) {
    const cert = i.certificates[0];
    const days = cert ? daysUntil(cert.validTill, now) : null;
    hits.push({
      kind: "instrument",
      id: i.id,
      title: i.serialNumber,
      subtitle: `${i.category} · ${i.model}`,
      meta: [i.business.name, i.location, `Capacity ${i.capacity}`],
      href: cert ? `/verify/${cert.token}` : undefined,
      status: !cert
        ? { label: "Unverified", tone: "neutral" }
        : days! < 0
          ? { label: `Expired ${Math.abs(days!)} d ago`, tone: "bad" }
          : days! <= 30
            ? { label: `Expires in ${days} d`, tone: "warn" }
            : { label: `Valid · ${days} d left`, tone: "good" },
    });
  }

  for (const c of certificates) {
    const days = daysUntil(c.validTill, now);
    hits.push({
      kind: "certificate",
      id: c.id,
      title: c.certNumber,
      subtitle: `${c.instrument.serialNumber} · ${c.instrument.category}`,
      meta: [c.instrument.business.name, `Valid till ${c.validTill.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`],
      href: `/verify/${c.token}`,
      status: days < 0 ? { label: "Expired", tone: "bad" } : { label: "Valid", tone: "good" },
    });
  }

  for (const b of businesses) {
    hits.push({
      kind: "business",
      id: b.id,
      title: b.name,
      subtitle: b.regNo,
      meta: [b.address, `${b._count.instruments} instrument${b._count.instruments === 1 ? "" : "s"}`],
    });
  }

  for (const a of applications) {
    const toneByStatus: Record<string, SearchHit["status"]> = {
      SUBMITTED: { label: "Needs officer", tone: "warn" },
      ASSIGNED: { label: "In the field", tone: "info" },
      INSPECTED: { label: "Certified", tone: "good" },
      REJECTED: { label: "Rejected", tone: "bad" },
    };
    hits.push({
      kind: "application",
      id: a.id,
      title: a.applicationNumber,
      subtitle: `${a.instrument.serialNumber} · ${a.business.name}`,
      meta: [
        a.assignedCentre?.name ?? a.assignedOfficer?.name ?? "Unassigned",
        `Filed ${a.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      ],
      status: toneByStatus[a.status],
    });
  }

  return NextResponse.json({
    success: true,
    query: q,
    scope: auth.user.role === "BUSINESS" ? "own" : "jurisdiction",
    counts: {
      instrument: instruments.length,
      certificate: certificates.length,
      business: businesses.length,
      application: applications.length,
    },
    hits,
  });
}
