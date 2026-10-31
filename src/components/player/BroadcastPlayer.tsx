"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Radio,
  Clock,
} from "lucide-react";
import { BrandLockup } from "@/components/brand/Logo";

type Entry = {
  id: string;
  videoId: string;
  title: string;
  kind: "main" | "ad";
  duration: number;
  src: string;
  thumb: string | null;
};

type BroadcastState = {
  status: "idle" | "scheduled" | "live" | "paused";
  currentEntryId: string | null;
  scheduledAt: string | null;
  entries: Entry[];
  totalDuration: number;
  loop: boolean;
};

async function fetchState(): Promise<BroadcastState | null> {
  try {
    const res = await fetch("/api/broadcast", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as BroadcastState;
  } catch {
    return null;
  }
}

/**
 * Tereverus TV — public broadcast player.
 * No scrubber, no seek, no play/pause: it behaves like a real TV channel.
 * Viewers only get volume + fullscreen. The control room drives everything.
 */
export default function BroadcastPlayer() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadRef = useRef<HTMLVideoElement>(null);

  const [ui, setUi] = useState<BroadcastState | null>(null);
  const uiRef = useRef<BroadcastState | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const failuresRef = useRef<Record<string, number>>({});
  const advancingRef = useRef(false);

  const [splash, setSplash] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [signalLost, setSignalLost] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clicksRef = useRef<{ n: number; last: number }>({ n: 0, last: 0 });

  // ── Secret: 4 clicks on the channel logo opens the control room ──
  const secretClick = useCallback(() => {
    const now = Date.now();
    const c = clicksRef.current;
    c.n = now - c.last < 2500 ? c.n + 1 : 1;
    c.last = now;
    if (c.n >= 4) {
      c.n = 0;
      router.push("/admin/login");
    }
  }, [router]);

  const pokeUi = useCallback(() => {
    setShowBar(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowBar(false), 3800);
  }, []);

  // ── Poll the control room ──
  const refresh = useCallback(async (immediate = false) => {
    const s = await fetchState();
    if (!s) return;
    uiRef.current = s;
    setUi(s);
    void immediate;
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  // ── Keep a preload of the next item for seamless transitions ──
  const primeNext = useCallback(() => {
    const s = uiRef.current;
    const v = videoRef.current;
    const p = preloadRef.current;
    if (!s || !v || !p || s.entries.length === 0) return;
    if (!v.duration || v.duration - v.currentTime > 6) return;
    const idx = s.entries.findIndex((e) => e.id === currentIdRef.current);
    const next = idx === -1 ? null : s.entries[(idx + 1) % s.entries.length];
    if (next && p.getAttribute("src") !== next.src) {
      p.src = next.src;
      p.load();
    }
  }, []);

  // ── When the current item finishes: hand the baton to the control room ──
  const reportEnded = useCallback(
    async (entryId: string, failed: boolean) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      try {
        await fetch("/api/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: failed ? "failed" : "ended", entryId }),
        });
        await refresh(true);
      } finally {
        advancingRef.current = false;
      }
    },
    [refresh],
  );

  const onVideoError = useCallback(() => {
    const id = currentIdRef.current;
    if (!id || !uiRef.current || uiRef.current.status !== "live") return;
    failuresRef.current[id] = (failuresRef.current[id] ?? 0) + 1;
    if (failuresRef.current[id] >= 3) {
      setSignalLost(true);
      return;
    }
    void reportEnded(id, true);
  }, [reportEnded]);

  // ── Sync effect: react to control-room state ──
  useEffect(() => {
    const s = ui;
    const v = videoRef.current;
    if (!s || !v) return;
    setSignalLost(false);

    if (s.status === "idle" || s.status === "scheduled") {
      v.pause();
      v.removeAttribute("src");
      v.load();
      currentIdRef.current = null;
      return;
    }

    const entry = s.entries.find((e) => e.id === s.currentEntryId);

    if (s.status === "paused") {
      if (currentIdRef.current) v.pause();
      return;
    }

    // live
    if (!entry) {
      v.pause();
      v.removeAttribute("src");
      v.load();
      currentIdRef.current = null;
      return;
    }
    if (splash || blocked) return; // wait for the user's first tap

    if (entry.id !== currentIdRef.current) {
      currentIdRef.current = entry.id;
      failuresRef.current[entry.id] = 0;
      v.src = entry.src;
      v.load();
      v.play().catch(() => setBlocked(true));
    } else if (v.paused) {
      v.play().catch(() => setBlocked(true));
    }
  }, [ui, splash, blocked]);

  // ── Autoplay blocked → show the tap-to-start hint ──
  useEffect(() => {
    if (!blocked) return;
    const v = videoRef.current;
    const attempt = () => {
      v?.play()
        .then(() => setBlocked(false))
        .catch(() => {});
    };
    const t = setTimeout(attempt, 1500);
    return () => clearTimeout(t);
  }, [blocked]);

  // ── Volume / mute / fullscreen ──
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.volume = volume;
      v.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "m" || e.key === "M") setMuted((m) => !m);
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMuted(false);
        setVolume((x) => Math.min(1, Math.round((x + 0.1) * 10) / 10));
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setVolume((x) => Math.max(0, Math.round((x - 0.1) * 10) / 10));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  // ── Derived UI ──
  const entry =
    ui?.entries.find((e) => e.id === ui.currentEntryId) ?? null;
  const idx = entry && ui ? ui.entries.findIndex((e) => e.id === entry.id) : -1;
  const nextEntry =
    entry && ui && ui.entries.length > 1
      ? ui.entries[(idx + 1) % ui.entries.length]
      : null;

  const onAir = ui?.status === "live" && !splash && !blocked && !signalLost && Boolean(entry);
  const offAir =
    ui !== null && (ui.status === "idle" || ui.status === "scheduled" || (ui.status === "live" && !entry));
  const pausedScreen = ui?.status === "paused" && !splash;

  const startBroadcast = useCallback(() => {
    setSplash(false);
    setMuted(false);
    const v = videoRef.current;
    if (v) v.play().catch(() => {});
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-dvh w-full select-none overflow-hidden bg-black"
      onMouseMove={pokeUi}
      onTouchStart={pokeUi}
      style={{ cursor: onAir && !showBar ? "none" : "default" }}
    >
      {/* Video surface */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-contain"
        playsInline
        autoPlay
        onEnded={() => {
          const id = currentIdRef.current;
          if (id) void reportEnded(id, false);
        }}
        onError={onVideoError}
        onTimeUpdate={primeNext}
        onPlaying={() => {
          const id = currentIdRef.current;
          if (id) failuresRef.current[id] = 0;
        }}
      />
      {/* Hidden buffer for the next item — keeps transitions seamless */}
      <video ref={preloadRef} className="hidden" preload="auto" playsInline muted />

      {/* ── Channel logo overlay (top-left) ── */}
      {!splash && !signalLost && (
        <button
          type="button"
          onClick={secretClick}
          aria-label="Tereverus TV"
          className="absolute left-4 top-4 z-30 cursor-default rounded-lg bg-black/35 p-2 backdrop-blur-[2px] transition-opacity duration-500 sm:left-5 sm:top-5"
          style={{ opacity: showBar ? 1 : 0.85 }}
        >
          <BrandLockup size="sm" />
        </button>
      )}

      {/* ── ON AIR / status chip (top-right) ── */}
      {!splash && !signalLost && (
        <div
          className="absolute right-4 top-4 z-30 transition-opacity duration-500 sm:right-5 sm:top-5"
          style={{ opacity: showBar ? 1 : 0.9 }}
        >
          {ui?.status === "live" && (
            <span className="flex items-center gap-2 rounded-md bg-black/45 px-3 py-1.5 font-display text-xs font-bold tracking-[0.2em] text-white backdrop-blur-[2px]">
              <span className="live-dot h-2 w-2 rounded-full bg-red-500" />
              ON AIR
            </span>
          )}
          {ui?.status === "paused" && (
            <span className="flex items-center gap-2 rounded-md bg-black/45 px-3 py-1.5 font-display text-xs font-bold tracking-[0.2em] text-gold-300 backdrop-blur-[2px]">
              <Clock className="h-3.5 w-3.5" />
              PAUSED
            </span>
          )}
          {ui?.status === "scheduled" && (
            <span className="flex items-center gap-2 rounded-md bg-black/45 px-3 py-1.5 font-display text-xs font-bold tracking-[0.2em] text-sky-300 backdrop-blur-[2px]">
              <Clock className="h-3.5 w-3.5" />
              GOING LIVE {ui.scheduledAt ? formatTime(ui.scheduledAt) : "SOON"}
            </span>
          )}
          {ui?.status === "idle" && (
            <span className="rounded-md bg-black/45 px-3 py-1.5 font-display text-xs font-bold tracking-[0.2em] text-zinc-400 backdrop-blur-[2px]">
              OFF AIR
            </span>
          )}
        </div>
      )}

      {/* ── Bottom control bar: volume + fullscreen only, no scrubber ── */}
      {onAir && (
        <div
          className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-4 pt-14 transition-all duration-500 sm:px-6"
          style={{
            opacity: showBar ? 1 : 0,
            transform: showBar ? "translateY(0)" : "translateY(8px)",
            pointerEvents: showBar ? "auto" : "none",
          }}
        >
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                {entry?.kind === "ad" && (
                  <span className="shrink-0 rounded bg-gold-400/90 px-1.5 py-0.5 font-display text-[10px] font-black tracking-widest text-ink-950">
                    AD
                  </span>
                )}
                <h1 className="truncate font-display text-lg font-bold text-white text-shadow-strong sm:text-xl">
                  {entry?.title}
                </h1>
              </div>
              {nextEntry && (
                <p className="mt-0.5 truncate text-xs font-medium text-zinc-400">
                  Up next · {nextEntry.title}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className="text-zinc-300 transition-colors hover:text-white"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    setMuted(false);
                    setVolume(Number(e.target.value));
                  }}
                  aria-label="Volume"
                  className="range-gold w-20 sm:w-28"
                  style={{ ["--fill" as string]: `${(muted ? 0 : volume) * 100}%` }}
                />
              </div>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Full screen"
                className="rounded-md bg-white/5 p-2 text-zinc-300 transition-colors hover:text-white"
              >
                {isFullscreen ? (
                  <Minimize className="h-5 w-5" />
                ) : (
                  <Maximize className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tap-to-start (satisfies browser autoplay policy) ── */}
      {splash && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-cover bg-center px-6" style={{ backgroundImage: "url(/images/ident.jpg)" }}>
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative flex flex-col items-center text-center">
            <div className="slow-glow">
              <BrandLockup size="xl" tagline />
            </div>
            <button
              type="button"
              onClick={startBroadcast}
              className="group mt-10 flex items-center gap-3 rounded-full border border-gold-400/60 bg-gold-400/10 px-8 py-3.5 font-display text-sm font-bold tracking-[0.25em] text-gold-200 transition-all hover:bg-gold-400 hover:text-ink-950"
            >
              <Radio className="h-4 w-4" />
              TAP TO TUNE IN
            </button>
            <p className="mt-4 text-xs font-medium tracking-wide text-zinc-400">
              Live broadcast · audio on
            </p>
          </div>
        </div>
      )}

      {/* ── Autoplay blocked nudge ── */}
      {blocked && !splash && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <button
            type="button"
            onClick={() => {
              const v = videoRef.current;
              v?.play().then(() => setBlocked(false)).catch(() => {});
            }}
            className="rounded-full border border-gold-400/60 bg-gold-400/10 px-8 py-3.5 font-display text-sm font-bold tracking-[0.25em] text-gold-200 transition-all hover:bg-gold-400 hover:text-ink-950"
          >
            TAP TO RESUME
          </button>
        </div>
      )}

      {/* ── Broadcast paused by control room ── */}
      {pausedScreen && !signalLost && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-ink-950/92 px-6 backdrop-blur-sm">
          <BrandLockup size="lg" tagline className="opacity-90" />
          <div className="mt-8 flex items-center gap-3 rounded-full border border-gold-500/40 bg-gold-500/10 px-6 py-2.5 font-display text-sm font-bold tracking-[0.3em] text-gold-300">
            <Clock className="h-4 w-4" />
            BROADCAST PAUSED
          </div>
          <p className="mt-4 text-sm text-zinc-500">The control room will resume shortly.</p>
        </div>
      )}

      {/* ── Off air / standby ── */}
      {offAir && !splash && !signalLost && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-cover bg-center px-6" style={{ backgroundImage: "url(/images/ident.jpg)" }}>
          <div className="absolute inset-0 bg-black/55" />
          <div className="relative flex flex-col items-center text-center">
            <div className="slow-glow">
              <BrandLockup size="xl" tagline />
            </div>
            <div className="mt-8 rounded-full border border-zinc-600/50 bg-black/50 px-6 py-2.5 font-display text-sm font-bold tracking-[0.35em] text-zinc-300">
              {ui?.status === "scheduled" ? (
                <span className="flex items-center gap-3 text-sky-300">
                  <Clock className="h-4 w-4" />
                  GOING LIVE {ui.scheduledAt ? formatTime(ui.scheduledAt) : "SOON"}
                </span>
              ) : ui && ui.entries.length > 0 ? (
                "OFF AIR · TUNE IN SHORTLY"
              ) : (
                "OFF AIR · NO PROGRAM SCHEDULED"
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Signal lost (repeated media errors) ── */}
      {signalLost && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-ink-950 px-6 text-center">
          <Radio className="h-10 w-10 text-red-500" />
          <div className="mt-6 font-display text-2xl font-black tracking-[0.2em] text-white">
            SIGNAL LOST
          </div>
          <p className="mt-2 max-w-sm text-sm text-zinc-500">
            The stream could not be played. The control room has been notified —
            this screen will recover automatically.
          </p>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
