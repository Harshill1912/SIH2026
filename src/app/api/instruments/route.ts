import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  firstInstrumentError,
  instrumentDeletionError,
  normalizeSerial,
} from "@/lib/instrument-validation";
import { resolvePremisesCoordinates } from "@/lib/address";

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
      select: { id: true, name: true, regNo: true, address: true, contact: true, lat: true, lng: true },
    });
    if (!business) {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    // Ensure business coordinates are populated from the address
    if (business.lat == null || business.lng == null) {
      const coords = await resolvePremisesCoordinates(business.address);
      await prisma.business.update({
        where: { id: business.id },
        data: { lat: coords.lat, lng: coords.lng },
      });
      business.lat = coords.lat;
      business.lng = coords.lng;
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
    const raw = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
    const input = {
      serialNumber: raw("serialNumber"),
      category: raw("category"),
      model: raw("model"),
      capacity: raw("capacity"),
      location: raw("location"),
    };

    const invalid = firstInstrumentError(input);
    if (invalid) {
      return NextResponse.json(
        { success: false, error: invalid.error, field: invalid.field },
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

    const cleanSerial = normalizeSerial(input.serialNumber);

    // Check serial uniqueness
    const existing = await prisma.instrument.findUnique({
      where: { serialNumber: cleanSerial },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Instrument with Serial Number ${cleanSerial} already exists` },
        { status: 409 }
      );
    }

    const instrument = await prisma.instrument.create({
      data: {
        serialNumber: cleanSerial,
        category: input.category.trim(),
        model: input.model.trim(),
        capacity: input.capacity.trim(),
        location: input.location.trim() || "Main Branch",
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

export async function DELETE(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  if (auth.user.role !== "BUSINESS" && auth.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = typeof body.id === "string" ? body.id : null;
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Instrument ID is required" }, { status: 400 });
    }

    const instrument = await prisma.instrument.findUnique({
      where: { id },
      include: {
        applications: {
          where: { status: { in: ["SUBMITTED", "ASSIGNED"] } },
          select: { id: true, applicationNumber: true, status: true },
        },
      },
    });

    if (!instrument) {
      return NextResponse.json({ success: false, error: "Instrument not found" }, { status: 404 });
    }

    // Ownership check: Business can only delete their own instruments
    if (auth.user.role === "BUSINESS" && instrument.businessId !== auth.user.businessId) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own instruments" },
        { status: 403 }
      );
    }

    // Guard: Do not allow deletion if there is an active application in progress
    const activeAppError = instrumentDeletionError(instrument.applications);
    if (activeAppError) {
      return NextResponse.json({ success: false, error: activeAppError }, { status: 409 });
    }

    await prisma.instrument.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Instrument ${instrument.serialNumber} has been removed from registry`,
    });
  } catch (error) {
    console.error("Failed to delete instrument:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete instrument" },
      { status: 500 }
    );
  }
}

