// src/lib/game/server/shop.server.ts
/**
 * Server-authoritative shop + board energy recover.
 *
 * Token model
 *  · Playable = progress tokens − claimed reserve (claim queue locked)
 *  · Shop: wallet authorization when paymentsLive, then spend $WARDOG or $WARCAT
 *  · Board recover: no wallet — spend playable $WARDOG or $WARCAT only
 *  · Never native TON
 */

import { requirePayment } from "@/lib/payments.server";
import { sql } from "@/lib/db.server";
import { normalizeToken, subTokens } from "@/lib/tokens";
import {
  MAX_ENERGY,
  RECOVER_ENERGY_AMOUNT,
  RECOVER_ENERGY_TOKEN_COST,
} from "@/lib/constants";
import {
  applyDynamicTax,
  recordTreasuryDeposit,
  getClaimedReserve,
} from "@/lib/treasury.server";
import {
  type ServerGameState,
  type ShopItemIdServer,
  loadProgress,
  writeProgress,
  alignStateWithColumns,
  clampServerEnergy,
  SHOP_ITEMS_SERVER,
} from "./state.server";
import type { GiftBoxId } from "@/lib/constants/gifts";

export type PayToken = "wardog" | "warcat";

/** Spend full cost from a single playable token balance. */
function spendFromSingleToken(
  playableWardog: number,
  playableWarcat: number,
  cost: number,
  payWith: PayToken,
):
  | { ok: true; wardog: number; warcat: number; spentW: number; spentC: number }
  | { ok: false } {
  const need = normalizeToken(cost);
  if (need <= 0) {
    return {
      ok: true,
      wardog: playableWardog,
      warcat: playableWarcat,
      spentW: 0,
      spentC: 0,
    };
  }

  if (payWith === "wardog") {
    if (playableWardog < need - 1e-6) return { ok: false };
    return {
      ok: true,
      wardog: subTokens(playableWardog, need),
      warcat: playableWarcat,
      spentW: need,
      spentC: 0,
    };
  }

  if (playableWarcat < need - 1e-6) return { ok: false };
  return {
    ok: true,
    wardog: playableWardog,
    warcat: subTokens(playableWarcat, need),
    spentW: 0,
    spentC: need,
  };
}

export async function serverPurchaseShopItem(
  userId: number,
  itemId: ShopItemIdServer,
  payWith: PayToken = "wardog",
): Promise<{ ok: true; state: ServerGameState } | { ok: false; reason: string }> {
  if (payWith !== "wardog" && payWith !== "warcat") {
    return { ok: false, reason: "invalid_pay_token" };
  }

  const item = SHOP_ITEMS_SERVER[itemId];
  if (!item) return { ok: false, reason: "unknown_item" };

  // Wallet authorization when live (no native TON). No-op while not live.
  try {
    await requirePayment(userId, `shop:${itemId}` as never);
  } catch {
    return { ok: false, reason: "payment_required" };
  }

  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  let state = alignStateWithColumns(
    { ...(prev.state as ServerGameState) } as ServerGameState,
    prev,
  );

  const baseCost = Number(item.cost);
  const cost = await applyDynamicTax(baseCost, payWith);

  const reserve = await getClaimedReserve(userId);
  const playableW = Math.max(0, Number(state.wardogTokens ?? 0) - reserve.wardog);
  const playableC = Math.max(0, Number(state.warcatTokens ?? 0) - reserve.warcat);

  const paid = spendFromSingleToken(playableW, playableC, cost, payWith);
  if (!paid.ok) return { ok: false, reason: "insufficient_tokens" };

  // Keep claimed reserve intact on the ledger totals
  state.wardogTokens = normalizeToken(paid.wardog + reserve.wardog);
  state.warcatTokens = normalizeToken(paid.warcat + reserve.warcat);

  if (itemId === "energyPack") {
    state.energy = Math.min(
      MAX_ENERGY,
      Number(state.energy ?? 0) + Number((item as { energy?: number }).energy ?? 0),
    );
    state.lastRegenAt = Date.now();
  } else if (itemId === "gloryBoost") {
    const now = Date.now();
    const base = Math.max(now, Number(state.gloryBoostUntil ?? 0));
    state.gloryBoostUntil =
      base + Number((item as { durationMs?: number }).durationMs ?? 0);
  } else if (itemId === "nukePack") {
    state.nukesOwned = (Number(state.nukesOwned) || 0) + 1;
  }
  // ── Gift Boxes ──────────────────────────────────────────────
  else if (
    itemId === "gift_common" ||
    itemId === "gift_wardog" ||
    itemId === "gift_warcat" ||
    itemId === "gift_nuke" ||
    itemId === "gift_legendary"
  ) {
    const giftId = itemId.replace("gift_", "") as GiftBoxId;
    const boxes = { ...(state.giftBoxes ?? {}) };
    boxes[giftId] = (Number(boxes[giftId]) || 0) + 1;
    state.giftBoxes = boxes;
  }

  await sql`
    INSERT INTO shop_ledger (user_id, item_id, cost)
    VALUES (${userId}, ${`${itemId}:${payWith}`}, ${cost})
  `;

  const multiplier = baseCost > 0 ? cost / baseCost : 1;
  const taxedShare = multiplier > 0 ? (multiplier - 1) / multiplier : 0;
  await recordTreasuryDeposit({
    userId,
    source: `shop:${itemId}`,
    wardog: paid.spentW * taxedShare,
    warcat: paid.spentC * taxedShare,
    baseAmount: baseCost,
    multiplier,
    details: { payWith },
  });

  await writeProgress(userId, state, { touchSyncClock: false });
  return { ok: true, state };
}

