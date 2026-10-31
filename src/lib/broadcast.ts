import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { broadcast, playlistEntries, videos } from "@/db/schema";

export type EntryKind = "main" | "ad";

export interface BroadcastEntry {
  id: string; // playlist entry id
  videoId: string;
  title: string;
  kind: EntryKind;
  duration: number; // seconds
  src: string;
  thumb: string | null;
}

export interface BroadcastState {
  status: "idle" | "scheduled" | "live" | "paused";
  currentEntryId: string | null;
  scheduledAt: string | null;
  entries: BroadcastEntry[];
  totalDuration: number;
  loop: boolean;
}

async function getOrderedEntries(): Promise<BroadcastEntry[]> {
  const rows = await db
    .select({
      entryId: playlistEntries.id,
      videoId: videos.id,
      title: videos.title,
      kind: videos.kind,
      duration: videos.duration,
      src: videos.srcPath,
      thumb: videos.thumbPath,
    })
    .from(playlistEntries)
    .innerJoin(videos, eq(playlistEntries.videoId, videos.id))
    .orderBy(asc(playlistEntries.position));

  return rows.map((r) => ({
    id: r.entryId,
    videoId: r.videoId,
    title: r.title,
    kind: r.kind,
    duration: Number(r.duration) || 0,
    src: r.src,
    thumb: r.thumb,
  }));
}

async function getRow() {
  const rows = await db.select().from(broadcast).limit(1);
  if (rows.length === 0) {
    const inserted = await db
      .insert(broadcast)
      .values({ id: 1, status: "idle" })
      .returning();
    return inserted[0];
  }
  return rows[0];
}

/** Public-facing broadcast state. A due "scheduled" state flips to "live" lazily. */
export async function getPublicState(): Promise<BroadcastState> {
  const row = await getRow();
  let status = row.status;
  let scheduledAt = row.scheduledAt;

  if (status === "scheduled" && row.scheduledAt && Date.now() >= row.scheduledAt.getTime()) {
    await db
      .update(broadcast)
      .set({ status: "live", scheduledAt: null, updatedAt: new Date() })
      .where(eq(broadcast.id, row.id));
    status = "live";
    scheduledAt = null;
  }

  const entries = await getOrderedEntries();
  return {
    status,
    currentEntryId: row.currentEntryId,
    scheduledAt: scheduledAt?.toISOString() ?? null,
    entries,
    totalDuration: entries.reduce((s, e) => s + e.duration, 0),
    loop: true,
  };
}

/** Internal: current entry id after advancing from `fromId` (wraps around for the looping channel). */
export async function nextEntryIdAfter(fromId: string | null): Promise<string | null> {
  const entries = await getOrderedEntries();
  if (entries.length === 0) return null;
  const idx = entries.findIndex((e) => e.id === fromId);
  if (idx === -1) return entries[0].id;
  return entries[(idx + 1) % entries.length].id;
}

/** Advance if the caller is reporting the item that is actually current (keeps one source of truth). */
export async function advanceIfCurrent(
  fromId: string,
): Promise<{ ok: boolean; currentEntryId: string | null }> {
  const row = await getRow();
  if (row.status !== "live" || row.currentEntryId !== fromId) {
    return { ok: false, currentEntryId: row.currentEntryId };
  }
  const next = await nextEntryIdAfter(fromId);
  if (next !== null) {
    await db
      .update(broadcast)
      .set({ currentEntryId: next, updatedAt: new Date() })
      .where(eq(broadcast.id, row.id));
  }
  return { ok: true, currentEntryId: next };
}

export async function setBroadcast(
  patch: Partial<{
    status: "idle" | "scheduled" | "live" | "paused";
    currentEntryId: string | null;
    scheduledAt: Date | null;
  }>,
) {
  const row = await getRow();
  await db
    .update(broadcast)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(broadcast.id, row.id));
}

/** Ensure the current entry still exists after admin edits; return fixed state. */
export async function reconcileCurrent(): Promise<string | null> {
  const row = await getRow();
  if (!row.currentEntryId) return null;
  const exists = await db
    .select({ id: playlistEntries.id })
    .from(playlistEntries)
    .where(eq(playlistEntries.id, row.currentEntryId))
    .limit(1);
  if (exists.length > 0) return row.currentEntryId;
  const fallback = await nextEntryIdAfter(null);
  if (fallback !== null) {
    await db
      .update(broadcast)
      .set({ currentEntryId: fallback, updatedAt: new Date() })
      .where(eq(broadcast.id, row.id));
  } else if (row.status === "live") {
    await db
      .update(broadcast)
      .set({ status: "idle", updatedAt: new Date() })
      .where(eq(broadcast.id, row.id));
  }
  return fallback;
}

export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
