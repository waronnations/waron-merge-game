// src/components/game/tabs/OpsTab.tsx
import { TabHero } from "@/components/game/TabHero";
import { TasksPanel, DailyQuestsPanel } from "@/components/Panels";
import type { GameState } from "@/lib/game-state";

export function OpsTab({
  state,
  missionsBadge,
  onClaimDailyQuest,
  onClaimTask,
}: {
  state: GameState;
  missionsBadge: number;
  onClaimDailyQuest: (id: string) => void;
  onClaimTask: (id: string) => void;
}) {
  return (
    <>
      <TabHero tab="ops" />
      {missionsBadge > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-[0.7rem] font-black uppercase tracking-wider text-amber-300">
          {missionsBadge} reward{missionsBadge === 1 ? "" : "s"} ready — scroll
          & tap Claim
        </div>
      )}
      <DailyQuestsPanel state={state} onClaim={onClaimDailyQuest} />
      <TasksPanel state={state} onClaim={onClaimTask} />
    </>
  );
}
