// src/components/game/PrimaryTabBar.tsx
import { Swords, Trophy, User, Globe2, Coins } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/ActionButton";

export type PrimaryTab = "play" | "season" | "world" | "earn" | "base";

export const PRIMARY_TABS: {
  id: PrimaryTab;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}[] = [
  { id: "play", label: "War", icon: Swords },
  { id: "season", label: "Season", icon: Trophy },
  { id: "world", label: "Nations", icon: Globe2 },
  { id: "earn", label: "Rewards", icon: Coins },
  { id: "base", label: "Profile", icon: User },
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
    <nav aria-label="Main navigation" className="bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-1 py-1.5">
        {PRIMARY_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          const badge = t.id === "earn" ? missionsBadge : 0;
          return (
            <ActionButton
              key={t.id}
              type="button"
              onClick={() => {
                onChange(t.id);
                haptic("light");
              }}
              className={cn(
                "nav-item relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-black uppercase tracking-wider",
                "border-0", active ? "nav-item-active" : "text-muted-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="nav-icon-wrap">
                <Icon className="h-5 w-5 shrink-0" />
              </span>
              <span className="truncate">{t.label}</span>
              {badge > 0 && (
                <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-black text-destructive-foreground">
                  {badge}
                </span>
              )}
            </ActionButton>
          );
        })}
      </div>
    </nav>
  );
}
