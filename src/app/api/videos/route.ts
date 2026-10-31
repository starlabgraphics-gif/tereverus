import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { isAuthedAdmin } from "@/lib/auth";
import { saveMedia } from "@/lib/storage";
import { ensureSchema } from "@/lib/dbReady";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ALLOWED_EXT = new Set([".mp4", ".webm", ".m4v", ".ogv"]);
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB guard

export async function GET() {
  await ensureSchema();
  const rows = await db.select().from(videos).orderBy(asc(videos.createdAt));
  return NextResponse.json({
    videos: rows.map((v) => ({
      id: v.id,
      title: v.title,
      kind: v.kind,
      duration: Number(v.duration) || 0,
      sizeBytes: v.sizeBytes,
      src: v.srcPath,
      thumb: v.thumbPath,
      mimeType: v.mimeType,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  if (!(await isAuthedAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  await ensureSchema();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart upload." }, { status: 400 });
  }

  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const kind = String(form.get("kind") ?? "main") === "ad" ? "ad" : "main";
  const duration = Number(String(form.get("duration") ?? "0")) || 0;
  const thumbDataUrl = String(form.get("thumbnail") ?? "");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Video file is required." }, { status: 400 });
  }

  const originalName = (file as File).name || "video.mp4";
  const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: "Unsupported format. Upload MP4 or WebM files." },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await (file as File).arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large." }, { status: 413 });
  }

  const id = randomUUID();
  const fileName = `${id}${ext}`;
  const thumbName = `${id}.jpg`;

  try {
    await saveMedia(fileName, bytes);
    if (thumbDataUrl.startsWith("data:image/jpeg;base64,")) {
      await saveMedia(thumbName, Buffer.from(thumbDataUrl.split(",")[1], "base64"));
    }
  } catch {
    return NextResponse.json(
      { error: "Could not store the file. Is media storage configured?" },
      { status: 500 },
    );
  }

  const finalTitle = title || originalName.replace(/\.[^.]+$/, "");
  const inserted = await db
    .insert(videos)
    .values({
      id,
      title: finalTitle,
      kind,
      duration: String(duration),
      sizeBytes: bytes.byteLength,
      srcPath: `/api/media/${fileName}`,
      thumbPath: thumbDataUrl.startsWith("data:image/jpeg;base64,")
        ? `/api/media/${thumbName}`
        : null,
      mimeType: (file as File).type || "video/mp4",
    })
    .returning();

  return NextResponse.json({ ok: true, video: inserted[0] }, { status: 201 });
}
