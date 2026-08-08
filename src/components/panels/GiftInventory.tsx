// src/components/panels/GiftInventory.tsx
import { useState } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import type { GameState } from "@/lib/game-state";
import { GIFT_BOXES, type GiftBoxId } from "@/lib/constants/gifts";
import { ClaimBurst } from "@/components/game/ClaimBurst";
import { haptic } from "@/lib/telegram";

export function GiftInventory({
  state,
  onOpen,
}: {
  state: GameState;
  onOpen: (giftId: GiftBoxId) => Promise<void> | void;
}) {
  const [burst, setBurst] = useState<GiftBoxId | null>(null);
  const [busy, setBusy] = useState<GiftBoxId | null>(null);

  const boxes = state.giftBoxes ?? {};
  const entries = (Object.keys(GIFT_BOXES) as GiftBoxId[]).filter(
    (id) => (boxes[id] ?? 0) > 0,
  );

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5 text-center">
        <Gift className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
        <div className="text-sm text-zinc-500">No supply drops yet</div>
        <div className="mt-1 text-[0.65rem] text-zinc-600">
          Complete Daily Ops or buy in Shop
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="px-1 text-xs font-black uppercase tracking-widest text-zinc-500">
        Your Supply Drops
      </h3>

      {entries.map((id) => {
        const def = GIFT_BOXES[id];
        const count = boxes[id] ?? 0;

        return (
          <div
            key={id}
            className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-3"
          >
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-black/40">
              <img
                src={def.closedImg}
                alt={def.name}
                className="h-10 w-10 object-contain"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">{def.name}</div>
              <div className="text-xs text-zinc-500">
                ×{count} · {def.desc}
              </div>
            </div>

            <button
              disabled={!!busy}
              onClick={async () => {
                if (busy) return;
                setBusy(id);
                try {
                  await onOpen(id);
                  haptic("heavy");
                  setBurst(id);
                  toast.success(`${def.name} opened!`);
                } catch {
                  toast.error("Failed to open");
                } finally {
                  setBusy(null);
                }
              }}
              className="min-h-[2.25rem] shrink-0 rounded-xl bg-amber-500 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-black disabled:opacity-50"
            >
              {busy === id ? "…" : "Open"}
            </button>
          </div>
        );
      })}

      {burst && (
        <ClaimBurst giftId={burst} onComplete={() => setBurst(null)} />
      )}
    </div>
  );
}
