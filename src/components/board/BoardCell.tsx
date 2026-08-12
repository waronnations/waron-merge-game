// src/components/board/BoardCell.tsx
import { motion } from "framer-motion";
import { getUnit, type Faction } from "@/lib/units";
import { cn } from "@/lib/utils";
import { cacheRemoteImage } from "@/lib/preload-units";
import type { GameState } from "@/lib/game/types";
import {
  VARIANT_COUNT,
  EXPLOSION_SHROOM_COLORS,
  type ExplosionColor,
} from "@/lib/constants";

const NUKE_SHROOMS = EXPLOSION_SHROOM_COLORS;

type NukeShroomColor = ExplosionColor;

export function nukeShroomSrc(color?: string | null): string {
  const c =
    color && (NUKE_SHROOMS as readonly string[]).includes(color)
      ? (color as NukeShroomColor)
      : NUKE_SHROOMS[Math.floor(Math.random() * NUKE_SHROOMS.length)];
  return `/images/units/nuke_shroom_${c}.png`;
}

export interface Burst {
  key: number;
  idx: number;
  tier: number;
  faction: Faction | "hybrid" | "target";
  token?: "wardog" | "warcat";
  amount?: number;
}

export function UnitChip({
  tier,
  faction,
  id,
  seed,
  imageUrl,
  variant,
  large = false,
  targetType,
  targetLabel,
  nationEmoji,
}: {
  tier: number;
  faction: Faction | "hybrid" | "target";
  id?: number;
  seed?: string;
  imageUrl?: string;
  variant?: number;
  large?: boolean;
  targetType?: "nation" | "player";
  targetLabel?: string;
  nationEmoji?: string;
}) {
  // ── LIVE TARGET (emoji flags) ────────────────────────────────
  if (faction === "target") {
    const isNation = targetType === "nation";
    const shortName = (targetLabel || (isNation ? "NATION" : "PLAYER"))
      .replace("@", "")
      .slice(0, 9);

    return (
      <motion.div
        className={cn(
          "relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-md border-2",
          isNation ? "border-red-500 bg-zinc-950" : "border-amber-500 bg-zinc-950",
          large ? "h-full w-full" : "h-[94%] w-[94%]",
        )}
        animate={{
          boxShadow: isNation
            ? [
                "0 0 0 0 rgba(239,68,68,0.55)",
                "0 0 0 7px rgba(239,68,68,0)",
              ]
            : [
                "0 0 0 0 rgba(245,158,11,0.55)",
                "0 0 0 7px rgba(245,158,11,0)",
              ],
        }}
        transition={{ duration: 1.15, repeat: Infinity }}
      >
        {/* Big emoji */}
        <div className={cn("leading-none", large ? "text-3xl" : "text-[22px]")}>
          {isNation ? nationEmoji || "🏳️" : "👤"}
        </div>

        {/* Short readable name */}
        <div
          className={cn(
            "mt-0.5 w-full truncate px-0.5 text-center font-black uppercase leading-none tracking-tight text-white",
            large ? "text-[11px]" : "text-[9px]",
          )}
        >
          {shortName}
        </div>

        {/* Action label */}
        <div
          className={cn(
            "mt-0.5 font-bold leading-none",
            isNation ? "text-red-400" : "text-amber-400",
            large ? "text-[10px]" : "text-[8px]",
          )}
        >
          {isNation ? "NUKE" : "STRIKE"}
        </div>
      </motion.div>
    );
  }

  // ── HYBRID ───────────────────────────────────────────────────
  if (faction === "hybrid") {
    if (imageUrl) {
      void cacheRemoteImage(imageUrl);
      return (
        <div
          className={cn(
            "relative aspect-square overflow-hidden rounded-md border-[1.5px] border-white/80 bg-white shadow-[0_0_18px_rgba(255,255,255,0.35)]",
            large ? "h-full w-full" : "h-[92%] w-[92%]",
          )}
        >
          <img
            src={imageUrl}
            alt="Hybrid"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            loading="eager"
            decoding="async"
            className="pointer-events-none h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent py-0.5 text-center font-black uppercase tracking-wider text-white",
              large ? "text-sm" : "text-[0.55rem]",
            )}
          >
            HYBRID
          </div>
        </div>
      );
    }

    return (
      <motion.div
        className={cn(
          "relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-md border-[1.5px] border-white/70 bg-gradient-to-br from-zinc-900 to-black",
          large ? "h-full w-full" : "h-[92%] w-[92%]",
        )}
        animate={{
          boxShadow: [
            "0 0 12px rgba(255,255,255,0.25)",
            "0 0 22px rgba(255,255,255,0.45)",
            "0 0 12px rgba(255,255,255,0.25)",
          ],
        }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        <div className={cn(large ? "text-5xl" : "text-xl")}>⚔️</div>
        <div
          className={cn(
            "mt-0.5 font-black uppercase tracking-wider text-white",
            large ? "text-sm" : "text-[0.5rem]",
          )}
        >
          HYBRID
        </div>
      </motion.div>
    );
  }

  // ── NORMAL UNIT ──────────────────────────────────────────────
  const unit = getUnit(faction as Faction, tier, id, variant);
  const v =
    typeof variant === "number"
      ? Math.abs(Math.floor(variant)) % VARIANT_COUNT
      : 0;

  return (
    <div
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-md border-[1.5px] border-black bg-white",
        large ? "h-full w-full" : "h-[92%] w-[92%]",
        tier >= 4 && "shadow-[0_0_14px_rgba(0,0,0,0.25)]",
      )}
      style={
        tier >= 5
          ? {
              boxShadow: "0 0 16px rgba(255,255,255,0.35)",
            }
          : undefined
      }
    >
      <img
        src={unit.image}
        alt={unit.name}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        loading="eager"
        decoding="async"
        className={cn(
          "pointer-events-none relative z-10 object-contain",
          large ? "h-[82%] w-[82%]" : "h-[86%] w-[86%]",
        )}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      <div className="absolute left-0.5 top-0.5 z-20 flex gap-0.5">
        {Array.from({ length: VARIANT_COUNT }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 w-1 rounded-full",
              i === v
                ? "bg-black shadow-[0_0_3px_rgba(0,0,0,0.8)]"
                : "bg-zinc-400/50",
            )}
          />
        ))}
      </div>

      <div
        className={cn(
          "absolute bottom-0.5 z-20 rounded px-1 font-black uppercase tracking-wider text-zinc-800",
          large ? "text-sm" : "text-[0.55rem]",
        )}
        style={{ background: "rgba(255,255,255,0.9)" }}
      >
        T{tier}
      </div>
    </div>
  );
}

