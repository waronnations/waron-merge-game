// src/components/panels/DailyQuestsPanel.tsx
// White-on-black · color only on status writings
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { GameState } from "@/lib/game-state";
import { haptic } from "@/lib/telegram";
import { RewardLine } from "./RewardLine";
import { ClaimBurst } from "@/components/game/ClaimBurst";
import { GIFT_CLOSED_VARIANTS } from "@/lib/constants/gifts";
import type { GiftBoxId } from "@/lib/constants/gifts";

function pickClosedImg(id: GiftBoxId = "common") {
  const variants = GIFT_CLOSED_VARIANTS[id] || GIFT_CLOSED_VARIANTS.common;
  return variants[Math.floor(Math.random() * variants.length)];
}

export function DailyQuestsPanel({
  state,
  onClaim,
}: {
  state: GameState;
  onClaim: (id: string) => void | Promise<void>;
}) {
  const [burstGift, setBurstGift] = useState<GiftBoxId | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
          Daily Ops
        </h3>
        <div className="text-[0.6rem] uppercase tracking-widest text-zinc-600">
          Resets at midnight
        </div>
      </div>

      {!state.dailyQuests.length && (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
          New daily ops incoming — check back shortly.
        </div>
      )}

      {state.dailyQuests.map((q) => {
        const pct = Math.min(100, (q.progress / q.target) * 100);
        const ready = q.progress >= q.target && !q.claimed;
        const closedSrc = pickClosedImg("common");

        return (
          <div
            key={q.id}
            className={`rounded-2xl border p-2.5 ${
              q.claimed
                ? "border-zinc-700 bg-zinc-900/60 opacity-80"
                : "border-zinc-700 bg-zinc-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl ${
                  q.claimed
                    ? "bg-zinc-800"
                    : ready
                      ? "bg-zinc-800 ring-1 ring-white/40"
                      : "bg-zinc-800"
                }`}
              >
                {q.claimed ? (
                  <Check className="h-5 w-5 text-emerald-400" />
                ) : (
                  <img
                    src={closedSrc}
                    alt="Ops crate"
                    className="h-8 w-8 object-contain"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">
                  {q.title}
                </div>
                <div className="truncate text-xs text-zinc-500">{q.desc}</div>
                <RewardLine
                  glory={q.reward}
                  wardog={q.wardog}
                  warcat={q.warcat}
                  energy={q.energy}
                />
              </div>

              <button
                disabled={!ready && !q.claimed}
                onClick={async () => {
                  if (!ready) return;
                  try {
                    await onClaim(q.id);
                    haptic("medium");
                    setBurstGift("common");
                    toast.success("Daily ops claimed — supply drop incoming!");
                  } catch {
                    /* handled upstream */
                  }
                }}
                className={`min-h-[2.25rem] shrink-0 rounded-xl px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                  q.claimed
                    ? "cursor-default bg-zinc-800 text-emerald-400"
                    : ready
                      ? "bg-white text-black hover:bg-zinc-200"
                      : "cursor-not-allowed bg-zinc-800 text-zinc-500"
                }`}
              >
                {q.claimed
                  ? "Claimed"
                  : ready
                    ? "Claim"
                    : `${q.progress}/${q.target}`}
              </button>
            </div>

            <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${
                  q.claimed ? "bg-emerald-500" : "bg-white"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}

      {burstGift && (
        <ClaimBurst
          giftId={burstGift}
          onComplete={() => setBurstGift(null)}
        />
      )}
    </div>
  );
}
