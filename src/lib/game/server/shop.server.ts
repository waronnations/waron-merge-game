// src/lib/game/server/shop.server.ts
/**
 * Server-authoritative shop + board energy recover.
 *
 * Token model
 *  · Playable = progress tokens − claimed reserve (claim vault locked)
 *  · Spendable = progress.spendable_* (from player top-ups)
 *  · Shop: debit spendable first; when treasury is healthy, may fall back to playable
 *  · Energy: when healthy, prefer playable; when strained, spendable only
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
  getTreasuryHealth,
} from "@/lib/treasury.server";
import {
  getSpendableBalances,
  debitSpendable,
  type TopupToken,
} from "@/lib/topups.server";
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

function isTreasuryHealthy(zone: string): boolean {
  return zone === "green" || zone === "yellow";
}

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

/**
 * Pay `cost` in `payWith`:
 * 1) Spendable first (always allowed)
 * 2) Remainder from playable only if allowPlayable
 */
async function payCost(
  userId: number,
  cost: number,
  payWith: PayToken,
  allowPlayable: boolean,
  playableW: number,
  playableC: number,
): Promise<
  | {
      ok: true;
      playableW: number;
      playableC: number;
      spentSpendable: number;
      spentPlayableW: number;
      spentPlayableC: number;
    }
  | { ok: false }
