// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";

import { useGame, type GameState, MAX_ENERGY } from "@/lib/game-state";
import { RECOVER_ENERGY_TOKEN_COST } from "@/lib/constants";
import { initTelegram } from "@/lib/telegram";
import { useTelegramSession } from "@/hooks/use-telegram-session";
import { useLeaderboard, useServerProgress } from "@/hooks/use-server-progress";
import { useNotificationScheduler } from "@/hooks/use-notification-scheduler";
import { useGameHandlers } from "@/hooks/use-game-handlers";
import { TopBar } from "@/components/TopBar";
import { PrimaryTabBar, type PrimaryTab } from "@/components/game/PrimaryTabBar";
import { GameModals } from "@/components/game/GameModals";
import { PlayTab } from "@/components/game/tabs/PlayTab";
import { OpsTab } from "@/components/game/tabs/OpsTab";
import { WorldTab, type WorldSub } from "@/components/game/tabs/WorldTab";
import { EarnTab, type EarnSub } from "@/components/game/tabs/EarnTab";
import { BaseTab, type BaseSub } from "@/components/game/tabs/BaseTab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "War On Nations — Merge. Build. Conquer. Feed the Pack." },
      {
        name: "description",
        content:
          "WAR On Nations is a Telegram merge game. Fuse WARDOG and WARCAT units, earn $WARDOG & $WARCAT, and rise from Private to Warlord.",
      },
      {
        property: "og:title",
        content: "War On Nations — Merge. Build. Conquer. Feed the Pack.",
      },
      {
        property: "og:description",
        content:
          "WAR On Nations is a Telegram merge game. Fuse WARDOG and WARCAT units, earn $WARDOG & $WARCAT, and rise from Private to Warlord.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@waronnations" },
    ],
  }),
  component: WaronMergePage,
});

