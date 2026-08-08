// src/components/claim/claim-helpers.ts
import type { ClaimRow } from "@/lib/claims.functions";

export type TokenKey = "wardog" | "warcat";

export function statusLabel(status: ClaimRow["status"]): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
}

/** Text color only — no filled color chrome */
export function statusClass(status: ClaimRow["status"]): string {
  switch (status) {
    case "pending":
      return "bg-zinc-800 text-zinc-300";
    case "sent":
      return "bg-zinc-800 text-emerald-400";
    case "failed":
      return "bg-zinc-800 text-red-300";
    case "refunded":
      return "bg-zinc-800 text-zinc-400";
    default:
      return "bg-zinc-800 text-zinc-400";
  }
}
