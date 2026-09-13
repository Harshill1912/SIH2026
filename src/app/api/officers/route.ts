import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { hashPassword } from "@/lib/password";

/** Officer roster for the assignment desk. HQ only. */
export async function GET() {
  const auth = await requireSession("ADMIN");
  if ("error" in auth) return auth.error;

  try {
    // Ensure all demo officers are provisioned so both officers are available immediately
    const demoOfficers = DEMO_ACCOUNTS.filter((a) => a.role === "OFFICER");
    for (const off of demoOfficers) {
      const exists = await prisma.user.findUnique({ where: { email: off.email } });
      if (!exists) {
        await prisma.user.create({
          data: {
            id: off.id,
            name: off.name,
            email: off.email,
            role: "OFFICER",
            badgeNumber: off.badgeNumber,
            passwordHash: hashPassword(DEMO_PASSWORD),
          },
        });
      }
    }

    const officers = await prisma.user.findMany({
      where: { role: "OFFICER" },
      select: { id: true, name: true, badgeNumber: true, email: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, officers });
  } catch (error) {
    console.error("Failed to fetch officers:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch officers" }, { status: 500 });
  }
}
