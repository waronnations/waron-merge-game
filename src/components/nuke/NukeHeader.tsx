// src/components/nuke/NukeHeader.tsx
import { Bomb, Skull } from "lucide-react";
import { TERRORIST_THRESHOLD } from "@/lib/constants";

export function NukeHeader({
  owned,
  isTerrorist,
  totalLaunched,
}: {
  owned: number;
  isTerrorist: boolean;
  totalLaunched: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <Bomb className="h-5 w-5" />
            <span className="font-bold tracking-wide">STRATEGIC NUKES</span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Buy in Shop · Strike real nations · Value goes to their vault
          </p>
        </div>
        {isTerrorist && (
          <div className="flex items-center gap-1.5 rounded-full border border-zinc-600 bg-zinc-950 px-3 py-1 text-xs font-bold text-red-300">
            <Skull className="h-3.5 w-3.5" />
            TERRORIST
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-zinc-950 py-2.5">
          <div className="text-2xl font-black text-white">{owned}</div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Owned
          </div>
        </div>
        <div className="rounded-xl bg-zinc-950 py-2.5">
          <div className="text-2xl font-black text-white">{totalLaunched}</div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Lifetime hits
          </div>
        </div>
      </div>

      {totalLaunched > 0 && totalLaunched < TERRORIST_THRESHOLD && (
        <p className="mt-3 text-center text-[11px] text-zinc-500">
          {TERRORIST_THRESHOLD - totalLaunched} more until Terrorist status
        </p>
      )}
    </div>
  );
}
