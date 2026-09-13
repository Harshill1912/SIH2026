import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { seedDatabase } from "@/lib/seed-data";

/**
 * Reset the demo database to its seed state. Any signed-in demo user may do
 * this (it is a stage control, not an admin feature). Seed user ids are fixed,
 * so the caller's session survives the reset.
 */
export async function POST() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const data = await seedDatabase(prisma);
    return NextResponse.json({
      success: true,
      message: "Database reset to pristine seed state successfully",
      data,
    });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ success: false, error: "Failed to reset database" }, { status: 500 });
  }
}