/**
 * Board energy recovery — playable tokens only, no wallet.
 * Player chooses $WARDOG or $WARCAT; claimed reserve cannot be spent.
 */
export async function serverRecoverEnergy(
  userId: number,
  payWith: PayToken = "wardog",
): Promise<
  | {
      ok: true;
      state: ServerGameState;
      energy: number;
      spent: { wardog: number; warcat: number };
    }
  | { ok: false; reason: string }
> {
  if (payWith !== "wardog" && payWith !== "warcat") {
    return { ok: false, reason: "invalid_pay_token" };
  }

  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  let state = alignStateWithColumns(
    { ...(prev.state as ServerGameState) } as ServerGameState,
    prev,
  );

  const energy = clampServerEnergy(state.energy, 0);
  if (energy >= MAX_ENERGY) return { ok: false, reason: "energy_full" };

  const reserve = await getClaimedReserve(userId);
  const playableW = Math.max(0, Number(state.wardogTokens ?? 0) - reserve.wardog);
  const playableC = Math.max(0, Number(state.warcatTokens ?? 0) - reserve.warcat);
  const playable = payWith === "wardog" ? playableW : playableC;

  if (playable < 0.001) return { ok: false, reason: "no_tokens" };

  const RECOVER_AMOUNT = RECOVER_ENERGY_AMOUNT;
  const RECOVER_COST = await applyDynamicTax(RECOVER_ENERGY_TOKEN_COST, payWith);
  const taxMultiplier =
    RECOVER_ENERGY_TOKEN_COST > 0 ? RECOVER_COST / RECOVER_ENERGY_TOKEN_COST : 1;

  const room = MAX_ENERGY - energy;
  const desiredEnergy = Math.min(RECOVER_AMOUNT, room);
  const desiredCost = (desiredEnergy / RECOVER_AMOUNT) * RECOVER_COST;
  const cost = Math.min(desiredCost, playable);
  const energyGain = Math.round((cost / RECOVER_COST) * RECOVER_AMOUNT);
  if (energyGain <= 0 || cost < 1e-9) return { ok: false, reason: "no_tokens" };

  const paid = spendFromSingleToken(playableW, playableC, cost, payWith);
  if (!paid.ok) return { ok: false, reason: "no_tokens" };

  state.energy = Math.min(MAX_ENERGY, energy + energyGain);
  state.wardogTokens = normalizeToken(paid.wardog + reserve.wardog);
  state.warcatTokens = normalizeToken(paid.warcat + reserve.warcat);
  state.lastRegenAt = Date.now();

  await sql`
    INSERT INTO shop_ledger (user_id, item_id, cost)
    VALUES (${userId}, ${`recoverEnergy:${payWith}`}, ${cost})
  `;

  const taxedShare = taxMultiplier > 0 ? (taxMultiplier - 1) / taxMultiplier : 0;
  await recordTreasuryDeposit({
    userId,
    source: "recoverEnergy",
    wardog: paid.spentW * taxedShare,
    warcat: paid.spentC * taxedShare,
    baseAmount: cost / (taxMultiplier || 1),
    multiplier: taxMultiplier,
    details: { payWith },
  });

  await writeProgress(userId, state, { touchSyncClock: false });
  return {
    ok: true,
    state,
    energy: energyGain,
    spent: { wardog: paid.spentW, warcat: paid.spentC },
  };
}
