// src/components/WarDispatch.tsx
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { getRank } from "@/lib/ranks";
import { shareUrl, haptic, tgUser } from "@/lib/telegram";
import { playRankUp, playHeavyImpact } from "@/lib/sounds";

interface Props {
  open: boolean;
  glory: number;
  highestTier: number;
  onClose: () => void;
  globalRank?: number | null;
}

export function WarDispatch({
  open,
  glory,
  highestTier,
  onClose,
  globalRank,
}: Props) {
  const { rank } = getRank(glory);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"cinematic" | "card">("cinematic");

  useEffect(() => {
    if (!open) return;

    setPhase("cinematic");
    setCardUrl(null);

    try {
      playRankUp();
      playHeavyImpact();
    } catch {
      /* sounds optional */
    }
    haptic("heavy");

    const t = setTimeout(() => {
      setPhase("card");
      generateCard();
    }, 2600);

    return () => clearTimeout(t);
  }, [open, glory, highestTier, globalRank]);

  const generateCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a0f");
    grad.addColorStop(0.5, "#111118");
    grad.addColorStop(1, "#1a0505");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Top / bottom bars
    ctx.fillStyle = "#c8102e";
    ctx.fillRect(0, 0, W, 14);
    ctx.fillRect(0, H - 14, W, 14);

    // Header
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚔  CLASSIFIED WAR DISPATCH  ⚔", W / 2, 130);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText("WAR ON NATIONS", W / 2, 190);

    // Rank insignia
    ctx.fillStyle = "#c8102e";
    ctx.font = "bold 140px system-ui, sans-serif";
    ctx.fillText(rank.insignia, W / 2, 430);

    // Rank name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 68px system-ui, sans-serif";
    ctx.fillText(rank.name.toUpperCase(), W / 2, 540);

    // Player name
    const name = tgUser()?.first_name || "Commander";
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillText(name, W / 2, 620);

    // Stats box
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(80, 700, W - 160, 340);

    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("GLORY", 130, 790);
    ctx.fillText("HIGHEST TIER", 130, 900);
    ctx.fillText("GLOBAL RANK", 130, 1010);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(glory.toLocaleString(), W - 130, 790);
    ctx.fillText(`T${highestTier}`, W - 130, 900);
    ctx.fillText(globalRank ? `#${globalRank}` : "—", W - 130, 1010);

    // Footer
    ctx.fillStyle = "#c8102e";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FEED THE PACK  •  EARN $WARDOG & $WARCAT", W / 2, 1220);

    ctx.fillStyle = "#71717a";
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("t.me/waronnationsgamebot", W / 2, 1320);

    // Official seal
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(W / 2, 1550, 95, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillText("OFFICIAL", W / 2, 1560);

    setCardUrl(canvas.toDataURL("image/png"));
  };

  const handleShare = () => {
    const text = `⚔ I just hit ${rank.name} in War On Nations!\n\nGlory: ${glory.toLocaleString()}\nHighest Tier: T${highestTier}${
      globalRank ? `\nGlobal Rank: #${globalRank}` : ""
    }\n\nJoin the fight and feed the pack 🔥`;
    shareUrl("https://t.me/waronnationsgamebot", text);
    haptic("medium");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
        >
          <canvas ref={canvasRef} className="hidden" />

          {/* Cinematic phase */}
          {phase === "cinematic" && (
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-8 text-center"
            >
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="mb-5 text-sm font-black tracking-[0.35em] text-amber-500"
              >
                CLASSIFIED
              </motion.div>

              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", delay: 0.35, stiffness: 200 }}
                className="mb-6 text-7xl"
              >
                {rank.insignia}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="text-4xl font-black tracking-widest text-white"
              >
                {rank.name.toUpperCase()}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.05 }}
                className="mt-4 text-sm tracking-widest text-zinc-400"
              >
                WAR DISPATCH INCOMING…
              </motion.p>
            </motion.div>
          )}

          {/* Card phase */}
          {phase === "card" && cardUrl && (
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex w-full max-w-md flex-col items-center gap-5 px-4"
            >
              <img
                src={cardUrl}
                alt="War Dispatch"
                className="w-full rounded-2xl border border-zinc-700 shadow-2xl"
              />

              <div className="flex w-full gap-3">
                <button
                  onClick={handleShare}
                  className="flex-1 rounded-xl bg-[#c8102e] py-4 text-sm font-black uppercase tracking-widest text-white active:scale-[0.98]"
                >
                  Share Dispatch
                </button>
                <button
                  onClick={() => {
                    haptic("light");
                    onClose();
                  }}
                  className="rounded-xl bg-zinc-800 px-6 py-4 text-sm font-bold uppercase tracking-wider text-zinc-300"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
