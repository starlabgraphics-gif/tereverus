import { useId } from "react";

/**
 * Tereverus TV brand mark — gold TV with antennas, play button and swoosh.
 * Vector so it stays crisp at any overlay size.
 */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  const uid = useId().replace(/[:]/g, "");
  const gold = `gold-${uid}`;
  return (
    <svg viewBox="0 0 72 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.42" stopColor="#f5b301" />
          <stop offset="1" stopColor="#9a6a00" />
        </linearGradient>
      </defs>
      {/* antennas */}
      <line x1="30" y1="17" x2="18" y2="6" stroke={`url(#${gold})`} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="16" cy="5" r="4" fill={`url(#${gold})`} />
      <line x1="44" y1="17" x2="56" y2="6" stroke={`url(#${gold})`} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="58" cy="5" r="4" fill={`url(#${gold})`} />
      {/* body */}
      <rect x="9" y="16" width="54" height="37" rx="10" fill="none" stroke={`url(#${gold})`} strokeWidth="6" />
      {/* play */}
      <path d="M30 26.5 L48 34.5 L30 42.5 Z" fill={`url(#${gold})`} />
      {/* swoosh */}
      <path
        d="M3 47 C 20 59, 54 57, 69 38"
        fill="none"
        stroke={`url(#${gold})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <span className="font-display font-black tracking-tight bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
        TEREVERUS
      </span>
      <span className="rounded-[0.22em] bg-gradient-to-b from-gold-200 via-gold-400 to-gold-600 px-[0.32em] py-[0.06em] font-display font-black leading-none text-ink-950 shadow-[0_1px_6px_rgba(245,179,1,0.4)]">
        TV
      </span>
    </span>
  );
}

interface BrandLockupProps {
  size?: "sm" | "md" | "lg" | "xl";
  tagline?: boolean;
  className?: string;
}

const SIZES = {
  sm: { mark: "h-7 w-7", word: "text-base", gap: "gap-2", tag: "text-[8px] tracking-[0.32em]" },
  md: { mark: "h-10 w-10", word: "text-xl", gap: "gap-2.5", tag: "text-[9px] tracking-[0.38em]" },
  lg: { mark: "h-14 w-14", word: "text-3xl", gap: "gap-3.5", tag: "text-[11px] tracking-[0.42em]" },
  xl: { mark: "h-20 w-20", word: "text-5xl", gap: "gap-4", tag: "text-sm tracking-[0.5em]" },
};

export function BrandLockup({ size = "md", tagline = false, className = "" }: BrandLockupProps) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <LogoMark className={s.mark} />
      <div className="leading-none">
        <Wordmark className={s.word} />
        {tagline && (
          <div className={`mt-1.5 font-semibold uppercase text-zinc-400 ${s.tag}`}>
            Inspire <span className="text-gold-400">·</span> Inform{" "}
            <span className="text-gold-400">·</span> Entertain
          </div>
        )}
      </div>
    </div>
  );
}
