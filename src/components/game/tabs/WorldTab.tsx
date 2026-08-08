// src/components/game/tabs/WorldTab.tsx
import { Flag, Crosshair } from "lucide-react";
import { TabHero } from "@/components/game/TabHero";
import { SubTabBar } from "@/components/game/SubTabBar";
import { NationsPanel } from "@/components/NationsPanel";
import { NukePanel } from "@/components/NukePanel";
import type { GameState } from "@/lib/game-state";

export type WorldSub = "nations" | "strike";

export function WorldTab({
  worldSub,
  setWorldSub,
  state,
  referralCode,
  onEconomyChange,
  onLaunchNuke,
}: {
  worldSub: WorldSub;
  setWorldSub: (v: WorldSub) => void;
  state: GameState;
  referralCode: string;
  onEconomyChange: () => Promise<void>;
  onLaunchNuke: (targetNationId: number) => Promise<any>;
}) {
  return (
    <>
      <TabHero tab="world" />
      <SubTabBar
        tabs={[
          { id: "nations" as const, label: "Nations", icon: Flag },
          { id: "strike" as const, label: "Strike", icon: Crosshair },
        ]}
        value={worldSub}
        onChange={setWorldSub}
      />
      {worldSub === "nations" ? (
        <NationsPanel
          referralCode={referralCode}
          onEconomyChange={onEconomyChange}
        />
      ) : (
        <NukePanel state={state} onLaunch={onLaunchNuke} />
      )}
    </>
  );
}
