// src/components/board/use-board-gestures.ts
import { useState, useRef, useCallback } from "react";
import { MAX_TIER, cellVariant, type Faction } from "@/lib/units";
import { BOARD_SIZE, type GameState } from "@/lib/game-state";
import { haptic } from "@/lib/telegram";

type Board = GameState["board"];

export interface ZoomCellInfo {
  idx: number;
  tier: number;
  faction: Faction | "hybrid";
  id?: number;
  seed?: string;
  imageUrl?: string;
  variant?: number;
}

export interface HybridMenuInfo {
  idx: number;
  tier: number;
  faction: "hybrid";
  id?: number;
  seed?: string;
  imageUrl?: string;
}

export function useBoardGestures({
  board,
  onMerge,
  onSwap,
  onMergeSuccess,
}: {
  board: Board;
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
  onMergeSuccess: (
    idx: number,
    tier: number,
    faction: Faction | "hybrid",
    token?: "wardog" | "warcat",
    amount?: number,
  ) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [zoomCell, setZoomCell] = useState<ZoomCellInfo | null>(null);
  const [hybridMenu, setHybridMenu] = useState<HybridMenuInfo | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActive = useRef(false);
  const dragFromRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const hoverRaf = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const setHoverThrottled = useCallback((idx: number | null) => {
    if (hoverRaf.current != null) cancelAnimationFrame(hoverRaf.current);
    hoverRaf.current = requestAnimationFrame(() => {
      setHoverIdx(idx);
      hoverRaf.current = null;
    });
  }, []);

  const getSide = (index: number): "dog" | "cat" =>
    index % BOARD_SIZE < 3 ? "dog" : "cat";

  const isValidPlacement = (index: number, faction: Faction | "hybrid") => {
    if (faction === "hybrid") return true;
    return getSide(index) === faction;
  };

  const isClashPossible = (from: number, to: number) => {
    const a = board[from];
    const b = board[to];
    if (!a || !b) return false;
    return (
      a.tier >= MAX_TIER &&
      b.tier >= MAX_TIER &&
      a.faction !== b.faction &&
      a.faction !== "hybrid" &&
      b.faction !== "hybrid"
    );
  };

  const canMergeTarget = (to: number) => {
    if (dragFrom === null) return false;
    const a = board[dragFrom];
    const b = board[to];
    if (!a || !b) return false;
    if (isClashPossible(dragFrom, to)) return true;
    if (a.tier >= MAX_TIER || b.tier >= MAX_TIER) return false;
    if (!isValidPlacement(to, a.faction)) return false;
    if (a.faction !== b.faction || a.tier !== b.tier) return false;
    return cellVariant(a) === cellVariant(b);
  };

  const canDropHere = (to: number) => {
    if (dragFrom === null) return false;
    const a = board[dragFrom];
    if (!a) return false;
    if (isClashPossible(dragFrom, to)) return true;
    if (a.tier >= MAX_TIER) return false;
    return isValidPlacement(to, a.faction);
  };

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const dismissOverlays = useCallback(() => {
    clearLongPressTimer();
    isLongPressActive.current = false;
    setZoomCell(null);
    setHybridMenu(null);
  }, []);

  const scheduleLongPress = (
    idx: number,
    cell: NonNullable<Board[number]>,
  ) => {
    clearLongPressTimer();
    longPressTimer.current = setTimeout(() => {
      if (movedRef.current) return;
      isLongPressActive.current = true;
      dragFromRef.current = null;
      setDragFrom(null);
      setHoverIdx(null);
      haptic("medium");

      if (cell.faction === "hybrid") {
        setHybridMenu({
          idx,
          tier: cell.tier,
          faction: "hybrid",
          id: cell.id,
          seed: cell.seed,
          imageUrl: cell.imageUrl,
        });
      } else {
        setZoomCell({
          idx,
          tier: cell.tier,
          faction: cell.faction,
          id: cell.id,
          seed: cell.seed,
          imageUrl: cell.imageUrl,
          variant: cell.variant,
        });
      }
    }, 420);
  };

  const getSlotFromPoint = (clientX: number, clientY: number): number | null => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    const col = Math.floor((x / rect.width) * BOARD_SIZE);
    const row = Math.floor((y / rect.height) * BOARD_SIZE);
    if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return null;
    return row * BOARD_SIZE + col;
  };

  const handleDrop = (to: number) => {
    if (isLongPressActive.current) {
      dismissOverlays();
      return;
    }
    const from = dragFromRef.current;
    if (from === null) return;

    const a = board[from];
    const b = board[to];
    const isClash = isClashPossible(from, to);

    if (a && !isClash && !isValidPlacement(to, a.faction)) {
      haptic("light");
      dragFromRef.current = null;
      setDragFrom(null);
      setHoverIdx(null);
      return;
    }

    if (a && b && (a.tier >= MAX_TIER || b.tier >= MAX_TIER) && !isClash) {
      haptic("light");
      dragFromRef.current = null;
      setDragFrom(null);
      setHoverIdx(null);
      return;
    }

    const sameVariant = !!(a && b && cellVariant(a) === cellVariant(b));

    if (
      from !== to &&
      a &&
      b &&
      (isClash || (a.faction === b.faction && sameVariant)) &&
      a.tier === b.tier
    ) {
      const res = onMerge(from, to);
      if (res.ok) {
        haptic(a.tier >= 4 || res.isHybrid ? "heavy" : a.tier >= 3 ? "medium" : "light");
        if (!res.isHybrid) {
          const displayTier = a.tier >= MAX_TIER ? MAX_TIER : a.tier + 1;
          onMergeSuccess(to, displayTier, a.faction, res.token, res.amount);
        }
      } else {
        haptic("light");
      }
    } else if (from !== to && a && a.tier < MAX_TIER) {
      if (
        isValidPlacement(to, a.faction) &&
        (!b || isValidPlacement(from, b.faction))
      ) {
        onSwap(from, to);
        haptic("light");
      } else {
        haptic("light");
      }
    }

    dragFromRef.current = null;
    setDragFrom(null);
    setHoverIdx(null);
  };

  const onPointerDown = (idx: number, e: React.PointerEvent) => {
    if (!board[idx]) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    if (e.pointerType === "touch" || e.pointerType === "pen") {
      e.preventDefault();
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pointerIdRef.current = e.pointerId;
    } catch {
      /* ignore */
    }

    movedRef.current = false;
    isLongPressActive.current = false;
    dragFromRef.current = idx;
    setDragFrom(idx);
    scheduleLongPress(idx, board[idx]!);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragFromRef.current === null || isLongPressActive.current) return;

    const dx = Math.abs(e.movementX);
    const dy = Math.abs(e.movementY);
    if (dx > 4 || dy > 4) {
      movedRef.current = true;
      clearLongPressTimer();
    }

    const slot = getSlotFromPoint(e.clientX, e.clientY);
    setHoverThrottled(slot);
  };

  const onPointerUp = () => {
    clearLongPressTimer();

    if (isLongPressActive.current) {
      // Long-press already opened menu/zoom — do nothing else
      pointerIdRef.current = null;
      return;
    }

    const from = dragFromRef.current;
    const to = hoverIdx;

    if (from !== null && to !== null && from !== to) {
      handleDrop(to);
    } else {
      // Cancelled
      dragFromRef.current = null;
      setDragFrom(null);
      setHoverIdx(null);
    }

    pointerIdRef.current = null;
  };

  const onPointerCancel = () => {
    clearLongPressTimer();
    isLongPressActive.current = false;
    dragFromRef.current = null;
    setDragFrom(null);
    setHoverIdx(null);
    pointerIdRef.current = null;
  };

  const onBoardPointerLeave = () => {
    if (dragFromRef.current !== null && !isLongPressActive.current) {
      setHoverIdx(null);
    }
  };

  return {
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
  };
}
