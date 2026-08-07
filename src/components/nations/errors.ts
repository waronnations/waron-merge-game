// src/components/nations/errors.ts
import { toast } from "sonner";

export function getErrorMessage(e: unknown): string {
  if (!e) return "unknown";
  if (typeof e === "string") return e;
  const any = e as any;
  return (
    any?.message ||
    any?.data?.message ||
    any?.cause?.message ||
    any?.error ||
    "unknown"
  );
}

export function showNationError(raw: unknown, fallback = "Action failed") {
  const msg = getErrorMessage(raw).toLowerCase();

  if (msg.includes("rate_limited")) toast.error("Too fast — wait a few seconds");
  else if (msg.includes("insufficient_tokens")) toast.error("Not enough tokens");
  else if (msg.includes("insufficient_vault"))
    toast.error("Not enough tokens in the nation vault");
  else if (msg.includes("not_for_sale"))
    toast.error("This nation is no longer for sale");
  else if (msg.includes("already_owner") || msg.includes("already_member"))
    toast.error("You already belong to a nation");
  else if (msg.includes("must_leave_current_nation"))
    toast.error("Leave your current nation before buying another");
  else if (msg.includes("not_leader")) toast.error("Only the leader can do this");
  else if (msg.includes("not_authorized"))
    toast.error("Only Leader or Officer can do this");
  else if (
    msg.includes("cannot_sell_faction") ||
    msg.includes("cannot_buy_faction")
  )
    toast.error("Default factions cannot be bought or sold");
  else if (msg.includes("nation_not_found")) toast.error("Nation not found");
  else if (msg.includes("traitors_cannot_claim_empty"))
    toast.error("Traitors cannot claim empty countries");
  else if (msg.includes("leader_min_tenure"))
    toast.error("Leaders must stay at least 24 hours before leaving or selling");
  else if (msg.includes("target_not_member"))
    toast.error("Target must be a member of the nation");
  else if (
    msg.includes("cannot_transfer_to_self") ||
    msg.includes("cannot_promote_self") ||
    msg.includes("cannot_demote_self")
  )
    toast.error("Invalid target");
  else if (msg.includes("price_too_low") || msg.includes("price_too_high"))
    toast.error("Price must be between 0.5 and 10 000 tokens");
  else if (msg.includes("max_officers_reached"))
    toast.error("Maximum 2 officers allowed");
  else if (msg.includes("already_officer")) toast.error("Already an officer");
  else if (msg.includes("not_officer")) toast.error("Not an officer");
  else if (msg.includes("nothing_to_donate"))
    toast.error("Enter an amount to donate");
  else if (msg.includes("invalid_buff")) toast.error("Invalid buff");
  else if (msg.includes("cannot_kick_self"))
    toast.error("You cannot kick yourself");
  else if (msg.includes("cannot_kick_leader"))
    toast.error("Cannot kick the leader");
  else if (msg.includes("cannot_kick_officer"))
    toast.error("Demote officer first, then kick");
  else if (msg.includes("already_protected"))
    toast.error("Nation is already protected");
  else if (msg.includes("cooldown_not_over"))
    toast.error("Cooldownoldown not over yet");
  else if (msg.includes("not_traitor")) toast.error("You are not a traitor");
  else toast.error(fallback);
}
