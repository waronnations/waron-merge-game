// src/components/claim/ClaimAmountControls.tsx
import { TOKENS } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { TokenKey } from "@/components/claim/claim-helpers";

export function ClaimAmountControls({
  token,
  available,
  minAmount,
  value,
  onChange,
  disabled,
}: {
  token: TokenKey;
  available: number;
  minAmount: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const setPct = (pct: number) => {
    const n = Math.floor(available * pct * 100) / 100;
    onChange(n > 0 ? String(n) : "");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[0.65rem] font-bold uppercase tracking-wider text-zinc-500">
          Amount to claim
        </label>
        <button
          type="button"
          disabled={disabled || available < minAmount}
          onClick={() => setPct(1)}
          className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 disabled:opacity-40"
        >
          Max {available.toFixed(2)}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={minAmount}
          max={available}
          step="0.01"
          placeholder={`Min ${minAmount}`}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none ring-amber-500/40 placeholder:text-zinc-600 focus:ring-2 disabled:opacity-50"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <button
            key={pct}
            type="button"
            disabled={disabled || available < minAmount}
            onClick={() => setPct(pct)}
            className={cn(
              "rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-300 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-40",
            )}
          >
            {pct === 1 ? "Max" : `${pct * 100}%`}
          </button>
        ))}
      </div>

      <p className="text-[0.6rem] text-zinc-500">
        {TOKENS[token].symbol}: available {available.toFixed(2)} · min{" "}
        {minAmount}
      </p>
    </div>
  );
}
