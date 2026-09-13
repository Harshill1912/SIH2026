import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RoleProvider } from "@/context/RoleContext";
import RoleHeader from "@/components/RoleHeader";
import { getSession } from "@/lib/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "e-Metrology — Digital Verification of Weights & Measures",
    template: "%s · e-Metrology",
  },
  description:
    "Tamper-evident digital verification certificates for commercial weighing and measuring instruments. Smart India Hackathon 2026 · SIH26036.",
  applicationName: "e-Metrology",
  appleWebApp: { capable: true, title: "e-Metrology", statusBarStyle: "default" },
  icons: { icon: "/favicon.ico", apple: "/apple-icon.png" },
  openGraph: {
    title: "e-Metrology — verify any weighing instrument in seconds",
    description:
      "Scan the QR sticker on any shop scale to check that it was verified under the Legal Metrology Act, 2009.",
    images: ["/og.png"],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e7c66",
  width: "device-width",
  initialScale: 1,
  // Field officers zoom into small type on a sunlit screen; do not block them.
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The session is read once here and handed to the client tree — no
  // client-side auth fetch, no flash of the wrong persona.
  const user = await getSession();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <RoleProvider user={user}>
          <RoleHeader />
          <div className="relative flex-1">
            <div
              aria-hidden
              className="paper-grid pointer-events-none absolute inset-x-0 top-0 h-[420px]"
            />
            <main className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
          <footer className="no-print border-t border-line">
            <div className="mx-auto max-w-7xl px-4 py-3 text-center text-xs text-ink-400 sm:px-6 lg:px-8">
              Legal Metrology Act, 2009 · Digital verification prototype
            </div>
          </footer>
        </RoleProvider>
      </body>
    </html>
  );
}
