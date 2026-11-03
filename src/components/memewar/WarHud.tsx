// src/components/memewar/WarHud.tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Timer } from "lucide-react";
import type { SeasonInfo, WarHolding } from "@/lib/memewar/types";
import { CoinLogo, fmtAmount } from "./CoinLogo";

export function DominanceMeter({ top, pct }: { top: WarHolding | null; pct: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-muted-foreground">
        <span>Your army</span>
        <span className="text-foreground">{top ? `${pct.toFixed(1)}% ${top.coin.symbol}` : "No troops"}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-destructive to-primary"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {pct >= 99.5 ? "Total domination. One coin rules your board." : "Merge weaker coins into your champion to reach 100%."}
      </p>
    </div>
  );
}

function useCountdown(to: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, to - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SeasonBar({ season }: { season: SeasonInfo | null }) {
  const left = useCountdown(season?.endsAt ?? Date.now());
  const ranking = season?.ranking ?? [];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2 text-[11px] font-black uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Timer className="h-3.5 w-3.5 text-destructive" /> Season ends
        </span>
        <span className="tabular-nums text-foreground">{season ? left : "…"}</span>
        {season?.previousWinner && (
          <span className="flex items-center gap-1 text-primary">
            <Crown className="h-3.5 w-3.5" /> {season.previousWinner.symbol}
          </span>
        )}
      </div>
      <div className="war-ticker overflow-hidden rounded-xl border border-border bg-card py-1.5" aria-label="Global war ranking">
        {ranking.length === 0 ? (
          <div className="px-3 text-[11px] font-bold text-muted-foreground">No battles yet this season — strike first.</div>
        ) : (
          <div className="war-ticker-track flex w-max gap-5 px-3">
            {[...ranking, ...ranking].map((r, i) => (
              <span key={`${r.master}-${i}`} className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-black">
                <span className="text-muted-foreground">#{(i % ranking.length) + 1}</span>
                <CoinLogo image={r.image} symbol={r.symbol} className="h-4 w-4" />
                <span className="text-foreground">{r.symbol}</span>
                <span className="text-primary">{fmtAmount(r.points)} pts</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {season?.mode === "mock" && (
        <p className="text-center text-[10px] text-muted-foreground">Preview ranking — live ranking starts once battles are recorded.</p>
      )}
    </div>
  );
}
