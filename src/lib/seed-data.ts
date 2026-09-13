import type { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demo-accounts";
import { hashPassword } from "./password";
import { divisionFromCapacity, evaluateAll, verdictFor, type TestWeightRow } from "./mpe";

/**
 * The single source of truth for the demo dataset. Used by `prisma db seed`
 * and by the in-app "Reset demo" button, so the two can never drift apart.
 *
 * Besides the live-flow instrument (unverified, so the jury can walk it
 * through), it seeds certificates at staggered expiries so the dashboards,
 * expiry alerts and reminder job have something real to show on first load.
 *
 * Takes the client as a parameter (rather than importing it) so the seed
 * script can run outside the Next.js runtime.
 */

const JWT_SECRET = process.env.JWT_SECRET || "sih26036-legal-metrology-hmac-secret-key-2026";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "http://localhost:3000";

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

interface SeedBusiness {
  id: string;
  name: string;
  regNo: string;
  address: string;
  contact: string;
  lat: number;
  lng: number;
}

interface SeedInstrument {
  id: string;
  serialNumber: string;
  category: string;
  model: string;
  capacity: string;
  location: string;
  /** Days until the current certificate expires; undefined = never certified. */
  expiresInDays?: number;
  /**
   * [nominal g, displayed g] from the last inspection. Omitted = an ordinary
   * run comfortably inside the MPE. Set to show the risk engine something real.
   */
  readings?: Array<[number, number]>;
  certNumber?: string;
  appNumber?: string;
}

const BUSINESSES: Array<SeedBusiness & { instruments: SeedInstrument[] }> = [
  {
    id: "biz-abc-traders",
    name: "ABC Traders",
    regNo: "ABC-DL-2024-9871",
    address: "Shop 14, Main Market, Connaught Place, New Delhi 110001",
    contact: "+91 98765 43210",
    lat: 28.6328,
    lng: 77.2197,
    instruments: [
      {
        // The live-demo instrument: registered, never verified.
        id: "inst-scale-001",
        serialNumber: "SCALE-2024-001",
        category: "Electronic Counter Scale",
        model: "Essae DS-215 Precision",
        capacity: "30 kg / 1 g",
        location: "Counter 1 – Retail Billing",
      },
      {
        id: "inst-scale-205",
        serialNumber: "SCALE-2024-205",
        category: "Electronic Counter Scale",
        model: "Essae DS-252",
        capacity: "30 kg / 2 g",
        location: "Counter 3 – Billing",
        expiresInDays: 200,
        certNumber: "CERT-LM-2026-0205",
        appNumber: "APP-2025-0205",
      },
      {
        id: "inst-scale-117",
        serialNumber: "SCALE-2023-117",
        category: "Electronic Counter Scale",
        model: "Essae DS-415",
        capacity: "15 kg / 1 g",
        location: "Counter 2 – Express",
        // Passed last year, but every reading sat just inside its limit — drift.
        readings: [[500, 500.45], [1000, 1000.8], [5000, 5001.4], [10000, 10001.4]],
        expiresInDays: 5,
        certNumber: "CERT-LM-2025-0117",
        appNumber: "APP-2025-0117",
      },
      {
        id: "inst-ps-088",
        serialNumber: "PS-2023-088",
        category: "Platform Scale (Industrial)",
        model: "Avery Berkel HL-122",
        capacity: "300 kg / 50 g",
        location: "Godown – Receiving",
        // Every reading exactly nominal — the pattern an invented record leaves.
        readings: [[5000, 5000], [10000, 10000], [20000, 20000]],
        expiresInDays: 12,
        certNumber: "CERT-LM-2025-0088",
        appNumber: "APP-2025-0088",
      },
      {
        id: "inst-wb-002",
        serialNumber: "WB-DL-2024-02",
        category: "Weighbridge (Heavy Vehicle)",
        model: "Avery Weigh-Tronix BridgeMaster",
        capacity: "60 Metric Tonnes",
        location: "Logistics Yard, Gate 1",
        expiresInDays: 25,
        certNumber: "CERT-LM-2025-0302",
        appNumber: "APP-2025-0302",
      },
      {
        id: "inst-fd-033",
        serialNumber: "FD-CP-2024-33",
        category: "Fuel Dispenser (Petrol/Diesel)",
        model: "Tokheim Quantium 510",
        capacity: "45 L/min",
        location: "Island 3 – Diesel",
        expiresInDays: -10,
        certNumber: "CERT-LM-2025-0033",
        appNumber: "APP-2025-0033",
      },
    ],
  },
  {
    id: "biz-sharma-store",
    name: "Sharma Provision Store",
    regNo: "SPS-DL-2022-3310",
    address: "12/4 Ajmal Khan Road, Karol Bagh, New Delhi 110005",
    contact: "+91 98100 22334",
    lat: 28.6519,
    lng: 77.1909,
    instruments: [
      {
        id: "inst-sps-441",
        serialNumber: "SCALE-2022-441",
        category: "Electronic Counter Scale",
        model: "Phoenix PX-30",
        capacity: "30 kg / 5 g",
        location: "Front counter",
        expiresInDays: 3,
        certNumber: "CERT-LM-2025-0441",
        appNumber: "APP-2025-0441",
      },
    ],
  },
];

const OFFICER = DEMO_ACCOUNTS.find((a) => a.role === "OFFICER")!;
const SHOP_GPS = { text: "28.63280° N, 77.21970° E (±8 m)", lat: 28.6328, lng: 77.2197 };

/**
 * The last calibration run for a seeded instrument, evaluated by the real MPE
 * engine so the stored limits always match the instrument's division. Returns
 * null for instruments with no weight division (dispensers, weighbridges).
 */
function seedCalibration(inst: SeedInstrument) {
  const e = divisionFromCapacity(inst.capacity);
  if (e == null) return null;
  let rows: TestWeightRow[];
  if (inst.readings) {
    rows = inst.readings.map(([nominalG, observedG]) => ({ nominalG, observedG }));
  } else {
    // An ordinary run: errors at roughly a quarter to a third of each limit.
    const max = /([\d.]+)\s*(kg|g)\b/i.exec(inst.capacity.split("/")[0]);
    const capG = max ? Number(max[1]) * (max[2].toLowerCase() === "kg" ? 1000 : 1) : Infinity;
    const share = [0.2, 0.3, -0.25, 0.35, 0.3];
    rows = [500, 1000, 5000, 10000, 20000]
      .filter((n) => n <= capG)
      .map((nominalG, i) => {
        const mpe = evaluateAll([{ nominalG, observedG: nominalG }], e)[0].mpeG;
        return { nominalG, observedG: Math.round((nominalG + share[i] * mpe) * 100) / 100 };
      });
  }
  const evaluated = evaluateAll(rows, e);
  return { testWeights: JSON.stringify(evaluated), mpeVerdict: verdictFor(evaluated) };
}

async function issueSeedCertificate(
  prisma: PrismaClient,
  business: SeedBusiness,
  inst: SeedInstrument
) {
  const validTill = daysFromNow(inst.expiresInDays!);
  const validFrom = new Date(validTill);
  validFrom.setFullYear(validFrom.getFullYear() - 1);

  const application = await prisma.application.create({
    data: {
      applicationNumber: inst.appNumber!,
      status: "INSPECTED",
      instrumentId: inst.id,
      businessId: business.id,
      assignedOfficerId: OFFICER.id,
      scheduledFor: validFrom,
      createdAt: new Date(validFrom.getTime() - 3 * 86_400_000),
    },
  });

  const calibration = seedCalibration(inst);
  await prisma.inspection.create({
    data: {
      applicationId: application.id,
      officerId: OFFICER.id,
      result: "PASS",
      notes:
        "Standard calibration test performed. Measurement errors within Maximum Permissible Error. Government verification seal affixed.",
      photoAttached: false,
      testWeights: calibration?.testWeights ?? "",
      mpeVerdict: calibration?.mpeVerdict ?? null,
      // Every seeded inspection is geotagged in Connaught Place — which is
      // right for ABC Traders and 3.5 km off for Sharma's Karol Bagh shop, so
      // the integrity check has one genuine case to raise.
      gpsCoordinates: SHOP_GPS.text,
      gpsLat: SHOP_GPS.lat,
      gpsLng: SHOP_GPS.lng,
      gpsAccuracyM: 8,
      inspectedAt: validFrom,
    },
  });

  const payload = {
    certId: inst.certNumber!,
    businessId: business.id,
    businessName: business.name,
    businessRegNo: business.regNo,
    instrumentId: inst.id,
    serialNumber: inst.serialNumber,
    category: inst.category,
    model: inst.model,
    capacity: inst.capacity,
    validFrom: validFrom.toISOString(),
    validTill: validTill.toISOString(),
    officer: OFFICER.name,
    badgeNumber: OFFICER.badgeNumber ?? "",
    gps: SHOP_GPS.text,
    issuedAt: validFrom.toISOString(),
  };
  const token = jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
  const qrCode = await QRCode.toDataURL(`${PUBLIC_ORIGIN}/verify/${token}`, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 350,
    color: { dark: "#0b0f1a", light: "#ffffff" },
  });

  await prisma.certificate.create({
    data: {
      certNumber: inst.certNumber!,
      token,
      validFrom,
      validTill,
      qrCode,
      instrumentId: inst.id,
      applicationId: application.id,
    },
  });
}

