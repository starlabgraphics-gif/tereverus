"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Play,
  Pause,
  SkipForward,
  CalendarClock,
  LogOut,
  ExternalLink,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ListVideo,
  Library,
  Loader2,
  Radio,
  Clock,
  Megaphone,
  Film,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { BrandLockup } from "@/components/brand/Logo";
import UploadModal, { fmtDur, fmtBytes } from "./UploadModal";

type Entry = {
  id: string;
  videoId: string;
  title: string;
  kind: "main" | "ad";
  duration: number;
  src: string;
  thumb: string | null;
};

type VideoMeta = {
  id: string;
  title: string;
  kind: "main" | "ad";
  duration: number;
  sizeBytes: number;
  src: string;
  thumb: string | null;
  mimeType: string;
  createdAt: string;
};

type BState = {
  status: "idle" | "scheduled" | "live" | "paused";
  currentEntryId: string | null;
  scheduledAt: string | null;
  entries: Entry[];
  totalDuration: number;
  loop: boolean;
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [state, setState] = useState<BState | null>(null);
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // schedule form
  const [scheduleAt, setScheduleAt] = useState("");
  const [startEntryId, setStartEntryId] = useState("");

  // drag & drop
  const dragIdx = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [dragIdxState, setDragIdxState] = useState<number | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const loadVideos = useCallback(async () => {
    try {
      const d = await api("/api/videos");
      setVideos(d.videos as VideoMeta[]);
    } catch {
      /* ignore */
    }
  }, []);

  const loadPlaylist = useCallback(async () => {
    try {
      const d = await api("/api/playlist");
      return d;
    } catch {
      return { entries: [] as Entry[], totalDuration: 0 };
    }
  }, []);

  const loadState = useCallback(async () => {
    try {
      const s = await api("/api/broadcast");
      setState(s as BState);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadVideos();
    void loadState();
    const t = setInterval(() => void loadState(), 3000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(clock);
    };
  }, [loadState, loadVideos]);

  const entries = state?.entries ?? [];
  const current = entries.find((e) => e.id === state?.currentEntryId) ?? null;

  async function broadcast(action: string, extra?: Record<string, unknown>) {
    setBusyAction(action);
    try {
      const d = await api("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (d.state) setState(d.state as BState);
      await loadPlaylist();
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Action failed.", "err");
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function applyReorder(ids: string[]) {
    try {
      await api("/api/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", ids }),
      });
      await loadPlaylist();
      await loadState();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Reorder failed.", "err");
    }
  }

  function move(dir: -1 | 1, idx: number) {
    const ids = entries.map((e) => e.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    void applyReorder(ids);
  }

  async function removeEntry(id: string) {
    try {
      await api("/api/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", entryId: id }),
      });
      await Promise.all([loadPlaylist(), loadState(), loadVideos()]);
      notify("Removed from schedule.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed.", "err");
    }
  }

  async function addEntry(videoId: string) {
    try {
      await api("/api/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", videoId }),
      });
      await Promise.all([loadPlaylist(), loadState()]);
      notify("Added to schedule.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed.", "err");
    }
  }

  async function updateVideo(id: string, patch: { title?: string; kind?: string }) {
    try {
      await api(`/api/videos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await Promise.all([loadVideos(), loadPlaylist(), loadState()]);
      notify("Saved — live for all viewers.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed.", "err");
    }
  }

  async function deleteVideo(v: VideoMeta) {
    if (!window.confirm(`Delete "${v.title}"? This removes it from the library and schedule.`))
      return;
    try {
      await api(`/api/videos/${v.id}`, { method: "DELETE" });
      await Promise.all([loadVideos(), loadPlaylist(), loadState()]);
      notify("Deleted.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Delete failed.", "err");
    }
  }

  async function logout() {
    try {
      await api("/api/admin/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const isLive = state?.status === "live";
  const isPaused = state?.status === "paused";
  const isScheduled = state?.status === "scheduled";
  const selectedStart = startEntryId || entries[0]?.id || "";

  return (
    <div className="min-h-dvh bg-ink-950 pb-16">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <BrandLockup size="sm" />
            <span className="hidden rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 font-display text-[10px] font-black tracking-[0.25em] text-gold-300 sm:block">
              CONTROL ROOM
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {now && (
              <span className="hidden font-mono text-xs font-semibold tabular-nums text-zinc-400 md:block">
                {now.toLocaleTimeString()}
              </span>
            )}
            <StatusChip status={state?.status ?? "idle"} scheduledAt={state?.scheduledAt} />
            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">View channel</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {/* ── On Air panel ── */}
        <section className="rounded-2xl border border-white/8 bg-ink-900/70 p-5 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-display text-sm font-black tracking-[0.2em] text-zinc-400">
                <Radio className="h-4 w-4 text-gold-400" />
                ON AIR
              </h2>
              {current ? (
                <div className="mt-3 flex items-center gap-4">
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-ink-950">
                    {current.thumb ? (
                      <img src={current.thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Film className="h-5 w-5 text-zinc-600" />
                      </div>
                    )}
                    {isLive && (
                      <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-white">
                        <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" /> NOW
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold text-white">
                      {current.title}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                      {current.kind === "ad" ? "Advertisement" : "Main Content"} ·{" "}
                      {fmtDur(current.duration)} · program {entries.length > 0 ? (entries.findIndex((e) => e.id === current.id) + 1) : 0}/{entries.length}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-zinc-500">
                  {entries.length === 0
                    ? "No programs in the schedule yet — upload media and build the playlist."
                    : "Nothing is on air."}
                </p>
              )}
            </div>

            {/* Transport controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {!isLive && (
                <button
                  type="button"
                  disabled={entries.length === 0 || busyAction !== null}
                  onClick={() => void broadcast("go_live", { entryId: selectedStart || undefined })}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-red-500 to-red-700 px-5 py-3 font-display text-sm font-black tracking-[0.15em] text-white shadow-[0_4px_24px_rgba(239,68,68,0.35)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busyAction === "go_live" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  GO LIVE
                </button>
              )}
              {isLive && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void broadcast("pause")}
                  className="flex items-center gap-2 rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 font-display text-sm font-black tracking-[0.15em] text-gold-300 transition-all hover:bg-gold-500/20 disabled:opacity-50"
                >
                  {busyAction === "pause" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  PAUSE SCHEDULE
                </button>
              )}
              {isPaused && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void broadcast("resume")}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 px-4 py-3 font-display text-sm font-black tracking-[0.15em] text-ink-950 shadow-[0_4px_24px_rgba(245,179,1,0.35)] transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {busyAction === "resume" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  RESUME
                </button>
              )}
              <button
                type="button"
                disabled={entries.length === 0 || busyAction !== null}
                onClick={() => void broadcast("skip")}
                className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-3 font-display text-sm font-black tracking-[0.15em] text-zinc-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyAction === "skip" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SkipForward className="h-4 w-4" />
                )}
                SKIP NEXT
              </button>
            </div>
          </div>

          {/* Scheduling row */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-white/8 pt-4">
            <CalendarClock className="h-4 w-4 shrink-0 text-zinc-500" />
            <span className="text-xs font-bold tracking-wide text-zinc-500">
              {isScheduled && state?.scheduledAt
                ? `Scheduled to go live at ${new Date(state.scheduledAt).toLocaleString()}`
                : "Schedule the broadcast:"}
            </span>
            {!isLive && (
              <>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  min={new Date(Date.now() - 60000).toISOString().slice(0, 16)}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="rounded-lg border border-white/10 bg-ink-950/80 px-3 py-2 text-xs font-semibold text-zinc-200 outline-none [color-scheme:dark] focus:border-gold-400/70"
                />
                <select
                  value={selectedStart}
                  onChange={(e) => setStartEntryId(e.target.value)}
                  className="max-w-[220px] rounded-lg border border-white/10 bg-ink-950/80 px-3 py-2 text-xs font-semibold text-zinc-200 outline-none focus:border-gold-400/70"
                >
                  {entries.map((e, i) => (
                    <option key={e.id} value={e.id}>
                      {i + 1}. {e.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!scheduleAt || entries.length === 0 || busyAction !== null}
                  onClick={() => {
                    void broadcast("schedule", { at: new Date(scheduleAt).toISOString(), entryId: selectedStart || undefined });
                    setScheduleAt("");
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3.5 py-2 text-xs font-black tracking-wide text-sky-300 transition-all hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busyAction === "schedule" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5" />
                  )}
                  SCHEDULE GO-LIVE
                </button>
                {isScheduled && (
                  <button
                    type="button"
                    onClick={() => void broadcast("cancel")}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    Cancel schedule
                  </button>
                )}
              </>
            )}
            {isLive && (
              <span className="text-xs font-medium text-zinc-500">
                The channel is looping the schedule automatically. Changes go live to every viewer within seconds.
              </span>
            )}
          </div>
        </section>

        {/* ── Two columns: Playlist + Library ── */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {/* Playlist builder */}
          <section className="rounded-2xl border border-white/8 bg-ink-900/70">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-sm font-black tracking-[0.2em] text-zinc-400">
                <ListVideo className="h-4 w-4 text-gold-400" />
                PLAY SEQUENCE
              </h2>
              <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold text-zinc-400">
                {entries.length} programs · {fmtDur(state?.totalDuration ?? 0)} loop
              </span>
            </div>
            <div className="p-4">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/12 py-14 text-center">
                  <ListVideo className="h-8 w-8 text-zinc-600" />
                  <p className="mt-3 text-sm font-semibold text-zinc-500">
                    Build the broadcast order here
                  </p>
                  <p className="mt-1 max-w-[240px] text-xs text-zinc-600">
                    Add programs from the media library, then drag to arrange the
                    continuous channel flow.
                  </p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {entries.map((e, i) => {
                    const isNow = e.id === state?.currentEntryId;
                    return (
                      <li
                        key={e.id}
                        draggable
                        onDragStart={(ev) => {
                          dragIdx.current = i;
                          setDragIdxState(i);
                          ev.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          dragIdx.current = null;
                          setDragIdxState(null);
                          setOverIdx(null);
                        }}
                        onDragOver={(ev) => {
                          ev.preventDefault();
                          if (overIdx !== i) setOverIdx(i);
                        }}
                        onDrop={(ev) => {
                          ev.preventDefault();
                          const from = dragIdx.current;
                          setOverIdx(null);
                          dragIdx.current = null;
                          setDragIdxState(null);
                          if (from === null || from === i) return;
                          const ids = entries.map((x) => x.id);
                          const [moved] = ids.splice(from, 1);
                          ids.splice(i, 0, moved);
                          void applyReorder(ids);
                        }}
                        className={`group flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                          isNow
                            ? "border-gold-400/60 bg-gold-400/8 shadow-[0_0_24px_rgba(245,179,1,0.12)]"
                            : "border-white/8 bg-ink-950/60 hover:border-white/20"
                        } ${dragIdxState === i ? "drag-ghost" : ""} ${overIdx === i && dragIdxState !== null && dragIdxState !== i ? "drag-over-ring" : ""}`}
                      >
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-600 group-hover:text-zinc-400" />
                        <span className={`w-6 shrink-0 text-center font-display text-sm font-black tabular-nums ${isNow ? "text-gold-300" : "text-zinc-500"}`}>
                          {i + 1}
                        </span>
                        <div className="relative h-11 w-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-ink-950">
                          {e.thumb ? (
                            <img src={e.thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              {e.kind === "ad" ? (
                                <Megaphone className="h-4 w-4 text-zinc-600" />
                              ) : (
                                <Film className="h-4 w-4 text-zinc-600" />
                              )}
                            </div>
                          )}
                          {isNow && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <span className="live-dot h-2 w-2 rounded-full bg-red-500" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-zinc-100">{e.title}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
                            <span
                              className={`rounded px-1.5 py-px text-[9px] font-black tracking-widest ${
                                e.kind === "ad"
                                  ? "bg-gold-400/15 text-gold-300"
                                  : "bg-white/8 text-zinc-400"
                              }`}
                            >
                              {e.kind === "ad" ? "AD" : "MAIN"}
                            </span>
                            {fmtDur(e.duration)}
                            {isNow && (
                              <span className="font-black tracking-widest text-gold-300">ON AIR</span>
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => move(-1, i)}
                            aria-label="Move up"
                            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(1, i)}
                            aria-label="Move down"
                            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          {isLive && (
                            <button
                              type="button"
                              title="Jump broadcast here"
                              onClick={() => void broadcast("set_entry", { entryId: e.id })}
                              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-black tracking-wider text-red-300 transition-colors hover:bg-red-500/15"
                            >
                              <Play className="h-3 w-3" /> START
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void removeEntry(e.id)}
                            aria-label="Remove from schedule"
                            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/15 hover:text-red-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {entries.length > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
                  <RotateCcw className="h-3 w-3" />
                  Continuous auto-loop — playback never stops while live.
                </p>
              )}
            </div>
          </section>

          {/* Media library */}
          <section className="rounded-2xl border border-white/8 bg-ink-900/70">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-sm font-black tracking-[0.2em] text-zinc-400">
                <Library className="h-4 w-4 text-gold-400" />
                MEDIA LIBRARY
              </h2>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 px-4 py-2 font-display text-xs font-black tracking-[0.12em] text-ink-950 shadow-[0_4px_16px_rgba(245,179,1,0.3)] transition-all hover:brightness-110"
              >
                <Upload className="h-3.5 w-3.5" />
                UPLOAD
              </button>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-4">
              {videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/12 py-14 text-center">
                  <Film className="h-8 w-8 text-zinc-600" />
                  <p className="mt-3 text-sm font-semibold text-zinc-500">Library is empty</p>
                  <p className="mt-1 max-w-[240px] text-xs text-zinc-600">
                    Upload your first program or advertisement clip to get started.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {videos.map((v) => (
                    <LibraryRow
                      key={v.id}
                      video={v}
                      inPlaylist={entries.some((e) => e.videoId === v.id)}
                      onAdd={() => void addEntry(v.id)}
                      onDelete={() => void deleteVideo(v)}
                      onRename={(t) => void updateVideo(v.id, { title: t })}
                      onKind={(k) => void updateVideo(v.id, { kind: k })}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold shadow-2xl backdrop-blur-md ${
            toast.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-950/90 text-emerald-200"
              : "border-red-500/30 bg-red-950/90 text-red-200"
          }`}
        >
          {toast.kind === "ok" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {toast.msg}
        </div>
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          notify("Media uploaded to the library.");
          void loadVideos();
        }}
      />
    </div>
  );
}

