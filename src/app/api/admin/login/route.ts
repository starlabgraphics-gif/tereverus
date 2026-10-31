import { NextResponse } from "next/server";
import { checkCredentials, setAdminSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "");
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (checkCredentials(email, password)) {
    await setAdminSessionCookie();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid operator credentials." }, { status: 401 });
}