/** Two open complaints, so the enforcement queue is not empty on first load. */
const SEED_REPORTS = [
  {
    kind: "NO_STICKER",
    placeText: "Vegetable stall, Karol Bagh main road",
    note: "The shopkeeper's scale has no QR sticker anywhere on it.",
    contact: null as string | null,
    hoursAgo: 5,
  },
  {
    kind: "SHORT_WEIGHT",
    placeText: "Fuel pump, Connaught Place",
    note: "Bought 5 litres, the can measured noticeably short.",
    contact: "+91 99999 12345",
    hoursAgo: 27,
    /** Ties the report to the expired dispenser so HQ can see the link. */
    instrumentId: "inst-fd-033",
  },
];

export async function seedDatabase(prisma: PrismaClient) {
  // Delete in reverse dependency order.
  await prisma.report.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.application.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.user.deleteMany();
  await prisma.testCentre.deleteMany();
  await prisma.business.deleteMany();

  for (const b of BUSINESSES) {
    await prisma.business.create({
      data: { id: b.id, name: b.name, regNo: b.regNo, address: b.address, contact: b.contact, lat: b.lat, lng: b.lng },
    });
  }

  await prisma.testCentre.create({
    data: {
      id: "gatc-precision-labs",
      name: "Precision Test Labs",
      notifyNo: "GATC/DL/2024/07",
      address: "Plot 22, Okhla Industrial Estate Phase II, New Delhi 110020",
      contact: "+91 98110 55220",
      categories: JSON.stringify([
        "Electronic Counter Scale",
        "Platform Scale (Industrial)",
        "Weighbridge (Heavy Vehicle)",
      ]),
    },
  });

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const users = [];
  for (const a of DEMO_ACCOUNTS) {
    users.push(
      await prisma.user.create({
        data: {
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          badgeNumber: a.badgeNumber,
          businessId: a.businessId,
          testCentreId: a.testCentreId,
          passwordHash,
        },
      })
    );
  }

  let certificates = 0;
  for (const b of BUSINESSES) {
    for (const inst of b.instruments) {
      await prisma.instrument.create({
        data: {
          id: inst.id,
          serialNumber: inst.serialNumber,
          category: inst.category,
          model: inst.model,
          capacity: inst.capacity,
          location: inst.location,
          businessId: b.id,
        },
      });
      if (inst.expiresInDays !== undefined) {
        await issueSeedCertificate(prisma, b, inst);
        certificates++;
      }
    }
  }

  for (const r of SEED_REPORTS) {
    await prisma.report.create({
      data: {
        kind: r.kind,
        placeText: r.placeText,
        note: r.note,
        contact: r.contact,
        instrumentId: "instrumentId" in r ? (r.instrumentId as string) : null,
        createdAt: new Date(Date.now() - r.hoursAgo * 3_600_000),
      },
    });
  }

  return {
    reports: SEED_REPORTS.length,
    businesses: BUSINESSES.map((b) => b.name),
    users: users.map((u) => `${u.name} <${u.email}>`),
    instruments: BUSINESSES.reduce((n, b) => n + b.instruments.length, 0),
    certificates,
  };
}
