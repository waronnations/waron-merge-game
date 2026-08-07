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

export function statusClass(status: ClaimRow["status"]): string {
  switch (status) {
    case "pending":
      return "bg-amber-500/20 text-amber-400";
    case "sent":
      return "bg-emerald-500/20 text-emerald-400";
    case "failed":
      return "bg-red-500/20 text-red-400";
    case "refunded":
      return "bg-sky-500/20 text-sky-400";
    default:
      return "bg-zinc-800 text-zinc-400";
  }
}
