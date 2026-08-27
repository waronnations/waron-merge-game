import { useState } from "react";
import { motion } from "framer-motion";
import { ShooterCanvas } from "./ShooterCanvas";
import type { BattleMode, Faction, PlayerStats, BattleRewardResult } from "./types";
import type { GameState } from "@/lib/game/types";
import { claimBattleReward } from "@/lib/battle/claimBattleReward.server";
import { LOADOUT, MATCH_SECONDS } from "./constants";

interface Props {
  state: GameState;
  onRewardClaimed?: () => void | Promise<void>;
}

export function BattlefieldTab({ state, onRewardClaimed }: Props) {
  const [inMatch, setInMatch] = useState(false);
  const [mode, setMode] = useState<BattleMode>("hunt");
  const [lastResult, setLastResult] = useState<PlayerStats | null>(null);
  const [lastReward, setLastReward] = useState<BattleRewardResult | null>(null);
  const [claiming, setClaiming] = useState(false);

  const playerFaction: Faction =
    (state.wardogTokens ?? 0) >= (state.warcatTokens ?? 0) ? "wardog" : "warcat";
  const rankBonus = Math.floor((state.highestTier ?? 1) / 2);
  const gun = LOADOUT[playerFaction];

  const handleMatchEnd = async (stats: PlayerStats) => {
    setLastResult(stats);
    setInMatch(false);
    setClaiming(true);
    setLastReward(null);
    try {
      const reward = await claimBattleReward({
        data: {
          kills: stats.kills,
          deaths: stats.deaths,
          damageDealt: stats.damageDealt ?? 0,
          survived: stats.survived ?? false,
          durationSec: Math.round(stats.durationSec || MATCH_SECONDS),
          faction: playerFaction,
          highestTier: state.highestTier ?? 1,
          shotsFired: stats.shotsFired,
          hits: stats.hits,
          mode: stats.mode,
        },
      });
      setLastReward(reward);
      if (onRewardClaimed) await onRewardClaimed();
    } catch (err) {
      console.error("Battle reward claim failed", err);
      setLastReward(null);
    } finally {
      setClaiming(false);
    }
  };

  if (inMatch) {
    return (
      <ShooterCanvas
        playerFaction={playerFaction}
        rankBonus={rankBonus}
        mode={mode}
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
          {gun.name} • Rank +{rankBonus * 6} HP
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-6 text-center space-y-5 shadow-xl"
      >
        <p className="text-zinc-300 text-sm leading-relaxed">
          Drop in as{" "}
          <span className="font-black text-amber-400">{playerFaction.toUpperCase()}</span>
          . Hold fire. Hunt the other color. {MATCH_SECONDS}s rounds.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {([
            ["hunt", "HUNT"],
            ["waves", "WAVES"],
            ["hold", "HOLD"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-xl py-2 text-[0.65rem] font-black tracking-widest ${
                mode === id
                  ? "bg-amber-500 text-black"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[0.65rem] text-zinc-500">
          {mode === "hunt" && "Only opposite-faction bots count as kills."}
          {mode === "waves" && "3 waves. Clear them all to victory."}
          {mode === "hold" && "Stand on the center crate to score. Survive the clock."}
        </p>

        {lastResult && (
          <div className="text-sm space-y-1">
            <div className="text-emerald-400 font-semibold">
              Last: {lastResult.kills} kills • {lastResult.accuracy}% acc •{" "}
              {lastResult.durationSec}s
              {lastResult.survived ? " • Victory" : ""}
            </div>
            {claiming && <div className="text-xs text-zinc-500">Claiming rewards…</div>}
            {lastReward && !claiming && (
              <div className="text-xs text-zinc-300 font-medium">{lastReward.message}</div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setInMatch(true)}
          className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 py-4 font-black text-white text-lg tracking-wide hover:brightness-110 active:scale-[0.98] transition shadow-lg shadow-red-900/50"
        >
          ENTER {mode.toUpperCase()}
        </button>
      </motion.div>
    </div>
  );
}
