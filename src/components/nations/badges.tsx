// src/components/nations/badges.tsx
import { Skull, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function TraitorBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-red-950/80 border border-red-500/50 px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-red-400",
        className,
      )}
    >
      <Skull className="h-2.5 w-2.5" />
      Traitor
    </span>
  );
}

export function OfficerBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-950/80 border border-blue-500/50 px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-blue-400">
      <Star className="h-2.5 w-2.5" />
      Officer
    </span>
  );
}
