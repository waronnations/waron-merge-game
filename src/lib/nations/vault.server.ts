// src/lib/nations/vault.server.ts
/**
 * Vault, buffs, protection, traitor redemption & invite rewards.
 * Server-only. All economy actions stay authoritative:
 *  · player spends: spendable first; playable (totals − claimed) only when treasury is healthy
 *  · every fee runs through the live treasury multiplier
 *  · the taxed delta is recorded as a pending treasury deposit
 */
import { sql } from "@/lib/db.server";
import {
  NATION_BUFFS,
  NATION_PROTECTION_COST,
  NATION_PROTECTION_DURATION_MS,
  MAX_REDEMPTION_PRICE,
  BUFF_ACTIVATION_REP,
  PROTECTION_ACTIVATION_REP,
  VAULT_DONATION_REP,
  NATION_INVITE_REWARD,
  TRAITOR_COOLDOWN_DAYS,
  MAX_ENERGY,
  type NationBuffId,
} from "@/lib/constants";
import { normalizeToken, subTokens } from "@/lib/tokens";
import {
  quoteDynamicTax,
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
  loadProgress,
  writeProgress,
  alignStateWithColumns,
  type ServerGameState,
} from "@/lib/game/server/state.server";
import { recalculateReputation } from "@/lib/nations/reputation.server";
import { logNationEvent } from "@/lib/nations/history.server";

/** Playable balances = ledger totals − claimed reserve. */
async function loadPlayable(userId: number) {
  const prev = await loadProgress(userId);
  if (!prev) throw new Error("no_progress");
  const state = alignStateWithColumns(
    { ...(prev.state as ServerGameState) } as ServerGameState,
    prev,
  );
  const reserve = await getClaimedReserve(userId);
  return {
    state,
    reserve,
    playableWardog: Math.max(0, Number(state.wardogTokens ?? 0) - reserve.wardog),
    playableWarcat: Math.max(0, Number(state.warcatTokens ?? 0) - reserve.warcat),
  };
}

/**
 * Prefer spendable; if treasury is healthy (green/yellow), allow playable remainder.
 * Throws insufficient_spendable | insufficient_tokens.
 */
async function spendPlayableTokens(
  userId: number,
  wardog: number,
  warcat: number,
): Promise<void> {
  const w = normalizeToken(Math.max(0, Number(wardog) || 0));
  const c = normalizeToken(Math.max(0, Number(warcat) || 0));
  if (w <= 0 && c <= 0) return;

  const health = await getTreasuryHealth();
  const allowPlayable =
    health.zone === "green" || health.zone === "yellow";

  const { state, reserve, playableWardog, playableWarcat } =
    await loadPlayable(userId);

  const spendable = await getSpendableBalances(userId);

  let needW = w;
  let needC = c;
  const fromSpendableW = Math.min(spendable.spendableWardog, needW);
  const fromSpendableC = Math.min(spendable.spendableWarcat, needC);
  needW = normalizeToken(needW - fromSpendableW);
  needC = normalizeToken(needC - fromSpendableC);

  if (fromSpendableW > 1e-9) {
    const d = await debitSpendable(
      userId,
      "wardog" as TopupToken,
      fromSpendableW,
    );
    if (!d.ok) throw new Error("insufficient_spendable");
  }
  if (fromSpendableC > 1e-9) {
    const d = await debitSpendable(
      userId,
      "warcat" as TopupToken,
      fromSpendableC,
    );
    if (!d.ok) throw new Error("insufficient_spendable");
  }

  if (needW <= 1e-9 && needC <= 1e-9) return;

  if (!allowPlayable) throw new Error("insufficient_spendable");

  if (playableWardog < needW - 1e-6 || playableWarcat < needC - 1e-6) {
    throw new Error("insufficient_tokens");
  }

  state.wardogTokens = normalizeToken(
    subTokens(playableWardog, needW) + reserve.wardog,
  );
  state.warcatTokens = normalizeToken(
    subTokens(playableWarcat, needC) + reserve.warcat,
  );

  await writeProgress(userId, state, { touchSyncClock: false });
}

