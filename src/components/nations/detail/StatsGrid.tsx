// src/components/nations/detail/StatsGrid.tsx
import type { NationDetails } from "../use-nations-panel";

export function StatsGrid({ selected }: { selected: NationDetails }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
        <div className="text-[0.65rem] uppercase tracking-wider text-zinc-500">
          Total Glory
        </div>
        <div className="mt-0.5 text-sm font-black text-white">
          {selected.totalGlory.toLocaleString()}
        </div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
        <div className="text-[0.65rem] uppercase tracking-wider text-zinc-500">
          Members
        </div>
        <div className="mt-0.5 text-sm font-black text-white">
          {selected.memberCount}
        </div>
      </div>
    </div>
  );
}
