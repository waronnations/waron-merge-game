// src/components/claim/ClaimHistoryList.tsx
import { Clock } from "lucide-react";
import { TOKENS } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { statusClass, statusLabel } from "@/components/claim/claim-helpers";
import type { ClaimsSnapshot } from "@/lib/claims.functions";

export function ClaimHistoryList({
  snapshot,
}: {
  snapshot: ClaimsSnapshot | null;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-zinc-500" />
        <span className="text-[0.65rem] font-black uppercase tracking-widest text-zinc-500">
          Recent claims
        </span>
      </div>
      {(snapshot?.claims?.length ?? 0) === 0 ? (
        <p className="text-xs text-zinc-600">No claims yet.</p>
      ) : (
        <ul className="space-y-2">
          {snapshot!.claims.slice(0, 8).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2"
            >
              <div>
                <div className="text-xs font-bold text-white">
                  {c.amount.toFixed(2)}{" "}
                  <span
                    className={
                      c.token === "wardog" ? "text-red-300" : "text-violet-300"
                    }
                  >
                    {TOKENS[c.token].symbol}
                  </span>
                </div>
                <div className="text-[0.6rem] text-zinc-500">
                  {new Date(c.createdAt).toLocaleString()}
                </div>
              </div>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[0.6rem] font-bold uppercase",
                  statusClass(c.status),
                )}
              >
                {statusLabel(c.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
