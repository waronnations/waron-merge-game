// src/components/nations/detail/DetailHeader.tsx
import { X } from "lucide-react";
import { getReputationTier } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { TraitorBadge } from "../badges";
import type { NationDetails } from "../use-nations-panel";

export function DetailHeader({
  selected,
  setSelected,
}: {
  selected: NationDetails;
  setSelected: (v: NationDetails | null) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-zinc-900 text-3xl">
          {selected.emblem || "🏳️"}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-black text-white">
              {selected.name}
            </h3>
            {selected.leader?.isTraitor && <TraitorBadge />}
          </div>
          <div className="text-xs text-zinc-400">
            [{selected.tag}] · {selected.memberCount} members
          </div>
          {typeof selected.reputation === "number" && (
            <div
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-black uppercase",
                getReputationTier(selected.reputation).bg,
                getReputationTier(selected.reputation).color,
              )}
            >
              {getReputationTier(selected.reputation).tier} ·{" "}
              {selected.reputation} Rep
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => setSelected(null)}
        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
