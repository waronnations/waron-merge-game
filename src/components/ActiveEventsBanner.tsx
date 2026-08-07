// src/components/ActiveEventsBanner.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getActiveEvents, type ActiveEvent } from "@/lib/events";
import { Zap, Star, Flame, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "ending…";
  const totalMins = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function EventIcon({ id, color }: { id: string; color: string }) {
  if (id === "double_glory")
    return <Star className="h-3.5 w-3.5" style={{ color }} />;
  if (id === "energy_frenzy")
    return <Zap className="h-3.5 w-3.5" style={{ color }} />;
  if (id === "legendary_surge")
    return <Flame className="h-3.5 w-3.5" style={{ color }} />;
  return <Star className="h-3.5 w-3.5" style={{ color }} />;
}

export function ActiveEventsBanner() {
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const refresh = () => {
      setNow(Date.now());
      setEvents(getActiveEvents());
    };
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="px-3 pt-1.5">
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="space-y-1.5 overflow-hidden"
          >
            {events.map((e) => {
              const remaining = Math.max(0, e.endsAt - now);
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                  style={{
                    borderColor: e.color + "44",
                    background: `linear-gradient(90deg, ${e.color}14, transparent)`,
                  }}
                >
                  <div className="shrink-0">
                    <EventIcon id={e.id} color={e.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[0.6rem] font-black uppercase tracking-wider"
                      style={{ color: e.color }}
                    >
                      {e.name}
                    </div>
                    <div className="truncate text-[0.6rem] leading-tight text-zinc-500">
                      {e.desc}
                    </div>
                  </div>
                  <div className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[0.6rem] text-zinc-400">
                    {formatRemaining(remaining)}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex w-full items-center justify-center gap-1 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-zinc-500 active:text-zinc-300"
            >
              <ChevronUp className="h-3 w-3" />
              Hide
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setExpanded(true)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/70 px-2.5 py-1.5",
              "active:bg-zinc-800/80",
            )}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              {events.slice(0, 3).map((e) => (
                <EventIcon key={e.id} id={e.id} color={e.color} />
              ))}
              <span className="truncate text-[0.65rem] font-bold text-zinc-300">
                {events.length} active event{events.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-zinc-500">
              <span className="font-mono text-[0.6rem]">
                {formatRemaining(Math.max(0, events[0].endsAt - now))}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
