// src/components/game/ClaimBurst.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GiftBoxId } from "@/lib/constants/gifts";
import { GIFT_BOXES, GIFT_BURST_IMAGES } from "@/lib/constants/gifts";

const SHOW_MS = 650; // was 1400 — felt stuck
const EXIT_MS = 180;

interface ClaimBurstProps {
  giftId: GiftBoxId;
  onComplete?: () => void;
  /** Optional override image */
  burstSrc?: string;
}

export function ClaimBurst({ giftId, onComplete, burstSrc }: ClaimBurstProps) {
  const [visible, setVisible] = useState(true);
  const def = GIFT_BOXES[giftId];

  const src =
    burstSrc ||
    GIFT_BURST_IMAGES[Math.floor(Math.random() * GIFT_BURST_IMAGES.length)] ||
    def.openImg;

  useEffect(() => {
    // Hide first so exit anim can run; only then notify parent to unmount
    const hide = setTimeout(() => setVisible(false), SHOW_MS);
    const done = setTimeout(() => onComplete?.(), SHOW_MS + EXIT_MS);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [onComplete]);

  const dismiss = () => {
    setVisible(false);
    // parent cleanup slightly after exit
    setTimeout(() => onComplete?.(), EXIT_MS);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: EXIT_MS / 1000 }}
        >
          {/* Soft overlay — never captures taps */}
          <motion.div
            className="pointer-events-none absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Burst image — brief pop, then out */}
          <motion.img
            src={src}
            alt="Supply drop"
            className="pointer-events-none relative z-10 h-36 w-36 object-contain drop-shadow-[0_0_24px_rgba(255,180,0,0.45)] sm:h-40 sm:w-40"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.08, 1], opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.div
            className="pointer-events-none absolute h-48 w-48 rounded-full bg-amber-500/15 blur-3xl"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.3, opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.6 }}
          />

          {/* Invisible full-screen dismiss hit target (optional early skip) */}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="pointer-events-auto absolute inset-0 z-20 cursor-default bg-transparent"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
