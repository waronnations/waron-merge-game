// src/hooks/server-progress/use-sync-progress.ts
import { useEffect, useRef, useState, useCallback } from "react";
import {
  getProgress,
  syncProgress,
  commitMerge,
  commitSpawn,
  commitSwap,
  resolveHybrid,
  sacrificeBoardHybrid,
} from "@/lib/game.functions";
import type { GameState } from "@/lib/game-state";

/** Background cadence — not a hard cap on player speed */
const SYNC_INTERVAL_MS = 6_000;
const SYNC_QUIET_MS = 800;

/** Errors that are noise (never toast) */
const SILENT_REASONS = new Set(["rate_limited"]);

export type ServerSyncStatus =
  | "idle"
  | "hydrating"
  | "ready"
  | "unavailable"
  | "error";

/**
 * Decide whether local progress should be kept over a server snapshot.
 * Protects board arrangement: equal-or-higher units + merges not lower → keep local.
 */
function isBetterLocal(local: GameState, server: any): boolean {
  if (!server) return true;
  if ((local.glory ?? 0) > (server.glory ?? 0)) return true;
  if ((local.totalMerges ?? 0) > (server.totalMerges ?? 0)) return true;
  if ((local.highestTier ?? 1) > (server.highestTier ?? 1)) return true;
  if (
    (local.wardogTokens ?? 0) + (local.warcatTokens ?? 0) >
    (server.wardogTokens ?? 0) + (server.warcatTokens ?? 0)
  )
    return true;

  const localUnits = (local.board ?? []).filter(Boolean).length;
  const serverUnits = Array.isArray(server.board)
    ? server.board.filter(Boolean).length
    : 0;
  if (
    localUnits >= serverUnits &&
    (local.totalMerges ?? 0) >= (server.totalMerges ?? 0)
  ) {
    return true;
  }

  return false;
}

/**
 * Apply economy fields from a server commit WITHOUT touching the board.
 * Board stays local-first until a cold pull / hydrate.
 */
function patchEconomyFromServer(
  applyServerEconomy: ((p: Partial<GameState>) => void) | undefined,
  applyServerState: (s: GameState) => void,
  local: GameState | null | undefined,
  serverState: GameState,
) {
  if (applyServerEconomy) {
    applyServerEconomy({
      energy: serverState.energy,
      glory: serverState.glory,
      totalMerges: serverState.totalMerges,
      highestTier: serverState.highestTier,
      wardogTokens: serverState.wardogTokens,
      warcatTokens: serverState.warcatTokens,
      lastRegenAt: serverState.lastRegenAt,
      lastMergeAt: serverState.lastMergeAt,
      achievements: serverState.achievements,
      pendingHybrid: serverState.pendingHybrid,
      hybrids: serverState.hybrids,
      explosion: serverState.explosion,
    });
    return;
  }

  applyServerState({
    ...serverState,
    board: local?.board ?? serverState.board,
  });
}

