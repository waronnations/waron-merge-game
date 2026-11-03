// src/components/memewar/WarCoinTile.tsx
import { motion } from "framer-motion";
import type { WarHolding } from "@/lib/memewar/types";
import { CoinLogo, fmtAmount, fmtUsd } from "./CoinLogo";
import { cn } from "@/lib/utils";

export function WarCoinTile({
  holding,
  index,
  power,
  selected,
  dropTarget,
  onTap,
  onDropOn,
}: {
  holding: WarHolding;
  index: number;
  /** 0..1 share of board value → glow strength. */
  power: number;
  selected: boolean;
  dropTarget: boolean;
  onTap: () => void;
  onDropOn: (targetIndex: number) => void;
}) {
  const { coin } = holding;
  const glow = Math.round(6 + power * 26);
  return (
    <motion.button
      type="button"
      layout
      data-war-slot={index}
      drag
      dragSnapToOrigin
      dragElastic={0.6}
      whileDrag={{ scale: 1.12, zIndex: 50, rotate: -3 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: selected ? 1.06 : 1 }}
      exit={{ opacity: 0, scale: 0.2, rotate: 25 }}
      onTap={onTap}
      onDragEnd={(_, info) => {
        const els = document.elementsFromPoint(info.point.x - window.scrollX, info.point.y - window.scrollY);
        const slot = els.map((e) => (e as HTMLElement).dataset?.warSlot).find((v) => v !== undefined && Number(v) !== index);
        if (slot !== undefined) onDropOn(Number(slot));
      }}
      className={cn(
        "war-tile relative flex aspect-square touch-none select-none flex-col items-center justify-center gap-1 rounded-2xl border p-1.5 text-center",
        selected ? "border-destructive" : dropTarget ? "border-primary" : "border-border",
      )}
      style={{ boxShadow: `0 0 ${glow}px color-mix(in srgb, var(--destructive) ${Math.round(25 + power * 60)}%, transparent)` }}
      aria-label={`${coin.symbol}: ${fmtAmount(holding.amount)} (${fmtUsd(holding.usd)})`}
    >
      {coin.verified && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-success" aria-hidden />}
      <CoinLogo image={coin.image} imageRaw={coin.imageRaw} symbol={coin.symbol} className="h-9 w-9 sm:h-11 sm:w-11" />
      <div className="w-full truncate text-[11px] font-black uppercase leading-none text-foreground">{coin.symbol}</div>
      <div className="w-full truncate text-[10px] font-bold leading-none text-muted-foreground">{fmtAmount(holding.amount)}</div>
      <div className="w-full truncate text-[10px] font-black leading-none text-primary">{fmtUsd(holding.usd)}</div>
      <div className="absolute inset-x-2 bottom-1 h-0.5 overflow-hidden rounded bg-muted">
        <div className="h-full bg-destructive" style={{ width: `${Math.max(4, power * 100)}%` }} />
      </div>
    </motion.button>
  );
}
