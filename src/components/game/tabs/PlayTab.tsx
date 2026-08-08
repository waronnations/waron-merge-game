// src/components/game/tabs/PlayTab.tsx
import { MergeBoard, type PayToken } from "@/components/MergeBoard";
import type { GameState } from "@/lib/game-state";

export function PlayTab({
  state,
  onMerge,
  onSwap,
  onSpawn,
  onRecover,
  canRecoverWardog,
  canRecoverWarcat,
  onSacrificeHybrid,
}: {
  state: GameState;
  onMerge: (
    from: number,
    to: number,
  ) => {
    ok: boolean;
    token?: "wardog" | "warcat";
    amount?: number;
    isHybrid?: boolean;
  };
  onSwap: (from: number, to: number) => void;
  onSpawn: () => void;
  onRecover: (payWith: PayToken) => void;
  canRecoverWardog: boolean;
  canRecoverWarcat: boolean;
  onSacrificeHybrid: (idx: number) => void;
}) {
  return (
    <MergeBoard
      state={state}
      onMerge={onMerge}
      onSwap={onSwap}
      onSpawn={onSpawn}
      onRecover={onRecover}
      canRecoverWardog={canRecoverWardog}
      canRecoverWarcat={canRecoverWarcat}
      onSacrificeHybrid={onSacrificeHybrid}
    />
  );
}
