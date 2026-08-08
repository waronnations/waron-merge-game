/**
 * Server-only shop purchases + energy recovery.
 *
 * HARD RULES:
 *   - Merge board play is free (energy only).
 *   - energyPack + recoverEnergy: topped-up (spendable) only.
 *   - All other shop items: topped-up spendable only.
 *   - Unclaimed playable tokens are claim-only — never shop-spent.
 */

import { sql } from "@/lib/db.server";
import { normalizeToken } from "@/lib/tokens";
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

  if (available < need - 1e-6) return { ok: false };

  const debited = await debitSpendable(userId, payWith as TopupToken, need);
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
  if (!item) return { ok: false, reason: "unknown_item" };

  const loaded = await loadProgress(userId);
  if (!loaded) return { ok: false, reason: "no_progress" };

  let state = alignStateWithColumns(
    { ...(loaded.state as ServerGameState) } as ServerGameState,
    loaded,
  );

  const baseCost = Number(item.cost);
  const cost = await applyDynamicTax(baseCost, payWith);

  const payment = await spendSpendableOnly(userId, cost, payWith);
  if (!payment.ok) {
    return { ok: false, reason: "insufficient_spendable" };
  }

  if (itemId === "energyPack") {
    state.energy = clampServerEnergy(Number(state.energy ?? 0) + 30);
  } else if (itemId === "gloryBoost") {
    state.gloryBoostUntil = Date.now() + 30 * 60 * 1000;
  } else if (itemId === "nukePack") {
    state.nukesOwned = (Number(state.nukesOwned ?? 0) || 0) + 1;
  }

  await sql`
    INSERT INTO shop_ledger (user_id, item_id, cost)
    VALUES (${userId}, ${`${itemId}:${payWith}`}, ${cost})
  `;

  const multiplier = baseCost > 0 ? cost / baseCost : 1;
  const tax = normalizeToken(Math.max(0, cost - baseCost));

  await recordTreasuryDeposit({
    userId,
    source: `shop:${itemId}`,
    wardog: payWith === "wardog" ? tax : 0,
    warcat: payWith === "warcat" ? tax : 0,
    baseAmount: baseCost,
    multiplier,
    details: {
      payWith,
      spentSpendable: payment.spent,
      spentPlayable: 0,
      itemId,
      paymentSource: "spendable",
    },
  });

  state.wardogTokens = normalizeToken(Math.max(0, Number(state.wardogTokens ?? 0)));
  state.warcatTokens = normalizeToken(Math.max(0, Number(state.warcatTokens ?? 0)));

  await getClaimedReserve(userId);
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
  if (!loaded) return { ok: false, reason: "no_progress" };

  let state = alignStateWithColumns(
    { ...(loaded.state as ServerGameState) } as ServerGameState,
    loaded,
  );

  const currentEnergy = clampServerEnergy(Number(state.energy ?? 0));
  if (currentEnergy >= MAX_ENERGY - 0.001) {
    return { ok: false, reason: "already_full" };
  }

  const cost = await applyDynamicTax(RECOVER_ENERGY_TOKEN_COST, payWith);
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
    RECOVER_ENERGY_TOKEN_COST > 0 ? cost / RECOVER_ENERGY_TOKEN_COST : 1;
  const tax = normalizeToken(Math.max(0, cost - RECOVER_ENERGY_TOKEN_COST));

  await recordTreasuryDeposit({
    userId,
    source: "recoverEnergy",
    wardog: payWith === "wardog" ? tax : 0,
    warcat: payWith === "warcat" ? tax : 0,
    baseAmount: RECOVER_ENERGY_TOKEN_COST,
    multiplier: taxMultiplier,
    details: {
      payWith,
      spentSpendable: payment.spent,
      spentPlayable: 0,
      paymentSource: "spendable",
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