export async function donateToVault(
  userId: number,
  nationId: number,
  wardogAmount: number,
  warcatAmount: number,
) {
  const member = await sql`
    SELECT role FROM nation_members
    WHERE user_id = ${userId} AND nation_id = ${nationId}
    LIMIT 1
  `;
  if (!member.rows[0]) throw new Error("not_a_member");

  const w = normalizeToken(Math.max(0, Number(wardogAmount) || 0));
  const c = normalizeToken(Math.max(0, Number(warcatAmount) || 0));
  if (w <= 0 && c <= 0) throw new Error("invalid_amount");

  const quoteW = w > 0 ? await quoteDynamicTax(w) : null;
  const quoteC = c > 0 ? await quoteDynamicTax(c) : null;

  await spendPlayableTokens(
    userId,
    quoteW?.final ?? 0,
    quoteC?.final ?? 0,
  );

  await sql`
    UPDATE nations
    SET vault_wardog = vault_wardog + ${w},
        vault_warcat = vault_warcat + ${c},
        last_activity_at = NOW()
    WHERE id = ${nationId}
  `;

  const taxW = quoteW?.tax ?? 0;
  const taxC = quoteC?.tax ?? 0;
  if (taxW > 0 || taxC > 0) {
    await recordTreasuryDeposit({
      userId,
      source: "vault_donation_tax",
      wardog: taxW,
      warcat: taxC,
      baseAmount: w + c,
      multiplier: quoteW?.multiplier ?? quoteC?.multiplier ?? 1,
      details: { nationId },
    });
  }

  await logNationEvent(nationId, userId, "vault_donation", {
    wardog: w,
    warcat: c,
    paidWardog: quoteW?.final ?? 0,
    paidWarcat: quoteC?.final ?? 0,
  });

  await recalculateReputation(nationId, VAULT_DONATION_REP);
  return { ok: true as const, wardog: w, warcat: c };
}

export async function activateNationBuff(
  userId: number,
  buffId: NationBuffId,
) {
  const buff = NATION_BUFFS[buffId];
  if (!buff) throw new Error("invalid_buff");

  const mem = await sql`
    SELECT nm.role, nm.nation_id, n.vault_wardog, n.vault_warcat,
           n.buff_expires_at
    FROM nation_members nm
    JOIN nations n ON n.id = nm.nation_id
    WHERE nm.user_id = ${userId}
    LIMIT 1
  `;
  const row = mem.rows[0];
  if (!row) throw new Error("not_in_nation");
  if (row.role !== "leader" && row.role !== "officer") {
    throw new Error("insufficient_authority");
  }

  const nationId = Number(row.nation_id);
  const vaultW = Number(row.vault_wardog || 0);
  const vaultC = Number(row.vault_warcat || 0);

  const quoteW = await quoteDynamicTax(buff.costWardog);
  const quoteC = await quoteDynamicTax(buff.costWarcat);
  const costW = quoteW.final;
  const costC = quoteC.final;

  if (vaultW < costW - 1e-6 || vaultC < costC - 1e-6) {
    throw new Error("insufficient_vault");
  }

  await sql`
    UPDATE nations
    SET vault_wardog = vault_wardog - ${costW},
        vault_warcat = vault_warcat - ${costC},
        active_buff = ${buff.id},
        buff_expires_at = CASE
          WHEN ${buff.durationMs} > 0 THEN NOW() + (${buff.durationMs} || ' milliseconds')::interval
          ELSE NULL
        END,
        last_activity_at = NOW()
    WHERE id = ${nationId}
  `;

  if (quoteW.tax > 0 || quoteC.tax > 0) {
    await recordTreasuryDeposit({
      userId,
      source: "nation_buff_tax",
      wardog: quoteW.tax,
      warcat: quoteC.tax,
      baseAmount: buff.costWardog + buff.costWarcat,
      multiplier: quoteW.multiplier,
      details: { nationId, buffId },
    });
  }

  const energyGrant = Number(
    (buff as { energyGrant?: number }).energyGrant ?? 0,
  );
  if (energyGrant > 0) {
    await sql`
      UPDATE progress
      SET state = jsonb_set(
        jsonb_set(
          state,
          '{energy}',
          to_jsonb(LEAST(${MAX_ENERGY}, COALESCE((state->>'energy')::numeric, 0) + ${energyGrant}))
        ),
        '{lastRegenAt}', to_jsonb(EXTRACT(EPOCH FROM NOW()) * 1000)
      )
      WHERE user_id IN (
        SELECT user_id FROM nation_members WHERE nation_id = ${nationId}
      )
    `;
  }

  await logNationEvent(nationId, userId, "buff_activated", {
    buffId,
    costWardog: costW,
    costWarcat: costC,
  });

  await recalculateReputation(nationId, BUFF_ACTIVATION_REP);
  return { ok: true as const, buffId };
}

