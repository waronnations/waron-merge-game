// src/components/claim/ClaimBalanceTiles.tsx
import { TOKENS } from "@/lib/tokens";

export function RewardTile({
  symbol,
  balance,
  color,
}: {
  symbol: string;
  balance: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3">
      <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
        {symbol}
      </div>
      <div className="mt-1 text-lg font-black" style={{ color }}>
        {balance.toFixed(2)}
      </div>
    </div>
  );
}

export function ClaimBalanceTiles({
  balances,
}: {
  balances: { wardog: number; warcat: number };
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <RewardTile
        symbol={TOKENS.wardog.symbol}
        balance={balances.wardog}
        color={TOKENS.wardog.color ?? "#f59e0b"}
      />
      <RewardTile
        symbol={TOKENS.warcat.symbol}
        balance={balances.warcat}
        color={TOKENS.warcat.color ?? "#38bdf8"}
      />
    </div>
  );
}
