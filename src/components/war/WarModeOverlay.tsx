// src/components/war/WarModeOverlay.tsx
import { useEffect, useState } from "react";
import { FrontLineBar } from "./FrontLineBar";
import { HYBRID_COMMANDER_ABILITIES } from "@/lib/constants/war-mode";
import type { WarModeState } from "@/lib/game/types";
import type { HybridCommanderAbilityId } from "@/lib/constants/war-mode";

interface Props {
  warMode: WarModeState;
  energy: number;
  onEnter: () => void;
  onDeploy: (index: number) => void;
  onActivateAbility: (id: HybridCommanderAbilityId) => void;
  onForceEnd: () => void;
  canEnter: boolean;
}

export function WarModeOverlay({
  warMode,
  energy,
  onEnter,
  onActivateAbility,
  onForceEnd,
  canEnter,
}: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!warMode.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [warMode.active]);

  const remainingMs = Math.max(0, warMode.endsAt - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;

  if (!warMode.active) {
    return (
      <div className="px-4 py-3">
        <button
          onClick={onEnter}
          disabled={!canEnter}
          className={`w-full py-3 rounded-xl font-black tracking-widest text-sm uppercase transition-all
            ${
              canEnter
                ? "bg-gradient-to-r from-orange-600 via-red-600 to-purple-700 text-white shadow-lg shadow-red-900/40 active:scale-95"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
        >
          {canEnter ? "ENTER WAR MODE" : "WAR MODE ON COOLDOWN / LOW ENERGY"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative border-y border-red-900/60 bg-gradient-to-b from-red-950/80 to-zinc-950/90">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-black tracking-[0.2em] text-red-400 uppercase">
            WAR MODE ACTIVE
          </span>
        </div>
        <div className="font-mono text-sm text-white">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </div>
      </div>

      <FrontLineBar
        frontLine={warMode.frontLine}
        controlGenerated={warMode.controlGenerated}
        active={true}
      />

      {/* Abilities */}
      <div className="px-3 pb-3 grid grid-cols-3 gap-2">
        {(Object.keys(HYBRID_COMMANDER_ABILITIES) as HybridCommanderAbilityId[]).map(
          (id) => {
            const ability = HYBRID_COMMANDER_ABILITIES[id];
            const isActive = warMode.activeAbilities.some(
              (a) => a.id === id && a.endsAt > now,
            );
            return (
              <button
                key={id}
                onClick={() => onActivateAbility(id)}
                disabled={isActive}
                className={`rounded-lg px-2 py-2 text-[10px] font-bold leading-tight transition-all
                  ${
                    isActive
                      ? "bg-emerald-900/60 text-emerald-300 border border-emerald-600"
                      : "bg-zinc-900/80 text-zinc-200 border border-zinc-700 active:scale-95"
                  }`}
              >
                {ability.name}
              </button>
            );
          },
        )}
      </div>

      {/* Force end (debug / emergency) */}
      <div className="px-3 pb-3">
        <button
          onClick={onForceEnd}
          className="w-full text-[10px] text-zinc-500 underline"
        >
          End War Mode Early
        </button>
      </div>
    </div>
  );
}
