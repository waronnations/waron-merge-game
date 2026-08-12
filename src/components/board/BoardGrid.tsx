// src/components/board/BoardGrid.tsx
import { useEffect, useState } from "react";
import {
  BOARD_SIZE,
  ENERGY_PER_MERGE,
  SPAWN_ENERGY,
  ENERGY_REGEN_MS,
} from "@/lib/constants";
import type { GameState } from "@/lib/game/types";
import { BoardCell, type Burst } from "@/components/board/BoardCell";
import { DeployButton } from "@/components/war/DeployButton";

export function BoardGrid({
  boardRef,
  board,
  state,
  dragFrom,
  hoverIdx,
  bursts,
  allowHtml5Drag,
  getSide,
  canMergeTarget,
  canDropHere,
  isClashPossible,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onBoardPointerLeave,
  onDeployUnit,
  warModeActive = false,
}: {
  boardRef: React.RefObject<HTMLDivElement | null>;
  board: GameState["board"];
  state: GameState;
  dragFrom: number | null;
  hoverIdx: number | null;
  bursts: Burst[];
  allowHtml5Drag: boolean;
  getSide: (index: number) => "dog" | "cat";
  canMergeTarget: (to: number) => boolean;
  canDropHere: (to: number) => boolean;
  isClashPossible: (from: number, to: number) => boolean;
  onPointerDown: (idx: number, e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onBoardPointerLeave: () => void;
  onDeployUnit?: (index: number) => void;
  warModeActive?: boolean;
}) {
  const [regenSeconds, setRegenSeconds] = useState(0);

  useEffect(() => {
    if (state.energy >= ENERGY_PER_MERGE) {
      setRegenSeconds(0);
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - (state.lastRegenAt || Date.now());
      const remaining = Math.max(0, ENERGY_REGEN_MS - (elapsed % ENERGY_REGEN_MS));
      setRegenSeconds(Math.ceil(remaining / 1000));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [state.energy, state.lastRegenAt]);

  return (
    <div
      ref={boardRef}
      className="merge-board relative mx-auto grid aspect-square w-full max-w-md gap-1 rounded-2xl border border-zinc-700/80 p-2"
      style={{
        gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        background: "#000000",
        boxShadow:
          "inset 0 0 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
      onPointerLeave={onBoardPointerLeave}
    >
      {/* Subtle left / right side distinction */}
      <div
        className="pointer-events-none absolute inset-y-2 left-2 z-0 rounded-l-xl"
        style={{
          width: "calc(50% - 9px)",
          background: "rgba(255,255,255,0.03)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-2 right-2 z-0 rounded-r-xl"
        style={{
          width: "calc(50% - 9px)",
          background: "rgba(255,255,255,0.015)",
        }}
      />

      {/* CENTER DIVIDER */}
      <div
        className="pointer-events-none absolute inset-y-3 z-20"
        style={{ left: "50%", transform: "translateX(-50%)" }}
      >
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2"
          style={{
            width: 14,
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.04) 10%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 90%, transparent 100%)",
            filter: "blur(4px)",
          }}
        />
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2"
          style={{
            width: 2,
            borderRadius: 2,
            background:
              "linear-gradient(to bottom, transparent 0%, #ffffff 15%, #ffffff 85%, transparent 100%)",
            boxShadow: "0 0 12px rgba(255,255,255,0.45)",
          }}
        />
      </div>

      {board.map((cell, i) => {
        const isDrag = dragFrom === i;
        const isHover = hoverIdx === i && dragFrom !== null && dragFrom !== i;
        const mergeOk = isHover && canMergeTarget(i);
        const dropOk = isHover && canDropHere(i);
        const clash = isHover && isClashPossible(dragFrom ?? -1, i);
        const side = getSide(i);

        return (
          <div key={i} className="relative">
            <BoardCell
              index={i}
              cell={cell}
              isDrag={isDrag}
              isHover={isHover}
              mergeOk={mergeOk}
              dropOk={dropOk}
              clash={clash}
              side={side}
              bursts={bursts}
              explosion={state.explosion}
              allowHtml5Drag={allowHtml5Drag}
              onPointerDown={(e) => onPointerDown(i, e)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            />
            {onDeployUnit && (
              <DeployButton
                cell={cell}
                index={i}
                warModeActive={warModeActive}
                energy={state.energy}
                onDeploy={onDeployUnit}
              />
            )}
          </div>
        );
      })}

      {/* Low energy overlay */}
      {state.energy < ENERGY_PER_MERGE && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center rounded-2xl bg-black/85 backdrop-blur-[3px]">
          <div
            className="mb-3 h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white"
            aria-hidden
          />
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
            Regenerating
          </div>
          <div className="mt-1.5 text-xs text-zinc-400">
            Energy {Math.floor(state.energy)} / {ENERGY_PER_MERGE} needed
          </div>
          {regenSeconds > 0 && (
            <div className="mt-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tabular-nums text-white">
              +1⚡ in {regenSeconds}s
            </div>
          )}
          <div className="mt-3 text-[10px] uppercase tracking-wider text-zinc-500">
            Merges {ENERGY_PER_MERGE}⚡ · Deploy {SPAWN_ENERGY}⚡
          </div>
        </div>
      )}
    </div>
  );
}
