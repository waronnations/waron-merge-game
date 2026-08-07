// src/components/game/SubTabBar.tsx
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

export function SubTabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: {
    id: T;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="subtab-rail mb-3">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onChange(t.id);
              haptic("light");
            }}
            className={cn("subtab-btn", active && "subtab-btn-active")}
          >
            <Icon className="h-4 w-4" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
