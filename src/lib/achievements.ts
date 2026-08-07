// src/lib/achievements.ts
import type { GameState } from "@/lib/game/types";

export type AchievementDef = {
  id: string;
  title: string;
  desc: string;
  glory: number;
  wardog?: number;
  warcat?: number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_merge",
    title: "First Blood",
    desc: "Complete your first merge",
    glory: 50,
  },
  {
    id: "tier_3",
    title: "Rising Force",
    desc: "Reach Tier 3",
    glory: 150,
    warcat: 1,
  },
  {
    id: "tier_4",
    title: "Heavy Armor",
    desc: "Reach Tier 4",
    glory: 400,
    wardog: 3,
  },
  {
    id: "tier_5",
    title: "Legend Forged",
    desc: "Reach Tier 5",
    glory: 1200,
    wardog: 8,
    warcat: 8,
  },
  {
    id: "first_hybrid",
    title: "Clash of Factions",
    desc: "Trigger a Hybrid clash",
    glory: 2000,
    wardog: 10,
    warcat: 10,
  },
  {
    id: "merges_25",
    title: "Skirmisher",
    desc: "Complete 25 merges",
    glory: 200,
  },
  {
    id: "merges_100",
    title: "Veteran",
    desc: "Complete 100 merges",
    glory: 800,
    wardog: 5,
    warcat: 5,
  },
  {
    id: "merges_500",
    title: "Warlord Path",
    desc: "Complete 500 merges",
    glory: 3000,
    wardog: 15,
    warcat: 15,
  },
  {
    id: "combo_5",
    title: "Blitz Commander",
    desc: "Hit a x5 merge combo",
    glory: 500,
    wardog: 3,
  },
  {
    id: "streak_7",
    title: "Week of War",
    desc: "Claim daily bonus 7 days in a row",
    glory: 1000,
    warcat: 8,
  },
];

export function getUnlockedSet(state: GameState): Set<string> {
  return new Set(state.achievements ?? []);
}

/**
 * Evaluate which achievements should unlock given current state + context.
 * Does NOT mutate state — returns ids to unlock.
 */
export function evaluateAchievements(
  state: GameState,
  ctx: {
    justHybrid?: boolean;
    combo?: number;
  } = {},
): string[] {
  const have = getUnlockedSet(state);
  const next: string[] = [];

  const tryUnlock = (id: string, cond: boolean) => {
    if (cond && !have.has(id)) next.push(id);
  };

  tryUnlock("first_merge", state.totalMerges >= 1);
  tryUnlock("tier_3", state.highestTier >= 3);
  tryUnlock("tier_4", state.highestTier >= 4);
  tryUnlock("tier_5", state.highestTier >= 5);
  tryUnlock("first_hybrid", !!ctx.justHybrid || (state.hybrids?.length ?? 0) > 0);
  tryUnlock("merges_25", state.totalMerges >= 25);
  tryUnlock("merges_100", state.totalMerges >= 100);
  tryUnlock("merges_500", state.totalMerges >= 500);
  tryUnlock("combo_5", (ctx.combo ?? 0) >= 5);
  tryUnlock("streak_7", state.dailyStreak >= 7);

  return next;
}

/** Apply achievement rewards and append ids. Pure. */
export function applyAchievementRewards(
  state: GameState,
  ids: string[],
): GameState {
  if (!ids.length) return state;
  const have = getUnlockedSet(state);
  let glory = state.glory;
  let wardog = state.wardogTokens;
  let warcat = state.warcatTokens;
  const added: string[] = [];

  for (const id of ids) {
    if (have.has(id)) continue;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) continue;
    glory += def.glory;
    wardog += def.wardog ?? 0;
    warcat += def.warcat ?? 0;
    added.push(id);
    have.add(id);
  }

  if (!added.length) return state;

  return {
    ...state,
    glory,
    wardogTokens: +wardog.toFixed(4),
    warcatTokens: +warcat.toFixed(4),
    achievements: Array.from(have),
  };
}

export function achievementTitle(id: string): string {
  return ACHIEVEMENTS.find((a) => a.id === id)?.title ?? id;
}
