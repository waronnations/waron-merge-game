// src/components/claim/claim-helpers.ts
import type { ClaimRow } from "@/lib/claims.functions";

export type TokenKey = "wardog" | "warcat";

export function statusLabel(status: ClaimRow["status"]): string {
  switch (status) {
    case "pending":
      return "Awaiting signature";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    case "refunded":
      return "Restored";
    default:
      return status;
  }
}

export function statusClass(status: ClaimRow["status"]): string {
  switch (status) {
    case "pending":
      return "bg-zinc-800 text-amber-300";
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
