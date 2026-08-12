// src/components/war/WarModeVictoryModal.tsx
import { useEffect } from "react";
import type { WarModeState } from "@/lib/game/types";

interface Props {
  warMode: WarModeState;
  onClose: () => void;
}

export function WarModeVictoryModal({ warMode, onClose }: Props) {
  const show = warMode.victory === true && !warMode.active;

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onClose, 6500);
    return () => clearTimeout(t);
  }, [show, onClose]);

  if (!show) return null;

  const isDogWin = warMode.frontLine <= 5;
  const title = isDogWin ? "WARDOG VICTORY" : "WARCAT VICTORY";
  const color = isDogWin ? "#f97316" : "#a855f7";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/20 bg-zinc-950 p-6 text-center shadow-2xl">
        <div
          className="mb-2 text-xs font-black tracking-[0.3em] uppercase"
          style={{ color }}
        >
          WAR MODE COMPLETE
        </div>
        <div className="mb-4 text-2xl font-black text-white">{title}</div>

        <div className="mb-5 space-y-1 text-sm text-zinc-400">
          <div>Front Line: {Math.round(warMode.frontLine)}</div>
          <div>Control Generated: {Math.floor(warMode.controlGenerated)}</div>
        </div>

        <div className="mb-6 rounded-xl bg-white/5 py-3 text-sm font-bold text-white">
          Rewards claimed
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-white py-3 text-sm font-black uppercase tracking-widest text-black active:scale-95"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
