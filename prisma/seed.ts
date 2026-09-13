import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/lib/seed-data";
import { DEMO_PASSWORD } from "../src/lib/demo-accounts";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding demo dataset…");
  const summary = await seedDatabase(prisma);
  console.log("✅ Seed completed");
  console.log(summary);
  console.log(`🔑 Demo password for every account: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
