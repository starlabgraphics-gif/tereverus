"use client";

import { useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  Film,
  Megaphone,
  X,
  FileVideo,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

interface Meta {
  duration: number;
  thumb: string | null;
}

function extractMeta(file: File): Promise<Meta> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    let done = false;
    const timer = setTimeout(() => finish(0, null), 15000);
    const finish = (duration: number, thumb: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve({ duration, thumb });
    };
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      if (d <= 0) {
        finish(0, null);
        return;
      }
      video.onseeked = () => {
        try {
          const w = 320;
          const h = 180;
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (ctx && vw && vh) {
            const scale = Math.max(w / vw, h / vh);
            const sw = w / scale;
            const sh = h / scale;
            ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
            finish(d, canvas.toDataURL("image/jpeg", 0.72));
            return;
          }
        } catch {
          /* thumbnail is optional */
        }
        finish(d, null);
      };
      video.currentTime = Math.min(2, d / 2);
    };
    video.onerror = () => finish(0, null);
    video.src = url;
  });
}

export function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export function fmtDur(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"main" | "ad">("main");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setTitle("");
      setKind("main");
      setMeta(null);
      setScanning(false);
      setProgress(null);
      setError(null);
      setDragging(false);
    }
  }, [open]);

  if (!open) return null;

  async function acceptFile(f: File) {
    const ok =
      /\.(mp4|webm|m4v|ogv)$/i.test(f.name) ||
      f.type.startsWith("video/");
    if (!ok) {
      setError("Unsupported format — upload MP4 or WebM files.");
      return;
    }
    setError(null);
    setFile(f);
    setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    setMeta(null);
    setScanning(true);
    const m = await extractMeta(f);
    setMeta(m);
    setScanning(false);
  }

  function upload() {
    if (!file) return;
    setError(null);
    setProgress(0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title.trim() || file.name);
    fd.append("kind", kind);
    fd.append("duration", String(meta?.duration ?? 0));
    if (meta?.thumb) fd.append("thumbnail", meta.thumb);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/videos");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onUploaded();
        onClose();
      } else {
        const body = JSON.parse(xhr.responseText || "{}");
        setError(body.error ?? "Upload failed.");
        setProgress(null);
      }
    };
    xhr.onerror = () => {
      setError("Network error during upload.");
      setProgress(null);
    };
    xhr.send(fd);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.8)]">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-black tracking-wide text-white">
              UPLOAD MEDIA
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              MP4 or WebM · main content or advertisement clips
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void acceptFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragging
              ? "border-gold-400 bg-gold-400/10"
              : "border-white/15 bg-ink-950/60 hover:border-gold-400/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,.mp4,.webm,.m4v,.ogv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void acceptFile(f);
              e.target.value = "";
            }}
          />
          <UploadCloud className={`h-9 w-9 ${dragging ? "text-gold-300" : "text-zinc-500"}`} />
          {file ? (
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-white">
              <FileVideo className="h-4 w-4 text-gold-400" />
              <span className="max-w-[220px] truncate">{file.name}</span>
              <span className="text-xs font-medium text-zinc-500">
                {fmtBytes(file.size)}
              </span>
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm font-semibold text-zinc-300">
                Drop a video here or click to browse
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Duration and a thumbnail are detected automatically
              </p>
            </>
          )}
        </div>

        {file && (
          <>
            {meta?.thumb && (
              <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                <img src={meta.thumb} alt="Preview" className="h-36 w-full object-cover" />
              </div>
            )}
            {scanning && (
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin text-gold-400" />
                Analyzing video…
              </div>
            )}
            {meta && !scanning && (
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Duration {fmtDur(meta.duration)}
                {meta.thumb ? " · thumbnail captured" : " · no thumbnail available"}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-400">
                  PROGRAM TITLE
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Morning News Bulletin"
                  className="w-full rounded-lg border border-white/10 bg-ink-950/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-gold-400/70"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-400">
                  MEDIA TYPE
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKind("main")}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold transition-all ${
                      kind === "main"
                        ? "border-gold-400 bg-gold-400/15 text-gold-200"
                        : "border-white/10 bg-ink-950/60 text-zinc-400 hover:border-white/25"
                    }`}
                  >
                    <Film className="h-4 w-4" />
                    Main Content
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind("ad")}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold transition-all ${
                      kind === "ad"
                        ? "border-gold-400 bg-gold-400/15 text-gold-200"
                        : "border-white/10 bg-ink-950/60 text-zinc-400 hover:border-white/25"
                    }`}
                  >
                    <Megaphone className="h-4 w-4" />
                    Advertisement
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium text-zinc-500">
            {progress !== null ? `Uploading… ${progress}%` : "Files are stored on the channel server"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!file || progress !== null || scanning}
              onClick={upload}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 px-5 py-2 font-display text-sm font-bold tracking-wide text-ink-950 shadow-[0_4px_20px_rgba(245,179,1,0.3)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {progress !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress}%
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>

        {progress !== null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
