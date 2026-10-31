"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowLeft, ShieldCheck } from "lucide-react";
import { BrandLockup } from "@/components/brand/Logo";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/admin/dashboard");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Invalid operator credentials.");
    } catch {
      setError("Could not reach the control room.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center bg-cover bg-center px-4"
      style={{ backgroundImage: "url(/images/ident.jpg)" }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative w-full max-w-sm">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-6 flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to channel
        </button>

        <div className="rounded-2xl border border-white/10 bg-ink-900/85 p-7 shadow-[0_20px_80px_rgba(0,0,0,0.7)] backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <BrandLockup size="md" tagline />
            <div className="mt-6 flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.22em] text-gold-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              CONTROL ROOM ACCESS
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-400">
                OPERATOR EMAIL
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@channel.tv"
                  className="w-full rounded-lg border border-white/10 bg-ink-950/80 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-gold-400/70"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wide text-zinc-400">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full rounded-lg border border-white/10 bg-ink-950/80 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-gold-400/70"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 py-2.5 font-display text-sm font-bold tracking-[0.15em] text-ink-950 shadow-[0_4px_20px_rgba(245,179,1,0.35)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "AUTHENTICATING…" : "ENTER CONTROL ROOM"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] font-medium tracking-wide text-zinc-500">
          Restricted area · authorized operators only
        </p>
      </div>
    </div>
  );
}