/* ────────────────────────── Sub-components ────────────────────────── */

function StatusChip({
  status,
  scheduledAt,
}: {
  status: "idle" | "scheduled" | "live" | "paused";
  scheduledAt?: string | null;
}) {
  if (status === "live")
    return (
      <span className="flex items-center gap-2 rounded-full bg-red-500/15 px-3.5 py-1.5 font-display text-[11px] font-black tracking-[0.2em] text-red-300">
        <span className="live-dot h-2 w-2 rounded-full bg-red-500" />
        LIVE
      </span>
    );
  if (status === "paused")
    return (
      <span className="flex items-center gap-2 rounded-full bg-gold-500/15 px-3.5 py-1.5 font-display text-[11px] font-black tracking-[0.2em] text-gold-300">
        <Pause className="h-3 w-3" />
        PAUSED
      </span>
    );
  if (status === "scheduled")
    return (
      <span className="flex items-center gap-2 rounded-full bg-sky-500/15 px-3.5 py-1.5 font-display text-[11px] font-black tracking-[0.2em] text-sky-300">
        <Clock className="h-3 w-3" />
        SCHEDULED {scheduledAt ? `· ${new Date(scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
      </span>
    );
  return (
    <span className="rounded-full bg-white/8 px-3.5 py-1.5 font-display text-[11px] font-black tracking-[0.2em] text-zinc-400">
      OFF AIR
    </span>
  );
}

function LibraryRow({
  video,
  inPlaylist,
  onAdd,
  onDelete,
  onRename,
  onKind,
}: {
  video: VideoMeta;
  inPlaylist: boolean;
  onAdd: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onKind: (kind: "main" | "ad") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(video.title);

  function commit() {
    const t = draft.trim();
    if (t && t !== video.title) onRename(t);
    else setDraft(video.title);
    setEditing(false);
  }

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-white/8 bg-ink-950/60 p-2.5 transition-colors hover:border-white/20">
      <div className="relative h-12 w-21 shrink-0 overflow-hidden rounded-md border border-white/10 bg-ink-950">
        {video.thumb ? (
          <img src={video.thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {video.kind === "ad" ? (
              <Megaphone className="h-4 w-4 text-zinc-600" />
            ) : (
              <Film className="h-4 w-4 text-zinc-600" />
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(video.title);
                  setEditing(false);
                }
              }}
              className="w-full rounded-md border border-gold-400/60 bg-ink-950 px-2 py-1 text-sm font-bold text-white outline-none"
            />
            <button type="button" onMouseDown={commit} className="rounded p-1 text-emerald-400 hover:bg-white/10">
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(video.title);
              setEditing(true);
            }}
            className="flex max-w-full items-center gap-1.5 text-left"
            title="Rename"
          >
            <span className="truncate text-sm font-bold text-zinc-100">{video.title}</span>
            <Pencil className="h-3 w-3 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
          <span
            className={`rounded px-1.5 py-px text-[9px] font-black tracking-widest ${
              video.kind === "ad" ? "bg-gold-400/15 text-gold-300" : "bg-white/8 text-zinc-400"
            }`}
          >
            {video.kind === "ad" ? "ADVERTISEMENT" : "MAIN CONTENT"}
          </span>
          {fmtDur(video.duration)}
          <span>·</span>
          {fmtBytes(video.sizeBytes)}
          {inPlaylist && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3" /> in schedule
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <select
          value={video.kind}
          onChange={(e) => onKind(e.target.value as "main" | "ad")}
          aria-label="Media type"
          className="mr-1 rounded-md border border-white/10 bg-ink-950 px-1.5 py-1 text-[10px] font-bold text-zinc-400 outline-none focus:border-gold-400/60"
        >
          <option value="main">Main</option>
          <option value="ad">Ad</option>
        </select>
        <button
          type="button"
          onClick={onAdd}
          title="Add to schedule"
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-gold-400/15 hover:text-gold-300"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/15 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
