// src/lib/game/use-game.ts
// The client useGame hook: wires together the pure state-transition logic
// from merge/spawn/hybrid/daily/idle/energy/server-reconcile into React
// state + optimistic-update/rollback semantics.
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_TIER, type Faction } from "@/lib/units";
import {
  ENERGY_PER_MERGE,
  MAX_ENERGY,
  LOCAL_BOARD_LOCK_MS,
  STARTER_PACK,
  type EnergyTreasuryZone,
} from "@/lib/constants";
import { preloadUnitImages } from "@/lib/preload-units";
import type { GameState, HybridNFT } from "./types";
import {
  applyOfflineEnergyRegen,
  clampEnergy,
  initialState,
  isCorrectSide,
  load,
  pickDailyQuests,
  save,
  sanitizeBoard,
  truncateToDay,
} from "./helpers";
import {
  computeHybridClash,
  computeNormalMerge,
  computeHybridMerge,
} from "./merge";
import { computeRollbackSpawn, computeSpawn } from "./spawn";
import {
  completeHybridWithArtState,
  resolveHybridState,
  sacrificeBoardHybridState,
  sacrificeConqueredSideState,
} from "./hybrid";
import {
  canClaimDailyPure,
  claimDailyQuestState,
  claimDailyState,
  claimTaskState,
  refreshDailyQuestsIfNeeded,
  type DailyClaimResult,
} from "./daily";
import {
  calculateIdleUpdate,
  claimIdleRewardState,
  dismissIdleRewardState,
} from "./idle";
import {
  computeRecoverEnergy,
  energyRegenTick,
  type LocalRecoverResult,
} from "./energy";
import {
  applyServerEconomyLogic,
  applyServerStateLogic,
  hydrateState,
} from "./server-reconcile";
import { getTreasuryHealthFn } from "@/lib/treasury.functions";
import {
  canEnterWarMode,
  enterWarMode,
  tickWarMode,
  deployUnit,
  activateHybridAbility,
  endWarMode,
} from "./war-mode";
import type { HybridCommanderAbilityId } from "@/lib/constants/war-mode";

export type { DailyClaimResult, LocalRecoverResult };

const ZONE_REFRESH_MS = 12_000;