export async function activateProtection(userId: number) {
  const mem = await sql`
    SELECT nm.role, nm.nation_id, n.vault_wardog, n.vault_warcat,
           n.is_protected, n.protection_expires_at
    FROM nation_members nm
    JOIN nations n ON n.id = nm.nation_id
    WHERE nm.user_id = ${userId}
    LIMIT 1
  `;
  const row = mem.rows[0];
  if (!row || row.role !== "leader") throw new Error("not_leader");

  const nationId = Number(row.nation_id);
  const alreadyProtected =
    Boolean(row.is_protected) &&
    row.protection_expires_at &&
    new Date(String(row.protection_expires_at)).getTime() > Date.now();

  if (alreadyProtected) throw new Error("already_protected");

  const quoteW = await quoteDynamicTax(NATION_PROTECTION_COST.wardog);
  const quoteC = await quoteDynamicTax(NATION_PROTECTION_COST.warcat);
  const costW = quoteW.final;
  const costC = quoteC.final;

  if (
    Number(row.vault_wardog || 0) < costW - 1e-6 ||
    Number(row.vault_warcat || 0) < costC - 1e-6
  ) {
    throw new Error("insufficient_vault");
  }

  await sql`
    UPDATE nations
    SET vault_wardog = vault_wardog - ${costW},
        vault_warcat = vault_warcat - ${costC},
        is_protected = TRUE,
        protection_expires_at = NOW() + (${NATION_PROTECTION_DURATION_MS} || ' milliseconds')::interval,
        last_activity_at = NOW()
    WHERE id = ${nationId}
  `;

  if (quoteW.tax > 0 || quoteC.tax > 0) {
    await recordTreasuryDeposit({
      userId,
      source: "nation_protection_tax",
      wardog: quoteW.tax,
      warcat: quoteC.tax,
      baseAmount:
        NATION_PROTECTION_COST.wardog + NATION_PROTECTION_COST.warcat,
      multiplier: quoteW.multiplier,
      details: { nationId },
    });
  }

  await logNationEvent(nationId, userId, "protection_activated", {
    costWardog: costW,
    costWarcat: costC,
    durationMs: NATION_PROTECTION_DURATION_MS,
  });

  await recalculateReputation(nationId, PROTECTION_ACTIVATION_REP);
  return { ok: true as const };
}

export async function setRedemptionPrice(
  userId: number,
  wardog: number,
  warcat: number,
) {
  const w = Math.min(
    MAX_REDEMPTION_PRICE.wardog,
    Math.max(0, Number(wardog) || 0),
  );
  const c = Math.min(
    MAX_REDEMPTION_PRICE.warcat,
    Math.max(0, Number(warcat) || 0),
  );

  const mem = await sql`
    SELECT role, nation_id FROM nation_members
    WHERE user_id = ${userId} LIMIT 1
  `;
  if (!mem.rows[0] || mem.rows[0].role !== "leader") {
    throw new Error("not_leader");
  }

  const nationId = Number(mem.rows[0].nation_id);
  await sql`
    UPDATE nations
    SET redemption_price_wardog = ${w},
        redemption_price_warcat = ${c}
    WHERE id = ${nationId}
  `;
  await logNationEvent(nationId, userId, "redemption_price_set", {
    wardog: w,
    warcat: c,
  });
  return { ok: true as const, wardog: w, warcat: c };
}