function WaronMergePage() {
  const game = useGame();
  const [tab, setTab] = useState<PrimaryTab>("play");
  const [worldSub, setWorldSub] = useState<WorldSub>("nations");
  const [earnSub, setEarnSub] = useState<EarnSub>("shop");
  const [baseSub, setBaseSub] = useState<BaseSub>("profile");
  const [showDaily, setShowDaily] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const [showCocoonModal, setShowCocoonModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null,
  );

  const session = useTelegramSession();
  const authenticated = session.status === "authenticated";

  const {
    forceSync,
    pullFromServer,
    lastError,
    status: syncStatus,
    serverMerge,
    serverSpawn,
    serverSwap,
    serverResolveHybrid,
    serverSacrificeBoardHybrid,
  } = useServerProgress({
    authenticated,
    localState: game.hydrated ? game.state : null,
    hydrate: game.hydrate,
    applyServerState: game.applyServerState,
    applyServerEconomy: game.applyServerEconomy,
  });

  const { entries: leaderboard, refresh: refreshLeaderboard } = useLeaderboard({
    authenticated,
    limit: 200,
  });

  useNotificationScheduler({
    authenticated,
    state: game.hydrated ? game.state : null,
  });

  const lastRateToastRef = useRef(0);

  // Rare soft rate toast only — never spam fast players
  const softRateLimitToast = useCallback(() => {
    const now = Date.now();
    if (now - lastRateToastRef.current < 4000) return;
    lastRateToastRef.current = now;
    toast.message("Slow down a bit", { duration: 1200 });
  }, []);

  useEffect(() => {
    initTelegram();
  }, []);

  useEffect(() => {
    if (!game.hydrated) return;
    if (!game.state.hasSeenTutorial) {
      setShowTutorial(true);
      return;
    }
    if (game.canClaimDaily()) {
      const t = setTimeout(() => setShowDaily(true), 400);
      return () => clearTimeout(t);
    }
  }, [game.hydrated, game.canClaimDaily, game.state.hasSeenTutorial]);

  // Resume → push local board (never pull stale board over active play)
  useEffect(() => {
    if (!authenticated) return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void forceSync();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [authenticated, forceSync]);

  const ranksSyncedRef = useRef(false);
  useEffect(() => {
    if (tab !== "base" || baseSub !== "ranks" || !authenticated) {
      ranksSyncedRef.current = false;
      return;
    }
    if (ranksSyncedRef.current) return;
    ranksSyncedRef.current = true;

    let cancelled = false;
    (async () => {
      await forceSync();
      if (!cancelled) await refreshLeaderboard();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, baseSub, authenticated]);

  // Silent on most sync noise; only rate-limit gets a soft ping
  useEffect(() => {
    if (!lastError) return;
    if (lastError === "rate_limited") softRateLimitToast();
  }, [lastError, softRateLimitToast]);

  // Energy recover: each token is checked separately (never TON)
  const canRecoverWardog =
    game.state.energy < MAX_ENERGY &&
    game.state.wardogTokens >= RECOVER_ENERGY_TOKEN_COST;
  const canRecoverWarcat =
    game.state.energy < MAX_ENERGY &&
    game.state.warcatTokens >= RECOVER_ENERGY_TOKEN_COST;

  const missionsBadge =
    game.state.dailyQuests.filter((q) => q.progress >= q.target && !q.claimed)
      .length +
    game.state.tasks.filter((t) => t.done && !t.claimed).length;

  const serverReady = authenticated && syncStatus === "ready";

  const {
    claimDaily,
    handleSpawn,
    handleRecoverEnergy,
    handleMerge,
    handleSwap,
    handleSacrificeHybrid,
    handleShopBuy,
    handleLaunchNuke,
    handleClaimTask,
    handleClaimDailyQuest,
    handleResolveHybrid,
    handleHybridWithArt,
  } = useGameHandlers({
    game,
    authenticated,
    serverReady,
    forceSync,
    pullFromServer,
    serverMerge,
    serverSpawn,
    serverSwap,
    serverResolveHybrid,
    serverSacrificeBoardHybrid,
    softRateLimitToast,
    generatedImageUrl,
    setShowDaily,
  });

  if (!game.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="app-shell mx-auto flex max-w-lg flex-col bg-zinc-950 text-white">
      <Toaster position="top-center" theme="dark" richColors />
      <TopBar state={game.state} />

      {authenticated && syncStatus !== "ready" && (
        <div className="px-3 pt-1">
          <div className="rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {syncStatus === "hydrating" && "Syncing progress…"}
            {syncStatus === "unavailable" && "Offline mode — local only"}
            {syncStatus === "error" && "Sync issue — will retry"}
            {syncStatus === "idle" && "Connecting…"}
          </div>
        </div>
      )}

      <main className="app-main flex-1 overflow-y-auto px-3 pt-2">
        <AnimatePresence mode="wait">
          {tab === "play" && (
            <motion.div
              key="play"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-2"
            >
              <PlayTab
                state={game.state}
                onMerge={handleMerge}
                onSwap={handleSwap}
                onSpawn={handleSpawn}
                onRecover={handleRecoverEnergy}
                canRecoverWardog={canRecoverWardog}
                canRecoverWarcat={canRecoverWarcat}
                onSacrificeHybrid={handleSacrificeHybrid}
              />
            </motion.div>
          )}

          {tab === "ops" && (
            <motion.div
              key="ops"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <OpsTab
                state={game.state}
                missionsBadge={missionsBadge}
                onClaimDailyQuest={handleClaimDailyQuest}
                onClaimTask={handleClaimTask}
              />
            </motion.div>
          )}

          {tab === "world" && (
            <motion.div
              key="world"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <WorldTab
                worldSub={worldSub}
                setWorldSub={setWorldSub}
                state={game.state}
                referralCode={game.state.referralCode}
                onEconomyChange={async () => {
                  await forceSync();
                  await pullFromServer();
                  await refreshLeaderboard();
                }}
                onLaunchNuke={handleLaunchNuke}
              />
            </motion.div>
          )}

          {tab === "earn" && (
            <motion.div
              key="earn"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <EarnTab
                earnSub={earnSub}
                setEarnSub={setEarnSub}
                game={game}
                authenticated={authenticated}
                forceSync={forceSync}
                onShopBuy={handleShopBuy}
              />
            </motion.div>
          )}

          {tab === "base" && (
            <motion.div
              key="base"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <BaseTab
                baseSub={baseSub}
                setBaseSub={setBaseSub}
                state={game.state}
                leaderboard={leaderboard}
                myUserId={session.user?.id ?? null}
                authenticated={authenticated}
                user={session.user}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <PrimaryTabBar tab={tab} onChange={setTab} missionsBadge={missionsBadge} />

      <GameModals
        game={game}
        showDaily={showDaily}
        setShowDaily={setShowDaily}
        claimDaily={claimDaily}
        showTutorial={showTutorial}
        setShowTutorial={setShowTutorial}
        forceSync={forceSync}
        showCocoonModal={showCocoonModal}
        setShowCocoonModal={setShowCocoonModal}
        showResultModal={showResultModal}
        setShowResultModal={setShowResultModal}
        generatedImageUrl={generatedImageUrl}
        setGeneratedImageUrl={setGeneratedImageUrl}
        handleResolveHybrid={handleResolveHybrid}
        handleHybridWithArt={handleHybridWithArt}
      />
    </div>
  );
}
