import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import VerifyView, { type TokenPayload, type VerifyStatus } from "@/components/verify/VerifyView";

const JWT_SECRET = process.env.JWT_SECRET || "sih26036-legal-metrology-hmac-secret-key-2026";

interface VerifyResult {
  status: VerifyStatus;
  payload: TokenPayload | null;
  verificationError: string | null;
  checkedAt: string;
}

/**
 * The cryptographic check. Verifies HMAC-SHA256 signature against JWT secret.
 */
function verifyCertificate(token: string): VerifyResult {
  const now = new Date();
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    const expired = new Date(payload.validTill).getTime() < now.getTime();
    return {
      status: expired ? "EXPIRED" : "VALID",
      payload,
      verificationError: null,
      checkedAt: now.toISOString(),
    };
  } catch (err: unknown) {
    let payload: TokenPayload | null = null;
    try {
      payload = jwt.decode(token) as TokenPayload | null;
    } catch {
      payload = null;
    }
    return {
      status: "TAMPERED",
      payload,
      verificationError: err instanceof Error ? err.message : "Invalid cryptographic signature",
      checkedAt: now.toISOString(),
    };
  }
}

/**
 * Revocation check layered on top of the signature.
 */
async function checkRevocation(certId: string | undefined) {
  if (!certId) return { revoked: null, reason: null, checked: false };
  try {
    const row = await prisma.certificate.findUnique({
      where: { certNumber: certId },
      select: { revokedAt: true, revokedReason: true },
    });
    return {
      revoked: row?.revokedAt ? row.revokedAt.toISOString() : null,
      reason: row?.revokedReason ?? null,
      checked: true,
    };
  } catch {
    return { revoked: null, reason: null, checked: false };
  }
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawParam } = await params;
  const rawDecoded = decodeURIComponent(rawParam).trim();
  // Strip accidental leading colons, hashes, or quotes
  const decoded = rawDecoded.replace(/^[:\s"'#]+|[:\s"'#]+$/g, "").trim();

  let tokenToVerify = decoded;

  // A JWT consists of three base64url segments separated by two periods.
  const isJwt = decoded.split(".").length === 3;

  if (!isJwt) {
    // The user entered a Certificate Number (e.g. CERT-LM-2026-1674) or Serial Number
    const normalized = decoded.toUpperCase();
    const certRow = await prisma.certificate.findFirst({
      where: {
        OR: [
          { certNumber: decoded },
          { certNumber: normalized },
          { certNumber: { contains: decoded } },
          { certNumber: { contains: normalized } },
          { instrument: { serialNumber: decoded } },
          { instrument: { serialNumber: normalized } },
          { instrument: { serialNumber: { contains: decoded } } },
        ],
      },
      select: { token: true, certNumber: true },
    });

    if (certRow?.token) {
      tokenToVerify = certRow.token;
    } else {
      return (
        <VerifyView
          status="NOT_FOUND"
          payload={null}
          verificationError={`No certificate matching "${decoded || rawDecoded}" was found in the official registry.`}
          checkedAt={new Date().toISOString()}
          revocationChecked={true}
        />
      );
    }
  }

  const result = verifyCertificate(tokenToVerify);

  // Only a signature-valid certificate can meaningfully be revoked.
  const rev =
    result.status === "TAMPERED" || result.status === "NOT_FOUND"
      ? { revoked: null, reason: null, checked: false }
      : await checkRevocation(result.payload?.certId);

  return (
    <VerifyView
      {...result}
      status={rev.revoked ? "REVOKED" : result.status}
      revokedAt={rev.revoked}
      revokedReason={rev.reason}
      revocationChecked={rev.checked}
    />
  );
}