> {
  const need = normalizeToken(cost);
  if (need <= 0) {
    return {
      ok: true,
      playableW,
      playableC,
      spentSpendable: 0,
      spentPlayableW: 0,
      spentPlayableC: 0,
    };
  }

  const spendable = await getSpendableBalances(userId);
  const haveSpendable =
    payWith === "wardog"
      ? spendable.spendableWardog
      : spendable.spendableWarcat;

  const fromSpendable = Math.min(haveSpendable, need);
  const remainder = normalizeToken(need - fromSpendable);

  if (fromSpendable > 1e-9) {
    const deb = await debitSpendable(
      userId,
      payWith as TopupToken,
      fromSpendable,
    );
    if (!deb.ok) return { ok: false };
  }

  if (remainder <= 1e-9) {
    return {
      ok: true,
      playableW,
      playableC,
      spentSpendable: fromSpendable,
      spentPlayableW: 0,
      spentPlayableC: 0,
    };
  }

  if (!allowPlayable) return { ok: false };

  const paid = spendFromSingleToken(playableW, playableC, remainder, payWith);
  if (!paid.ok) return { ok: false };

  return {
    ok: true,
    playableW: paid.wardog,
    playableC: paid.warcat,
    spentSpendable: fromSpendable,
    spentPlayableW: paid.spentW,
    spentPlayableC: paid.spentC,
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

  const health = await getTreasuryHealth();
  const allowPlayable = isTreasuryHealthy(health.zone);

  const reserve = await getClaimedReserve(userId);
  const playableW = Math.max(
    0,
    Number(state.wardogTokens ?? 0) - reserve.wardog,
  );
  const playableC = Math.max(
    0,
    Number(state.warcatTokens ?? 0) - reserve.warcat,
  );

  const paid = await payCost(
    userId,
    cost,
    payWith,
    allowPlayable,
    playableW,
    playableC,
  );
  if (!paid.ok) {
    return {
      ok: false,
      reason: allowPlayable ? "insufficient_tokens" : "insufficient_spendable",
    };
  }

  // Ledger totals = remaining playable + claimed reserve
  state.wardogTokens = normalizeToken(paid.playableW + reserve.wardog);
  state.warcatTokens = normalizeToken(paid.playableC + reserve.warcat);

  if (itemId === "energyPack") {
    state.energy = Math.min(
      MAX_ENERGY,
      Number(state.energy ?? 0) +
        Number((item as { energy?: number }).energy ?? 0),
    );
    state.lastRegenAt = Date.now();
  } else if (itemId === "gloryBoost") {
    const now = Date.now();
    const base = Math.max(now, Number(state.gloryBoostUntil ?? 0));
    state.gloryBoostUntil =
      base + Number((item as { durationMs?: number }).durationMs ?? 0);
  } else if (itemId === "nukePack") {
    state.nukesOwned = (Number(state.nukesOwned) || 0) + 1;
  } else if (
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
  // Tax surplus bookkeeping: attribute to playable portion only (treasury story)
  const spentPlayableTotal = paid.spentPlayableW + paid.spentPlayableC;
  await recordTreasuryDeposit({
    userId,
    source: `shop:${itemId}`,
    wardog: paid.spentPlayableW * taxedShare,
    warcat: paid.spentPlayableC * taxedShare,
    baseAmount: baseCost,
    multiplier,
    details: {
      payWith,
      spentSpendable: paid.spentSpendable,
      spentPlayable: spentPlayableTotal,
      treasuryZone: health.zone,
    },
  });

  await writeProgress(userId, state, { touchSyncClock: false });
  return { ok: true, state };
}

/**
 * Board energy recovery.
 * Healthy treasury: prefer playable, then spendable.
 * Strained: spendable only.
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

  const health = await getTreasuryHealth();
  const healthy = isTreasuryHealthy(health.zone);

  const reserve = await getClaimedReserve(userId);
  let playableW = Math.max(
    0,
    Number(state.wardogTokens ?? 0) - reserve.wardog,
  );
  let playableC = Math.max(
    0,
    Number(state.warcatTokens ?? 0) - reserve.warcat,
  );
  const playable = payWith === "wardog" ? playableW : playableC;

  const spendable = await getSpendableBalances(userId);
  const haveSpendable =
    payWith === "wardog"
      ? spendable.spendableWardog
      : spendable.spendableWarcat;

  const availablePool = healthy
    ? playable + haveSpendable
    : haveSpendable;

  if (availablePool < 0.001) {
    return {
      ok: false,
      reason: healthy ? "no_tokens" : "insufficient_spendable",
    };
  }

  const RECOVER_AMOUNT = RECOVER_ENERGY_AMOUNT;
  const RECOVER_COST = await applyDynamicTax(RECOVER_ENERGY_TOKEN_COST, payWith);
  const taxMultiplier =
    RECOVER_ENERGY_TOKEN_COST > 0 ? RECOVER_COST / RECOVER_ENERGY_TOKEN_COST : 1;

  const room = MAX_ENERGY - energy;
  const desiredEnergy = Math.min(RECOVER_AMOUNT, room);
  const desiredCost = (desiredEnergy / RECOVER_AMOUNT) * RECOVER_COST;
  const cost = Math.min(desiredCost, availablePool);
  const energyGain = Math.round((cost / RECOVER_COST) * RECOVER_AMOUNT);
  if (energyGain <= 0 || cost < 1e-9) {
    return {
      ok: false,
      reason: healthy ? "no_tokens" : "insufficient_spendable",
    };
  }

  let spentW = 0;
  let spentC = 0;
  let spentSpendable = 0;

  if (healthy) {
    // Prefer playable first for energy when treasury is healthy
    const fromPlayable = Math.min(playable, cost);
    const remainder = normalizeToken(cost - fromPlayable);

    if (fromPlayable > 1e-9) {
      const paid = spendFromSingleToken(
        playableW,
        playableC,
        fromPlayable,
        payWith,
      );
      if (!paid.ok) return { ok: false, reason: "no_tokens" };
      playableW = paid.wardog;
      playableC = paid.warcat;
      spentW += paid.spentW;
      spentC += paid.spentC;
    }

    if (remainder > 1e-9) {
      const deb = await debitSpendable(
        userId,
        payWith as TopupToken,
        remainder,
      );
      if (!deb.ok) return { ok: false, reason: "insufficient_spendable" };
      spentSpendable = remainder;
      if (payWith === "wardog") spentW += remainder;
      else spentC += remainder;
    }
  } else {
    const deb = await debitSpendable(userId, payWith as TopupToken, cost);
    if (!deb.ok) return { ok: false, reason: "insufficient_spendable" };
    spentSpendable = cost;
    if (payWith === "wardog") spentW = cost;
    else spentC = cost;
  }

  state.energy = Math.min(MAX_ENERGY, energy + energyGain);
  state.wardogTokens = normalizeToken(playableW + reserve.wardog);
  state.warcatTokens = normalizeToken(playableC + reserve.warcat);
  state.lastRegenAt = Date.now();

  await sql`
    INSERT INTO shop_ledger (user_id, item_id, cost)
    VALUES (${userId}, ${`recoverEnergy:${payWith}`}, ${cost})
  `;

  const taxedShare = taxMultiplier > 0 ? (taxMultiplier - 1) / taxMultiplier : 0;
  await recordTreasuryDeposit({
    userId,
    source: "recoverEnergy",
    wardog: (spentW - (payWith === "wardog" ? spentSpendable : 0)) * taxedShare,
    warcat: (spentC - (payWith === "warcat" ? spentSpendable : 0)) * taxedShare,
    baseAmount: cost / (taxMultiplier || 1),
    multiplier: taxMultiplier,
    details: {
      payWith,
      spentSpendable,
      treasuryZone: health.zone,
    },
  });

  await writeProgress(userId, state, { touchSyncClock: false });
  return {
    ok: true,
    state,
    energy: energyGain,
    spent: { wardog: spentW, warcat: spentC },
  };
}
