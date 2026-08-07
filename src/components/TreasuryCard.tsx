// src/components/TreasuryCard.tsx
// Live Claim Treasury health. Purely presentational — all numbers come from
// the server (src/lib/treasury.server.ts). Refreshes when it becomes visible.
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Activity, Loader2 } from "lucide-react";
import {
  getTreasuryHealthFn,
  type TreasurySnapshot,
} from "@/lib/treasury.functions";
import { cn } from "@/lib/utils";

const ZONE_UI: Record<
  TreasurySnapshot["zone"],
  { label: string; text: string; bar: string; ring: string }
> = {
  green: {
    label: "Healthy",
    text: "text-emerald-400",
    bar: "bg-emerald-500",
    ring: "border-emerald-500/30",
  },
  yellow: {
    label: "Tightening",
    text: "text-amber-400",
    bar: "bg-amber-500",
    ring: "border-amber-500/30",
  },
  red: {
    label: "Strained",
    text: "text-red-400",
    bar: "bg-red-500",
    ring: "border-red-500/40",
  },
  critical: {
    label: "Critical",
    text: "text-red-300",
    bar: "bg-red-600",
    ring: "border-red-600/60",
  },
};

export function TreasuryCard({ className }: { className?: string }) {
  const [snap, setSnap] = useState<TreasurySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const res = await getTreasuryHealthFn();
      setSnap(res);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void load();
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const zone = snap ? ZONE_UI[snap.zone] : ZONE_UI.green;
  // Bar fills at HR 2.0 = 100%.
  const fill = snap ? Math.min(100, (snap.healthRatio / 2) * 100) : 0;

  return (
    <div
      ref={boxRef}
      className={cn(
        "rounded-2xl border bg-zinc-900 p-4",
        snap ? zone.ring : "border-zinc-700",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
          <ShieldCheck className="h-4 w-4 text-red-500" />
          Treasury Health
        </h3>
        {loading && !snap ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
        ) : snap ? (
          <span
            className={cn(
              "rounded-lg bg-black/40 px-2 py-1 text-[0.6rem] font-black uppercase tracking-widest",
              zone.text,
            )}
          >
            {zone.label}
          </span>
        ) : null}
      </div>

      {!snap ? (
        <p className="text-[0.7rem] text-zinc-500">
          Treasury desk offline — reopen the app to refresh.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className={cn("text-2xl font-black", zone.text)}>
                {snap.healthRatio.toFixed(2)}×
              </div>
              <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
                Health ratio
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-xl font-black text-white">
                <Activity className="h-4 w-4 text-red-500" />
                {snap.taxMultiplier.toFixed(2)}×
              </div>
              <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
                Live fee multiplier
              </div>
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-950">
            <div
              className={cn("h-full rounded-full transition-all", zone.bar)}
              style={{ width: `${fill}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Cell label="$WARDOG pool" value={snap.balanceWardog} />
            <Cell label="$WARCAT pool" value={snap.balanceWarcat} />
            <Cell label="Owed to players" value={snap.totalClaimable} />
          </div>

          <p className="mt-3 text-[0.65rem] leading-relaxed text-zinc-500">
            The treasury backs every claimable token. When the pool thins, in-game
            fees (shop, energy recovery, donations, nation sales) rise up to 5× and
            the surplus refills it — so claims can never run dry.{" "}
            <span className={zone.text}>{snap.zoneNote}</span>
          </p>
        </>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-950 p-2">
      <div className="truncate text-sm font-black text-white">
        {Math.round(value).toLocaleString()}
      </div>
      <div className="text-[0.55rem] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  );
}
