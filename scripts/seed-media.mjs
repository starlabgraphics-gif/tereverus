// Seeds Tereverus TV with generated demo clips (test patterns) so the
// broadcast channel works out of the box. Safe to re-run: it skips if
// the library already has videos.
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ffmpegPath from "ffmpeg-static";
import { Pool } from "pg";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 64 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function makeClip({ file, source, seconds, fps = 24 }) {
  const out = path.join(UPLOAD_DIR, file);
  await run([
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `${source}=s=1280x720:r=${fps}:d=${seconds}`,
    "-t", String(seconds),
    "-vf", `fade=t=in:st=0:d=1.2,fade=t=out:st=${seconds - 1.2}:d=1.2`,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
    "-pix_fmt", "yuv420p", out,
  ]);
  return out;
}

async function makeThumb(videoFile, thumbFile) {
  await run([
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", "2", "-i", videoFile,
    "-frames:v", "1", "-q:v", "5", path.join(UPLOAD_DIR, thumbFile),
  ]);
}

const clips = [
  { name: "Tereverus Newsroom Open", kind: "main", seconds: 14, source: "testsrc2" },
  { name: "Gold Series — Sponsor Promo", kind: "ad", seconds: 8, source: "smptebars" },
  { name: "Horizons Documentary Teaser", kind: "main", seconds: 12, source: "testsrc" },
];

const existing = await pool.query("SELECT count(*)::int AS n FROM videos");
if (existing.rows[0].n > 0) {
  console.log("Library already has videos — skipping seed.");
  process.exit(0);
}

await fs.mkdir(UPLOAD_DIR, { recursive: true });

const rows = [];
for (const clip of clips) {
  const id = crypto.randomUUID();
  const file = `${id}.mp4`;
  const thumb = `${id}.jpg`;
  console.log("Generating", clip.name, "...");
  const videoFile = await makeClip({
    file,
    source: clip.source,
    seconds: clip.seconds,
  });
  await makeThumb(videoFile, thumb);
  const size = (await fs.stat(videoFile)).size;
  const res = await pool.query(
    `INSERT INTO videos (id, title, kind, duration, size_bytes, src_path, thumb_path, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'video/mp4') RETURNING id`,
    [id, clip.name, clip.kind, clip.seconds, size, `/api/media/${file}`, `/api/media/${thumb}`],
  );
  rows.push({ videoId: res.rows[0].id, kind: clip.kind });
}

// Playlist: Main -> Ad -> Main (continuous loop)
for (let i = 0; i < rows.length; i++) {
  await pool.query(
    `INSERT INTO playlist_entries (video_id, position) VALUES ($1, $2)`,
    [rows[i].videoId, i],
  );
}

// Go live from the first program
await pool.query(
  `INSERT INTO broadcast (id, status, current_entry_id)
   VALUES (1, 'live', (SELECT id FROM playlist_entries ORDER BY position LIMIT 1))
   ON CONFLICT (id) DO UPDATE SET status = 'live',
     current_entry_id = (SELECT id FROM playlist_entries ORDER BY position LIMIT 1)`,
);

console.log("Seed complete: 3 clips uploaded, playlist built, channel is LIVE.");
await pool.end();
