import { createServerFn } from "@tanstack/react-start";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import {
  requireUserId,
  getSeasonalLeaderboard,
  getUserBadges,
  ensureCurrentSeason,
} from "@/lib/seasons.server";

export const getSeasonalLeaderboardFn = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!hasDatabase()) return { season: null, entries: [] };
    await ensureSchema();
    return getSeasonalLeaderboard(100);
  },
);

export const getMyBadgesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!hasDatabase()) return [];
    await ensureSchema();
    return getUserBadges(await requireUserId());
  },
);

export const ensureSeasonFn = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!hasDatabase()) return null;
    await ensureSchema();
    return ensureCurrentSeason();
  },
);
