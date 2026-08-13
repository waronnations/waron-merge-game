// src/lib/game/use-game.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_TIER, type Faction } from "@/lib/units";
import {
  ENERGY_PER_MERGE,
  MAX_ENERGY,
  LOCAL_BOARD_LOCK_MS,
  STARTER_PACK,
  type EnergyTreasuryZone,
} from "@/lib/constants";
import { TARGET_ATTACK_ENERGY_COST } from "@/lib/constants/war-targets";
import { preloadUnitImages } from "@/lib/preload-units";
import type { GameState } from "./types";
import {
  initialState,
  isCorrectSide,
  load,
  pickDailyQuests,
  save,
} from "./helpers";
import {
  computeHybridClash,
  computeNormalMerge,
  computeHybridMerge,
  computeTargetAttack,
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
  afterMergeWarMode,
  markTargetTutorialSeen,
  clearWarModeVictory,
} from "./war-mode";
import type { HybridCommanderAbilityId } from "@/lib/constants/war-mode";
import { useRecentOpsPlayers } from "@/hooks/use-recent-ops-players";
import { battlefieldStrikeFn } from "@/lib/battlefield.functions";

export type { DailyClaimResult, LocalRecoverResult };

const ZONE_REFRESH_MS = 12_000;

/** Fire real OPS strike or Nation Nuke announcement to group + possible DM */
async function fireRealTargetAction(attacker: any, targetCell: any) {
  try {
    const label = targetCell.targetLabel || "Enemy";

    if (targetCell.targetType === "player") {
      let weaponId: "knife" | "pistol" | "rifle" = "knife";
      if (attacker.tier >= 4 || attacker.faction === "hybrid") weaponId = "rifle";
      else if (attacker.tier >= 3) weaponId = "pistol";

      // Real OPS strike → group announcement + history + possible DM
      await battlefieldStrikeFn({
        data: {
          target: label,
          weaponId,
        },
      });
    }

    if (targetCell.targetType === "nation") {
      // Always announce simulated nation nuke to @waronnations
      const { announceToGroup } = await import("@/lib/notify.server");
      announceToGroup(
        `☢️ NATION NUKE CONFIRMED\n\n` +
          `A Warlord just nuked <b>${label}</b> from the Live Battlefield!\n` +
          `+480 Glory · Control shifted\n\n` +
          `The pack is hungry. Feed it 🐺`,
      );
    }
  } catch (err) {
    console.warn("[WarMode] Server target action failed", err);
  }
}

