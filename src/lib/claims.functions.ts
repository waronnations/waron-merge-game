import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId } from "@/lib/auth.server";
import {
  ClaimRequestInput,
  loadClaimsSnapshot,
  requestClaim,
  markClaimSubmitted,
  type ClaimRequestResult,
  type ClaimsSnapshot,
} from "@/lib/claims.server";

export type { ClaimRow, ClaimsSnapshot } from "@/lib/claims.server";

export const getClaims = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClaimsSnapshot | { available: false }> => {
    if (!hasDatabase()) return { available: false };
    await ensureSchema();
    return loadClaimsSnapshot(await requireUserId());
  },
);

export const createClaim = createServerFn({ method: "POST" })
  .validator((input: unknown) => ClaimRequestInput.parse(input))
  .handler(async ({ data }): Promise<ClaimRequestResult> => {
    if (!hasDatabase()) return { ok: false, error: "database_unavailable" };
    await ensureSchema();
    return requestClaim(
      await requireUserId(),
      data.token,
      data.beneficiaryAddress,
      data.amount,
    );
  });

const MarkSubmittedInput = z.object({
  claimId: z.number().int().positive(),
  txHash: z.string().nullable().optional(),
});

export const markClaimTxSubmitted = createServerFn({ method: "POST" })
  .validator((input: unknown) => MarkSubmittedInput.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { ok: false as const };
    await ensureSchema();
    await markClaimSubmitted(
      await requireUserId(),
      data.claimId,
      data.txHash ?? null,
    );
    return { ok: true as const };
  });
