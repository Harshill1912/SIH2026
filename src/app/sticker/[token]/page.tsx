import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import StickerSheet from "@/components/certificate/StickerSheet";
import type { TokenPayload } from "@/components/verify/VerifyView";

const JWT_SECRET = process.env.JWT_SECRET || "sih26036-legal-metrology-hmac-secret-key-2026";

export const metadata = { title: "Verification sticker" };

/**
 * The physical artefact: the sticker an officer prints and affixes to the
 * instrument. Public on purpose — a trader who loses the sticker should be able
 * to reprint it from the QR they still have, and nothing here is secret that
 * the QR does not already carry.
 */
export default async function StickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ origin?: string }>;
}) {
  const { token } = await params;
  const { origin } = await searchParams;
  const decoded = decodeURIComponent(token);

  let payload: TokenPayload;
  try {
    payload = jwt.verify(decoded, JWT_SECRET) as TokenPayload;
  } catch {
    // A sticker is only ever printed for a genuine certificate.
    notFound();
  }

  const base = origin && /^https?:\/\//.test(origin) ? origin : "";
  const verifyUrl = `${base}/verify/${decoded}`;
  // Level M, not H: the signed token is a long payload, and lower error
  // correction means fewer, larger modules — which a phone camera reads far
  // more reliably off a small printed label.
  const qr = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 700,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return <StickerSheet payload={payload} qr={qr} />;
}
