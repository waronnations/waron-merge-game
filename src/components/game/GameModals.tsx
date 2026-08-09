// src/components/game/GameModals.tsx
import { TutorialModal } from "@/components/TutorialModal";
import { IdleWelcomeModal } from "@/components/IdleWelcomeModal";
import { DailyBonusModal } from "@/components/DailyBonusModal";
import { HybridModal } from "@/components/HybridModal";
import { CocoonGenerateModal } from "@/components/CocoonGenerateModal";
import { HybridResultModal } from "@/components/HybridResultModal";
import { NukedLockModal } from "@/components/NukedLockModal";
import { OpsJailModal } from "@/components/OpsJailModal";
import { GlobalStrikeToast } from "@/components/GlobalStrikeToast";
import { GlobalOpsEventToast } from "@/components/GlobalOpsEventToast";
import type { useGame } from "@/lib/game-state";

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
  return (
    <>
      <NukedLockModal />
      <OpsJailModal />
      <GlobalStrikeToast />
      <GlobalOpsEventToast />

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

      <HybridModal
        open={
          !!game.state.pendingHybrid && !showCocoonModal && !showResultModal
        }
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
