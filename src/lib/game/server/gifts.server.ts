// src/lib/game/server/gifts.server.ts
/**
 * Server-authoritative gift box grant + open.
 * All reward rolls happen here — client never decides amounts.
 */

import { sql } from "@/lib/db.server";
import { normalizeToken, addTokens } from "@/lib/tokens";
import { GIFT_BOXES, type GiftBoxId } from "@/lib/constants/gifts";
import {
  type ServerGameState,
  loadProgress,
  writeProgress,
  alignStateWithColumns,
} from "./state.server";

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function rollRewards(giftId: GiftBoxId) {
  const def = GIFT_BOXES[giftId];
  const r = def.rewards;

  const glory = Math.round(rand(r.glory[0], r.glory[1]));
  const wardog = normalizeToken(rand(r.wardog[0], r.wardog[1]));
  const warcat = normalizeToken(rand(r.warcat[0], r.warcat[1]));
  const energy = Math.round(rand(r.energy[0], r.energy[1]));
  const gotNuke =
    typeof r.nukeChance === "number" && Math.random() < r.nukeChance;

  return { glory, wardog, warcat, energy, gotNuke };
}

/** Grant one (or more) gift boxes to inventory. */
export async function serverGrantGiftBox(
  userId: number,
  giftId: GiftBoxId,
  amount = 1,
): Promise<{ ok: true; state: ServerGameState } | { ok: false; reason: string }> {
  if (!GIFT_BOXES[giftId]) return { ok: false, reason: "unknown_gift" };
  if (amount < 1 || amount > 20) return { ok: false, reason: "bad_amount" };

  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  let state = alignStateWithColumns(
    { ...(prev.state as ServerGameState) } as ServerGameState,
    prev,
  );

  const boxes = { ...(state.giftBoxes ?? {}) };
  boxes[giftId] = (boxes[giftId] ?? 0) + amount;
  state.giftBoxes = boxes;

  await writeProgress(userId, state, { touchSyncClock: false });
  return { ok: true, state };
}

/** Open one gift box — roll rewards and deduct from inventory. */
export async function serverOpenGiftBox(
  userId: number,
  giftId: GiftBoxId,
): Promise<
  | {
      ok: true;
      state: ServerGameState;
      rewards: {
        glory: number;
        wardog: number;
        warcat: number;
        energy: number;
        gotNuke: boolean;
      };
    }
  | { ok: false; reason: string }
> {
  if (!GIFT_BOXES[giftId]) return { ok: false, reason: "unknown_gift" };

  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  let state = alignStateWithColumns(
    { ...(prev.state as ServerGameState) } as ServerGameState,
    prev,
  );

  const boxes = { ...(state.giftBoxes ?? {}) };
  const count = boxes[giftId] ?? 0;
  if (count < 1) return { ok: false, reason: "none_owned" };

  boxes[giftId] = count - 1;
  if (boxes[giftId] <= 0) delete boxes[giftId];
  state.giftBoxes = boxes;

  const rewards = rollRewards(giftId);

  state.glory = Number(state.glory ?? 0) + rewards.glory;
  state.wardogTokens = addTokens(Number(state.wardogTokens ?? 0), rewards.wardog);
  state.warcatTokens = addTokens(Number(state.warcatTokens ?? 0), rewards.warcat);
  state.energy = Math.min(
    100, // MAX_ENERGY – import if you prefer
    Number(state.energy ?? 0) + rewards.energy,
  );

  if (rewards.gotNuke) {
    state.nukesOwned = (Number(state.nukesOwned) || 0) + 1;
  }

  await sql`
    INSERT INTO shop_ledger (user_id, item_id, cost)
    VALUES (${userId}, ${`open_gift:${giftId}`}, 0)
  `;

  await writeProgress(userId, state, { touchSyncClock: false });
  return { ok: true, state, rewards };
}
