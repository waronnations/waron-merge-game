// src/components/claim/ClaimBalanceTiles.tsx
import { TOKENS } from "@/lib/tokens";

export function RewardTile({
  symbol,
  claimable,
  claimed,
  total,
  color,
}: {
  symbol: string;
  claimable: number;
  claimed: number;
  total: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3">
      <div className="text-[0.6rem] uppercase tracking-widest text-zinc-500">
        {symbol}
      </div>
      <div className="mt-1 text-lg font-black" style={{ color }}>
        {claimable.toFixed(2)}
      </div>
      <div className="mt-1 space-y-0.5 text-[0.55rem] leading-tight text-zinc-500">
        <div>
          Claimable · <span className="text-zinc-300">{claimable.toFixed(2)}</span>
        </div>
        <div>
          Claimed · <span className="text-zinc-400">{claimed.toFixed(2)}</span>
        </div>
        <div>
          Total earned · <span className="text-zinc-400">{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export function ClaimBalanceTiles({
  balances,
  claimed,
  total,
}: {
  balances: { wardog: number; warcat: number };
  claimed?: { wardog: number; warcat: number };
  total?: { wardog: number; warcat: number };
}) {
  const c = claimed ?? { wardog: 0, warcat: 0 };
  const t = total ?? {
    wardog: balances.wardog + c.wardog,
    warcat: balances.warcat + c.warcat,
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <RewardTile
        symbol={TOKENS.wardog.symbol}
        claimable={balances.wardog}
        claimed={c.wardog}
        total={t.wardog}
        color={TOKENS.wardog.color ?? "#f59e0b"}
      />
      <RewardTile
        symbol={TOKENS.warcat.symbol}
        claimable={balances.warcat}
        claimed={c.warcat}
        total={t.warcat}
        color={TOKENS.warcat.color ?? "#38bdf8"}
      />
    </div>
  );
}
