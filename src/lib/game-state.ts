// src/lib/game-state.ts
// Re-export barrel ONLY. All implementation now lives under src/lib/game/.
// Kept so every existing `import ... from "@/lib/game-state"` keeps compiling.
export {
  BOARD_SIZE,
  MAX_ENERGY,
  ENERGY_PER_MERGE,
  SPAWN_ENERGY,
  ENERGY_REGEN_MS,
  EARLY_GAME_MERGES,
  EARLY_GAME_REGEN_MULT,
  RECOVER_ENERGY_AMOUNT,
  RECOVER_ENERGY_TOKEN_COST,
  IDLE_CAP_HOURS,
  IDLE_GLORY_PER_MIN,
  IDLE_TOKEN_PER_HOUR,
  IDLE_MIN_MINUTES,
  STARTER_PACK,
  SHOP_ITEMS,
  type ShopItemId,
} from "@/lib/constants";

export type {
  Cell,
  HybridNFT,
  PendingHybrid,
  Task,
  DailyQuest,
  Referral,
  IdleReward,
  GameState,
  MergeResult,
} from "@/lib/game/types";

export {
  applyOfflineEnergyRegen,
  clampEnergy,
  initialState,
  isCorrectSide,
  makeReferralCode,
  normalizeTasks,
  pickDailyQuests,
  truncateToDay,
} from "@/lib/game/helpers";

export type { DailyClaimResult, LocalRecoverResult } from "@/lib/game/use-game";
export { useGame } from "@/lib/game/use-game";
