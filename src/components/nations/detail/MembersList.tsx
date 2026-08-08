// src/components/nations/detail/MembersList.tsx
import { Crown, UserMinus, Users, Ban } from "lucide-react";
import { TraitorBadge, OfficerBadge } from "../badges";
import type { NationDetails } from "../use-nations-panel";

export function MembersList({
  selected,
  isLeader,
  promoting,
  demoting,
  handlePromote,
  handleDemote,
  kicking = null,
  handleKick,
}: {
  selected: NationDetails;
  isLeader: boolean;
  promoting: number | null;
  demoting: number | null;
  handlePromote: (toUserId: number) => Promise<void>;
  handleDemote: (toUserId: number) => Promise<void>;
  kicking?: number | null;
  handleKick?: (targetUserId: number) => Promise<void>;
}) {
  if (!(selected.topMembers?.length > 0)) return null;
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-zinc-500">
        <Users className="h-3.5 w-3.5" />
        Members
      </div>
      <div className="space-y-1.5">
        {selected.topMembers.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-sm font-medium text-white">
                {m.username
                  ? `@${m.username}`
                  : m.firstName || `#${m.userId}`}
              </span>
              {m.role === "leader" && (
                <Crown className="h-3 w-3 shrink-0 text-amber-400" />
              )}
              {m.role === "officer" && <OfficerBadge />}
              {m.isTraitor && <TraitorBadge />}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-zinc-400">
                {m.glory.toLocaleString()}
              </span>
              {isLeader && m.role === "member" && (
                <button
                  onClick={() => handlePromote(m.userId)}
                  disabled={promoting === m.userId}
                  className="rounded bg-blue-950/60 border border-blue-500/40 px-1.5 py-0.5 text-[0.6rem] font-bold text-blue-400 disabled:opacity-50"
                >
                  {promoting === m.userId ? "..." : "Promote"}
                </button>
              )}
              {isLeader && m.role === "officer" && (
                <button
                  onClick={() => handleDemote(m.userId)}
                  disabled={demoting === m.userId}
                  className="rounded bg-zinc-800 border border-zinc-600 px-1.5 py-0.5 text-[0.6rem] font-bold text-zinc-400 disabled:opacity-50"
                >
                  {demoting === m.userId ? (
                    "..."
                  ) : (
                    <UserMinus className="h-3 w-3" />
                  )}
                </button>
              )}
              {isLeader &&
                m.role === "member" &&
                handleKick && (
                  <button
                    onClick={() => void handleKick(m.userId)}
                    disabled={kicking === m.userId}
                    title="Kick member"
                    className="rounded bg-red-950/60 border border-red-500/40 px-1.5 py-0.5 text-[0.6rem] font-bold text-red-400 disabled:opacity-50"
                  >
                    {kicking === m.userId ? (
                      "..."
                    ) : (
                      <Ban className="h-3 w-3" />
                    )}
                  </button>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
