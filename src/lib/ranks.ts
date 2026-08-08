// src/lib/ranks.ts

export interface Rank {
  name: string;
  minGlory: number;
  insignia: string;
  color: string; // tailwind-ish accent – now pure monochrome
}

export const RANKS: Rank[] = [
  { name: "Recruit",      minGlory: 0,         insignia: "◇",   color: "text-zinc-500" },
  { name: "Private",      minGlory: 250,       insignia: "▪",   color: "text-zinc-400" },
  { name: "Corporal",     minGlory: 900,       insignia: "▪▪",  color: "text-zinc-300" },
  { name: "Sergeant",     minGlory: 2_800,     insignia: "▲",   color: "text-zinc-200" },
  { name: "Lieutenant",   minGlory: 6_500,     insignia: "▲▲",  color: "text-zinc-100" },
  { name: "Captain",      minGlory: 14_000,    insignia: "★",   color: "text-white" },
  { name: "Major",        minGlory: 32_000,    insignia: "★★",  color: "text-white" },
  { name: "Colonel",      minGlory: 75_000,    insignia: "★★★", color: "text-white" },
  { name: "General",      minGlory: 170_000,   insignia: "✪",   color: "text-white" },
  { name: "Marshal",      minGlory: 380_000,   insignia: "✪✪",  color: "text-white" },
  { name: "Warlord",      minGlory: 900_000,   insignia: "☠",   color: "text-white" },
];

export function getRank(glory: number): {
  rank: Rank;
  next: Rank | null;
  progress: number;
  index: number;
} {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (glory >= RANKS[i].minGlory) idx = i;
  }

  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;

  const progress = next
    ? (glory - rank.minGlory) / (next.minGlory - rank.minGlory)
    : 1;

  return {
    rank,
    next,
    progress: Math.max(0, Math.min(1, progress)),
    index: idx,
  };
}

export function getLevel(glory: number): number {
  // Slightly faster early/mid levels
  return 1 + Math.floor(Math.sqrt(glory / 22));
}

export function getRankForGlory(glory: number): Rank {
  return getRank(glory).rank;
}