export function useServerProgress(opts: {
  authenticated: boolean;
  localState: GameState | null;
  hydrate: (state: GameState) => void;
  applyServerState: (state: GameState) => void;
  applyServerEconomy?: (partial: Partial<GameState>) => void;
}): {
  status: ServerSyncStatus;
  lastError?: string;
  forceSync: () => Promise<boolean>;
  pullFromServer: () => Promise<GameState | null>;
  serverMerge: (
    from: number,
    to: number,
  ) => Promise<{
    ok: boolean;
    state?: GameState;
    isHybrid?: boolean;
    token?: string;
    amount?: number;
    reason?: string;
  }>;
  serverSpawn: (opts?: {
    targetIdx?: number;
    faction?: "dog" | "cat";
  }) => Promise<{
    ok: boolean;
    state?: GameState;
    reason?: string;
  }>;
  serverSwap: (
    from: number,
    to: number,
  ) => Promise<{ ok: boolean; state?: GameState; reason?: string }>;
  serverResolveHybrid: (
    choice: "sacrifice" | "keep",
  ) => Promise<{ ok: boolean; state?: GameState; reason?: string }>;
  serverSacrificeBoardHybrid: (
    idx: number,
  ) => Promise<{
    ok: boolean;
    state?: GameState;
    glory?: number;
    wardog?: number;
    warcat?: number;
    reason?: string;
  }>;
} {
  const {
    authenticated,
    localState,
    hydrate,
    applyServerState,
    applyServerEconomy,
  } = opts;
  const [status, setStatus] = useState<ServerSyncStatus>("idle");
  const [lastError, setLastError] = useState<string | undefined>();
  const hydratedRef = useRef(false);
  const lastSyncedAtRef = useRef(0);
  const lastPayloadRef = useRef<string>("");
  const localStateRef = useRef(localState);
  const statusRef = useRef(status);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const pendingForceRef = useRef(false);
  const seedRequiredRef = useRef(false);

  useEffect(() => {
    localStateRef.current = localState;
  }, [localState]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const doSync = useCallback(async (force = false): Promise<boolean> => {
    const current = localStateRef.current;
    if (!current || statusRef.current !== "ready") return false;

    const payload = JSON.stringify(current);
    if (!force && payload === lastPayloadRef.current) return true;

    if (inFlightRef.current) {
      if (force) pendingForceRef.current = true;
      return inFlightRef.current;
    }

    const run = (async (): Promise<boolean> => {
      try {
        const res = await syncProgress({ data: current } as any);
        if (!res || (res as any).ok === false) {
          const reason = (res as any)?.reason ?? "sync_rejected";
          if (!SILENT_REASONS.has(reason)) {
            setLastError(reason);
            console.warn("[sync] rejected:", reason);
          }
          return false;
        }
        lastSyncedAtRef.current = Date.now();
        lastPayloadRef.current = JSON.stringify(
          localStateRef.current ?? current,
        );
        setLastError(undefined);
        return true;
      } catch (e) {
        setLastError(e instanceof Error ? e.message : "syncProgress failed");
        return false;
      } finally {
        inFlightRef.current = null;
        if (pendingForceRef.current) {
          pendingForceRef.current = false;
          void doSync(true);
        }
      }
    })();

    inFlightRef.current = run;
    return run;
  }, []);

  const forceSync = useCallback(async () => doSync(true), [doSync]);

  useEffect(() => {
    if (!authenticated || hydratedRef.current) return;
    hydratedRef.current = true;
    setStatus("hydrating");

    (async () => {
      try {
        const res = await getProgress();
        if (!res.available) {
          setStatus("unavailable");
          return;
        }
        const serverState = res.state as GameState | null;
        const local = localStateRef.current;

        if (serverState && local && isBetterLocal(local, serverState)) {
          console.info(
            "[sync] local progress is ahead (or equal units), keeping it",
          );
          // Lift local economy to server floor so seed is not glory_regressed
          if (applyServerEconomy) {
            applyServerEconomy({
              glory: Math.max(local.glory ?? 0, serverState.glory ?? 0),
              totalMerges: Math.max(
                local.totalMerges ?? 0,
                serverState.totalMerges ?? 0,
              ),
              highestTier: Math.max(
                local.highestTier ?? 1,
                serverState.highestTier ?? 1,
              ),
              wardogTokens: Math.max(
                local.wardogTokens ?? 0,
                serverState.wardogTokens ?? 0,
              ),
              warcatTokens: Math.max(
                local.warcatTokens ?? 0,
                serverState.warcatTokens ?? 0,
              ),
            });
          }
          seedRequiredRef.current = true;
        } else if (serverState) {
          applyServerState(serverState);
        } else {
          seedRequiredRef.current = true;
        }

        statusRef.current = "ready";
        setStatus("ready");

        if (seedRequiredRef.current) {
          seedRequiredRef.current = false;
          const seeded = await doSync(true);
          if (!seeded) console.warn("[sync] initial seed failed");
        }
      } catch (e) {
        setStatus("error");
        setLastError(e instanceof Error ? e.message : "getProgress failed");
      }
    })();
  }, [authenticated, hydrate, applyServerState, applyServerEconomy, doSync]);

  const pullFromServer = useCallback(async (): Promise<GameState | null> => {
    try {
      const res = await getProgress();
      if (!res.available || !res.state) return null;
      const serverState = res.state as GameState;
      // Economy only — never stomp local board mid-play
      if (applyServerEconomy) {
        applyServerEconomy({
          energy: serverState.energy,
          glory: serverState.glory,
          totalMerges: serverState.totalMerges,
          highestTier: serverState.highestTier,
          wardogTokens: serverState.wardogTokens,
          warcatTokens: serverState.warcatTokens,
          lastRegenAt: serverState.lastRegenAt,
          lastMergeAt: serverState.lastMergeAt,
          achievements: serverState.achievements,
          pendingHybrid: serverState.pendingHybrid,
          hybrids: serverState.hybrids,
          explosion: serverState.explosion,
        });
      } else {
        applyServerState({
          ...serverState,
          board: localStateRef.current?.board ?? serverState.board,
        });
      }
      lastPayloadRef.current = JSON.stringify(
        localStateRef.current ?? serverState,
      );
      lastSyncedAtRef.current = Date.now();
      setLastError(undefined);
      return serverState;
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "pullFromServer failed");
      return null;
    }
  }, [applyServerState, applyServerEconomy]);

  const serverMerge = useCallback(
    async (from: number, to: number) => {
      if (statusRef.current !== "ready") {
        return { ok: false, reason: "not_ready" };
      }
      try {
        const res = await commitMerge({ data: { from, to } } as any);
        if (res.ok && (res as any).state) {
          patchEconomyFromServer(
            applyServerEconomy,
            applyServerState,
            localStateRef.current,
            (res as any).state as GameState,
          );
          lastPayloadRef.current = JSON.stringify(localStateRef.current);
          lastSyncedAtRef.current = Date.now();
        } else if (!res.ok) {
          console.warn("[merge] server rejected:", (res as any)?.reason);
        }
        return res as any;
      } catch (e) {
        return {
          ok: false,
          reason: e instanceof Error ? e.message : "merge_failed",
        };
      }
    },
    [applyServerState, applyServerEconomy],
  );

  const serverSpawn = useCallback(
    async (opts?: { targetIdx?: number; faction?: "dog" | "cat" }) => {
      if (statusRef.current !== "ready") {
        return { ok: false, reason: "not_ready" };
      }
      try {
        const res = await commitSpawn({
          data: {
            targetIdx: opts?.targetIdx,
            faction: opts?.faction,
          },
        } as any);
        if (res.ok && (res as any).state) {
          patchEconomyFromServer(
            applyServerEconomy,
            applyServerState,
            localStateRef.current,
            (res as any).state as GameState,
          );
          lastPayloadRef.current = JSON.stringify(localStateRef.current);
          lastSyncedAtRef.current = Date.now();
        } else if (!res.ok) {
          console.warn("[spawn] server rejected:", (res as any)?.reason);
        }
        return res as any;
      } catch (e) {
        return {
          ok: false,
          reason: e instanceof Error ? e.message : "spawn_failed",
        };
      }
    },
    [applyServerState, applyServerEconomy],
  );

  const serverSwap = useCallback(
    async (from: number, to: number) => {
      if (statusRef.current !== "ready") {
        return { ok: false, reason: "not_ready" };
      }
      try {
        const res = await commitSwap({ data: { from, to } } as any);
        if (res.ok && (res as any).state) {
          patchEconomyFromServer(
            applyServerEconomy,
            applyServerState,
            localStateRef.current,
            (res as any).state as GameState,
          );
          lastPayloadRef.current = JSON.stringify(localStateRef.current);
          lastSyncedAtRef.current = Date.now();
        }
        return res as any;
      } catch (e) {
        return {
          ok: false,
          reason: e instanceof Error ? e.message : "swap_failed",
        };
      }
    },
    [applyServerState, applyServerEconomy],
  );

  const serverResolveHybrid = useCallback(
    async (choice: "sacrifice" | "keep") => {
      if (statusRef.current !== "ready") {
        return { ok: false, reason: "not_ready" };
      }
      try {
        const res = await resolveHybrid({ data: { choice } } as any);
        if (res.ok && (res as any).state) {
          const st = (res as any).state as GameState;
          if (applyServerEconomy) {
            applyServerEconomy({
              energy: st.energy,
              glory: st.glory,
              totalMerges: st.totalMerges,
              highestTier: st.highestTier,
              wardogTokens: st.wardogTokens,
              warcatTokens: st.warcatTokens,
              pendingHybrid: st.pendingHybrid,
              hybrids: st.hybrids,
              explosion: st.explosion,
              board: st.board,
            });
          } else {
            applyServerState(st);
          }
          lastPayloadRef.current = JSON.stringify(
            localStateRef.current ?? st,
          );
          lastSyncedAtRef.current = Date.now();
        }
        return res as any;
      } catch (e) {
        return {
          ok: false,
          reason: e instanceof Error ? e.message : "hybrid_failed",
        };
      }
    },
    [applyServerState, applyServerEconomy],
  );

  const serverSacrificeBoardHybrid = useCallback(
    async (idx: number) => {
      if (statusRef.current !== "ready") {
        return { ok: false, reason: "not_ready" };
      }
      try {
        const res = await sacrificeBoardHybrid({ data: { idx } } as any);
        if (res.ok && (res as any).state) {
          const st = (res as any).state as GameState;
          if (applyServerEconomy) {
            applyServerEconomy({
              energy: st.energy,
              glory: st.glory,
              totalMerges: st.totalMerges,
              highestTier: st.highestTier,
              wardogTokens: st.wardogTokens,
              warcatTokens: st.warcatTokens,
              board: st.board,
              explosion: st.explosion,
            });
          } else {
            applyServerState(st);
          }
          lastPayloadRef.current = JSON.stringify(
            localStateRef.current ?? st,
          );
          lastSyncedAtRef.current = Date.now();
        }
        return res as any;
      } catch (e) {
        return {
          ok: false,
          reason:
            e instanceof Error ? e.message : "hybrid_sacrifice_failed",
        };
      }
    },
    [applyServerState, applyServerEconomy],
  );

  useEffect(() => {
    if (status !== "ready" || !localState) return;
    const payload = JSON.stringify(localState);
    if (payload === lastPayloadRef.current) return;

    const now = Date.now();
    const first = lastSyncedAtRef.current === 0;
    const sinceLast = now - lastSyncedAtRef.current;
    const wait = first
      ? 300
      : Math.max(SYNC_QUIET_MS, SYNC_INTERVAL_MS - sinceLast);

    const timer = window.setTimeout(() => {
      void doSync(false);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [status, localState, doSync]);

  return {
    status,
    lastError,
    forceSync,
    pullFromServer,
    serverMerge,
    serverSpawn,
    serverSwap,
    serverResolveHybrid,
    serverSacrificeBoardHybrid,
  };
}
