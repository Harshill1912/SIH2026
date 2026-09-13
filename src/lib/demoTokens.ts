import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "sih26036-legal-metrology-hmac-secret-key-2026";

export function generateDemoTokens() {
  const now = new Date();

  // 1. Genuine Valid Token (Valid for 1 year from now)
  const validFrom = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
  const validTill = new Date(now.getTime() + 355 * 24 * 60 * 60 * 1000); // 355 days left

  const genuinePayload = {
    certId: "CERT-LM-2026-GENUINE",
    businessId: "biz-abc-traders",
    businessName: "ABC Traders",
    businessRegNo: "ABC-DL-2024-9871",
    instrumentId: "inst-scale-001",
    serialNumber: "SCALE-2024-001",
    category: "Electronic Counter Scale",
    model: "Essae DS-215 Precision",
    capacity: "30 kg / 1 g",
    validFrom: validFrom.toISOString(),
    validTill: validTill.toISOString(),
    officer: "Inspector Rajesh Kumar",
    badgeNumber: "DL-MET-402",
    gps: "28.6328° N, 77.2197° E (Connaught Place)",
    issuedAt: validFrom.toISOString(),
  };

  const validToken = jwt.sign(genuinePayload, JWT_SECRET, { algorithm: "HS256" });

  // 2. Expired Token (Expired 45 days ago)
  const expiredFrom = new Date(now.getTime() - 410 * 24 * 60 * 60 * 1000);
  const expiredTill = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

  const expiredPayload = {
    certId: "CERT-LM-2024-EXPIRED",
    businessId: "biz-abc-traders",
    businessName: "ABC Traders",
    businessRegNo: "ABC-DL-2024-9871",
    instrumentId: "inst-scale-001",
    serialNumber: "SCALE-2024-001",
    category: "Electronic Counter Scale",
    model: "Essae DS-215 Precision",
    capacity: "30 kg / 1 g",
    validFrom: expiredFrom.toISOString(),
    validTill: expiredTill.toISOString(),
    officer: "Inspector Rajesh Kumar",
    badgeNumber: "DL-MET-402",
    gps: "28.6328° N, 77.2197° E",
    issuedAt: expiredFrom.toISOString(),
  };

  const expiredToken = jwt.sign(expiredPayload, JWT_SECRET, { algorithm: "HS256" });

  // 3. Tampered Token:
  // Take a real valid token, decode payload, alter the capacity or merchant to fraudulent values,
  // and re-package with the original signature so HMAC verification fails!
  const parts = validToken.split(".");
  const fraudulentPayload = Buffer.from(
    JSON.stringify({
      ...genuinePayload,
      capacity: "100 kg / 10 g (TAMPERED DATA)",
      businessName: "FRAUDULENT ENTERPRISES LTD",
    })
  ).toString("base64url");

  const tamperedToken = `${parts[0]}.${fraudulentPayload}.${parts[2]}`;

  return {
    validToken,
    expiredToken,
    tamperedToken,
  };
}
