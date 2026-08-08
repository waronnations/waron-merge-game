// src/components/nuke/NationTargetGrid.tsx
import { Loader2, Shield } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

export interface NationRow {
  id: number;
  name: string;
  tag: string;
  emblem: string;
  isDefault?: boolean;
  memberCount?: number;
  reputation?: number;
  lastNukeLaunchedAt?: string | null;
  nukesOwnedTotal?: number;
  timesNuked?: number;
  isProtected?: boolean;
}

export function NationTargetGrid({
  filtered,
  loadingNations,
  search,
  setSearch,
  selectedId,
  setSelectedId,
  setLastResult,
}: {
  filtered: NationRow[];
  loadingNations: boolean;
  search: string;
  setSearch: (v: string) => void;
  selectedId: number | null;
  setSelectedId: (id: number) => void;
  setLastResult: (v: null) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">Select target</h3>
        <span className="text-xs text-zinc-500">{filtered.length} nations</span>
      </div>
      <input
        type="text"
        placeholder="Search nation..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
      />
      {loadingNations ? (
        <div className="flex h-40 items-center justify-center text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
          {filtered.map((n) => {
            const active = selectedId === n.id;
            const arsenal = Number(n.nukesOwnedTotal ?? 0);
            const hits = Number(n.timesNuked ?? 0);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setSelectedId(n.id);
                  setLastResult(null);
                  haptic("light");
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-all",
                  active
                    ? "scale-[1.03] border-white/50 bg-white/10"
                    : n.isProtected
                      ? "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                      : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600",
                )}
              >
                <span className="text-2xl leading-none">{n.emblem}</span>
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-zinc-200">
                  {n.name}
                </span>
                <span className="text-[9px] text-zinc-500">{n.tag}</span>
                <div className="flex flex-wrap justify-center gap-1">
                  {n.isProtected && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                      <Shield className="h-2.5 w-2.5" />
                      24h
                    </span>
                  )}
                  {arsenal > 0 && (
                    <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold text-zinc-300">
                      ☢ {arsenal}
                    </span>
                  )}
                  {hits > 0 && (
                    <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                      💥 {hits}×
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
