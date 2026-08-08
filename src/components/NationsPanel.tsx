// src/components/NationsPanel.tsx
import { useNationsPanel } from "./nations/use-nations-panel";
import { NationsList } from "./nations/NationsList";
import { NationDetail } from "./nations/NationDetail";
import { NationActions } from "./nations/NationActions";

export function NationsPanel({
  referralCode,
  onEconomyChange,
}: {
  referralCode?: string | null;
  onEconomyChange?: () => void | Promise<void>;
} = {}) {
  const p = useNationsPanel({ referralCode, onEconomyChange });

  return (
    <div className="space-y-4 pb-8">
      <NationsList {...p} />
      <NationDetail {...p} />
      <NationActions {...p} />
    </div>
  );
}
