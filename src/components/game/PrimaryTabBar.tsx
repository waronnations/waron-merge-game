// src/components/game/PrimaryTabBar.tsx
import { Swords, ListChecks, Shield, Globe2, Coins, Crosshair } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

export type PrimaryTab = "play" | "ops" | "world" | "earn" | "base" | "battlefield";

export const PRIMARY_TABS: {
  id: PrimaryTab;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}[] = [
  { id: "play", label: "Play", icon: Swords },
  { id: "ops", label: "Ops", icon: ListChecks },
  { id: "battlefield", label: "Battle", icon: Crosshair },
  { id: "world", label: "World", icon: Globe2 },
  { id: "earn", label: "Earn", icon: Coins },
  { id: "base", label: "Base", icon: Shield },
];

export function PrimaryTabBar({
  tab,
  onChange,
  missionsBadge,
}: {
  tab: PrimaryTab;
  onChange: (id: PrimaryTab) => void;
  missionsBadge: number;
}) {
  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/80 bg-black/98 shadow-[0_-8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-1 py-1.5">
        {PRIMARY_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          const badge = t.id === "ops" ? missionsBadge : 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onChange(t.id);
                haptic("light");
              }}
              className={cn(
                "nav-item relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-black uppercase tracking-wider",
                active ? "nav-item-active" : "text-zinc-500",
              )}
            >
              <span className="nav-icon-wrap">
                <Icon className="h-5 w-5 shrink-0" />
              </span>
              <span className="truncate">{t.label}</span>
              {badge > 0 && (
                <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-black text-black shadow">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
