import { getPool as _getPool } from "@/db/pool";

let ensured: Promise<void> | null = null;

/**
 * Idempotent schema bootstrap: creates the tables if they do not exist yet.
 * This lets the app work on any fresh PostgreSQL instance (e.g. Netlify +
 * Neon) without running drizzle-kit migrations by hand.
 */
export function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const client = await _getPool().connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS videos (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title text NOT NULL,
            kind varchar NOT NULL DEFAULT 'main',
            duration text NOT NULL DEFAULT '0',
            size_bytes integer NOT NULL DEFAULT 0,
            src_path text NOT NULL,
            thumb_path text,
            mime_type text NOT NULL DEFAULT 'video/mp4',
            created_at timestamptz NOT NULL DEFAULT now()
          );
          CREATE TABLE IF NOT EXISTS playlist_entries (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
            position integer NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS playlist_entries_position_idx
            ON playlist_entries(position);
          CREATE TABLE IF NOT EXISTS broadcast (
            id integer PRIMARY KEY DEFAULT 1,
            status varchar NOT NULL DEFAULT 'idle',
            current_entry_id uuid,
            scheduled_at timestamptz,
            updated_at timestamptz NOT NULL DEFAULT now()
          );
        `);
      } finally {
        client.release();
      }
    })();
    // If a cold boot ever fails, allow the next request to retry.
    ensured.catch(() => {
      ensured = null;
    });
  }
  return ensured;
}
