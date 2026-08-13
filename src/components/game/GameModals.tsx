// src/components/game/GameModals.tsx
import { TutorialModal } from "@/components/TutorialModal";
import { IdleWelcomeModal } from "@/components/IdleWelcomeModal";
import { DailyBonusModal } from "@/components/DailyBonusModal";
import { HybridModal } from "@/components/HybridModal";
import { ConquestModal } from "@/components/ConquestModal";
import { CocoonGenerateModal } from "@/components/CocoonGenerateModal";
import { HybridResultModal } from "@/components/HybridResultModal";
import { NukedLockModal } from "@/components/NukedLockModal";
import { OpsJailModal } from "@/components/OpsJailModal";
import { GlobalStrikeToast } from "@/components/GlobalStrikeToast";
import { GlobalOpsEventToast } from "@/components/GlobalOpsEventToast";
import { WarModeVictoryModal } from "@/components/war/WarModeVictoryModal";
import type { useGame } from "@/lib/game-state";
import { isCorrectSide, countHybridsOnSide } from "@/lib/game/helpers";
import { toast } from "sonner";

export function GameModals({
  game,
  showDaily,
  setShowDaily,
  claimDaily,
  showTutorial,
  setShowTutorial,
  forceSync,
  showCocoonModal,
  setShowCocoonModal,
  showResultModal,
  setShowResultModal,
  generatedImageUrl,
  setGeneratedImageUrl,
  handleResolveHybrid,
  handleHybridWithArt,
}: {
  game: ReturnType<typeof useGame>;
  showDaily: boolean;
  setShowDaily: (v: boolean) => void;
  claimDaily: () => void | Promise<void>;
  showTutorial: boolean;
  setShowTutorial: (v: boolean) => void;
  forceSync: () => Promise<unknown>;
  showCocoonModal: boolean;
  setShowCocoonModal: (v: boolean) => void;
  showResultModal: boolean;
  setShowResultModal: (v: boolean) => void;
  generatedImageUrl: string | null;
  setGeneratedImageUrl: (v: string | null) => void;
  handleResolveHybrid: (choice: "sacrifice" | "keep") => void;
  handleHybridWithArt: (choice: "keep" | "mint") => void | Promise<void>;
}) {
  const pending = game.state.pendingHybrid;

  let conquestSide: "dog" | "cat" | null = null;
  let hybridCountOnSide = 0;

  if (pending) {
    const targetSide = isCorrectSide(pending.to, "dog") ? "dog" : "cat";
    hybridCountOnSide = countHybridsOnSide(game.state.board, targetSide);
    if (hybridCountOnSide + 1 >= 14) {
      conquestSide = targetSide;
    }
  }

  if (
    !conquestSide &&
    pending &&
    (game.state.dogSideConquered || game.state.catSideConquered)
  ) {
    conquestSide = game.state.dogSideConquered ? "dog" : "cat";
    hybridCountOnSide = countHybridsOnSide(game.state.board, conquestSide);
  }

  const showConquest =
    !!pending && !!conquestSide && !showCocoonModal && !showResultModal;

  const showNormalHybrid =
    !!pending && !showConquest && !showCocoonModal && !showResultModal;

  const handleMassSacrifice = () => {
    if (!conquestSide) return;

    handleResolveHybrid("keep");

    setTimeout(() => {
      const result = game.sacrificeConqueredSide(conquestSide!);
      if (result.ok) {
        toast.success(
          `CONQUEST! +${result.glory} Glory · +${result.wardog} $WARDOG · +${result.warcat} $WARCAT`,
          { duration: 3500 },
        );
      } else {
        toast.error("Mass sacrifice failed");
      }
      void forceSync();
    }, 80);
  };

  return (
    <>
      <NukedLockModal />
      <OpsJailModal />
      <GlobalStrikeToast />
      <GlobalOpsEventToast />

      {/* War Mode Victory Modal */}
      <WarModeVictoryModal
        warMode={game.state.warMode}
        onClose={() => {
          if (typeof game.clearWarModeVictory === "function") {
            game.clearWarModeVictory();
          }
        }}
      />

      <DailyBonusModal
        open={showDaily}
        onClaim={claimDaily}
        onClose={() => setShowDaily(false)}
        streak={game.state.dailyStreak}
      />

      <TutorialModal
        open={showTutorial}
        onComplete={() => {
          if (typeof game.grantStarterPack === "function") {
            game.grantStarterPack();
          } else if (typeof game.dismissTutorial === "function") {
            game.dismissTutorial();
          }
          setShowTutorial(false);
          void forceSync();
        }}
        onSkip={() => {
          if (typeof game.dismissTutorial === "function") {
            game.dismissTutorial();
          }
          setShowTutorial(false);
          void forceSync();
        }}
      />

      <IdleWelcomeModal
        reward={game.state.pendingIdleReward}
        onClose={() => {
          game.claimIdleReward();
          void forceSync();
        }}
      />

      <ConquestModal
        open={showConquest}
        side={conquestSide || "cat"}
        hybridCount={hybridCountOnSide + (pending ? 1 : 0)}
        onMassSacrifice={handleMassSacrifice}
      />

      <HybridModal
        open={showNormalHybrid}
        onResolve={(choice) => {
          if (choice === "generate") {
            setShowCocoonModal(true);
            return;
          }
          handleResolveHybrid(choice);
        }}
      />

      <CocoonGenerateModal
        open={showCocoonModal}
        seed={
          game.state.pendingHybrid
            ? `HYB-${game.state.pendingHybrid.id}`
            : undefined
        }
        imagePrompt={
          game.state.pendingHybrid
            ? `Epic cinematic hybrid warrior, fusion of fierce war dog and elegant war cat, armored, glowing energy aura, red and purple neon lights, dramatic battlefield lighting, highly detailed, 4k`
            : undefined
        }
        onBack={() => {
          setShowCocoonModal(false);
        }}
        onSuccess={(imageUrl) => {
          setGeneratedImageUrl(imageUrl);
          setShowCocoonModal(false);
          setShowResultModal(true);
        }}
      />

      <HybridResultModal
        open={showResultModal}
        imageUrl={generatedImageUrl}
        onBack={() => {
          setShowResultModal(false);
          setShowCocoonModal(true);
        }}
        onResolve={(choice) => {
          if (choice === "sacrifice") {
            handleResolveHybrid("sacrifice");
          } else if (choice === "keep" || choice === "mint") {
            void handleHybridWithArt(choice);
          }

          setShowResultModal(false);
          setGeneratedImageUrl(null);
        }}
      />
    </>
  );
}
