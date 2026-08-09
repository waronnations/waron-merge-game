// src/lib/battlefield.server.ts
/**
 * OPS Battlefield — inventory in ops_inventory (NOT progress.state).
 * progress sync must never wipe weapons.
 */

import { sql } from "@/lib/db.server";
import { loadProgress, writeProgress } from "@/lib/game.server";
import { addTokens, normalizeToken } from "@/lib/tokens";
import {
  BATTLEFIELD_WEAPONS,
  BATTLEFIELD_DAILY_ATTACK_CAP,
  OPS_PROTECTED_LEADER_JAIL_MS,
  OPS_PROTECTED_LEADER_GLORY_LOSS,
  OPS_PROTECTED_LEADER_TOKEN_LOSS,
  type BattlefieldWeaponId,
} from "@/lib/constants";
import {
  applyDynamicTax,
  quoteDynamicTax,
  recordTreasuryDeposit,
  getTreasuryHealth,
} from "@/lib/treasury.server";
import {
  getSpendableBalances,
  debitSpendable,
  type TopupToken,
} from "@/lib/topups.server";

export type PayToken = "wardog" | "warcat";

type WeaponInv = Record<string, number>;

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function ensureBattlefieldSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS ops_history (
      id            BIGSERIAL PRIMARY KEY,
      attacker_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      victim_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
      victim_telegram_id BIGINT,
      weapon_id     TEXT NOT NULL,
      hit           BOOLEAN NOT NULL DEFAULT FALSE,
      pay_token     TEXT,
      cost          NUMERIC(20,4) NOT NULL DEFAULT 0,
      tax_amount    NUMERIC(20,4) NOT NULL DEFAULT 0,
      glory_gained  INT NOT NULL DEFAULT 0,
      token_reward  NUMERIC(20,4) NOT NULL DEFAULT 0,
      details       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ops_history_attacker_idx ON ops_history (attacker_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ops_history_victim_idx ON ops_history (victim_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ops_history_created_idx ON ops_history (created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS ops_cooldowns (
      user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      weapon_id   TEXT NOT NULL,
      ready_at    TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (user_id, weapon_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ops_inventory (
      user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      weapon_id   TEXT NOT NULL,
      qty         INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
      PRIMARY KEY (user_id, weapon_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ops_inventory_user_idx ON ops_inventory (user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS ops_jail (
      user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      jail_until  TIMESTAMPTZ NOT NULL,
      reason      TEXT NOT NULL DEFAULT 'attacked_protected_leader'
    )
  `;
}

async function readInventory(userId: number): Promise<WeaponInv> {
  const res = await sql`
    SELECT weapon_id, qty FROM ops_inventory
    WHERE user_id = ${userId} AND qty > 0
  `;
  const out: WeaponInv = {};
  for (const r of res.rows) {
    out[String(r.weapon_id)] = Math.floor(Number(r.qty));
  }
  return out;
}

async function addInventory(
  userId: number,
  weaponId: string,
  delta: number,
): Promise<number> {
  if (delta === 0) {
    const cur = await readInventory(userId);
    return cur[weaponId] ?? 0;
  }
  if (delta > 0) {
    await sql`
      INSERT INTO ops_inventory (user_id, weapon_id, qty)
      VALUES (${userId}, ${weaponId}, ${delta})
      ON CONFLICT (user_id, weapon_id)
      DO UPDATE SET qty = ops_inventory.qty + EXCLUDED.qty
    `;
  } else {
    await sql`
      UPDATE ops_inventory
      SET qty = GREATEST(0, qty + ${delta})
      WHERE user_id = ${userId} AND weapon_id = ${weaponId}
    `;
  }
  const inv = await readInventory(userId);
  return inv[weaponId] ?? 0;
}

async function consumeWeapon(
  userId: number,
  weaponId: string,
): Promise<boolean> {
  const res = await sql`
    UPDATE ops_inventory
    SET qty = qty - 1
    WHERE user_id = ${userId}
      AND weapon_id = ${weaponId}
      AND qty >= 1
    RETURNING qty
  `;
  return (res.rowCount ?? 0) > 0;
}

export async function resolveBattlefieldTarget(
  query: string,
): Promise<
  | {
      ok: true;
      userId: number;
      telegramId: number;
      username: string | null;
      firstName: string | null;
      displayName: string;
    }
  | { ok: false; error: string }
> {
  const raw = String(query ?? "").trim();
  if (!raw) return { ok: false, error: "invalid_target" };

  if (/^\d+$/.test(raw)) {
    const tg = Number(raw);
    if (!Number.isFinite(tg) || tg < 1) return { ok: false, error: "invalid_target" };
    const res = await sql`
      SELECT id, telegram_id, username, first_name
      FROM users WHERE telegram_id = ${tg} LIMIT 1
    `;
    if (!res.rows[0]) return { ok: false, error: "target_not_found" };
    const r = res.rows[0];
    const username = (r.username as string) || null;
    const firstName = (r.first_name as string) || null;
    return {
      ok: true,
      userId: Number(r.id),
      telegramId: Number(r.telegram_id),
      username,
      firstName,
      displayName: username ? `@${username}` : firstName || `tg:${tg}`,
    };
  }

  const uname = raw.replace(/^@/, "").toLowerCase();
  if (uname.length < 2 || uname.length > 64) {
    return { ok: false, error: "invalid_target" };
  }
  const res = await sql`
    SELECT id, telegram_id, username, first_name
    FROM users
    WHERE LOWER(username) = ${uname}
    LIMIT 1
  `;
  if (!res.rows[0]) return { ok: false, error: "target_not_found" };
  const r = res.rows[0];
  const username = (r.username as string) || null;
  const firstName = (r.first_name as string) || null;
  return {
    ok: true,
    userId: Number(r.id),
    telegramId: Number(r.telegram_id),
    username,
    firstName,
    displayName: username ? `@${username}` : firstName || `user:${r.id}`,
  };
}

async function isNationProtected(userId: number): Promise<boolean> {
  const res = await sql`
    SELECT n.is_protected, n.protection_expires_at
    FROM users u
    LEFT JOIN nations n ON n.id = u.nation_id
    WHERE u.id = ${userId}
    LIMIT 1
  `;
  const row = res.rows[0];
  if (!row || !row.is_protected) return false;
  if (!row.protection_expires_at) return true;
  return new Date(row.protection_expires_at as string).getTime() > Date.now();
}

async function isProtectedNationLeader(userId: number): Promise<boolean> {
  const res = await sql`
    SELECT n.is_protected, n.protection_expires_at, n.leader_id
    FROM users u
    JOIN nations n ON n.id = u.nation_id
    WHERE u.id = ${userId}
    LIMIT 1
  `;
  const row = res.rows[0];
  if (!row) return false;
  const protectedUntil = row.protection_expires_at
    ? new Date(String(row.protection_expires_at)).getTime()
    : 0;
  const isCurrentlyProtected =
    Boolean(row.is_protected) &&
    (protectedUntil === 0 || protectedUntil > Date.now());
  return isCurrentlyProtected && Number(row.leader_id) === userId;
}

async function notifyUser(
  userId: number,
  telegramId: number,
  kind: string,
  text: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO notifications (user_id, telegram_id, kind, text, due_at)
      VALUES (${userId}, ${telegramId}, ${kind}, ${text}, NOW())
    `;
  } catch {
    /* non-fatal */
  }
}

export async function getBattlefieldInventory(userId: number): Promise<{
  weapons: WeaponInv;
  cooldowns: Record<string, number>;
  attacksToday: number;
}> {
  await ensureBattlefieldSchema();
  const inv = await readInventory(userId);

  const cdsRes = await sql`
    SELECT weapon_id, ready_at FROM ops_cooldowns
    WHERE user_id = ${userId}
  `;
  const cooldowns: Record<string, number> = {};
  for (const r of cdsRes.rows) {
    cooldowns[String(r.weapon_id)] = new Date(r.ready_at as string).getTime();
  }

  const day = utcDayKey();
  const atkRes = await sql`
    SELECT COUNT(*)::int AS c FROM ops_history
    WHERE attacker_id = ${userId}
      AND created_at >= ${day}::date
      AND created_at < (${day}::date + INTERVAL '1 day')
  `;
  const attacksToday = Number(atkRes.rows[0]?.c ?? 0);

  return { weapons: inv, cooldowns, attacksToday };
}

export async function getBattlefieldArmoryQuotes(): Promise<
  Array<{
    weaponId: BattlefieldWeaponId;
    base: number;
    final: number;
    tax: number;
    multiplier: number;
    zone: string;
  }>
> {
  const out = [];
  for (const w of Object.values(BATTLEFIELD_WEAPONS)) {
    const q = await quoteDynamicTax(w.cost);
    out.push({
      weaponId: w.id,
      base: q.base,
      final: q.final,
      tax: q.tax,
      multiplier: q.multiplier,
      zone: q.zone,
    });
  }
  return out;
}

export async function buyBattlefieldWeapon(
  userId: number,
  weaponId: BattlefieldWeaponId,
  payWith: PayToken = "wardog",
): Promise<
  | {
      ok: true;
      inventory: WeaponInv;
      base: number;
      cost: number;
      tax: number;
      multiplier: number;
      zone: string;
    }
  | { ok: false; error: string }
> {
  await ensureBattlefieldSchema();
  const weapon = BATTLEFIELD_WEAPONS[weaponId];
  if (!weapon) return { ok: false, error: "invalid_weapon" };
  if (payWith !== "wardog" && payWith !== "warcat") {
    return { ok: false, error: "invalid_pay_token" };
  }

  const base = weapon.cost;
  if (!(base > 0)) return { ok: false, error: "invalid_weapon_cost" };

  const health = await getTreasuryHealth();
  const total = normalizeToken(await applyDynamicTax(base, payWith));
  const tax = normalizeToken(Math.max(0, total - base));
  if (!(total > 0)) return { ok: false, error: "invalid_amount" };

  const spendable = await getSpendableBalances(userId);
  const have =
    payWith === "wardog"
      ? spendable.spendableWardog
      : spendable.spendableWarcat;

  if (have < total - 1e-6) {
    return { ok: false, error: "insufficient_spendable" };
  }

  const deb = await debitSpendable(userId, payWith as TopupToken, total);
  if (!deb.ok) {
    return { ok: false, error: "insufficient_spendable" };
  }

  await addInventory(userId, weaponId, 1);
  const inv = await readInventory(userId);

  await recordTreasuryDeposit({
    userId,
    source: `battlefield_buy:${weaponId}`,
    wardog: payWith === "wardog" ? tax : 0,
    warcat: payWith === "warcat" ? tax : 0,
    baseAmount: base,
    multiplier: health.taxMultiplier,
    details: {
      weaponId,
      payWith,
      total,
      tax,
      zone: health.zone,
    },
  });

  return {
    ok: true,
    inventory: inv,
    base,
    cost: total,
    tax,
    multiplier: health.taxMultiplier,
    zone: health.zone,
  };
}

export async function battlefieldStrike(
  attackerId: number,
  targetQuery: string | number,
  weaponId: BattlefieldWeaponId,
): Promise<
  | {
      ok: true;
      hit: boolean;
      gloryGained: number;
      tokenReward: number;
      victimName: string | null;
      victimTelegramId: number;
      jailed?: boolean;
      jailUntil?: number;
      message?: string;
    }
  | { ok: false; error: string }
> {
  await ensureBattlefieldSchema();
  const weapon = BATTLEFIELD_WEAPONS[weaponId];
  if (!weapon) return { ok: false, error: "invalid_weapon" };

  const target = await resolveBattlefieldTarget(String(targetQuery));
  if (!target.ok) return { ok: false, error: target.error };

  const me = await sql`
    SELECT id, telegram_id, username, first_name
    FROM users WHERE id = ${attackerId} LIMIT 1
  `;
  if (!me.rows[0]) return { ok: false, error: "unauthorized" };
  const myTg = Number(me.rows[0].telegram_id ?? 0);
  if (myTg && myTg === target.telegramId) {
    return { ok: false, error: "cannot_attack_self" };
  }
  if (Number(me.rows[0].id) === target.userId) {
    return { ok: false, error: "cannot_attack_self" };
  }

  const attackerLabel = (me.rows[0].username as string)
    ? `@${me.rows[0].username}`
    : (me.rows[0].first_name as string) || `tg:${myTg}`;

  // ── Protected Nation Leader → JAIL the attacker ──────────────────────────
  if (await isProtectedNationLeader(target.userId)) {
    const invSnap = await getBattlefieldInventory(attackerId);
    if (invSnap.attacksToday >= BATTLEFIELD_DAILY_ATTACK_CAP) {
      return { ok: false, error: "daily_cap" };
    }
    if ((invSnap.weapons[weaponId] ?? 0) < 1) {
      return { ok: false, error: "no_weapon" };
    }
    const readyAt = invSnap.cooldowns[weaponId] ?? 0;
    if (readyAt > Date.now()) {
      return { ok: false, error: "cooldown" };
    }

    const consumed = await consumeWeapon(attackerId, weaponId);
    if (!consumed) return { ok: false, error: "no_weapon" };

    const prog = await loadProgress(attackerId);
    if (prog) {
      const state = { ...(prog.state as any) };
      state.glory = Math.max(
        0,
        Number(state.glory ?? prog.glory ?? 0) - OPS_PROTECTED_LEADER_GLORY_LOSS,
      );
      state.wardogTokens = Math.max(
        0,
        Number(prog.wardog_tokens ?? state.wardogTokens ?? 0) -
          OPS_PROTECTED_LEADER_TOKEN_LOSS,
      );
      state.warcatTokens = Math.max(
        0,
        Number(prog.warcat_tokens ?? state.warcatTokens ?? 0) -
          OPS_PROTECTED_LEADER_TOKEN_LOSS,
      );
      await writeProgress(attackerId, state, { touchSyncClock: false });
    }

    const jailUntil = new Date(Date.now() + OPS_PROTECTED_LEADER_JAIL_MS);
    await sql`
      INSERT INTO ops_jail (user_id, jail_until, reason)
      VALUES (${attackerId}, ${jailUntil.toISOString()}, 'attacked_protected_leader')
      ON CONFLICT (user_id)
      DO UPDATE SET jail_until = EXCLUDED.jail_until, reason = EXCLUDED.reason
    `;

    const ready = new Date(Date.now() + weapon.cooldownSec * 1000);
    await sql`
      INSERT INTO ops_cooldowns (user_id, weapon_id, ready_at)
      VALUES (${attackerId}, ${weaponId}, ${ready.toISOString()})
      ON CONFLICT (user_id, weapon_id)
      DO UPDATE SET ready_at = EXCLUDED.ready_at
    `;

    await sql`
      INSERT INTO ops_history (
        attacker_id, victim_id, victim_telegram_id, weapon_id, hit,
        glory_gained, token_reward, details
      )
      VALUES (
        ${attackerId}, ${target.userId}, ${target.telegramId}, ${weaponId}, false,
        ${-OPS_PROTECTED_LEADER_GLORY_LOSS}, ${-OPS_PROTECTED_LEADER_TOKEN_LOSS},
        ${JSON.stringify({
          victimName: target.displayName,
          attackerName: attackerLabel,
          jailed: true,
          reason: "attacked_protected_leader",
          gloryLost: OPS_PROTECTED_LEADER_GLORY_LOSS,
          tokenLost: OPS_PROTECTED_LEADER_TOKEN_LOSS,
          weaponName: weapon.name,
        })}::jsonb
      )
    `;

    await notifyUser(
      target.userId,
      target.telegramId,
      "ops_jail_attempt",
      `${attackerLabel} tried to attack you (protected Leader) with ${weapon.name} and got JAILED`,
    );

    return {
      ok: true,
      jailed: true,
      hit: false,
      gloryGained: -OPS_PROTECTED_LEADER_GLORY_LOSS,
      tokenReward: -OPS_PROTECTED_LEADER_TOKEN_LOSS,
      victimName: target.displayName,
      victimTelegramId: target.telegramId,
      jailUntil: jailUntil.getTime(),
      message:
        "You attacked an important World Leader, take your jail time and lose glory points and WARDOG / WARCAT",
    };
  }

  if (await isNationProtected(target.userId)) {
    return { ok: false, error: "target_protected" };
  }

  const invSnap = await getBattlefieldInventory(attackerId);
  if (invSnap.attacksToday >= BATTLEFIELD_DAILY_ATTACK_CAP) {
    return { ok: false, error: "daily_cap" };
  }
  if ((invSnap.weapons[weaponId] ?? 0) < 1) {
    return { ok: false, error: "no_weapon" };
  }
  const readyAt = invSnap.cooldowns[weaponId] ?? 0;
  if (readyAt > Date.now()) {
    return { ok: false, error: "cooldown" };
  }

  const consumed = await consumeWeapon(attackerId, weaponId);
  if (!consumed) return { ok: false, error: "no_weapon" };

  const hit = Math.random() < weapon.hitChance;
  let gloryGained = 0;
  let tokenReward = 0;

  if (hit) {
    gloryGained = weapon.gloryOnHit;
    tokenReward = weapon.tokenRewardOnHit;

    const prog = await loadProgress(attackerId);
    if (prog) {
      const state = { ...(prog.state as any) };
      state.glory = Number(state.glory ?? prog.glory ?? 0) + gloryGained;
      const half = normalizeToken(tokenReward / 2);
      state.wardogTokens = addTokens(Number(prog.wardog_tokens ?? 0), half);
      state.warcatTokens = addTokens(Number(prog.warcat_tokens ?? 0), half);
      await writeProgress(attackerId, state, { touchSyncClock: false });
    }

    const vProg = await loadProgress(target.userId);
    if (vProg) {
      const vs = { ...(vProg.state as any) };
      vs.glory = Math.max(
        0,
        Number(vs.glory ?? vProg.glory ?? 0) - weapon.gloryDrainOnHit,
      );
      vs.energy = Math.max(
        0,
        Number(vs.energy ?? 0) - weapon.energyDrainOnHit,
      );
      await writeProgress(target.userId, vs, { touchSyncClock: false });
    }

    await notifyUser(
      target.userId,
      target.telegramId,
      "ops_hit",
      `${attackerLabel} hit you with ${weapon.name} (−${weapon.gloryDrainOnHit} glory, −${weapon.energyDrainOnHit} energy)`,
    );
  } else {
    await notifyUser(
      target.userId,
      target.telegramId,
      "ops_miss",
      `${attackerLabel} missed you with ${weapon.name}`,
    );
  }

  const ready = new Date(Date.now() + weapon.cooldownSec * 1000);
  await sql`
    INSERT INTO ops_cooldowns (user_id, weapon_id, ready_at)
    VALUES (${attackerId}, ${weaponId}, ${ready.toISOString()})
    ON CONFLICT (user_id, weapon_id)
    DO UPDATE SET ready_at = EXCLUDED.ready_at
  `;

  await sql`
    INSERT INTO ops_history (
      attacker_id, victim_id, victim_telegram_id, weapon_id, hit,
      glory_gained, token_reward, details
    )
    VALUES (
      ${attackerId}, ${target.userId}, ${target.telegramId}, ${weaponId}, ${hit},
      ${gloryGained}, ${tokenReward},
      ${JSON.stringify({
        victimName: target.displayName,
        attackerName: attackerLabel,
        hitChance: weapon.hitChance,
        weaponName: weapon.name,
      })}::jsonb
    )
  `;

  return {
    ok: true,
    hit,
    gloryGained,
    tokenReward,
    victimName: target.displayName,
    victimTelegramId: target.telegramId,
  };
}

export async function listOpsHistory(
  userId: number,
  limit = 30,
): Promise<
  Array<{
    id: number;
    weaponId: string;
    hit: boolean;
    victimTelegramId: number | null;
    gloryGained: number;
    tokenReward: number;
    createdAt: number;
    details: Record<string, unknown>;
  }>
> {
  await ensureBattlefieldSchema();
  const res = await sql`
    SELECT id, weapon_id, hit, victim_telegram_id, glory_gained, token_reward,
           created_at, details
    FROM ops_history
    WHERE attacker_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return res.rows.map((r) => ({
    id: Number(r.id),
    weaponId: String(r.weapon_id),
    hit: Boolean(r.hit),
    victimTelegramId:
      r.victim_telegram_id != null ? Number(r.victim_telegram_id) : null,
    gloryGained: Number(r.glory_gained ?? 0),
    tokenReward: Number(r.token_reward ?? 0),
    createdAt: new Date(r.created_at as string).getTime(),
    details: (r.details as Record<string, unknown>) ?? {},
  }));
}

export async function listOpsKillFeed(limit = 15): Promise<
  Array<{
    id: number;
    weaponId: string;
    hit: boolean;
    attackerName: string;
    victimName: string;
    gloryGained: number;
    createdAt: number;
    jailed?: boolean;
  }>
> {
  await ensureBattlefieldSchema();
  const res = await sql`
    SELECT id, weapon_id, hit, glory_gained, created_at, details
    FROM ops_history
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return res.rows.map((r) => {
    const d = (r.details as Record<string, unknown>) ?? {};
    return {
      id: Number(r.id),
      weaponId: String(r.weapon_id),
      hit: Boolean(r.hit),
      attackerName: String(d.attackerName ?? "Unknown"),
      victimName: String(d.victimName ?? "Unknown"),
      gloryGained: Number(r.glory_gained ?? 0),
      createdAt: new Date(r.created_at as string).getTime(),
      jailed: Boolean(d.jailed),
    };
  });
}

export async function lookupTargetPreview(
  query: string,
): Promise<
  | { ok: true; displayName: string; telegramId: number; protected: boolean }
  | { ok: false; error: string }
> {
  const t = await resolveBattlefieldTarget(query);
  if (!t.ok) return t;
  const protected_ = await isNationProtected(t.userId);
  return {
    ok: true,
    displayName: t.displayName,
    telegramId: t.telegramId,
    protected: protected_,
  };
}

export async function getOpsJailStatus(userId: number): Promise<{
  active: boolean;
  remainingMs: number;
  reason: string | null;
}> {
  await ensureBattlefieldSchema();
  const res = await sql`
    SELECT jail_until, reason FROM ops_jail WHERE user_id = ${userId} LIMIT 1
  `;
  const row = res.rows[0];
  if (!row) return { active: false, remainingMs: 0, reason: null };
  const until = new Date(row.jail_until as string).getTime();
  const remainingMs = Math.max(0, until - Date.now());
  return {
    active: remainingMs > 0,
    remainingMs,
    reason: (row.reason as string) || null,
  };
}
