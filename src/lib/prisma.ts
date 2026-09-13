import { PrismaClient } from "@prisma/client";
import path from "node:path";
import fs from "node:fs";

function resolveDatabaseUrl(): string {
  // If explicitly overridden with a remote DB URL
  if (
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL.trim() &&
    !process.env.DATABASE_URL.includes("./dev.db")
  ) {
    return process.env.DATABASE_URL;
  }

  // Running on Vercel or AWS Lambda where the deployment root is read-only
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDbPath = path.join("/tmp", "dev.db");
    if (!fs.existsSync(tmpDbPath)) {
      const templatePath = path.join(process.cwd(), "prisma", "template.db");
      if (fs.existsSync(templatePath)) {
        try {
          fs.copyFileSync(templatePath, tmpDbPath);
        } catch (e) {
          console.error("Failed to copy template database to /tmp:", e);
        }
      }
    }
    return `file:${tmpDbPath}`;
  }

  return "file:./dev.db";
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
