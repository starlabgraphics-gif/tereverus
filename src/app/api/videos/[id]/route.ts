import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { isAuthedAdmin } from "@/lib/auth";
import { deleteMedia, mediaNameFromPath } from "@/lib/storage";
import { ensureSchema } from "@/lib/dbReady";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  if (!(await isAuthedAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  await ensureSchema();
  const { id } = await ctx.params;
  let body: { title?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const patch: { title?: string; kind?: "main" | "ad" } = {};
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim().slice(0, 200);
  }
  if (body.kind === "ad" || body.kind === "main") {
    patch.kind = body.kind;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await db
    .update(videos)
    .set(patch)
    .where(eq(videos.id, id))
    .returning();
  if (updated.length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, video: updated[0] });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await isAuthedAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  await ensureSchema();
  const { id } = await ctx.params;

  const found = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  if (found.length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.delete(videos).where(eq(videos.id, id)); // cascade removes playlist entries

  for (const p of [found[0].srcPath, found[0].thumbPath]) {
    const name = mediaNameFromPath(p);
    if (name) await deleteMedia(name).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
