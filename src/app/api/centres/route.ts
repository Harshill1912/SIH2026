import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

/** Notified test centres available to the assignment desk. HQ only. */
export async function GET() {
  const auth = await requireSession("ADMIN");
  if ("error" in auth) return auth.error;

  try {
    const rows = await prisma.testCentre.findMany({
      select: { id: true, name: true, notifyNo: true, address: true, categories: true },
      orderBy: { name: "asc" },
    });
    const centres = rows.map((c) => ({
      ...c,
      categories: safeList(c.categories),
    }));
    return NextResponse.json({ success: true, centres });
  } catch (error) {
    console.error("Failed to fetch test centres:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch test centres" }, { status: 500 });
  }
}

function safeList(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
