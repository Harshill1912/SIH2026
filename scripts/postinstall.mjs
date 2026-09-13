import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
  process.env.DATABASE_URL = "file:./dev.db";
}

try {
  execSync("npx prisma generate", { stdio: "inherit", env: process.env });
} catch (e) {
  console.warn("[postinstall] Note: prisma generate warning (will re-run during build):", e.message);
}
