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
    // Future: server reward glory / tokens here
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white tracking-tight">BATTLEFIELD</h2>
        <div className="text-xs text-zinc-400 font-medium">
          Rank +{rankBonus * 6} HP
        </div>
      </div>

      {!inMatch ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-zinc-700/80 bg-zinc-900/90 p-6 text-center space-y-5"
        >
          <div className="space-y-2">
            <p className="text-zinc-300 text-sm leading-relaxed">
              Drop into the arena as{" "}
              <span className="font-black text-amber-400">
                {playerFaction.toUpperCase()}
              </span>
              .
              <br />
              Clear the enemy force. Your merge rank grants real combat power.
            </p>
            {lastResult && (
              <p className="text-emerald-400 text-sm font-semibold">
                Last match: {lastResult.kills} kills
              </p>
            )}
          </div>

          <button
            onClick={() => setInMatch(true)}
            className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 py-4 font-black text-white text-lg tracking-wide hover:brightness-110 active:scale-[0.98] transition shadow-lg shadow-red-900/40"
          >
            ENTER BATTLEFIELD
          </button>
        </motion.div>
      ) : (
        <ShooterCanvas
          playerFaction={playerFaction}
          rankBonus={rankBonus}
          onMatchEnd={handleMatchEnd}
        />
      )}
    </div>
  );
}
