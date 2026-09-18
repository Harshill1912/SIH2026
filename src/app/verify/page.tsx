import PublicVerificationPortal from "@/components/public/PublicVerificationPortal";
import { generateDemoTokens } from "@/lib/demoTokens";

export const metadata = { title: "Verify a certificate" };

/**
 * Public — no sign-in. Anyone with a QR sticker lands here, so the page shows
 * only what a citizen needs: the scanner and a way to report a problem. The
 * internal workflow strip belongs on the staff dashboards, not here.
 */
export default function VerifyPortalPage() {
  const demoTokens = generateDemoTokens();
  return (
    <div className="py-4">
      <PublicVerificationPortal demoTokens={demoTokens} />
    </div>
  );
}

