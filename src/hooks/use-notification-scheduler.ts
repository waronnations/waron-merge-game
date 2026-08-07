import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scheduleNotification } from "@/lib/notifications.functions";
import { MAX_ENERGY, ENERGY_REGEN_MS, type GameState } from "@/lib/game-state";

interface Opts {
  authenticated: boolean;
  state: GameState | null;
}

/**
 * Schedules two personal reminders via the bot:
 *  - "energy_full"  → when energy will reach MAX_ENERGY at current regen rate
 *  - "daily_ready"  → next midnight (local) after today's claim
 * Reschedules whenever the ETA changes; cancels itself when the trigger passes.
 */
export function useNotificationScheduler({ authenticated, state }: Opts) {
  const schedule = useServerFn(scheduleNotification);
  const lastEnergyEtaRef = useRef<number>(0);
  const lastDailyEtaRef = useRef<number>(0);

  useEffect(() => {
    if (!authenticated || !state) return;

    // ---- Energy full reminder ----
    let energyDue = 0;
    if (state.energy < MAX_ENERGY) {
      const needed = MAX_ENERGY - state.energy;
      energyDue = state.lastRegenAt + needed * ENERGY_REGEN_MS;
    }
    if (Math.abs(energyDue - lastEnergyEtaRef.current) > 60_000) {
      lastEnergyEtaRef.current = energyDue;
      void schedule({ data: { kind: "energy_full", dueAt: energyDue } }).catch(() => {});
    }

    // ---- Daily bonus reminder ----
    // If already available now, cancel; else fire at next local midnight.
    const now = Date.now();
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const lastClaimDay = new Date(state.lastDailyClaim);
    lastClaimDay.setHours(0, 0, 0, 0);
    let dailyDue = 0;
    if (state.lastDailyClaim > 0 && lastClaimDay.getTime() >= todayMid.getTime()) {
      const nextMid = new Date(todayMid.getTime() + 24 * 60 * 60 * 1000);
      dailyDue = nextMid.getTime();
    } else if (state.lastDailyClaim === 0) {
      // Never claimed — remind an hour from now once so we don't spam newbies.
      dailyDue = now + 60 * 60 * 1000;
    }
    if (Math.abs(dailyDue - lastDailyEtaRef.current) > 60_000) {
      lastDailyEtaRef.current = dailyDue;
      void schedule({ data: { kind: "daily_ready", dueAt: dailyDue } }).catch(() => {});
    }
  }, [authenticated, state, schedule]);
}
