// src/lib/ranks.ts

export interface Rank {
  name: string;
  minGlory: number;
  insignia: string;
  color: string; // tailwind-ish accent
}

export const RANKS: Rank[] = [
  { name: "Recruit",      minGlory: 0,         insignia: "◇",   color: "text-zinc-400" },
  { name: "Private",      minGlory: 250,       insignia: "▪",   color: "text-zinc-300" },
  { name: "Corporal",     minGlory: 900,       insignia: "▪▪",  color: "text-slate-300" },
  { name: "Sergeant",     minGlory: 2_800,     insignia: "▲",   color: "text-emerald-400" },
  { name: "Lieutenant",   minGlory: 6_500,     insignia: "▲▲",  color: "text-cyan-400" },
  { name: "Captain",      minGlory: 14_000,    insignia: "★",   color: "text-sky-400" },
  { name: "Major",        minGlory: 32_000,    insignia: "★★",  color: "text-blue-400" },
  { name: "Colonel",      minGlory: 75_000,    insignia: "★★★", color: "text-violet-400" },
  { name: "General",      minGlory: 170_000,   insignia: "✪",   color: "text-amber-400" },
  { name: "Marshal",      minGlory: 380_000,   insignia: "✪✪",  color: "text-orange-400" },
  { name: "Warlord",      minGlory: 900_000,   insignia: "☠",   color: "text-red-400" },
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
