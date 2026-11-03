// src/components/memewar/CoinLogo.tsx
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Jetton logo with fallback chain: proxied preview → raw metadata → initials badge. */
export function CoinLogo({
  image,
  imageRaw,
  symbol,
  className,
}: {
  image: string | null;
  imageRaw?: string | null;
  symbol: string;
  className?: string;
}) {
  const sources = [image, imageRaw].filter((s, i, a): s is string => Boolean(s) && a.indexOf(s) === i);
  const [idx, setIdx] = useState(0);
  const src = sources[idx];
  if (!src) {
    let h = 0;
    for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 360;
    return (
      <div
        className={cn("flex items-center justify-center rounded-full font-black text-foreground", className)}
        style={{ background: `linear-gradient(135deg, hsl(${h} 70% 35%), hsl(${(h + 40) % 360} 70% 18%))` }}
        aria-label={symbol}
      >
        <span className="text-[0.7em]">{symbol.slice(0, 3)}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`${symbol} logo`}
      loading="lazy"
      draggable={false}
      onError={() => setIdx((i) => i + 1)}
      className={cn("rounded-full bg-muted object-cover", className)}
    />
  );
}

export function fmtAmount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

export function fmtUsd(n: number): string {
  if (!(n > 0)) return "$—";
  if (n >= 1000) return `$${fmtAmount(n)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(2)}`;
}
