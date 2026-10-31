import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "tvtv-media";

/**
 * Media storage abstraction.
 *
 * - On Netlify (functions have an ephemeral, read-only filesystem) media is
 *   persisted to Netlify Blobs (R2-backed) and streamed back on demand.
 * - Everywhere else (local sandbox / self-hosted) media lives in
 *   public/uploads and is read from the local filesystem.
 *
 * Stored media is always addressed as /api/media/<fileName>.
 */

const isNetlify = () =>
  Boolean(process.env.NETLIFY) || Boolean(process.env.NETLIFY_SITE_ID);

const LOCAL_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".ogv": "video/ogg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function mimeOf(name: string): string {
  return MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

/** Validate a media file name (uuid + extension) to block path traversal. */
export function isSafeMediaName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,60}\.(mp4|webm|m4v|ogv|jpg|jpeg)$/i.test(name);
}

export async function saveMedia(name: string, bytes: Buffer): Promise<void> {
  if (isNetlify()) {
    await getStore(STORE_NAME).set(name, new Blob([new Uint8Array(bytes)]));
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ LOCAL_DIR, name), bytes);
}

export async function getMediaResponse(name: string): Promise<Response | null> {
  const headers: Record<string, string> = {
    "Content-Type": mimeOf(name),
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (isNetlify()) {
    const stream = await getStore(STORE_NAME).get(name, { type: "stream" });
    if (!stream) return null;
    return new Response(stream, { status: 200, headers });
  }
  const filePath = path.join(/*turbopackIgnore: true*/ LOCAL_DIR, name);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat) return null;
  const stream = createReadStream(filePath);
  const web = Readable.toWeb(stream) as ReadableStream;
  return new Response(web, { status: 200, headers });
}

export async function deleteMedia(name: string): Promise<void> {
  if (isNetlify()) {
    await getStore(STORE_NAME).delete(name);
    return;
  }
  const filePath = path.join(/*turbopackIgnore: true*/ LOCAL_DIR, name);
  await fs.unlink(filePath).catch(() => {});
}

/** Strip a stored media path (e.g. /api/media/x.mp4 or legacy /uploads/x.mp4) to a bare name. */
export function mediaNameFromPath(storedPath: string | null): string | null {
  if (!storedPath) return null;
  const last = storedPath.split("/").pop();
  return last && isSafeMediaName(last) ? last : null;
}
