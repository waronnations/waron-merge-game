// src/components/nations/detail/history-events.ts
export const EVENT_LABELS: Record<string, string> = {
  claim: "Claimed leadership",
  join: "Joined",
  leave: "Left",
  kick_member: "Kicked member",
  promote_officer: "Promoted officer",
  demote_officer: "Demoted officer",
  transfer_ownership: "Transferred leadership",
  list_for_sale: "Listed for sale",
  unlist: "Unlisted",
  buy: "Purchased",
  donate: "Donated to vault",
  activate_protection: "Activated protection",
  nuked: "Nuked",
  admin_force_leave: "Admin force-leave",
  admin_transfer_ownership: "Admin transfer",
};

export function formatEvent(event: string) {
  return EVENT_LABELS[event] ?? event.replace(/_/g, " ");
}

export function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
