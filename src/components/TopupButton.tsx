// src/components/TopupButton.tsx
import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { TopupModal } from "@/components/TopupModal";

export function TopupButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          haptic("light");
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-wider text-white transition hover:border-white/40 hover:bg-zinc-900",
          className,
        )}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        Top up
      </button>
      <TopupModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