export function useGame() {
  const [state, setState] = useState<GameState>(() => initialState());
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef<GameState>(state);

  const boardRevisionRef = useRef(0);
  const localBoardLockUntilRef = useRef(0);
  const treasuryZoneRef = useRef<EnergyTreasuryZone>("yellow");

  // Real recent players from OPS Kill Feed
  const realPlayers = useRecentOpsPlayers(25);

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

  // Treasury zone
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
        /* offline */
      }
    };
    void refreshZone();
    const int = setInterval(() => void refreshZone(), ZONE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(int);
    };
  }, []);

  // Daily quests
  useEffect(() => {
    const check = () => {
      setState((s) => {
        const next = refreshDailyQuestsIfNeeded(s, pickDailyQuests);
        if (!next) return s;
        stateRef.current = next;
        return next;
      });
    };
    const int = setInterval(check, 60_000);
    return () => clearInterval(int);
  }, []);

  // Energy regen
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

  // War Mode ticker + target spawning with real players
  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => {
      const current = stateRef.current;
      if (!current.warMode?.active) return;

      let next = tickWarMode(current);
      next = afterMergeWarMode(next, realPlayers);
      if (next !== current) {
        stateRef.current = next;
        setState(next);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [hydrated, realPlayers]);

  // Idle
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

  // ─── MAIN MERGE ────────────────────────────────────────────────
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
      rewardText?: string;
    } => {
      const s = stateRef.current;
      if (from === to) return { ok: false };
      const a = s.board[from];
      const b = s.board[to];
      if (!a || !b) return { ok: false };

      // FIXED: Live Targets bypass the hard energy gate when cost is free
      const isTargetAttack = !!(b.isTarget && a.faction !== "target");
      if (!isTargetAttack && s.energy < ENERGY_PER_MERGE) return { ok: false };
      if (
        isTargetAttack &&
        TARGET_ATTACK_ENERGY_COST > 0 &&
        s.energy < TARGET_ATTACK_ENERGY_COST
      ) {
        return { ok: false };
      }

      // 0. LIVE TARGET ATTACK (Player STRIKE or Nation NUKE)
      const targetAttack = computeTargetAttack(s, from, to);
      if (targetAttack) {
        let nextState = targetAttack.nextState;
        nextState = afterMergeWarMode(nextState, realPlayers);
        stateRef.current = nextState;
        setState(nextState);
        bumpBoardRevision();

        // Fire real OPS / Nuke in background → group + possible DM
        void fireRealTargetAction(a, b);

        return {
          ...targetAttack.result,
          rewardText: targetAttack.rewardText,
        };
      }

      // 1. Classic Hybrid Clash
      const clash = computeHybridClash(s, from, to, comboCount);
      if (clash) {
        let nextState = afterMergeWarMode(clash.nextState, realPlayers);
        stateRef.current = nextState;
        setState(nextState);
        bumpBoardRevision();

        setTimeout(() => {
          setState((prev) => {
            if (prev.explosion?.key !== clash.explosionKey) return prev;
            if (prev.pendingHybrid) return prev;
            if (prev.board[from] !== null || prev.board[to] !== null) return prev;

            const next = {
              ...prev,
              explosion: null,
              pendingHybrid: {
                id: prev.nextId,
                parentDogId: clash.dogId,
                parentCatId: clash.catId,
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

      // 2. Hybrid ↔ Hybrid
      const hybridMerge = computeHybridMerge(s, from, to, comboMult, comboCount);
      if (hybridMerge) {
        let nextState = afterMergeWarMode(hybridMerge.nextState, realPlayers);
        stateRef.current = nextState;
        setState(nextState);
        bumpBoardRevision();
        return hybridMerge.result;
      }

      // 3. Normal merge
      const merged = computeNormalMerge(s, from, to, comboMult, comboCount);
      if (!merged) return { ok: false };

      let nextState = afterMergeWarMode(merged.nextState, realPlayers);
      stateRef.current = nextState;
      setState(nextState);
      bumpBoardRevision();
      return merged.result;
    },
    [realPlayers],
  );

  // ─── Rest of actions ───────────────────────────────────────────
  const swap = useCallback((from: number, to: number) => {
    setState((s) => {
      if (from === to) return s;
      const a = s.board[from];
      if (!a) return s;
      if (
        a.faction !== "hybrid" &&
        a.faction !== "target" &&
        !isCorrectSide(to, a.faction)
      )
        return s;

      const b = s.board[to];
      if (
        b &&
        b.faction !== "hybrid" &&
        b.faction !== "target" &&
        !isCorrectSide(from, b.faction)
      )
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

  const sacrificeBoardHybrid = useCallback((idx: number) => {
    const s = stateRef.current;
    const outcome = sacrificeBoardHybridState(s, idx);
    if (!outcome.ok) return outcome;

    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    bumpBoardRevision();

    return {
      ok: true as const,
      glory: outcome.glory,
      wardog: outcome.wardog,
      warcat: outcome.warcat,
    };
  }, []);

  const sacrificeConqueredSide = useCallback((side: "dog" | "cat") => {
    const s = stateRef.current;
    const outcome = sacrificeConqueredSideState(s, side);
    if (!outcome.ok) return outcome;

    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    bumpBoardRevision();

    return {
      ok: true as const,
      glory: outcome.glory,
      wardog: outcome.wardog,
      warcat: outcome.warcat,
    };
  }, []);

  const claimDaily = useCallback((): DailyClaimResult => {
    const s = stateRef.current;
    const outcome = claimDailyState(s);
    if (!outcome) return null;
    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    return outcome.result;
  }, []);

  const canClaimDaily = useCallback(() => canClaimDailyPure(stateRef.current), []);

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

  const recoverEnergy = useCallback(
    (_payWith?: "wardog" | "warcat"): LocalRecoverResult => {
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
    },
    [],
  );

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
      if (!preferLocalBoard) boardRevisionRef.current = 0;
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

  // ─── WAR MODE ACTIONS ──────────────────────────────────────────
  const tryEnterWarMode = useCallback(() => {
    const next = enterWarMode(stateRef.current);
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

  const markTargetTutorialSeenFn = useCallback(() => {
    const next = markTargetTutorialSeen(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const clearVictory = useCallback(() => {
    const next = clearWarModeVictory(stateRef.current);
    stateRef.current = next;
    setState(next);
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
    markTargetTutorialSeen: markTargetTutorialSeenFn,
    clearWarModeVictory: clearVictory,
  };
}
