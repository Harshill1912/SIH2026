import { execSync } from "node:child_process";

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  process.env.JWT_SECRET = "sih26036-legal-metrology-hmac-secret-key-2026";
}

try {
  console.log("[vercel-build] 1. Generating Prisma client...");
  execSync("npx prisma generate", { stdio: "inherit", env: process.env });

  console.log("[vercel-build] 2. Building Next.js application...");
  execSync("npx next build", { stdio: "inherit", env: process.env });

  console.log("[vercel-build] Build completed successfully!");
} catch (err) {
  console.error("[vercel-build] Build failed:", err);
  process.exit(1);
}
