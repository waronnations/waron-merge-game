// src/hooks/game-handlers/use-nuke-handlers.ts
import { toast } from "sonner";
import { launchNuke } from "@/lib/game.functions";
import { track } from "@/lib/analytics";
import { type GameState, type useGame } from "@/lib/game-state";

export function useNukeHandlers({
  game,
  authenticated,
  forceSync,
}: {
  game: ReturnType<typeof useGame>;
  authenticated: boolean;
  forceSync: () => Promise<unknown>;
}) {
  const handleLaunchNuke = async (targetNationId: number) => {
    if (!authenticated) {
      toast.error("Open in Telegram to launch a strike");
      return { ok: false as const, reason: "not_authenticated" };
    }

    try {
      const res = await launchNuke({ data: { targetNationId } });

      if (!res.ok) {
        return {
          ok: false as const,
          reason: res.reason ?? "failed",
        };
      }

      if (res.state) {
        game.applyServerState(res.state as GameState);
      }

      track("nuke_launch", { targetNationId, wasPeaceful: res.wasPeaceful });
      void forceSync();

      return {
        ok: true as const,
        glory: res.glory,
        energy: res.energy,
        tokens: res.tokens,
        transferred: res.transferred,
        wasPeaceful: res.wasPeaceful,
        becameTerrorist: res.becameTerrorist,
        targetName: res.targetName,
      };
    } catch {
      toast.error("Strike failed");
      return { ok: false as const, reason: "request_failed" };
    }
  };

  return { handleLaunchNuke };
}