export function MergeBurst({
  tier,
  faction,
}: {
  tier: number;
  faction: Faction | "hybrid" | "target";
}) {
  const color = "#ffffff";
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      initial={{ scale: 0.35, opacity: 1 }}
      animate={{ scale: 1.85, opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div
        className="h-12 w-12 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}cc 0%, transparent 70%)`,
          boxShadow: `0 0 32px ${color}`,
        }}
      />
    </motion.div>
  );
}

export function BoardCell({
  index,
  cell,
  isDrag,
  isHover,
  mergeOk,
  dropOk,
  clash,
  side,
  bursts,
  explosion,
  allowHtml5Drag,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  index: number;
  cell: GameState["board"][number];
  isDrag: boolean;
  isHover: boolean;
  mergeOk: boolean;
  dropOk: boolean;
  clash: boolean;
  side: "dog" | "cat";
  bursts: Burst[];
  explosion: GameState["explosion"];
  allowHtml5Drag: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  const cellBursts = bursts.filter((b) => b.idx === index);
  const showExplosion = explosion?.idx === index;

  return (
    <div
      data-slot={index}
      className={cn(
        "relative z-10 flex aspect-square items-center justify-center overflow-hidden rounded-lg border transition-all duration-150",
        !cell && "border-zinc-900 bg-black",
        cell && !cell.isTarget && "border-black bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]",
        cell?.isTarget && "border-transparent bg-transparent",
        isDrag && "opacity-35 scale-95",
        mergeOk && "ring-2 ring-white scale-[1.03]",
        clash && "ring-2 ring-white/80 scale-[1.03]",
        dropOk && !mergeOk && !clash && "ring-1 ring-zinc-400/60",
      )}
      style={
        cell && !cell.isTarget
          ? {
              boxShadow:
                side === "dog"
                  ? "inset 0 0 0 1px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(255,255,255,0.35)"
                  : "inset 0 0 0 1px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(255,255,255,0.2)",
            }
          : undefined
      }
    >
      {cell && (
        <motion.div
          className="absolute inset-0 z-10 flex touch-none items-center justify-center"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          draggable={allowHtml5Drag}
          layout
        >
          <UnitChip
            tier={cell.tier}
            faction={cell.faction}
            id={cell.id}
            seed={cell.seed}
            imageUrl={cell.imageUrl}
            variant={cell.variant}
            targetType={cell.targetType}
            targetLabel={cell.targetLabel}
            nationEmoji={(cell as any).nationEmoji}
          />
        </motion.div>
      )}

      {cellBursts.map((b) => (
        <MergeBurst key={b.key} tier={b.tier} faction={b.faction} />
      ))}

      {showExplosion && explosion && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          <img
            src={nukeShroomSrc(explosion.color)}
            alt=""
            className="h-16 w-16 object-contain"
            draggable={false}
          />
        </motion.div>
      )}
    </div>
  );
}