async function findBetrayedNation(userId: number): Promise<number | null> {
  const res = await sql`
    SELECT nation_id FROM nation_history
    WHERE user_id = ${userId}
      AND event IN ('member_left', 'leader_left', 'left', 'kicked')
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const id = res.rows[0]?.nation_id;
  return id != null ? Number(id) : null;
}

export async function redeemTraitor(
  userId: number,
  pay: boolean,
  payWith: "wardog" | "warcat" = "wardog",
) {
  const userRes = await sql`
    SELECT is_traitor, traitor_since FROM users WHERE id = ${userId} LIMIT 1
  `;
  const user = userRes.rows[0];
  if (!user) throw new Error("user_not_found");
  if (!user.is_traitor) return { ok: true as const, alreadyClean: true };

  const nationId = await findBetrayedNation(userId);

  if (!pay) {
    const since = user.traitor_since
      ? new Date(String(user.traitor_since)).getTime()
      : 0;
    const elapsedDays = since
      ? (Date.now() - since) / (24 * 60 * 60 * 1000)
      : Infinity;
    if (elapsedDays < TRAITOR_COOLDOWN_DAYS) {
      throw new Error("cooldown_active");
    }
  } else {
    let priceW = 15;
    let priceC = 15;
    if (nationId != null) {
      const nat = await sql`
        SELECT redemption_price_wardog, redemption_price_warcat
        FROM nations WHERE id = ${nationId} LIMIT 1
      `;
      priceW = Number(nat.rows[0]?.redemption_price_wardog ?? 15);
      priceC = Number(nat.rows[0]?.redemption_price_warcat ?? 15);
    }

    const base = payWith === "wardog" ? priceW : priceC;
    const quote = await quoteDynamicTax(base);

    await spendPlayableTokens(
      userId,
      payWith === "wardog" ? quote.final : 0,
      payWith === "warcat" ? quote.final : 0,
    );

    if (nationId != null && base > 0) {
      await sql`
        UPDATE nations
        SET vault_wardog = vault_wardog + ${payWith === "wardog" ? base : 0},
            vault_warcat = vault_warcat + ${payWith === "warcat" ? base : 0},
            last_activity_at = NOW()
        WHERE id = ${nationId}
      `;
    }

    if (quote.tax > 0) {
      await recordTreasuryDeposit({
        userId,
        source: "traitor_redemption_tax",
        wardog: payWith === "wardog" ? quote.tax : 0,
        warcat: payWith === "warcat" ? quote.tax : 0,
        baseAmount: base,
        multiplier: quote.multiplier,
        details: { nationId },
      });
    }
  }

  await sql`
    UPDATE users
    SET is_traitor = FALSE,
        traitor_since = NULL,
        traitor_reason = NULL
    WHERE id = ${userId}
  `;

  if (nationId != null) {
    await logNationEvent(nationId, userId, "traitor_redeemed", { paid: pay });
    await recalculateReputation(nationId);
  }

  return { ok: true as const, paid: pay };
}

export async function isNationProtected(nationId: number): Promise<boolean> {
  const res = await sql`
    SELECT is_protected, protection_expires_at
    FROM nations WHERE id = ${nationId} LIMIT 1
  `;
  const row = res.rows[0];
  if (!row || !row.is_protected) return false;
  if (!row.protection_expires_at) return false;
  return new Date(String(row.protection_expires_at)).getTime() > Date.now();
}

export async function grantNationInviteReward(
  inviterId: number,
  nationId: number,
) {
  const reward = NATION_INVITE_REWARD;

  const prev = await loadProgress(inviterId);
  if (prev) {
    const state = alignStateWithColumns(
      { ...(prev.state as ServerGameState) } as ServerGameState,
      prev,
    );
    state.wardogTokens = normalizeToken(
      Number(state.wardogTokens ?? 0) + reward.wardog,
    );
    state.warcatTokens = normalizeToken(
      Number(state.warcatTokens ?? 0) + reward.warcat,
    );
    state.glory = Number(state.glory ?? 0) + reward.glory;
    await writeProgress(inviterId, state, {
      touchSyncClock: false,
      gloryDelta: reward.glory,
    });
  }

  await recalculateReputation(nationId, reward.nationRep);

  await sql`
    UPDATE nations SET last_activity_at = NOW() WHERE id = ${nationId}
  `;

  await logNationEvent(nationId, inviterId, "invite_reward", { ...reward });

  return { ok: true as const, reward };
}
