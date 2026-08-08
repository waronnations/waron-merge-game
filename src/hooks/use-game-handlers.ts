// src/hooks/use-game-handlers.ts
import { type GameState, type useGame } from "@/lib/game-state";
import { useBoardHandlers } from "@/hooks/game-handlers/use-board-handlers";
import { useEconomyHandlers } from "@/hooks/game-handlers/use-economy-handlers";
import { useDailyQuestsHandlers } from "@/hooks/game-handlers/use-daily-quests-handlers";
import { useNukeHandlers } from "@/hooks/game-handlers/use-nuke-handlers";
import { useHybridHandlers } from "@/hooks/game-handlers/use-hybrid-handlers";

export { type PayToken, formatReason } from "@/hooks/game-handlers/helpers";

export function useGameHandlers({
  game,
  authenticated,
  serverReady,
  forceSync,
  pullFromServer,
  serverMerge,
  serverSpawn,
  serverSwap,
  serverResolveHybrid,
  serverSacrificeBoardHybrid,
  softRateLimitToast,
  generatedImageUrl,
  setShowDaily,
}: {
  game: ReturnType<typeof useGame>;
  authenticated: boolean;
  serverReady: boolean;
  forceSync: () => Promise<unknown>;
  pullFromServer: () => Promise<unknown>;
  serverMerge: (
    from: number,
    to: number,
  ) => Promise<{ ok: boolean; reason?: string }>;
  serverSpawn: (args?: {
    targetIdx?: number;
    faction?: "cat" | "dog";
  }) => Promise<{ ok: boolean; state?: GameState; reason?: string }>;
  serverSwap: (
    from: number,
    to: number,
  ) => Promise<{ ok: boolean; reason?: string }>;
  serverResolveHybrid: (
    choice: "sacrifice" | "keep",
  ) => Promise<{ ok: boolean; reason?: string }>;
  serverSacrificeBoardHybrid?: (
    idx: number,
  ) => Promise<{ ok: boolean; reason?: string; state?: unknown }>;
  softRateLimitToast: () => void;
  generatedImageUrl: string | null;
  setShowDaily: (v: boolean) => void;
}) {
  const {
    handleSpawn,
    handleMerge,
    handleSwap,
    handleSacrificeHybrid,
    handleResolveHybrid,
  } = useBoardHandlers({
    game,
    serverReady,
    forceSync,
    pullFromServer,
    serverMerge,
    serverSpawn,
    serverSwap,
    serverResolveHybrid,
    serverSacrificeBoardHybrid,
    softRateLimitToast,
  });

  const { handleRecoverEnergy, handleShopBuy } = useEconomyHandlers({
    game,
    authenticated,
    pullFromServer,
    forceSync,
  });

  const { claimDaily, handleClaimTask, handleClaimDailyQuest } =
    useDailyQuestsHandlers({
      game,
      authenticated,
      forceSync,
      softRateLimitToast,
      setShowDaily,
    });

  const { handleLaunchNuke } = useNukeHandlers({
    game,
    authenticated,
    forceSync,
  });

  const { handleHybridWithArt } = useHybridHandlers({
    game,
    authenticated,
    pullFromServer,
    forceSync,
    generatedImageUrl,
  });

  return {
    claimDaily,
    handleSpawn,
    handleRecoverEnergy,
    handleMerge,
    handleSwap,
    handleSacrificeHybrid,
    handleShopBuy,
    handleLaunchNuke,
    handleClaimTask,
    handleClaimDailyQuest,
    handleResolveHybrid,
    handleHybridWithArt,
  };
}
