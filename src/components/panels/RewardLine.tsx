// src/components/panels/RewardLine.tsx
export function RewardLine({
  glory,
  wardog,
  warcat,
  spins,
  energy,
}: {
  glory: number;
  wardog?: number;
  warcat?: number;
  spins?: number;
  energy?: number;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6rem] font-bold uppercase tracking-wider">
      <span className="text-white">+{glory}★</span>
      {!!wardog && <span className="text-zinc-300">+{wardog} $WARDOG</span>}
      {!!warcat && <span className="text-zinc-400">+{warcat} $WARCAT</span>}
      {!!spins && <span className="text-zinc-500">+{spins} spin</span>}
      {!!energy && <span className="text-zinc-500">+{energy}⚡</span>}
    </div>
  );
}
