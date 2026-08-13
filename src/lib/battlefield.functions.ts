// src/lib/battlefield.functions.ts
/**
 * Client-callable OPS Battlefield surface.
 * Mutations require auth + rate limits.
 * Buys: spendable-only + dynamic tax → ClaimTreasury.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId } from "@/lib/auth.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import {
  BATTLEFIELD_WEAPONS,
  BATTLEFIELD_DAILY_ATTACK_CAP,
  type BattlefieldWeaponId,
} from "@/lib/constants";
import {
  ensureBattlefieldSchema,
  getBattlefieldInventory,
  getBattlefieldArmoryQuotes,
  buyBattlefieldWeapon,
  battlefieldStrike,
  listOpsHistory,
  listOpsKillFeed,
  lookupTargetPreview,
  getOpsJailStatus,
  type PayToken,
} from "@/lib/battlefield.server";
import { announceToGroup } from "@/lib/notify.server";

const PayTokenSchema = z.enum(["wardog", "warcat"]);
const WeaponIdSchema = z.enum(["knife", "pistol", "rifle"]);

export type { BattlefieldWeaponId };

/** Static catalog + daily cap (no auth). */
export const getBattlefieldCatalogFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return {
      weapons: Object.values(BATTLEFIELD_WEAPONS),
      dailyAttackCap: BATTLEFIELD_DAILY_ATTACK_CAP,
    };
  },
);

/** Live tax quotes for armory buttons. */
export const getBattlefieldArmoryQuotesFn = createServerFn({
  method: "GET",
}).handler(async () => {
  if (!hasDatabase()) {
    return Object.values(BATTLEFIELD_WEAPONS).map((w) => ({
      weaponId: w.id as BattlefieldWeaponId,
      base: w.cost,
      final: w.cost,
      tax: 0,
      multiplier: 1,
      zone: "green",
    }));
  }
  await ensureSchema();
  await ensureBattlefieldSchema();
  return getBattlefieldArmoryQuotes();
});

/** Inventory + cooldowns + attacks today. */
export const getBattlefieldInventoryFn = createServerFn({
  method: "GET",
}).handler(async () => {
  if (!hasDatabase()) {
    return {
      weapons: {} as Record<string, number>,
      cooldowns: {} as Record<string, number>,
      attacksToday: 0,
      dailyAttackCap: BATTLEFIELD_DAILY_ATTACK_CAP,
    };
  }
  await ensureSchema();
  await ensureBattlefieldSchema();
  const userId = await requireUserId();
  const inv = await getBattlefieldInventory(userId);
  return {
    ...inv,
    dailyAttackCap: BATTLEFIELD_DAILY_ATTACK_CAP,
  };
});

/**
 * Buy one weapon unit.
 * Requires topped-up spendable; tax → ClaimTreasury.
 */
export const buyBattlefieldWeaponFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        weaponId: WeaponIdSchema,
        payWith: PayTokenSchema.default("wardog"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    await ensureBattlefieldSchema();
    const userId = await requireUserId();
    assertRateLimit(`ops:buy:${userId}`, 20, 60_000);
    const res = await buyBattlefieldWeapon(
      userId,
      data.weaponId as BattlefieldWeaponId,
      data.payWith as PayToken,
    );
    if (!res.ok) throw new Error(res.error);
    return res;
  });

/**
 * Strike by Telegram user ID **or** @username.
 * `target` accepts "123456789" or "@someuser" / "someuser".
 */
export const battlefieldStrikeFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        target: z.string().min(1).max(64),
        weaponId: WeaponIdSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    await ensureBattlefieldSchema();
    const userId = await requireUserId();
    assertRateLimit(`ops:strike:${userId}`, 30, 60_000);
    const res = await battlefieldStrike(
      userId,
      data.target.trim(),
      data.weaponId as BattlefieldWeaponId,
    );
    if (!res.ok) throw new Error(res.error);
    return res;
  });

/** Attacker's personal ops history. */
export const listOpsHistoryFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).optional().default(30),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) return [];
    await ensureSchema();
    await ensureBattlefieldSchema();
    const userId = await requireUserId();
    return listOpsHistory(userId, data.limit ?? 30);
  });

/** Global kill feed (recent hits + jail events). */
export const listOpsKillFeedFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(50).optional().default(15),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) return [];
    await ensureSchema();
    await ensureBattlefieldSchema();
    return listOpsKillFeed(data.limit ?? 15);
  });

/** Preview target before strike (name + protection). */
export const lookupBattlefieldTargetFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ query: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, error: "database_unavailable" };
    await ensureSchema();
    await ensureBattlefieldSchema();
    await requireUserId();
    return lookupTargetPreview(data.query.trim());
  });

/** Current jail status for the logged-in player */
export const getOpsJailStatusFn = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!hasDatabase()) return { active: false, remainingMs: 0, reason: null };
    await ensureSchema();
    await ensureBattlefieldSchema();
    const userId = await requireUserId();
    return getOpsJailStatus(userId);
  },
);

/**
 * Announce a Live Target hit (nation nuke or player strike) to @waronnations.
 * Called from the client after a successful board attack.
 */
export const announceLiveTargetFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        type: z.enum(["nation", "player"]),
        label: z.string().min(1).max(64),
        glory: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Soft auth – still works even if session is briefly missing
    try {
      await requireUserId();
    } catch {
      /* allow announce anyway */
    }

    if (data.type === "nation") {
      announceToGroup(
        `☢️ NATION NUKE CONFIRMED\n\n` +
          `A Warlord just nuked <b>${data.label}</b> from the Live Battlefield!\n` +
          `+${data.glory ?? 480} Glory · Control shifted\n\n` +
          `The pack is hungry. Feed it 🐺`,
      );
    } else {
      announceToGroup(
        `⚔️ OPS STRIKE\n\n` +
          `A Warlord struck <b>${data.label}</b> on the Live Battlefield!\n` +
          `+${data.glory ?? 320} Glory\n\n` +
          `The pack is hungry. Feed it 🐺`,
      );
    }
    return { ok: true as const };
  });
