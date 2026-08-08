// src/components/game/tabs/BaseTab.tsx
import { User, Trophy } from "lucide-react";
import { TabHero } from "@/components/game/TabHero";
import { SubTabBar } from "@/components/game/SubTabBar";
import { ProfilePanel, LeaderboardPanel } from "@/components/Panels";
import type { GameState } from "@/lib/game-state";
import type { useLeaderboard } from "@/hooks/use-server-progress";

export type BaseSub = "profile" | "ranks";

export function BaseTab({
  baseSub,
  setBaseSub,
  state,
  leaderboard,
  myUserId,
  authenticated,
}: {
  baseSub: BaseSub;
  setBaseSub: (v: BaseSub) => void;
  state: GameState;
  leaderboard: ReturnType<typeof useLeaderboard>["entries"];
  myUserId: number | null;
  authenticated: boolean;
}) {
  return (
    <>
      <TabHero tab="base" />
      <SubTabBar
        tabs={[
          { id: "profile" as const, label: "Profile", icon: User },
          { id: "ranks" as const, label: "Ranks", icon: Trophy },
        ]}
        value={baseSub}
        onChange={setBaseSub}
      />
      {baseSub === "profile" ? (
        <ProfilePanel state={state} />
      ) : (
        <LeaderboardPanel
          state={state}
          serverEntries={leaderboard}
          myUserId={myUserId}
          authenticated={authenticated}
        />
      )}
    </>
  );
}
