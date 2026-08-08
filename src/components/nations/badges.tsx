// src/components/nations/badges.tsx
import { Skull, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function TraitorBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-zinc-600 bg-zinc-950 px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-red-300",
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
    <span className="inline-flex items-center gap-0.5 rounded-full border border-zinc-600 bg-zinc-950 px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-white">
      <Star className="h-2.5 w-2.5" />
      Officer
    </span>
  );
}
