import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { isAuthedAdmin } from "@/lib/auth";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_EXT = new Set([".mp4", ".webm", ".m4v", ".ogv"]);
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB guard

export async function GET() {
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
  const ext = path.extname(originalName).toLowerCase();
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

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    return NextResponse.json({ error: "Could not prepare storage." }, { status: 500 });
  }

  const id = crypto.randomUUID();
  const fileName = `${id}${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), bytes);

  let thumbPath: string | null = null;
  if (thumbDataUrl.startsWith("data:image/jpeg;base64,")) {
    try {
      const thumbName = `${id}.jpg`;
      await fs.writeFile(
        path.join(UPLOAD_DIR, thumbName),
        Buffer.from(thumbDataUrl.split(",")[1], "base64"),
      );
      thumbPath = `/uploads/${thumbName}`;
    } catch {
      thumbPath = null;
    }
  }

  const finalTitle = title || path.basename(originalName, ext);
  const inserted = await db
    .insert(videos)
    .values({
      id,
      title: finalTitle,
      kind,
      duration: String(duration),
      sizeBytes: bytes.byteLength,
      srcPath: `/uploads/${fileName}`,
      thumbPath,
      mimeType: (file as File).type || "video/mp4",
    })
    .returning();

  return NextResponse.json({ ok: true, video: inserted[0] }, { status: 201 });
}
