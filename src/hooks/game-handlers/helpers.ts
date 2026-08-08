// src/hooks/game-handlers/helpers.ts
export type PayToken = "wardog" | "warcat";

export function formatReason(reason?: string) {
  if (!reason) return "Something went wrong";
  return reason.replace(/_/g, " ");
}
