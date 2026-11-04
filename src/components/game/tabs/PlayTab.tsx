// src/components/game/tabs/PlayTab.tsx
import { Link } from "@tanstack/react-router";
import { MergeBoard, type PayToken } from "@/components/MergeBoard";
import { WarModeOverlay } from "@/components/war/WarModeOverlay";
import type { GameState } from "@/lib/game/types";
import type { HybridCommanderAbilityId } from "@/lib/constants/war-mode";

export function PlayTab({
  state,
  onMerge,
  onSwap,
  onSpawn,
  onRecover,
  canRecoverWardog,
  canRecoverWarcat,
  onSacrificeHybrid,
  // War Mode
  onEnterWarMode,
  onDeployUnit,
  onActivateAbility,
  onForceEndWarMode,
  canEnterWarMode,
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
  // War Mode
  onEnterWarMode: () => void;
  onDeployUnit: (index: number) => void;
  onActivateAbility: (id: HybridCommanderAbilityId) => void;
  onForceEndWarMode: () => void;
  canEnterWarMode: boolean;
}) {
  return (
    <div className="flex flex-col gap-0">
      <Link
        to="/war"
        className="mb-3 flex items-center justify-between rounded-2xl border border-destructive/60 bg-destructive/10 px-3 py-2.5 text-xs font-black uppercase tracking-wider text-foreground"
      >
        <span>Memecoin War — fight with your real coins</span>
        <span className="text-destructive">Enter →</span>
      </Link>
      <WarModeOverlay
        warMode={state.warMode}
        energy={state.energy}
        onEnter={onEnterWarMode}
        onDeploy={onDeployUnit}
        onActivateAbility={onActivateAbility}
        onForceEnd={onForceEndWarMode}
        canEnter={canEnterWarMode}
      />

      <MergeBoard
        state={state}
        onMerge={onMerge}
        onSwap={onSwap}
        onSpawn={onSpawn}
        onRecover={onRecover}
        canRecoverWardog={canRecoverWardog}
        canRecoverWarcat={canRecoverWarcat}
        onSacrificeHybrid={onSacrificeHybrid}
        onDeployUnit={onDeployUnit}
      />
    </div>
  );
}
