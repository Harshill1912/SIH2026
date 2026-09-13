import { execSync } from "node:child_process";

try {
  execSync("npx prisma generate", { stdio: "inherit", env: process.env });
} catch (e) {
  console.warn("[postinstall] Note: prisma generate warning (will re-run during build):", e.message);
}
