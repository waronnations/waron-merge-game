// src/components/claim/ClaimBalanceTiles.tsx
import { TOKENS } from "@/lib/tokens";

export function RewardTile({
  symbol,
  balance,
  tint,
}: {
  symbol: string;
  balance: number;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3">
      <div className={`text-[0.6rem] uppercase tracking-widest ${tint}`}>
        {symbol}
      </div>
      <div className="mt-1 text-lg font-black text-white">
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
        tint="text-red-300"
      />
      <RewardTile
        symbol={TOKENS.warcat.symbol}
        balance={balances.warcat}
        tint="text-violet-300"
      />
    </div>
  );
}
