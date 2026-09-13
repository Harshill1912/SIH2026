import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    // A business only ever sees its own registry. Staff may look up any
    // business by id (used by future admin/officer views).
    const { searchParams } = new URL(request.url);
    const businessId =
      auth.user.role === "BUSINESS" ? auth.user.businessId : searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "No business is linked to this account" },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, regNo: true, address: true, contact: true },
    });
    if (!business) {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const instruments = await prisma.instrument.findMany({
      where: { businessId },
      include: {
        certificates: {
          orderBy: { validTill: "desc" },
          take: 1,
        },
        applications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            assignedOfficer: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Compute status and statistics dynamically
    const total = instruments.length;
    let validCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let unverifiedCount = 0;

    const enrichedInstruments = instruments.map((inst) => {
      const latestCert = inst.certificates[0] || null;
      const latestApp = inst.applications[0] || null;

      let status: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "PENDING" | "UNVERIFIED" = "UNVERIFIED";
      let daysRemaining: number | null = null;

      if (latestCert) {
        const validTill = new Date(latestCert.validTill);
        const diffTime = validTill.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffTime < 0) {
          status = "EXPIRED";
          expiredCount++;
        } else if (validTill <= thirtyDaysFromNow) {
          status = "EXPIRING_SOON";
          expiringSoonCount++;
        } else {
          status = "VALID";
          validCount++;
        }
      } else {
        if (latestApp && (latestApp.status === "SUBMITTED" || latestApp.status === "ASSIGNED")) {
          status = "PENDING";
          unverifiedCount++;
        } else {
          status = "UNVERIFIED";
          unverifiedCount++;
        }
      }

      return {
        ...inst,
        computedStatus: status,
        daysRemaining,
        latestCertificate: latestCert,
        latestApplication: latestApp,
      };
    });

    return NextResponse.json({
      success: true,
      business,
      stats: {
        total,
        valid: validCount,
        expiringSoon: expiringSoonCount,
        expired: expiredCount,
        unverified: unverifiedCount,
      },
      instruments: enrichedInstruments,
    });
  } catch (error) {
    console.error("Failed to fetch instruments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch instruments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSession("BUSINESS");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { serialNumber, category, model, capacity, location } = body;

    if (!serialNumber || !category || !model || !capacity) {
      return NextResponse.json(
        { success: false, error: "Serial number, category, model, and capacity are required" },
        { status: 400 }
      );
    }

    // The instrument belongs to the signed-in business — never to a body field.
    const targetBusinessId = auth.user.businessId;
    if (!targetBusinessId) {
      return NextResponse.json(
        { success: false, error: "No business is linked to this account" },
        { status: 400 }
      );
    }

    // Verify business exists
    const business = await prisma.business.findUnique({
      where: { id: targetBusinessId },
    });

    if (!business) {
      return NextResponse.json(
        { success: false, error: "Business not found" },
        { status: 404 }
      );
    }

    // Check serial uniqueness
    const existing = await prisma.instrument.findUnique({
      where: { serialNumber },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Instrument with Serial Number ${serialNumber} already exists` },
        { status: 409 }
      );
    }

    const instrument = await prisma.instrument.create({
      data: {
        serialNumber: serialNumber.trim().toUpperCase(),
        category,
        model: model.trim(),
        capacity: capacity.trim(),
        location: location ? location.trim() : "Main Branch",
        businessId: targetBusinessId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Instrument registered successfully",
      instrument,
    });
  } catch (error) {
    console.error("Failed to create instrument:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register instrument" },
      { status: 500 }
    );
  }
}
