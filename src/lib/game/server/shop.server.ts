/**
 * Server-only shop purchases + energy recovery.
 *
 * HARD RULE (enforced):
 *   - Merge board remains free (energy only).
 *   - Every shop item and energy recovery requires topped-up (spendable) jettons.
 *   - Free-earned playable tokens (from merges) can ONLY be claimed to ClaimTreasury.
 *   - Never touches claimed_* reserves or claimable vault.
 *   - All costs still go through applyDynamicTax + recordTreasuryDeposit
 *     so ClaimTreasury health is always protected.
 *
 * Claims flow and top-up balances remain completely untouched.
 */

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

type PayToken = "wardog" | "warcat";

/**
 * Spend ONLY from topped-up (spendable) balances.
 * Returns false if the user does not have enough spendable jettons.
 */
async function spendSpendableOnly(
  userId: number,
  cost: number,
  payWith: PayToken,
): Promise<{ ok: true; spent: number } | { ok: false }> {
  const need = normalizeToken(cost);
  if (need <= 0) return { ok: true, spent: 0 };

  const balances = await getSpendableBalances(userId);
  const available =
    payWith === "wardog"
      ? balances.spendableWardog
      : balances.spendableWarcat;

  if (available < need - 1e-6) {
    return { ok: false };
  }

  const debited = await debitSpendable(
    userId,
    payWith as TopupToken,
    need,
  );

  if (!debited.ok) return { ok: false };

  return { ok: true, spent: need };
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
  if (!item) {
    return { ok: false, reason: "unknown_item" };
  }

  const loaded = await loadProgress(userId);
  if (!loaded) {
    return { ok: false, reason: "no_progress" };
  }

  let state = alignStateWithColumns(
    { ...(loaded.state as ServerGameState) } as ServerGameState,
    loaded,
  );

  const baseCost = Number(item.cost);
  const cost = await applyDynamicTax(baseCost, payWith);

  // HARD RULE: spendable only
  const payment = await spendSpendableOnly(userId, cost, payWith);
  if (!payment.ok) {
    return { ok: false, reason: "insufficient_spendable" };
  }

  // Apply item effect
  if (itemId === "energyPack") {
    state.energy = clampServerEnergy(Number(state.energy ?? 0) + 30);
  } else if (itemId === "gloryBoost") {
    state.gloryBoostUntil = Date.now() + 30 * 60 * 1000;
  } else if (itemId === "nukePack") {
    state.nukesOwned = (Number(state.nukesOwned ?? 0) || 0) + 1;
  }
  // Gift boxes and other items keep their existing effect logic
  // (they only grant items / tokens that are already handled downstream)

  // Ledger (cost is the final taxed amount)
  await sql`
    INSERT INTO shop_ledger (user_id, item_id, cost)
    VALUES (${userId}, ${`${itemId}:${payWith}`}, ${cost})
  `;

  // Tax portion → pending deposit for ClaimTreasury health
  const multiplier = baseCost > 0 ? cost / baseCost : 1;
  const taxedShare = multiplier > 1 ? (multiplier - 1) / multiplier : 0;

  await recordTreasuryDeposit({
    userId,
    source: `shop:${itemId}`,
    wardog: payWith === "wardog" ? cost * taxedShare : 0,
    warcat: payWith === "warcat" ? cost * taxedShare : 0,
    baseAmount: baseCost,
    multiplier,
    details: {
      payWith,
      spentSpendable: payment.spent,
      itemId,
    },
  });

  // Recompute ledger totals from current playable + claimed reserve
  // (we never spent playable, so this stays correct)
  const reserve = await getClaimedReserve(userId);
  state.wardogTokens = normalizeToken(
    Math.max(0, Number(state.wardogTokens ?? 0)),
  );
  state.warcatTokens = normalizeToken(
    Math.max(0, Number(state.warcatTokens ?? 0)),
  );

  await writeProgress(userId, state, { touchSyncClock: false });
  return { ok: true, state };
}

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

  const loaded = await loadProgress(userId);
  if (!loaded) {
    return { ok: false, reason: "no_progress" };
  }

  let state = alignStateWithColumns(
    { ...(loaded.state as ServerGameState) } as ServerGameState,
    loaded,
  );

  const currentEnergy = clampServerEnergy(Number(state.energy ?? 0));
  if (currentEnergy >= MAX_ENERGY - 0.001) {
    return { ok: false, reason: "already_full" };
  }

  const cost = await applyDynamicTax(RECOVER_ENERGY_TOKEN_COST, payWith);

  // HARD RULE: spendable only
  const payment = await spendSpendableOnly(userId, cost, payWith);
  if (!payment.ok) {
    return { ok: false, reason: "insufficient_spendable" };
  }

  state.energy = clampServerEnergy(currentEnergy + RECOVER_ENERGY_AMOUNT);

  await sql`
    INSERT INTO shop_ledger (user_id, item_id, cost)
    VALUES (${userId}, ${`recoverEnergy:${payWith}`}, ${cost})
  `;

  const taxMultiplier =
    RECOVER_ENERGY_TOKEN_COST > 0
      ? cost / RECOVER_ENERGY_TOKEN_COST
      : 1;
  const taxedShare = taxMultiplier > 1 ? (taxMultiplier - 1) / taxMultiplier : 0;

  await recordTreasuryDeposit({
    userId,
    source: "recoverEnergy",
    wardog: payWith === "wardog" ? cost * taxedShare : 0,
    warcat: payWith === "warcat" ? cost * taxedShare : 0,
    baseAmount: RECOVER_ENERGY_TOKEN_COST,
    multiplier: taxMultiplier,
    details: {
      payWith,
      spentSpendable: payment.spent,
    },
  });

  await writeProgress(userId, state, { touchSyncClock: false });

  return {
    ok: true,
    state,
    energy: state.energy,
    spent: {
      wardog: payWith === "wardog" ? cost : 0,
      warcat: payWith === "warcat" ? cost : 0,
    },
  };
}
