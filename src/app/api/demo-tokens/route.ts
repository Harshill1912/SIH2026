import { NextResponse } from "next/server";
import { generateDemoTokens } from "@/lib/demoTokens";

export async function GET() {
  const tokens = generateDemoTokens();
  return NextResponse.json({ success: true, ...tokens });
}
