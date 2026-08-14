// src/components/war/WarModeVictoryModal.tsx
import { useEffect } from "react";
import type { WarModeState } from "@/lib/game/types";

interface Props {
  warMode: WarModeState | null | undefined;
  onClose: () => void;
}

export function WarModeVictoryModal({ warMode, onClose }: Props) {
  // Show for ANY finished session (not only extreme victory)
  const show = !!(
    warMode &&
    warMode.active === false &&
    (warMode.sessionComplete === true || warMode.victory === true)
  );

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onClose, 9000);
    return () => clearTimeout(t);
  }, [show, onClose]);

  if (!show || !warMode) return null;

  const isVictory = warMode.victory === true;
  const front = warMode.frontLine ?? 50;
  const isDogLead = front <= 50;
  const rewards = warMode.lastRewards;

  const title = isVictory
    ? isDogLead
      ? "WARDOG VICTORY"
      : "WARCAT VICTORY"
    : "WAR MODE COMPLETE";
  const color = isVictory
    ? isDogLead
      ? "#f97316"
      : "#a855f7"
    : "#fbbf24";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/20 bg-zinc-950 p-6 text-center shadow-2xl">
        <div
          className="mb-2 text-xs font-black tracking-[0.3em] uppercase"
          style={{ color }}
        >
          {isVictory ? "SECTOR SECURED" : "SESSION ENDED"}
        </div>
        <div className="mb-4 text-2xl font-black text-white">{title}</div>

        <div className="mb-4 space-y-1 text-sm text-zinc-400">
          <div>Front Line: {Math.round(front)}</div>
          <div>
            Control Generated: {Math.floor(warMode.controlGenerated ?? 0)}
          </div>
        </div>

        {rewards ? (
          <div className="mb-6 space-y-2 rounded-xl bg-white/5 px-4 py-3 text-left text-sm">
            <div className="text-center text-xs font-bold uppercase tracking-wider text-zinc-500">
              Rewards
            </div>
            <div className="flex justify-between text-white">
              <span>Glory</span>
              <span className="font-bold text-amber-400">+{rewards.glory}</span>
            </div>
            <div className="flex justify-between text-white">
              <span>$WARDOG</span>
              <span className="font-bold text-orange-400">
                +{Number(rewards.wardog).toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between text-white">
              <span>$WARCAT</span>
              <span className="font-bold text-purple-400">
                +{Number(rewards.warcat).toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 text-white">
              <span>Energy refund</span>
              <span className="font-bold text-emerald-400">
                +{rewards.energyRefund}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-xl bg-white/5 py-3 text-sm font-bold text-white">
            Rewards claimed
          </div>
        )}

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
