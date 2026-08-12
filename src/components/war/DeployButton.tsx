// src/components/war/DeployButton.tsx
import type { Cell } from "@/lib/game/types";

interface Props {
  cell: Cell | null;
  index: number;
  warModeActive: boolean;
  energy: number;
  onDeploy: (index: number) => void;
}

export function DeployButton({
  cell,
  index,
  warModeActive,
  energy,
  onDeploy,
}: Props) {
  if (!warModeActive || !cell) return null;

  const canDeploy =
    (cell.tier >= 4 || cell.faction === "hybrid") &&
    (!cell.deployedUntil || cell.deployedUntil < Date.now()) &&
    energy >= 8;

  if (!canDeploy) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDeploy(index);
      }}
      className="absolute -top-1 -right-1 z-20 h-5 w-5 rounded-full bg-red-600 text-[9px] font-black text-white shadow-lg shadow-red-900/60 active:scale-90 flex items-center justify-center"
      title="Deploy to Front"
    >
      ⚔
    </button>
  );
}
