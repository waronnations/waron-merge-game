/**
 * Client-callable Claim Treasury surface.
 *
 * Read-only: the health snapshot and a tax quote so the UI can show players
 * exactly what a fee will cost before they commit. All mutations (tax
 * collection, claims) happen inside the server-authoritative economy paths.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import {
  getTreasuryHealth,
  quoteDynamicTax,
  CLAIM_ZONE_RULES,
  CLAIM_TREASURY_ADDRESS,
  type TreasuryHealth,
} from "@/lib/treasury.server";

export type { TreasuryHealth, TreasuryZone } from "@/lib/treasury.server";

export interface TreasurySnapshot extends TreasuryHealth {
  /** Placeholder Claim Treasury address (real contract lands later). */
  treasuryAddress: string;
  /** Human-readable claim policy for the current zone. */
  zoneNote: string;
  /** Fraction of an available balance claimable in this zone (0 - 1). */
  claimFraction: number;
  /** Per-token daily claim cap in this zone (null = uncapped). */
  dailyCap: number | null;
}

export const getTreasuryHealthFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TreasurySnapshot | null> => {
    if (!hasDatabase()) return null;
    await ensureSchema();
    const health = await getTreasuryHealth();
    const rules = CLAIM_ZONE_RULES[health.zone];
    return {
      ...health,
      treasuryAddress: CLAIM_TREASURY_ADDRESS,
      zoneNote: rules.note,
      claimFraction: rules.fraction,
      dailyCap: Number.isFinite(rules.dailyCap) ? rules.dailyCap : null,
    };
  },
);

export const quoteTaxFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        amount: z.number().nonnegative().max(1_000_000),
        token: z.enum(["wardog", "warcat"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) {
      return {
        base: data.amount,
        final: data.amount,
        tax: 0,
        multiplier: 1,
        zone: "green" as const,
      };
    }
    await ensureSchema();
    return quoteDynamicTax(data.amount);
  });
