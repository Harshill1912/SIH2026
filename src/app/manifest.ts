import type { MetadataRoute } from "next";

/**
 * Installable-app metadata. The problem statement asks for "mobile application
 * support for field verification officers"; this is what lets an officer add
 * e-Metrology to their home screen and run it full-screen, offline queue and all.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "e-Metrology — Legal Metrology Verification",
    short_name: "e-Metrology",
    description:
      "Online verification and digital certification for weights and measuring instruments used in trade.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8fa",
    theme_color: "#0e7c66",
    categories: ["government", "business", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Verify a certificate", short_name: "Verify", url: "/verify" },
      { name: "Search the register", short_name: "Search", url: "/search" },
    ],
  };
}
