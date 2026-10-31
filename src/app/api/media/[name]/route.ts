import { NextResponse } from "next/server";
import { getMediaResponse, isSafeMediaName } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ name: string }> };

/** Public, immutable media stream (video files + thumbnails). */
export async function GET(_req: Request, ctx: Ctx) {
  const { name } = await ctx.params;
  if (!isSafeMediaName(name)) {
    return NextResponse.json({ error: "Invalid media name." }, { status: 400 });
  }
  const res = await getMediaResponse(name).catch(() => null);
  if (!res) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
  return res;
}
