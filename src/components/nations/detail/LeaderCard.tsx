// src/components/nations/detail/LeaderCard.tsx
import { Crown } from "lucide-react";
import { TraitorBadge } from "../badges";
import type { NationDetails } from "../use-nations-panel";

export function LeaderCard({ selected }: { selected: NationDetails }) {
  if (!selected.leader) return null;
  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
      <div className="text-[0.65rem] uppercase tracking-wider text-zinc-500">
        Leader
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-sm font-bold text-white">
        <Crown className="h-3.5 w-3.5 text-amber-400" />
        {selected.leader.username
          ? `@${selected.leader.username}`
          : selected.leader.firstName ||
            `#${selected.leader.userId}`}
        {selected.leader.isTraitor && <TraitorBadge />}
      </div>
    </div>
  );
}
