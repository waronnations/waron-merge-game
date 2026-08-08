// src/lib/payments.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId, loadUser } from "@/lib/auth.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import { MAX_PAYMENT_INTENTS_PER_MIN, PAID_ACTIONS } from "@/lib/constants";
import {
  confirmIntent,
  createIntent,
  isPaidAction,
  listPayments,
  paymentsLive,
  serverNetwork,
  serverTreasuryAddress,
} from "@/lib/payments.server";

const ActionInput = z.object({
  action: z.string().refine(isPaidAction, "unknown_action"),
  walletAddress: z.string().trim().min(10).max(80).optional(),
});

const ConfirmInput = z.object({
  intentId: z.number().int().positive(),
  txHash: z.string().trim().max(200).optional(),
  apiKey: z.string().trim().max(200).optional(),
});

/** Public config — safe for the client. */
export const getPaymentConfigFn = createServerFn({ method: "GET" }).handler(
  async () => ({
    live: paymentsLive(),
    network: serverNetwork(),
    treasury: serverTreasuryAddress(),
    /** Labels only — costs are SHOP_ITEMS / nation prices in WARDOG|WARCAT */
    actions: Object.fromEntries(
      Object.entries(PAID_ACTIONS).map(([id, v]) => [id, { label: v.label }]),
    ),
    currency: "wardog_warcat" as const,
    note: "Wallet authorizes; spend is in-game $WARDOG or $WARCAT. Board energy uses in-game balances only.",
  }),
);

export const createPaymentIntentFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => ActionInput.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(
      `payment:intent:${userId}`,
      MAX_PAYMENT_INTENTS_PER_MIN,
      60_000,
    );

    const user = await loadUser(userId);
    const wallet =
      (data.walletAddress && data.walletAddress.trim()) ||
      user?.walletAddress ||
      null;

    if (!wallet || wallet.length < 10) {
      throw new Error("wallet_required");
    }

    return createIntent(userId, data.action, wallet);
  });

export const confirmPaymentFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => ConfirmInput.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`payment:confirm:${userId}`, 30, 60_000);

    return confirmIntent(userId, data.intentId, {
      txHash: data.txHash ?? null,
      apiKey: data.apiKey ?? null,
    });
  });

export const listPaymentsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!hasDatabase()) return [];
    await ensureSchema();
    const userId = await requireUserId();
    return listPayments(userId);
  },
);
