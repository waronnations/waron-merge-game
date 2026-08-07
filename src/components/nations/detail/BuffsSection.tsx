// src/components/nations/detail/BuffsSection.tsx
import { RefreshCw, Zap, Shield, Swords } from "lucide-react";
import { NATION_BUFFS, type NationBuffId } from "@/lib/constants";

export function BuffsSection({
  canManageBuffs,
  activatingBuff,
  activateBuff,
}: {
  canManageBuffs: boolean;
  activatingBuff: string | null;
  activateBuff: (buffId: NationBuffId) => Promise<void>;
}) {
  if (!canManageBuffs) return null;

  const buffs: {
    id: NationBuffId;
    icon: React.ReactNode;
    border: string;
    bg: string;
    titleColor: string;
  }[] = [
    {
      id: "gloryBoost",
      icon: <Zap className="h-4 w-4 text-amber-400" />,
      border: "border-amber-500/30",
      bg: "bg-amber-950/20",
      titleColor: "text-amber-300",
    },
    {
      id: "energySurge",
      icon: <Zap className="h-4 w-4 text-blue-400" />,
      border: "border-blue-500/30",
      bg: "bg-blue-950/20",
      titleColor: "text-blue-300",
    },
    {
      id: "mergeFrenzy",
      icon: <Swords className="h-4 w-4 text-orange-400" />,
      border: "border-orange-500/30",
      bg: "bg-orange-950/20",
      titleColor: "text-orange-300",
    },
    {
      id: "shieldWall",
      icon: <Shield className="h-4 w-4 text-emerald-400" />,
      border: "border-emerald-500/30",
      bg: "bg-emerald-950/20",
      titleColor: "text-emerald-300",
    },
  ];

  return (
    <div className="mt-3 space-y-2">
      <div className="text-[0.65rem] uppercase tracking-wider text-zinc-500">
        Activate Buff (from Vault)
      </div>

      {buffs.map((b) => {
        const def = NATION_BUFFS[b.id];
        const isActive = activatingBuff === b.id;
        return (
          <button
            key={b.id}
            onClick={() => activateBuff(b.id)}
            disabled={!!activatingBuff}
            className={`flex w-full items-center justify-between rounded-xl border ${b.border} ${b.bg} px-3 py-2.5 text-left text-sm disabled:opacity-50`}
          >
            <div>
              <div className={`font-bold ${b.titleColor}`}>{def.name}</div>
              <div className="text-xs text-zinc-400">
                {def.desc} · {def.costWardog} + {def.costWarcat} from vault
              </div>
            </div>
            {isActive ? (
              <RefreshCw className="h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              b.icon
            )}
          </button>
        );
      })}
    </div>
  );
}
