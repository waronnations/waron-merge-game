// src/hooks/game-handlers/use-daily-quests-handlers.ts
import { toast } from "sonner";
import {
  claimDaily as claimDailyServer,
  claimTask as claimTaskServer,
  claimDailyQuest as claimDailyQuestServer,
} from "@/lib/game.functions";
import { track } from "@/lib/analytics";
import { type GameState, type useGame } from "@/lib/game-state";
import { formatReason } from "@/hooks/game-handlers/helpers";

export function useDailyQuestsHandlers({
  game,
  authenticated,
  forceSync,
  softRateLimitToast,
  setShowDaily,
}: {
  game: ReturnType<typeof useGame>;
  authenticated: boolean;
  forceSync: () => Promise<unknown>;
  softRateLimitToast: () => void;
  setShowDaily: (v: boolean) => void;
}) {
  const claimDaily = async () => {
    if (authenticated) {
      try {
        const res = await claimDailyServer();
        if (!res.ok) {
          if (res.reason === "rate_limited") softRateLimitToast();
          else
            toast.error(
              res.reason === "already_claimed_today"
                ? "Already claimed today"
                : formatReason(res.reason) || "Claim failed",
            );
          return;
        }
        if (res.state) game.applyServerState(res.state as GameState);
        track("daily_claim", { streak: res.streak });
        toast.success(
          `+${res.glory} Glory · +${res.energy} Energy · Streak ${res.streak}`,
        );
        void forceSync();
      } catch {
        toast.error("Claim failed");
      }
    } else {
      const r = game.claimDaily();
      if (r) {
        track("daily_claim", { streak: r.streak });
        toast.success(
          `+${r.glory} Glory · +${r.energy} Energy · Streak ${r.streak}`,
        );
        void forceSync();
      }
    }
    setShowDaily(false);
  };

  const handleClaimTask = async (id: string) => {
    if (authenticated) {
      try {
        const res = await claimTaskServer({ data: { taskId: id } });
        if (!res.ok) {
          if (res.reason === "already_claimed") return;
          if (res.reason === "rate_limited") {
            softRateLimitToast();
            return;
          }
          toast.error(formatReason(res.reason) || "Cannot claim");
          return;
        }
        if (res.state) game.applyServerState(res.state as GameState);
        void forceSync();
      } catch {
        toast.error("Claim failed");
      }
      return;
    }
    const r = game.claimTask(id);
    if (r && (r as { ok?: boolean }).ok === false) {
      if ((r as { reason?: string }).reason === "already_claimed") return;
      toast.error(
        formatReason((r as { reason?: string }).reason) || "Cannot claim",
      );
      return;
    }
    void forceSync();
  };

  const handleClaimDailyQuest = async (id: string) => {
    if (authenticated) {
      try {
        const res = await claimDailyQuestServer({ data: { questId: id } });
        if (!res.ok) {
          if (res.reason === "already_claimed") return;
          if (res.reason === "rate_limited") {
            softRateLimitToast();
            return;
          }
          toast.error(formatReason(res.reason) || "Cannot claim");
          return;
        }
        if (res.state) game.applyServerState(res.state as GameState);
        void forceSync();
      } catch {
        toast.error("Claim failed");
      }
      return;
    }
    const r = game.claimDailyQuest(id);
    if (r && (r as { ok?: boolean }).ok === false) {
      if ((r as { reason?: string }).reason === "already_claimed") return;
      toast.error(
        formatReason((r as { reason?: string }).reason) || "Cannot claim",
      );
      return;
    }
    void forceSync();
  };

  return { claimDaily, handleClaimTask, handleClaimDailyQuest };
}
