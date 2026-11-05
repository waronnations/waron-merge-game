import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql, ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId } from "@/lib/auth.server";
import { assertRateLimit } from "@/lib/rate-limit.server";

const BattleResultSchema = z.object({
  kills: z.number().int().min(0).max(12),
  deaths: z.number().int().min(0).max(8),
  damageDealt: z.number().min(0).max(4000),
  survived: z.boolean(),
  durationSec: z.number().min(8).max(120),
  faction: z.enum(["wardog", "warcat"]),
  highestTier: z.number().int().min(1).max(40).optional(),
  shotsFired: z.number().int().min(0).max(400).optional(),
  hits: z.number().int().min(0).max(80).optional(),
  mode: z.enum(["hunt", "hold", "waves"]).optional(),
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
  .inputValidator((input: unknown) => BattleResultSchema.parse(input))
  .handler(async ({ data }): Promise<BattleRewardResult> => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();

    // 8 matches / 10 min — stops DevTools farm loops
    assertRateLimit(`battle:claim:${userId}`, 8, 10 * 60_000);

    const shots = data.shotsFired ?? 0;
    const hits = Math.min(data.hits ?? 0, shots);
    const maxKillsByTime = Math.max(0, Math.floor(data.durationSec / 6));
    const maxKillsByShots = shots === 0 ? 0 : Math.min(12, Math.floor(shots / 3));
    const kills = Math.min(data.kills, maxKillsByTime, Math.max(maxKillsByShots, hits));
    const survived = data.survived && kills >= 4;
    const highestTier = data.highestTier ?? 1;
    const faction = data.faction;

    const glory =
      18 +
      kills * 9 +
      (survived ? 35 : 0) +
      Math.floor(highestTier / 2) * 3;

    const tokenAmount = Number(
      (0.22 + kills * 0.11 + (survived ? 0.45 : 0)).toFixed(4),
    );
    const energy = Math.floor((data.durationSec / 60) * 3) + (survived ? 6 : 2);
    const wardog = faction === "wardog" ? tokenAmount : 0;
    const warcat = faction === "warcat" ? tokenAmount : 0;

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
        ? `VICTORY • ${kills} kills • +${glory} Glory • +${tokenAmount.toFixed(2)} ${faction.toUpperCase()}`
        : `${kills} kills • +${glory} Glory • +${tokenAmount.toFixed(2)} ${faction.toUpperCase()}`,
    };
  });
