// src/components/nations/detail/HistoryList.tsx
import { ScrollText } from "lucide-react";
import { formatEvent, formatTime } from "./history-events";
import type { NationHistoryRow } from "../use-nations-panel";

export function HistoryList({
  history = [],
  historyLoading = false,
}: {
  history?: NationHistoryRow[];
  historyLoading?: boolean;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-zinc-500">
        <ScrollText className="h-3.5 w-3.5" />
        History
      </div>
      {historyLoading ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-4 text-center text-xs text-zinc-500">
          Loading history...
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-4 text-center text-xs text-zinc-500">
          No events yet
        </div>
      ) : (
        <div className="max-h-40 space-y-1.5 overflow-y-auto">
          {history.map((h) => (
            <div
              key={h.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-200">
                  {formatEvent(h.event)}
                </span>
                <span className="shrink-0 text-[0.6rem] text-zinc-500">
                  {formatTime(h.createdAt)}
                </span>
              </div>
              {h.userName && (
                <div className="mt-0.5 text-[0.65rem] text-zinc-400">
                  {h.userName}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
