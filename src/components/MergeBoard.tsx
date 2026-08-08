// src/components/MergeBoard.tsx
import { useState, useRef, useEffect } from "react";
import { MAX_TIER, type Faction } from "@/lib/units";
import {
  BOARD_SIZE,
  SPAWN_ENERGY,
  type GameState,
} from "@/lib/game-state";
import { haptic } from "@/lib/telegram";
import { playMerge, playLegendary, playNukeExplosion } from "@/lib/sounds";
import { type Burst } from "@/components/board/BoardCell";
import { BoardGrid } from "@/components/board/BoardGrid";
import { useBoardGestures } from "@/components/board/use-board-gestures";
import { FactionLabels, BoardActionBar, BoardBrandFooter } from "@/components/board/BoardControls";
import { BoardOverlays } from "@/components/board/BoardOverlays";

export type PayToken = "wardog" | "warcat";

interface Props {
  state: GameState;
  onMerge: (
    from: number,
    to: number,
  ) => {
    ok: boolean;
    token?: "wardog" | "warcat";
    amount?: number;
    isHybrid?: boolean;
  };
  onSwap: (from: number, to: number) => void;
  onSpawn?: () => void;
  onRecover?: (payWith: PayToken) => void;
  canRecoverWardog?: boolean;
  canRecoverWarcat?: boolean;
  onSacrificeHybrid?: (idx: number) => void;
}

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

export function MergeBoard({
  state,
  onMerge,
  onSwap,
  onSpawn,
  onRecover,
  canRecoverWardog = false,
  canRecoverWarcat = false,
  onSacrificeHybrid,
}: Props) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstKey = useRef(1);
  const lastExplosionKey = useRef<number | null>(null);

  const board =
    Array.isArray(state.board) && state.board.length === BOARD_SIZE * BOARD_SIZE
      ? state.board
      : Array(BOARD_SIZE * BOARD_SIZE).fill(null);

  const canSpawn = state.energy >= SPAWN_ENERGY;
  const allowHtml5Drag = !isTouchDevice();

  useEffect(() => {
    const key = state.explosion?.key;
    if (key == null || key === lastExplosionKey.current) return;
    lastExplosionKey.current = key;
    playNukeExplosion();
    haptic("heavy");
  }, [state.explosion?.key]);

  const spawnBurst = (
    idx: number,
    tier: number,
    faction: Faction | "hybrid",
    token?: "wardog" | "warcat",
    amount?: number,
  ) => {
    const key = burstKey.current++;
    setBursts((cur) => [...cur, { key, idx, tier, faction, token, amount }]);
    if (tier >= MAX_TIER) playLegendary();
    else playMerge(tier);
    setTimeout(() => {
      setBursts((cur) => cur.filter((b) => b.key !== key));
    }, 700);
  };

  const {
    dragFrom,
    hoverIdx,
    zoomCell,
    hybridMenu,
    setZoomCell,
    setHybridMenu,
    boardRef,
    getSide,
    isClashPossible,
    canMergeTarget,
    canDropHere,
    dismissOverlays,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onBoardPointerLeave,
  } = useBoardGestures({
    board,
    onMerge,
    onSwap,
    onMergeSuccess: spawnBurst,
  });

  return (
    <div className="relative">
      <FactionLabels />

      <BoardGrid
        boardRef={boardRef}
        board={board}
        state={state}
        dragFrom={dragFrom}
        hoverIdx={hoverIdx}
        bursts={bursts}
        allowHtml5Drag={allowHtml5Drag}
        getSide={getSide}
        canMergeTarget={canMergeTarget}
        canDropHere={canDropHere}
        isClashPossible={isClashPossible}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onBoardPointerLeave={onBoardPointerLeave}
      />

      <BoardActionBar
        canSpawn={canSpawn}
        onSpawn={onSpawn}
        canRecoverWardog={canRecoverWardog}
        canRecoverWarcat={canRecoverWarcat}
        onRecover={onRecover}
      />

      <BoardBrandFooter />

      <BoardOverlays
        zoomCell={zoomCell}
        hybridMenu={hybridMenu}
        setZoomCell={setZoomCell}
        setHybridMenu={setHybridMenu}
        dismissOverlays={dismissOverlays}
        onSacrificeHybrid={onSacrificeHybrid}
      />
    </div>
  );
}
