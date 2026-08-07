// src/hooks/game-handlers/use-hybrid-handlers.ts
import { useCallback } from "react";
import { toast } from "sonner";
import { completeHybridWithArt } from "@/lib/game.functions";
import { type GameState, type useGame } from "@/lib/game-state";
import { formatReason } from "@/hooks/game-handlers/helpers";

export function useHybridHandlers({
  game,
  authenticated,
  pullFromServer,
  forceSync,
  generatedImageUrl,
}: {
  game: ReturnType<typeof useGame>;
  authenticated: boolean;
  pullFromServer: () => Promise<unknown>;
  forceSync: () => Promise<unknown>;
  generatedImageUrl: string | null;
}) {
  const handleHybridWithArt = useCallback(
    async (choice: "keep" | "mint") => {
      const url = generatedImageUrl || "";
      if (!url) {
        toast.error("No image generated");
        return;
      }

      if (authenticated) {
        try {
          const res = await completeHybridWithArt({ data: { imageUrl: url } });
          if (!res.ok) {
            toast.error(
              formatReason((res as { reason?: string }).reason) ||
                "Hybrid save failed",
            );
            await pullFromServer();
            return;
          }
          if (res.state) game.applyServerState(res.state as GameState);
          toast.success(
            choice === "mint"
              ? "Hybrid trophy saved"
              : "Hybrid placed on board",
            { duration: 1600 },
          );
          void forceSync();
        } catch {
          toast.error("Hybrid save failed");
        }
      } else {
        game.completeHybridWithArt(url);
        toast.success(
          choice === "mint" ? "Hybrid trophy saved" : "Hybrid placed on board",
          { duration: 1600 },
        );
        void forceSync();
      }
    },
    [generatedImageUrl, authenticated, game, pullFromServer, forceSync],
  );

  return { handleHybridWithArt };
}
