// src/lib/battle/claimBattleReward.server.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql, ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId } from "@/lib/auth.server";
import { assertRateLimit } from "@/lib/rate-limit.server";

const BattleResultSchema = z.object({
  kills: z.number().int().min(0).max(50),
  deaths: z.number().int().min(0).max(20),
  damageDealt: z.number().min(0).max(15000),
  survived: z.boolean(),
  durationSec: z.number().min(15).max(600),
  faction: z.enum(["wardog", "warcat"]),
  highestTier: z.number().int().min(1).max(40).optional(),
});

export type BattleResultInput = z.infer<typeof BattleResultSchema>;

export interface BattleRewardResult {
  glory: number;
  wardog: number;
  warcat: number;
  energy: number;
  message: string;
}

export const claimBattleReward = createServerFn({ method: "POST" })
  .validator((input: unknown) => BattleResultSchema.parse(input))
  .handler(async ({ data }): Promise<BattleRewardResult> => {
    if (!hasDatabase()) {
      throw new Error("database_unavailable");
    }

    await ensureSchema();

    // Correct auth used everywhere in this project
    const userId = await requireUserId();

    // Rate limit: max 15 claims per minute
    assertRateLimit(`battle:claim:${userId}`, 15, 60_000);

    const kills = data.kills;
    const survived = data.survived;
    const durationSec = data.durationSec;
    const highestTier = data.highestTier ?? 1;
    const faction = data.faction;

    // Server-side reward calculation (client cannot invent values)
    const glory =
      18 +
      kills * 9 +
      (survived ? 35 : 0) +
      Math.floor(highestTier / 2) * 3;

    const tokenAmount = Number(
      (0.22 + kills * 0.11 + (survived ? 0.45 : 0)).toFixed(4)
    );

    const energy = Math.floor((durationSec / 60) * 3) + (survived ? 6 : 2);

    const wardog = faction === "wardog" ? tokenAmount : 0;
    const warcat = faction === "warcat" ? tokenAmount : 0;

    // Write to real progress table
    await sql`
      UPDATE progress
      SET
        glory         = glory + ${glory},
        wardog_tokens = wardog_tokens + ${wardog},
        warcat_tokens = warcat_tokens + ${warcat},
        updated_at    = NOW()
      WHERE user_id = ${userId}
    `;

    return {
      glory,
      wardog,
      warcat,
      energy,
      message: survived
        ? `VICTORY! +${glory} Glory • +${tokenAmount.toFixed(2)} ${faction.toUpperCase()} • +${energy} Energy`
        : `Battle ended. +${glory} Glory • +${tokenAmount.toFixed(2)} ${faction.toUpperCase()} • +${energy} Energy`,
    };
  });
