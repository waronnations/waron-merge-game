// src/components/game/ClaimBurst.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GiftBoxId } from "@/lib/constants/gifts";
import { GIFT_BOXES, GIFT_BURST_IMAGES } from "@/lib/constants/gifts";

interface ClaimBurstProps {
  giftId: GiftBoxId;
  onComplete?: () => void;
  /** Optional override image */
  burstSrc?: string;
}

export function ClaimBurst({ giftId, onComplete, burstSrc }: ClaimBurstProps) {
  const [visible, setVisible] = useState(true);
  const def = GIFT_BOXES[giftId];

  // Pick a random burst image for variety
  const src =
    burstSrc ||
    GIFT_BURST_IMAGES[Math.floor(Math.random() * GIFT_BURST_IMAGES.length)] ||
    def.openImg;

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 1400);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Dark overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Burst image */}
          <motion.img
            src={src}
            alt="Supply drop"
            className="relative z-10 h-48 w-48 object-contain drop-shadow-[0_0_30px_rgba(255,180,0,0.6)] sm:h-56 sm:w-56"
            initial={{ scale: 0.3, rotate: -12, opacity: 0 }}
            animate={{
              scale: [0.3, 1.15, 1],
              rotate: [-12, 6, 0],
              opacity: 1,
            }}
            exit={{ scale: 1.4, opacity: 0 }}
            transition={{
              duration: 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
          />

          {/* Extra glow ring */}
          <motion.div
            className="absolute h-64 w-64 rounded-full bg-amber-500/20 blur-3xl"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1.6, opacity: [0, 0.7, 0] }}
            transition={{ duration: 1.1 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
