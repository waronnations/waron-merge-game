// src/components/NukePanel.tsx
import type { GameState } from "@/lib/game-state";
import { NukeHeader } from "@/components/nuke/NukeHeader";
import { NationTargetGrid } from "@/components/nuke/NationTargetGrid";
import { TargetStage } from "@/components/nuke/TargetStage";
import { StrikeResultCard, type NukeResult } from "@/components/nuke/StrikeResultCard";
import { StrikeCinematic } from "@/components/nuke/StrikeCinematic";
import { useNukeStrike } from "@/components/nuke/use-nuke-strike";

interface Props {
  state: GameState;
  onLaunch: (targetNationId: number) => Promise<NukeResult>;
}

export function NukePanel({ state, onLaunch }: Props) {
  const {
    loadingNations,
    selectedId,
    setSelectedId,
    busy,
    phase,
    lastResult,
    setLastResult,
    search,
    setSearch,
    owned,
    isTerrorist,
    totalLaunched,
    selected,
    filtered,
    selectedIsProtected,
    canLaunch,
    handleLaunch,
    shareStrikeTelegram,
    shareStrikeX,
  } = useNukeStrike({ state, onLaunch });

  return (
    <div className="relative flex flex-col gap-4 pb-8">
      <NukeHeader
        owned={owned}
        isTerrorist={isTerrorist}
        totalLaunched={totalLaunched}
      />

      <NationTargetGrid
        filtered={filtered}
        loadingNations={loadingNations}
        search={search}
        setSearch={setSearch}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        setLastResult={setLastResult}
      />

      <TargetStage
        selected={selected}
        canLaunch={canLaunch}
        busy={busy}
        phase={phase}
        handleLaunch={handleLaunch}
        owned={owned}
        selectedIsProtected={selectedIsProtected}
      />

      <StrikeResultCard
        lastResult={lastResult}
        phase={phase}
        setLastResult={setLastResult}
        shareStrikeTelegram={shareStrikeTelegram}
        shareStrikeX={shareStrikeX}
      />

      <StrikeCinematic phase={phase} selected={selected} />
    </div>
  );
}
