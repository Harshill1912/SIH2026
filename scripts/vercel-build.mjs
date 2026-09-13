import { execSync } from "node:child_process";

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  process.env.JWT_SECRET = "sih26036-legal-metrology-hmac-secret-key-2026";
}

try {
  console.log("[vercel-build] 1. Generating Prisma client...");
  execSync("npx prisma generate", { stdio: "inherit", env: process.env });

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    console.log("[vercel-build] 2. Synchronizing database schema with Supabase...");
    try {
      execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", env: process.env });
    } catch (e) {
      console.warn("[vercel-build] Note: db push warning (check connection):", e.message);
    }
  } else {
    console.log("[vercel-build] Note: DATABASE_URL not provided yet. Skipping db push.");
  }

  console.log("[vercel-build] 3. Building Next.js production bundle...");
  execSync("npx next build", { stdio: "inherit", env: process.env });

  console.log("[vercel-build] Deployment build completed successfully!");
} catch (err) {
  console.error("[vercel-build] Build failed:", err);
  process.exit(1);
}