export function useGame() {
  const [state, setState] = useState<GameState>(() => initialState());
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef<GameState>(state);

  const boardRevisionRef = useRef(0);
  const localBoardLockUntilRef = useRef(0);

  /** Cached Claim Treasury zone for dynamic energy regen (default yellow = 1×). */
  const treasuryZoneRef = useRef<EnergyTreasuryZone>("yellow");

  const bumpBoardRevision = () => {
    boardRevisionRef.current += 1;
    localBoardLockUntilRef.current = Date.now() + LOCAL_BOARD_LOCK_MS;
  };

  useEffect(() => {
    const loaded = load();
    stateRef.current = loaded;
    setState(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    preloadUnitImages();
  }, [hydrated]);

  useEffect(() => {
    stateRef.current = state;
    if (hydrated) save(state);
  }, [state, hydrated]);

  // Refresh treasury zone periodically so energy regen tracks Claim Treasury health
  useEffect(() => {
    let cancelled = false;

    const refreshZone = async () => {
      try {
        const snap = await getTreasuryHealthFn();
        if (cancelled || !snap?.zone) return;
        if (
          snap.zone === "green" ||
          snap.zone === "yellow" ||
          snap.zone === "red" ||
          snap.zone === "critical"
        ) {
          treasuryZoneRef.current = snap.zone;
        }
      } catch {
        /* offline — keep last known zone */
      }
    };

    void refreshZone();
    const int = setInterval(() => void refreshZone(), ZONE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(int);
    };
  }, []);

  useEffect(() => {
    const check = () => {
      setState((s) => {
        const next = refreshDailyQuestsIfNeeded(s, pickDailyQuests);
        if (!next) return s;
        stateRef.current = next;
        return next;
      });
    };
    const int = setInterval(check, 60 * 1000);
    return () => clearInterval(int);
  }, []);

  // Passive energy regen — driven by treasury zone
  useEffect(() => {
    const interval = setInterval(() => {
      setState((s) => {
        const next = energyRegenTick(s, treasuryZoneRef.current);
        if (!next) return s;
        stateRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // War Mode ticker
  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => {
      const current = stateRef.current;
      if (!current.warMode?.active) return;
      const next = tickWarMode(current);
      if (next !== current) {
        stateRef.current = next;
        setState(next);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const calculateIdle = () => {
      setState((s) => {
        const next = calculateIdleUpdate(s);
        if (!next) return s;
        stateRef.current = next;
        return next;
      });
    };

    calculateIdle();
    const onVis = () => {
      if (document.visibilityState === "visible") calculateIdle();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [hydrated]);

  const tryMerge = useCallback(
    (
      from: number,
      to: number,
      comboMult = 1,
      comboCount = 1,
    ): {
      ok: boolean;
      token?: "wardog" | "warcat";
      amount?: number;
      isHybrid?: boolean;
      combo?: number;
      comboMult?: number;
      unlocked?: string[];
      gloryGained?: number;
    } => {
      const s = stateRef.current;
      if (from === to) return { ok: false };
      const a = s.board[from];
      const b = s.board[to];
      if (!a || !b) return { ok: false };
      if (s.energy < ENERGY_PER_MERGE) return { ok: false };

      // 1. Classic Hybrid Clash (T5 dog + T5 cat)
      const clash = computeHybridClash(s, from, to, comboCount);
      if (clash) {
        const { nextState, dogId, catId, explosionKey } = clash;
        stateRef.current = nextState;
        setState(nextState);
        bumpBoardRevision();

        setTimeout(() => {
          setState((prev) => {
            // Stronger guards against stale / random modal
            if (prev.explosion?.key !== explosionKey) return prev;
            if (prev.pendingHybrid) return prev; // already handled
            // Board must still be empty at the clash positions
            if (prev.board[from] !== null || prev.board[to] !== null)
              return prev;

            const next = {
              ...prev,
              explosion: null,
              pendingHybrid: {
                id: prev.nextId,
                parentDogId: dogId,
                parentCatId: catId,
                from,
                to,
              },
              nextId: prev.nextId + 1,
            };
            stateRef.current = next;
            return next;
          });
        }, 1800);

        return clash.result;
      }

      // 2. Hybrid ↔ Hybrid merge (any same-tier hybrids)
      const hybridMerge = computeHybridMerge(
        s,
        from,
        to,
        comboMult,
        comboCount,
      );
      if (hybridMerge) {
        stateRef.current = hybridMerge.nextState;
        setState(hybridMerge.nextState);
        bumpBoardRevision();
        return hybridMerge.result;
      }

      // 3. Normal same-faction merge
      const merged = computeNormalMerge(s, from, to, comboMult, comboCount);
      if (!merged) return { ok: false };

      stateRef.current = merged.nextState;
      setState(merged.nextState);
      bumpBoardRevision();
      return merged.result;
    },
    [],
  );

  const swap = useCallback((from: number, to: number) => {
    setState((s) => {
      if (from === to) return s;
      const a = s.board[from];
      if (!a) return s;
      if (a.faction !== "hybrid" && !isCorrectSide(to, a.faction)) return s;

      const b = s.board[to];
      if (b && b.faction !== "hybrid" && !isCorrectSide(from, b.faction))
        return s;

      if (a.tier >= MAX_TIER && a.faction !== "hybrid") return s;

      const board = s.board.slice();
      board[from] = board[to];
      board[to] = a;
      const next = { ...s, board, lastSeenAt: Date.now() };
      stateRef.current = next;
      bumpBoardRevision();
      return next;
    });
  }, []);

  const spawnUnit = useCallback(():
    | { ok: true; targetIdx: number; faction: Faction; unitId: number }
    | { ok: false; reason: string } => {
    const s = stateRef.current;
    const outcome = computeSpawn(s);
    if (!outcome.ok) return outcome;

    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    bumpBoardRevision();

    return {
      ok: true,
      targetIdx: outcome.targetIdx,
      faction: outcome.faction,
      unitId: outcome.unitId,
    };
  }, []);

  /** Rolls back an optimistic deploy the server rejected. */
  const rollbackSpawn = useCallback((targetIdx: number, unitId: number) => {
    setState((s) => {
      const next = computeRollbackSpawn(s, targetIdx, unitId);
      stateRef.current = next;
      return next;
    });
  }, []);

  const resolveHybrid = useCallback((choice: "sacrifice" | "keep") => {
    setState((s) => {
      const next = resolveHybridState(s, choice);
      stateRef.current = next;
      bumpBoardRevision();
      return next;
    });
  }, []);

  const completeHybridWithArt = useCallback((imageUrl: string) => {
    setState((s) => {
      const next = completeHybridWithArtState(s, imageUrl);
      stateRef.current = next;
      bumpBoardRevision();
      return next;
    });
  }, []);

  /** Sacrifice a hybrid already sitting on the board. */
  const sacrificeBoardHybrid = useCallback(
    (
      idx: number,
    ):
      | { ok: true; glory: number; wardog: number; warcat: number }
      | { ok: false; reason: string } => {
      const s = stateRef.current;
      const outcome = sacrificeBoardHybridState(s, idx);
      if (!outcome.ok) return outcome;

      stateRef.current = outcome.nextState;
      setState(outcome.nextState);
      bumpBoardRevision();

      return {
        ok: true,
        glory: outcome.glory,
        wardog: outcome.wardog,
        warcat: outcome.warcat,
      };
    },
    [],
  );

  /** Mass sacrifice an entire conquered side */
  const sacrificeConqueredSide = useCallback(
    (
      side: "dog" | "cat",
    ):
      | { ok: true; glory: number; wardog: number; warcat: number }
      | { ok: false; reason: string } => {
      const s = stateRef.current;
      const outcome = sacrificeConqueredSideState(s, side);
      if (!outcome.ok) return outcome;

      stateRef.current = outcome.nextState;
      setState(outcome.nextState);
      bumpBoardRevision();

      return {
        ok: true,
        glory: outcome.glory,
        wardog: outcome.wardog,
        warcat: outcome.warcat,
      };
    },
    [],
  );

  const claimDaily = useCallback((): DailyClaimResult => {
    const s = stateRef.current;
    const outcome = claimDailyState(s);
    if (!outcome) return null;
    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    return outcome.result;
  }, []);

  const canClaimDaily = useCallback(() => {
    return canClaimDailyPure(stateRef.current);
  }, []);

  const claimTask = useCallback((id: string) => {
    const s = stateRef.current;
    const outcome = claimTaskState(s, id);
    if (!outcome.ok) return outcome;
    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    return { ok: true as const };
  }, []);

  const claimDailyQuest = useCallback((id: string) => {
    const s = stateRef.current;
    const outcome = claimDailyQuestState(s, id);
    if (!outcome.ok) return outcome;
    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    return { ok: true as const };
  }, []);

  const claimIdleReward = useCallback(() => {
    setState((s) => {
      const next = claimIdleRewardState(s);
      if (!next) return s;
      stateRef.current = next;
      return next;
    });
  }, []);

  const dismissIdleReward = useCallback(() => {
    setState((s) => {
      const next = dismissIdleRewardState(s);
      if (!next) return s;
      stateRef.current = next;
      return next;
    });
  }, []);

  const dismissTutorial = useCallback(() => {
    setState((s) => {
      const next = { ...s, hasSeenTutorial: true };
      stateRef.current = next;
      return next;
    });
  }, []);

  const grantStarterPack = useCallback(() => {
    setState((s) => {
      if (s.hasSeenTutorial) return s;
      const next = {
        ...s,
        hasSeenTutorial: true,
        glory: s.glory + STARTER_PACK.glory,
        energy: Math.min(MAX_ENERGY, s.energy + STARTER_PACK.energy),
        wardogTokens: s.wardogTokens + STARTER_PACK.wardog,
        warcatTokens: s.warcatTokens + STARTER_PACK.warcat,
        lastSeenAt: Date.now(),
      };
      stateRef.current = next;
      return next;
    });
  }, []);

  const recoverEnergy = useCallback((
    _payWith?: "wardog" | "warcat",
  ): LocalRecoverResult => {
    const s = stateRef.current;
    const outcome = computeRecoverEnergy(s);
    if (!outcome.ok) return outcome;
    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    return {
      ok: true,
      energy: outcome.energy,
      spent: outcome.spent,
    };
  }, []);

  /**
   * @deprecated – free personal nuke is removed.
   */
  const useNuke = useCallback(() => {
    console.warn(
      "[WarOnNations] useNuke is deprecated. Use launchNuke(targetNationId) instead.",
    );
  }, []);

  const nukeWorld = useNuke;

  const hydrate = useCallback((partial: Partial<GameState>) => {
    setState((s) => {
      const next = hydrateState(s, partial);
      stateRef.current = next;
      return next;
    });
  }, []);

  const applyServerState = useCallback((incoming: GameState) => {
    setState((s) => {
      const { next, preferLocalBoard } = applyServerStateLogic(s, incoming, {
        boardRevision: boardRevisionRef.current,
        localBoardLockUntil: localBoardLockUntilRef.current,
      });

      if (!preferLocalBoard) {
        boardRevisionRef.current = 0;
      }

      stateRef.current = next;
      return next;
    });
  }, []);

  const applyServerEconomy = useCallback((incoming: Partial<GameState>) => {
    setState((s) => {
      const { next, boardChanged } = applyServerEconomyLogic(s, incoming);

      if (boardChanged) {
        boardRevisionRef.current += 1;
        localBoardLockUntilRef.current = Date.now() + LOCAL_BOARD_LOCK_MS;
      }

      stateRef.current = next;
      return next;
    });
  }, []);

  // ── WAR MODE ACTIONS ──────────────────────────────────────────────
  const tryEnterWarMode = useCallback(() => {
    const s = stateRef.current;
    const next = enterWarMode(s);
    if (!next) return { ok: false as const, reason: "Cannot enter War Mode" };
    stateRef.current = next;
    setState(next);
    bumpBoardRevision();
    return { ok: true as const };
  }, []);

  const tryDeployUnit = useCallback((index: number) => {
    const result = deployUnit(stateRef.current, index);
    if (result.ok) {
      stateRef.current = result.nextState;
      setState(result.nextState);
      bumpBoardRevision();
    }
    return result;
  }, []);

  const tryActivateAbility = useCallback((abilityId: HybridCommanderAbilityId) => {
    const next = activateHybridAbility(stateRef.current, abilityId);
    if (!next) return { ok: false as const };
    stateRef.current = next;
    setState(next);
    return { ok: true as const };
  }, []);

  const forceEndWarMode = useCallback(() => {
    const next = endWarMode(stateRef.current);
    stateRef.current = next;
    setState(next);
    bumpBoardRevision();
  }, []);

  return {
    state,
    hydrated,
    tryMerge,
    swap,
    spawnUnit,
    rollbackSpawn,
    resolveHybrid,
    completeHybridWithArt,
    sacrificeBoardHybrid,
    sacrificeConqueredSide,
    claimDaily,
    canClaimDaily,
    claimTask,
    claimDailyQuest,
    claimIdleReward,
    dismissIdleReward,
    dismissTutorial,
    grantStarterPack,
    recoverEnergy,
    useNuke,
    nukeWorld,
    hydrate,
    applyServerState,
    applyServerEconomy,

    // War Mode
    warMode: state.warMode,
    tryEnterWarMode,
    tryDeployUnit,
    tryActivateAbility,
    forceEndWarMode,
    canEnterWarMode: () => canEnterWarMode(stateRef.current),
  };
}
