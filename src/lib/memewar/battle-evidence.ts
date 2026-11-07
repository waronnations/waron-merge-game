import { MEMEWAR_INTENT_TTL_MS } from "@/lib/constants/memewar";

export interface BattleEvidence {
  event_id: string;
  timestamp: number;
  in_progress: boolean;
  is_scam?: boolean;
  actions: { type: string; status: string; JettonSwap?: { user_wallet: { address: string }; router: { address: string }; jetton_master_in?: { address: string }; jetton_master_out?: { address: string }; amount_in: string; amount_out: string; gram_out?: number; ton_out?: number }; JettonTransfer?: { sender?: { address: string }; recipient?: { address: string }; jetton: { address: string }; amount: string; comment?: string } }[];
}

export function settledBattle(event: BattleEvidence, expected: { owner: string; router: string; from: string; to: string; units: string; minOut: string; taxMaster: string; taxUnits: string; treasury: string; createdAt: number }) {
  if (event.in_progress) return "pending" as const;
  if (event.is_scam || event.timestamp * 1000 < expected.createdAt - 60_000 || event.timestamp * 1000 > expected.createdAt + MEMEWAR_INTENT_TTL_MS) return "failed" as const;
  const swap = event.actions.find(a => a.type === "JettonSwap" && a.status === "ok" && a.JettonSwap?.user_wallet.address === expected.owner && a.JettonSwap.router.address === expected.router && a.JettonSwap.jetton_master_in?.address === expected.from && (expected.to === "TON" ? !a.JettonSwap.jetton_master_out : a.JettonSwap.jetton_master_out?.address === expected.to) && a.JettonSwap.amount_in === expected.units)?.JettonSwap;
  const fee = event.actions.some(a => a.type === "JettonTransfer" && a.status === "ok" && a.JettonTransfer?.sender?.address === expected.owner && a.JettonTransfer.recipient?.address === expected.treasury && a.JettonTransfer.jetton.address === expected.taxMaster && /^\d+$/.test(a.JettonTransfer.amount) && BigInt(a.JettonTransfer.amount) >= BigInt(expected.taxUnits) && a.JettonTransfer.comment === "WAR_TAX");
  if (!swap || !fee) return "failed" as const;
  const out = expected.to === "TON" ? String(swap.gram_out ?? swap.ton_out ?? swap.amount_out) : swap.amount_out;
  return /^\d+$/.test(out) && BigInt(out) >= BigInt(expected.minOut) ? "confirmed" as const : "failed" as const;
}

export function battleStreak(days: string[], now = Date.now()): number {
  const unique = new Set(days);
  let cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);
  if (!unique.has(cursor.toISOString().slice(0, 10))) cursor = new Date(cursor.getTime() - 86_400_000);
  let streak = 0;
  while (unique.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}