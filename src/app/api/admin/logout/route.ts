import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
