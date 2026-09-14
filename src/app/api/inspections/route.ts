import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { requireSession } from "@/lib/auth";
import { checkGeofence } from "@/lib/geofence";
import {
  divisionFromCapacity,
  evaluateRecord,
  maxFromCapacity,
  measureFor,
  recordVerdict,
  type TestPoint,
} from "@/lib/mpe";

const JWT_SECRET = process.env.JWT_SECRET || "sih26036-legal-metrology-hmac-secret-key-2026";

/** ≈1.5 MB decoded. The client compresses to a few hundred KB; this is the ceiling. */
const MAX_PHOTO_DATA_URL_CHARS = 2_000_000;

const toNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export async function POST(request: Request) {
  // Departmental officers and notified test centres both verify.
  const auth = await requireSession("OFFICER", "GATC");
  if ("error" in auth) return auth.error;
  // The signing verifier is whoever is logged in — never a body field.
  const officerId = auth.user.id;

  try {
    const body = await request.json();
    const {
      applicationId,
      result, // "PASS" | "FAIL"
      notes,
      photoAttached,
      photoData,
      photoName,
      gpsCoordinates,
      gpsLat,
      gpsLng,
      gpsAccuracyM,
      gpsSource,
      testWeights,
    } = body;

    if (!applicationId || (result !== "PASS" && result !== "FAIL")) {
      return NextResponse.json(
        { success: false, error: "Application ID and a PASS/FAIL result are required" },
        { status: 400 }
      );
    }

    // Evidence photo: must be an image data URL and under the size ceiling.
    let storedPhoto: string | null = null;
    if (typeof photoData === "string" && photoData.length > 0) {
      if (!photoData.startsWith("data:image/")) {
        return NextResponse.json({ success: false, error: "Photo must be an image" }, { status: 400 });
      }
      if (photoData.length > MAX_PHOTO_DATA_URL_CHARS) {
        return NextResponse.json(
          { success: false, error: "Photo is too large — please retake it" },
          { status: 413 }
        );
      }
      storedPhoto = photoData;
    }
    // The seal photo is the evidence an instrument was physically sealed.
    if (!storedPhoto) {
      return NextResponse.json(
        { success: false, error: "A photo of the lead seal is required", field: "photo" },
        { status: 400 }
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { business: true, instrument: true, assignedOfficer: true },
    });

    if (!application) {
      return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    }

    // Only the assigned verifier may record the inspection — an officer by
    // user id, a test centre by its centre id.
    const mine =
      auth.user.role === "GATC"
        ? application.assignedCentreId != null && application.assignedCentreId === auth.user.testCentreId
        : application.assignedOfficerId === officerId;
    if (!mine) {
      return NextResponse.json(
        { success: false, error: "This case is assigned to a different verifier" },
        { status: 403 }
      );
    }

    // On-site check: nothing is recorded, and no certificate generated, unless
    // the verifier's GPS fix is within the geofence of the registered premises.
    const fence = checkGeofence(
      {
        lat: toNum(gpsLat),
        lng: toNum(gpsLng),
        accuracyM: toNum(gpsAccuracyM),
        source: gpsSource === "manual" ? "manual" : "device",
      },
      application.business
    );
    if (fence.status !== "inside") {
      const status = fence.status === "bad-fix" ? 400 : fence.status === "no-premises" ? 409 : 403;
      return NextResponse.json(
        {
          success: false,
          error: fence.message,
          field: "location",
          geofence: fence.status,
          distanceM: fence.status === "outside" ? Math.round(fence.distanceM) : undefined,
        },
        { status }
      );
    }

    // Re-evaluate the calibration rows server-side: the client may compute the
    // verdict for its own display, but what is stored (and signed into the
    // certificate) must be derived from the readings here.
    //
    // The measure (mass / volume / length) comes from the instrument on record,
    // never from the request, so a client cannot test a fuel pump against a
    // scale's limits. Accepts the current record object or the legacy row array.
    let storedWeights = "";
    let mpeVerdict: "PASS" | "FAIL" | null = null;
    let testPoints = 0;
    if (typeof testWeights === "string" && testWeights.length > 0) {
      const { category, capacity } = application.instrument;
      const measure = measureFor(category, capacity);
      let points: TestPoint[] = [];
      let sentDivision: number | null = null;
      try {
        const raw = JSON.parse(testWeights);
        const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray(raw?.points) ? raw.points : [];
        points = list
          .map((r) => {
            const o = (r ?? {}) as Record<string, unknown>;
            return { nominal: Number(o.nominal ?? o.nominalG), observed: Number(o.observed ?? o.observedG) };
          })
          .filter((p) => Number.isFinite(p.nominal) && Number.isFinite(p.observed) && p.nominal > 0 && p.observed >= 0);
        if (!Array.isArray(raw) && raw?.divisionG != null) sentDivision = Number(raw.divisionG);
      } catch {
        return NextResponse.json({ success: false, error: "Malformed calibration record" }, { status: 400 });
      }
      if (points.length > 40) {
        return NextResponse.json({ success: false, error: "Too many calibration rows" }, { status: 400 });
      }

      const max = maxFromCapacity(capacity, measure);
      if (max != null && points.some((p) => p.nominal > max * 1.0001)) {
        return NextResponse.json(
          { success: false, error: `A test standard exceeds the instrument's capacity (${capacity})` },
          { status: 400 }
        );
      }

      // Scale interval: the capacity on record wins. Only when it states none
      // (e.g. "60 Metric Tonnes") is the checker's reading of the data plate used.
      let divisionG = measure === "mass" ? divisionFromCapacity(capacity) : null;
      if (measure === "mass" && divisionG == null && sentDivision != null) {
        if (!Number.isFinite(sentDivision) || sentDivision <= 0 || (max != null && sentDivision > max / 100)) {
          return NextResponse.json(
            { success: false, error: "The scale interval (e) entered is not plausible for this instrument" },
            { status: 400 }
          );
        }
        divisionG = sentDivision;
      }

      if (points.length > 0) {
        const record = evaluateRecord(measure, points, divisionG);
        if (!record) {
          return NextResponse.json(
            { success: false, error: "Enter the instrument's scale interval (e) to evaluate the readings" },
            { status: 400 }
          );
        }
        storedWeights = JSON.stringify(record);
        mpeVerdict = recordVerdict(record);
        testPoints = record.points.length;
      }
    }

    const inspectionData = {
      officerId,
      result,
      notes:
        (typeof notes === "string" && notes.trim()) ||
        "Standard verification tests conducted according to Legal Metrology Standards.",
      photoAttached: Boolean(storedPhoto) || Boolean(photoAttached),
      photoData: storedPhoto,
      photoHash: storedPhoto ? createHash("sha256").update(storedPhoto).digest("hex") : null,
      photoName: typeof photoName === "string" ? photoName.slice(0, 200) : null,
      testWeights: storedWeights,
      mpeVerdict,
      gpsCoordinates: typeof gpsCoordinates === "string" && gpsCoordinates ? gpsCoordinates : null,
      gpsLat: toNum(gpsLat),
      gpsLng: toNum(gpsLng),
      gpsAccuracyM: toNum(gpsAccuracyM),
      inspectedAt: new Date(),
    };

    // 1. Create or update the Inspection record
    const inspection = await prisma.inspection.upsert({
      where: { applicationId },
      create: { applicationId, ...inspectionData },
      update: inspectionData,
    });

    // Never echo the photo payload back in the response.
    const { photoData: _omit, ...inspectionPublic } = inspection;
    void _omit;

    // 2. If PASS: Generate signed tamper-evident Certificate + QR code
    if (result === "PASS") {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const certNumber = `CERT-LM-2026-${randomSuffix}`;

      const validFrom = new Date();
      const validTill = new Date();
      validTill.setFullYear(validFrom.getFullYear() + 1); // 1-year standard validity

      const payload = {
        certId: certNumber,
        businessId: application.businessId,
        businessName: application.business.name,
        businessRegNo: application.business.regNo,
        instrumentId: application.instrumentId,
        serialNumber: application.instrument.serialNumber,
        category: application.instrument.category,
        model: application.instrument.model,
        capacity: application.instrument.capacity,
        validFrom: validFrom.toISOString(),
        validTill: validTill.toISOString(),
        officer: application.assignedOfficer?.name ?? auth.user.name,
        badgeNumber: application.assignedOfficer?.badgeNumber ?? auth.user.badgeNumber ?? "",
        gps: inspection.gpsCoordinates ?? undefined,
        mpe: mpeVerdict ?? undefined,
        testPoints: testPoints || undefined,
        issuedAt: validFrom.toISOString(),
      };

      const token = jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });

      // Determine verification URL (relative or fallback localhost)
      const origin = request.headers.get("origin") || "http://localhost:3000";
      const verificationUrl = `${origin}/verify/${token}`;

      // Generate visual QR code with high error correction
      const qrCode = await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 350,
        color: { dark: "#0b0f1a", light: "#ffffff" },
      });

      const certificate = await prisma.certificate.upsert({
        where: { applicationId },
        create: {
          certNumber,
          token,
          validFrom,
          validTill,
          qrCode,
          instrumentId: application.instrumentId,
          applicationId,
        },
        update: {
          certNumber,
          token,
          validFrom,
          validTill,
          qrCode,
          instrumentId: application.instrumentId,
        },
      });

      await prisma.application.update({
        where: { id: applicationId },
        data: { status: "INSPECTED" },
      });

      return NextResponse.json({
        success: true,
        message: `Inspection recorded: PASS. Certificate ${certNumber} successfully issued!`,
        result: "PASS",
        inspection: inspectionPublic,
        certificate: { ...certificate, token, qrCode },
      });
    }

    // FAIL outcome
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({
      success: true,
      message: "Inspection recorded: FAIL. Instrument rejected due to calibration discrepancies.",
      result: "FAIL",
      inspection: inspectionPublic,
    });
  } catch (error) {
    console.error("Inspection error:", error);
    return NextResponse.json({ success: false, error: "Failed to record inspection" }, { status: 500 });
  }
}
