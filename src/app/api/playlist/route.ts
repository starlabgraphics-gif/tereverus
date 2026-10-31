import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { playlistEntries } from "@/db/schema";
import { isAuthedAdmin } from "@/lib/auth";
import { getPublicState } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getPublicState();
  return NextResponse.json({ entries: state.entries, totalDuration: state.totalDuration });
}

export async function POST(req: Request) {
  if (!(await isAuthedAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: {
    action?: "add" | "remove" | "reorder";
    videoId?: string;
    entryId?: string;
    ids?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action = body.action;

  if (action === "add") {
    if (!body.videoId) {
      return NextResponse.json({ error: "videoId required." }, { status: 400 });
    }
    const maxRow = await db
      .select({ pos: playlistEntries.position })
      .from(playlistEntries)
      .orderBy(asc(playlistEntries.position))
      .limit(1)
      .then((rows) => rows[rows.length - 1]);
    const pos = (maxRow?.pos ?? -1) + 1;
    const inserted = await db
      .insert(playlistEntries)
      .values({ videoId: body.videoId, position: pos })
      .returning();
    return NextResponse.json({ ok: true, entry: inserted[0] }, { status: 201 });
  }

  if (action === "remove") {
    if (!body.entryId) {
      return NextResponse.json({ error: "entryId required." }, { status: 400 });
    }
    await db.delete(playlistEntries).where(eq(playlistEntries.id, body.entryId));
    return NextResponse.json({ ok: true });
  }

  if (action === "reorder") {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: "ids[] required." }, { status: 400 });
    }
    for (let i = 0; i < body.ids.length; i++) {
      await db
        .update(playlistEntries)
        .set({ position: i })
        .where(eq(playlistEntries.id, body.ids[i]));
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
