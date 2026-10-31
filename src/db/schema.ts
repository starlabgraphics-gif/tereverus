import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/pg-core";

/** Media items: main content videos and advertisement clips */
export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  /** "main" = Main Content, "ad" = Advertisement */
  kind: varchar("kind", { enum: ["main", "ad"] }).notNull().default("main"),
  /** Duration in seconds (stored as numeric, returned as string by pg) */
  duration: text("duration").notNull().default("0"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  /** Public path of the video file, e.g. /uploads/xxx.mp4 */
  srcPath: text("src_path").notNull(),
  /** Public path of the thumbnail, e.g. /uploads/xxx.jpg (nullable) */
  thumbPath: text("thumb_path"),
  mimeType: text("mime_type").notNull().default("video/mp4"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Ordered playlist — a video can appear multiple times (separate entries) */
export const playlistEntries = pgTable(
  "playlist_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("playlist_entries_position_idx").on(t.position)],
);

/** Single-row broadcast control state */
export const broadcast = pgTable("broadcast", {
  id: integer("id").primaryKey().default(1),
  status: varchar("status", {
    enum: ["idle", "scheduled", "live", "paused"],
  })
    .notNull()
    .default("idle"),
  currentEntryId: uuid("current_entry_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type VideoRow = typeof videos.$inferSelect;
export type PlaylistEntryRow = typeof playlistEntries.$inferSelect;
export type BroadcastRow = typeof broadcast.$inferSelect;
