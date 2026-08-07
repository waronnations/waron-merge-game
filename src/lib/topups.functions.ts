import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId } from "@/lib/auth.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import {
  MIN_TOPUP_AMOUNT,
  createTopupIntent,
  confirmTopup,
  getSpendableBalances,
  listTopups,
  getTreasuryDepositAddress,
} from "@/lib/topups.server";

export const getTopupSnapshot = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!hasDatabase()) {
      return {
        available: false as const,
        spendable: { spendableWardog: 0, spendableWarcat: 0 },
        topups: [] as Awaited<ReturnType<typeof listTopups>>,
        depositAddress: getTreasuryDepositAddress(),
        minAmount: MIN_TOPUP_AMOUNT,
      };
    }
    await ensureSchema();
    const userId = await requireUserId();
    return {
      available: true as const,
      spendable: await getSpendableBalances(userId),
      topups: await listTopups(userId),
      depositAddress: getTreasuryDepositAddress(),
      minAmount: MIN_TOPUP_AMOUNT,
    };
  },
);

const CreateTopupInput = z.object({
  token: z.enum(["wardog", "warcat"]),
  amount: z.number().positive().finite(),
  walletAddress: z.string().min(10),
});

export const createTopup = createServerFn({ method: "POST" })
  .validator((input: unknown) => CreateTopupInput.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { ok: false as const, error: "database_unavailable" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`topup:create:${userId}`, 10, 60_000);
    return createTopupIntent(
      userId,
      data.token,
      data.amount,
      data.walletAddress,
    );
  });

const ConfirmTopupInput = z.object({
  topupId: z.number().int().positive(),
  txHash: z.string().min(8),
});

export const confirmTopupFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => ConfirmTopupInput.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { ok: false as const, error: "database_unavailable" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`topup:confirm:${userId}`, 20, 60_000);
    return confirmTopup(userId, data.topupId, data.txHash);
  });
