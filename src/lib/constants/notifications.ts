// src/lib/constants/notifications.ts
/**
 * Telegram notification cooldowns and templates.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

export const NOTIFY_COOLDOWN_MS = {
  energyFull: 4 * 60 * 60 * 1000,
  nationBuff: 30 * 60 * 1000,
  nationUnderAttack: 15 * 60 * 1000,
  hybridReady: 60 * 60 * 1000,
  inviteAccepted: 10 * 60 * 1000,
} as const;

export const NOTIFY_TEMPLATES = {
  energyFull: "⚡ Your energy is full, Commander. Time to merge!",
  nationBuff: (buffName: string) =>
    `🛡️ Nation buff active: ${buffName}. Fight harder!`,
  nationUnderAttack: (nationName: string) =>
    `☢️ ${nationName} is under nuclear attack! Rally your forces.`,
  hybridReady: "🧬 A Hybrid Clash is ready — claim your reward!",
  inviteAccepted: (name: string) =>
    `🎖️ ${name} joined via your invite. Glory awaits!`,
} as const;
