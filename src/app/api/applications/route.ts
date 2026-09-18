import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { formatSchedule } from "@/lib/schedule";
import { resolvePremisesCoordinates } from "@/lib/address";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Scope by role: a business sees its own applications, an officer sees
    // those assigned to them, HQ sees everything.
    const whereClause: Record<string, unknown> = {};
    if (auth.user.role === "BUSINESS") whereClause.businessId = auth.user.businessId;
    if (auth.user.role === "OFFICER") whereClause.assignedOfficerId = auth.user.id;
    if (auth.user.role === "GATC") whereClause.assignedCentreId = auth.user.testCentreId ?? "__none__";
    if (status) whereClause.status = status;

    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        business: true,
        instrument: {
          include: {
            certificates: {
              orderBy: { validTill: "desc" },
              take: 1,
            },
          },
        },
        assignedOfficer: true,
        assignedCentre: { select: { id: true, name: true, notifyNo: true } },
        // Everything except the photo bytes — those come from /api/inspections/[id]/photo.
        inspection: {
          select: {
            id: true,
            result: true,
            notes: true,
            photoAttached: true,
            photoName: true,
            testWeights: true,
            mpeVerdict: true,
            gpsCoordinates: true,
            gpsLat: true,
            gpsLng: true,
            gpsAccuracyM: true,
            inspectedAt: true,
          },
        },
        certificate: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const pendingCount = applications.filter((a) => a.status === "SUBMITTED").length;
    const assignedCount = applications.filter((a) => a.status === "ASSIGNED").length;
    const inspectedCount = applications.filter(
      (a) => a.status === "INSPECTED" || a.status === "VERIFIED"
    ).length;

    return NextResponse.json({
      success: true,
      stats: {
        total: applications.length,
        pending: pendingCount,
        assigned: assignedCount,
        completed: inspectedCount,
      },
      applications,
    });
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSession("BUSINESS");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { instrumentId } = body;

    if (!instrumentId) {
      return NextResponse.json(
        { success: false, error: "Instrument ID is required" },
        { status: 400 }
      );
    }

    const instrument = await prisma.instrument.findUnique({
      where: { id: instrumentId },
      include: { business: true },
    });

    if (!instrument) {
      return NextResponse.json(
        { success: false, error: "Instrument not found" },
        { status: 404 }
      );
    }

    // You can only apply for your own instruments.
    if (instrument.businessId !== auth.user.businessId) {
      return NextResponse.json(
        { success: false, error: "This instrument belongs to another business" },
        { status: 403 }
      );
    }

    // Every inspection is geofenced against the premises. Ensure premises
    // coordinates are established from the address.
    if (instrument.business.lat == null || instrument.business.lng == null) {
      const coords = await resolvePremisesCoordinates(instrument.business.address);
      await prisma.business.update({
        where: { id: instrument.business.id },
        data: { lat: coords.lat, lng: coords.lng },
      });
      instrument.business.lat = coords.lat;
      instrument.business.lng = coords.lng;
    }

    // Check if there is already an active pending or assigned application
    const existingActive = await prisma.application.findFirst({
      where: {
        instrumentId,
        status: { in: ["SUBMITTED", "ASSIGNED"] },
      },
    });

    if (existingActive) {
      return NextResponse.json(
        {
          success: false,
          error: `An active verification application (${existingActive.applicationNumber}) already exists for this instrument`,
        },
        { status: 409 }
      );
    }

    // Generate readable Application Number
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const applicationNumber = `APP-2026-${randomSuffix}`;

    const application = await prisma.application.create({
      data: {
        applicationNumber,
        status: "SUBMITTED",
        instrumentId,
        businessId: instrument.businessId,
      },
      include: {
        instrument: true,
        business: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Verification application ${applicationNumber} submitted successfully`,
      application,
    });
  } catch (error) {
    console.error("Failed to submit application:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit application" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  // Assignment is an HQ decision.
  const auth = await requireSession("ADMIN");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { applicationId, assignedOfficerId, assignedCentreId, status, scheduledFor } = body;

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: "Application ID is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // A job goes to exactly one verifier: a departmental officer or a notified
    // test centre. Setting one clears the other so the queues can never both
    // claim the same case.
    if (assignedCentreId) {
      updateData.assignedCentreId = assignedCentreId;
      updateData.assignedOfficerId = null;
      if (!status) updateData.status = "ASSIGNED";
    } else if (assignedOfficerId) {
      updateData.assignedOfficerId = assignedOfficerId;
      updateData.assignedCentreId = null;
      if (!status) updateData.status = "ASSIGNED";
    }

    // Planned site visit. Null clears it; anything else must parse as a date
    // and not be in the past (today is fine).
    if (scheduledFor !== undefined) {
      if (scheduledFor === null) {
        updateData.scheduledFor = null;
      } else {
        const when = new Date(scheduledFor);
        if (Number.isNaN(when.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid visit date" }, { status: 400 });
        }
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (when < startOfToday) {
          return NextResponse.json(
            { success: false, error: "Visit date cannot be in the past" },
            { status: 400 }
          );
        }
        updateData.scheduledFor = when;
      }
    }
    if (status) {
      updateData.status = status;
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        assignedOfficer: true,
        assignedCentre: true,
        instrument: true,
        business: true,
      },
    });

    const visit = updated.scheduledFor ? ` · visit ${formatSchedule(updated.scheduledFor.toISOString())}` : "";
    const verifier = updated.assignedCentre?.name ?? updated.assignedOfficer?.name ?? "a verifier";
    return NextResponse.json({
      success: true,
      message: `${updated.applicationNumber} assigned to ${verifier}${visit}`,
      application: updated,
    });
  } catch (error: any) {
    console.error("Failed to update application:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update application" },
      { status: 500 }
    );
  }
}
