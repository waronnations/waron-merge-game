import { useState } from "react";
import { motion } from "framer-motion";
import { ShooterCanvas } from "./ShooterCanvas";
import type { Faction, PlayerStats } from "./types";
import type { GameState } from "@/lib/game/types";

interface Props {
  state: GameState;
}

export function BattlefieldTab({ state }: Props) {
  const [inMatch, setInMatch] = useState(false);
  const [lastResult, setLastResult] = useState<PlayerStats | null>(null);

  const playerFaction: Faction =
    (state.wardogTokens ?? 0) >= (state.warcatTokens ?? 0) ? "wardog" : "warcat";
  const rankBonus = Math.floor((state.highestTier ?? 1) / 2);

  const handleMatchEnd = (stats: PlayerStats) => {
    setLastResult(stats);
    setInMatch(false);
  };

  if (inMatch) {
    return (
      <ShooterCanvas
        playerFaction={playerFaction}
        rankBonus={rankBonus}
        onMatchEnd={handleMatchEnd}
        onExit={() => setInMatch(false)}
      />
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white tracking-tight">BATTLEFIELD</h2>
        <div className="text-xs text-zinc-400 font-medium">
          Rank +{rankBonus * 6} HP
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-6 text-center space-y-5 shadow-xl"
      >
        <div className="space-y-2">
          <p className="text-zinc-300 text-sm leading-relaxed">
            Enter full-screen combat as{" "}
            <span className="font-black text-amber-400">
              {playerFaction.toUpperCase()}
            </span>
            .
          </p>
          <p className="text-zinc-500 text-xs">
            Continuous fire • Recoil • Enemies shoot back • Rank bonus active
          </p>
        </div>

        {lastResult && (
          <div className="text-sm">
            <span className="text-emerald-400 font-semibold">
              Last run: {lastResult.kills} kills
            </span>
            {lastResult.health <= 0 && (
              <span className="text-red-400 ml-2">• You were eliminated</span>
            )}
          </div>
        )}

        <button
          onClick={() => setInMatch(true)}
          className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 py-4 font-black text-white text-lg tracking-wide hover:brightness-110 active:scale-[0.98] transition shadow-lg shadow-red-900/50"
        >
          ENTER BATTLEFIELD
        </button>
      </motion.div>
    </div>
  );
}
