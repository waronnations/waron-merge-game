/**
 * Server-only shop purchases + energy recovery.
 *
 * HARD RULES:
 *   - Merge board play is free (energy only). No token spend on merge/spawn/swap.
 *   - Board energy recover (serverRecoverEnergy): UNCLAIMED playable jettons only
 *     (earned on board = wardog_tokens/warcat_tokens − claimed_*). Never top-up.
 *   - energyPack + all other shop items: topped-up spendable only.
 *   - All paid costs still use applyDynamicTax + recordTreasuryDeposit.
 *   - Never spends claimed_* reserve (claimable vault stays intact).
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
 * Used for energyPack and all non-recover shop items.
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

/**
 * Spend ONLY from unclaimed playable balances (merge earnings).
 * playable = progress tokens − claimed_* reserve.
 * Never touches top-up / spendable.
 * Used exclusively by board energy recover.
 */
function spendPlayableOnly(
  state: ServerGameState,
  reserve: { wardog: number; warcat: number },
  cost: number,
  payWith: PayToken,
):
  | { ok: true; state: ServerGameState; spent: number }
  | { ok: false } {
  const need = normalizeToken(cost);
  if (need <= 0) return { ok: true, state, spent: 0 };

  const totalW = Number(state.wardogTokens ?? 0);
  const totalC = Number(state.warcatTokens ?? 0);
  const playableW = Math.max(0, totalW - reserve.wardog);
  const playableC = Math.max(0, totalC - reserve.warcat);

  if (payWith === "wardog") {
    if (playableW < need - 1e-6) return { ok: false };
    return {
      ok: true,
      state: {
        ...state,
        wardogTokens: normalizeToken(subTokens(totalW, need)),
        warcatTokens: normalizeToken(totalC),
      },
      spent: need,
    };
  }

  if (playableC < need - 1e-6) return { ok: false };
  return {
    ok: true,
    state: {
      ...state,
      wardogTokens: normalizeToken(totalW),
      warcatTokens: normalizeToken(subTokens(totalC, need)),
    },
    spent: need,
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

  // energyPack + every other shop item → spendable (top-up) only
  const payment = await spendSpendableOnly(userId, cost, payWith);
  if (!payment.ok) {
    return { ok: false, reason: "insufficient_spendable" };
  }

  // Apply item effect
  if (itemId === "energyPack") {
    state.energy = clampServerEnergy(
      Number(state.energy ?? 0) + 30,
      0,
    );
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

  state.wardogTokens = normalizeToken(
    Math.max(0, Number(state.wardogTokens ?? 0)),
  );
  state.warcatTokens = normalizeToken(
    Math.max(0, Number(state.warcatTokens ?? 0)),
  );

  await writeProgress(userId, state, { touchSyncClock: false });
  return { ok: true, state };
}

/**
 * Board energy recover — UNCLAIMED playable jettons only.
 * Does not touch top-up / spendable balances.
 * This is the only place in the game that spends unclaimed tokens.
 *
 * FIX: apply passive regen BEFORE the "full" check so client/server
 * energy desync (client shows 0, server still has old high value)
 * no longer falsely returns energy_full.
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

  const loaded = await loadProgress(userId);
  if (!loaded) {
    return { ok: false, reason: "no_progress" };
  }

  let state = alignStateWithColumns(
    { ...(loaded.state as ServerGameState) } as ServerGameState,
    loaded,
  );

  // ── Apply passive regen BEFORE the "full" check ──────────────────────
  const now = Date.now();
  let currentEnergy = clampServerEnergy(Number(state.energy ?? 0), 0);
  const lastRegen =
    typeof state.lastRegenAt === "number" && state.lastRegenAt > 0
      ? state.lastRegenAt
      : now;

  // Base regen rate (1 energy / 75s) — same as ENERGY_REGEN_MS
  const ENERGY_REGEN_MS = 75_000;
  const gained = Math.floor((now - lastRegen) / ENERGY_REGEN_MS);
  if (gained > 0 && currentEnergy < MAX_ENERGY) {
    currentEnergy = clampServerEnergy(currentEnergy + gained, 0);
    state.energy = currentEnergy;
    state.lastRegenAt = lastRegen + gained * ENERGY_REGEN_MS;
  }

  // Only reject when truly full (0.5 tolerance for float noise)
  if (currentEnergy >= MAX_ENERGY - 0.5) {
    // Persist any regen we applied so the next pull is consistent
    await writeProgress(userId, state, { touchSyncClock: false });
    return { ok: false, reason: "energy_full" };
  }

  const cost = await applyDynamicTax(RECOVER_ENERGY_TOKEN_COST, payWith);
  const reserve = await getClaimedReserve(userId);

  const paid = spendPlayableOnly(state, reserve, cost, payWith);
  if (!paid.ok) {
    return { ok: false, reason: "insufficient_playable" };
  }
  state = paid.state;

  state.energy = clampServerEnergy(
    currentEnergy + RECOVER_ENERGY_AMOUNT,
    0,
  );
  state.lastRegenAt = now;

  await sql`
    INSERT INTO shop_ledger (user_id, item_id, cost)
    VALUES (${userId}, ${`recoverEnergy:${payWith}`}, ${cost})
  `;

  const taxMultiplier =
    RECOVER_ENERGY_TOKEN_COST > 0
      ? cost / RECOVER_ENERGY_TOKEN_COST
      : 1;
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
      spentPlayable: paid.spent,
      spentSpendable: 0,
      paymentSource: "playable",
    },
  });

  await writeProgress(userId, state, { touchSyncClock: false });

  return {
    ok: true,
    state,
    energy: RECOVER_ENERGY_AMOUNT,
    spent: {
      wardog: payWith === "wardog" ? paid.spent : 0,
      warcat: payWith === "warcat" ? paid.spent : 0,
    },
  };
}
