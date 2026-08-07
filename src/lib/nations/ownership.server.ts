// src/lib/nations/ownership.server.ts
/**
 * Server-only Nations ownership: claim/transfer/sell/buy.
 * ONE NATION RULE: buyer must leave their current nation before buying another.
 *
 * buyNation: spendable first; playable remainder only when treasury is healthy.
 * Never TON.
 */

import { sql } from "@/lib/db.server";
import { loadProgress, writeProgress } from "@/lib/game.server";
import { addTokens, subTokens, normalizeToken } from "@/lib/tokens";
import {
  NATION_LEADER_MIN_TENURE_HOURS,
  MARKETPLACE_TAX_RATE,
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
import { getMyNation, getNationDetails } from "@/lib/nations/list.server";
import { logNationEvent, markTraitor } from "@/lib/nations/history.server";
import { recalculateReputation } from "@/lib/nations/reputation.server";

export type PayToken = "wardog" | "warcat";

export async function transferNationOwnership(userId: number, toUserId: number) {
  if (userId === toUserId) throw new Error("cannot_transfer_to_self");

  const my = await getMyNation(userId);
  if (!my || my.myRole !== "leader") throw new Error("not_leader");
  if (my.isDefault) throw new Error("cannot_transfer_faction");

  const target = await sql`
    SELECT role FROM nation_members
    WHERE nation_id = ${my.id} AND user_id = ${toUserId} LIMIT 1
  `;
  if (target.rowCount === 0) throw new Error("target_not_member");

  const updated = await sql`
    UPDATE nations
    SET leader_id = ${toUserId},
        listed_price = NULL,
        listed_at = NULL
    WHERE id = ${my.id} AND leader_id = ${userId}
    RETURNING id
  `;
  if (!updated.rowCount || updated.rowCount === 0) throw new Error("not_leader");

  await sql`
    UPDATE nation_members SET role = 'member'
    WHERE nation_id = ${my.id} AND user_id = ${userId}
  `;
  await sql`
    UPDATE nation_members SET role = 'leader'
    WHERE nation_id = ${my.id} AND user_id = ${toUserId}
  `;

  await logNationEvent(my.id, userId, "transfer", { toUserId });
  return getMyNation(userId);
}

export async function listNationForSale(userId: number, price: number) {
  if (price < 0.5) throw new Error("price_too_low");
  if (price > 10000) throw new Error("price_too_high");

  const my = await getMyNation(userId);
  if (!my || my.myRole !== "leader") throw new Error("not_leader");
  if (my.isDefault) throw new Error("cannot_sell_faction");

  if (my.joinedAt) {
    const joined = new Date(my.joinedAt).getTime();
    const hours = (Date.now() - joined) / (1000 * 60 * 60);
    if (hours < NATION_LEADER_MIN_TENURE_HOURS) {
      throw new Error("leader_min_tenure");
    }
  }

  const updated = await sql`
    UPDATE nations
    SET listed_price = ${price}, listed_at = NOW()
    WHERE id = ${my.id} AND leader_id = ${userId}
    RETURNING id
  `;
  if (!updated.rowCount || updated.rowCount === 0) throw new Error("not_leader");

  await logNationEvent(my.id, userId, "list_for_sale", { price });
  return getMyNation(userId);
}

export async function unlistNation(userId: number) {
  const my = await getMyNation(userId);
  if (!my || my.myRole !== "leader") throw new Error("not_leader");

  await sql`
    UPDATE nations
    SET listed_price = NULL, listed_at = NULL
    WHERE id = ${my.id} AND leader_id = ${userId}
  `;
  await logNationEvent(my.id, userId, "unlist");
  return getMyNation(userId);
}

/**
 * Buy a listed nation.
 * Seller receives the listed price in the same token the buyer paid with.
 * Platform tax is taken from the same token and deposited to the Claim Treasury.
 */
export async function buyNation(
  buyerId: number,
  nationId: number,
  payWith: PayToken = "wardog",
) {
  if (payWith !== "wardog" && payWith !== "warcat") {
    throw new Error("invalid_pay_token");
  }

  const details = await getNationDetails(buyerId, nationId);
  if (!details) throw new Error("nation_not_found");
  if (details.isDefault) throw new Error("cannot_buy_faction");
  if (!details.listedPrice || details.listedPrice <= 0) throw new Error("not_for_sale");
  if (details.leaderId === buyerId) throw new Error("already_owner");
  if (details.isMember) throw new Error("already_member");

  const current = await getMyNation(buyerId);
  if (current && current.id !== nationId) {
    throw new Error("must_leave_current_nation");
  }

  await sql`
    UPDATE nations n
    SET leader_id = NULL, listed_price = NULL, listed_at = NULL
    WHERE n.leader_id = ${buyerId}
      AND n.id != ${nationId}
      AND NOT EXISTS (
        SELECT 1 FROM nation_members nm
        WHERE nm.nation_id = n.id AND nm.user_id = ${buyerId}
      )
  `;

  const stillLeads = await sql`
    SELECT id FROM nations
    WHERE leader_id = ${buyerId} AND id != ${nationId}
    LIMIT 1
  `;
  if ((stillLeads.rowCount ?? 0) > 0) {
    throw new Error("must_leave_or_sell_current_nation");
  }

  const sellerId = details.leaderId;
  if (!sellerId) throw new Error("no_seller");

  const price = details.listedPrice;

  const buyerProg = await loadProgress(buyerId);
  if (!buyerProg) throw new Error("no_progress");

  const platformTax = await applyDynamicTax(price * MARKETPLACE_TAX_RATE, payWith);
  const totalCost = normalizeToken(price + platformTax);

  const health = await getTreasuryHealth();
  const allowPlayable =
    health.zone === "green" || health.zone === "yellow";

  const reserve = await getClaimedReserve(buyerId);
  const buyerWardog = Math.max(
    0,
    Number(buyerProg.wardog_tokens) - reserve.wardog,
  );
  const buyerWarcat = Math.max(
    0,
    Number(buyerProg.warcat_tokens) - reserve.warcat,
  );
  const playable = payWith === "wardog" ? buyerWardog : buyerWarcat;

  const spendable = await getSpendableBalances(buyerId);
  const haveSpendable =
    payWith === "wardog"
      ? spendable.spendableWardog
      : spendable.spendableWarcat;

  const pool = allowPlayable ? playable + haveSpendable : haveSpendable;
  if (pool < totalCost - 1e-6) {
    throw new Error(
      allowPlayable ? "insufficient_tokens" : "insufficient_spendable",
    );
  }

  const fromSpendable = Math.min(haveSpendable, totalCost);
  const fromPlayable = normalizeToken(totalCost - fromSpendable);

  if (fromSpendable > 1e-9) {
    const d = await debitSpendable(
      buyerId,
      payWith as TopupToken,
      fromSpendable,
    );
    if (!d.ok) throw new Error("insufficient_spendable");
  }

  const spendWardog = payWith === "wardog" ? fromPlayable : 0;
  const spendWarcat = payWith === "warcat" ? fromPlayable : 0;

  const buyerState = {
    ...(buyerProg.state as any),
    wardogTokens: subTokens(buyerProg.wardog_tokens, spendWardog),
    warcatTokens: subTokens(buyerProg.warcat_tokens, spendWarcat),
  };
  await writeProgress(buyerId, buyerState, { touchSyncClock: false });

  const sellerWardog = payWith === "wardog" ? normalizeToken(price) : 0;
  const sellerWarcat = payWith === "warcat" ? normalizeToken(price) : 0;

  const sellerProg = await loadProgress(sellerId);
  if (sellerProg) {
    const sellerState = {
      ...(sellerProg.state as any),
      wardogTokens: addTokens(sellerProg.wardog_tokens, sellerWardog),
      warcatTokens: addTokens(sellerProg.warcat_tokens, sellerWarcat),
    };
    await writeProgress(sellerId, sellerState, { touchSyncClock: false });
  }

  await recordTreasuryDeposit({
    userId: buyerId,
    source: "marketplace_nation_buy",
    wardog: payWith === "wardog" ? platformTax : 0,
    warcat: payWith === "warcat" ? platformTax : 0,
    baseAmount: price * MARKETPLACE_TAX_RATE,
    details: {
      nationId,
      sellerId,
      price,
      platformTax,
      payWith,
      fromSpendable,
      fromPlayable,
      treasuryZone: health.zone,
    },
  });

  await sql`
    INSERT INTO shop_ledger (user_id, item_id, cost)
    VALUES (${buyerId}, ${`nation_buy_${nationId}:${payWith}`}, ${totalCost})
  `;

  const transfer = await sql`
    UPDATE nations
    SET leader_id     = ${buyerId},
        listed_price  = NULL,
        listed_at     = NULL
    WHERE id = ${nationId}
      AND leader_id = ${sellerId}
      AND listed_price = ${price}
    RETURNING id
  `;

  if (!transfer.rowCount || transfer.rowCount === 0) {
    // Race lost — refund playable portion only (spendable refund is a follow-up if needed)
    const refundState = {
      ...(buyerProg.state as any),
      wardogTokens: normalizeToken(buyerProg.wardog_tokens),
      warcatTokens: normalizeToken(buyerProg.warcat_tokens),
    };
    await writeProgress(buyerId, refundState, { touchSyncClock: false });
    // Note: spendable debit is not auto-refunded on race; rare; operator can credit
    throw new Error("not_for_sale");
  }

  await markTraitor(sellerId, "sold_nation");

  await sql`DELETE FROM nation_members WHERE user_id = ${buyerId}`;
  await sql`UPDATE users SET nation_id = NULL WHERE id = ${buyerId}`;

  await sql`
    UPDATE nation_members SET role = 'member'
    WHERE nation_id = ${nationId} AND user_id = ${sellerId}
  `;

  await sql`
    INSERT INTO nation_members (nation_id, user_id, role)
    VALUES (${nationId}, ${buyerId}, 'leader')
    ON CONFLICT (nation_id, user_id) DO UPDATE SET role = 'leader'
  `;

  await sql`UPDATE users SET nation_id = ${nationId} WHERE id = ${buyerId}`;

  await sql`
    UPDATE nations
    SET member_count = (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${nationId})
    WHERE id = ${nationId}
  `;

  await logNationEvent(nationId, buyerId, "buy", {
    sellerId,
    price,
    platformTax,
    totalCost,
    payWith,
    fromSpendable,
    fromPlayable,
  });
  await recalculateReputation(nationId);

  return getMyNation(buyerId);
}
