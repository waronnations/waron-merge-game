// src/lib/constants/hybrid.ts
/**
 * Hybrid clash, keep, sacrifice & NFT rewards.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

export const HYBRID_TIER = 6;

export const HYBRID_SACRIFICE_GLORY = 3200;
export const HYBRID_SACRIFICE_WARDOG = 3.5;
export const HYBRID_SACRIFICE_WARCAT = 3.5;

export const HYBRID_KEEP_GLORY = 400;

export const HYBRID_ART_BONUS_GLORY = 600;
export const HYBRID_ART_BONUS_TOKENS = 1.0;

export const HYBRID_IMAGE_PROMPT_TEMPLATE = (seed: string) =>
  `Epic cinematic hybrid warrior, fusion of fierce war dog and elegant war cat, armored, glowing dual-energy aura (orange + purple neon), dramatic battlefield lighting, highly detailed, 4k, unique seed ${seed}`;
