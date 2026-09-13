import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
  delete process.env.DATABASE_URL;
}
if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  process.env.JWT_SECRET = "sih26036-legal-metrology-hmac-secret-key-2026";
}

try {
  console.log("[vercel-build] 1. Generating Prisma client...");
  execSync("npx prisma generate", { stdio: "inherit", env: process.env });

  console.log("[vercel-build] 2. Initializing SQLite database schema...");
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", env: process.env });

  console.log("[vercel-build] 3. Seeding database with demo records...");
  execSync("npx prisma db seed", { stdio: "inherit", env: process.env });

  console.log("[vercel-build] 4. Building Next.js production bundle...");
  execSync("npx next build", { stdio: "inherit", env: process.env });

  console.log("[vercel-build] Deployment build completed successfully!");
} catch (err) {
  console.error("[vercel-build] Build failed:", err);
  process.exit(1);
}
