import { createServerFn } from "@tanstack/react-start";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import {
  WalletSchema,
  WalletLinkSchema,
  loadUser,
  requireUserId,
  sessionUserId,
  setWallet,
  validateTonProofShape,
} from "@/lib/auth.server";
import { mutableSession } from "@/lib/session.server";
import { assertRateLimit } from "@/lib/rate-limit.server";

export type { WonUser } from "@/lib/auth.server";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!hasDatabase()) return null;
    const userId = await sessionUserId();
    if (!userId) return null;
    await ensureSchema();
    return loadUser(userId);
  },
);

/**
 * Link wallet with ton_proof shape checks.
 * Client must send address + proof { timestamp, domain, signature, payload }.
 */
export const linkWallet = createServerFn({ method: "POST" })
  .validator((input: unknown) => WalletLinkSchema.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_not_configured");
    const userId = await requireUserId();
    assertRateLimit(`wallet:link:${userId}`, 5, 60_000);
    await ensureSchema();

    const proofCheck = validateTonProofShape(data);
    if (!proofCheck.ok) {
      throw new Error(proofCheck.reason);
    }

    // TODO: full Ed25519 ton_proof verification with @ton/crypto + stateInit
    // when dependency is added. Shape + domain + freshness already enforced.

    return setWallet(userId, data.address);
  });

/** Legacy address-only link (disabled for security — use linkWallet with proof). */
export const linkWalletLegacy = createServerFn({ method: "POST" })
  .validator((input: unknown) => WalletSchema.parse(input))
  .handler(async () => {
    throw new Error("use_linkWallet_with_ton_proof");
  });

export const unlinkWallet = createServerFn({ method: "POST" }).handler(
  async () => {
    if (!hasDatabase()) throw new Error("database_not_configured");
    const userId = await requireUserId();
    assertRateLimit(`wallet:unlink:${userId}`, 5, 60_000);
    await ensureSchema();
    return setWallet(userId, null);
  },
);

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await mutableSession();
  await session.clear();
  return { ok: true };
});
