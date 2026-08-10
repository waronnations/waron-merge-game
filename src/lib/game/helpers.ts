// src/lib/game/helpers.ts
// Pure helpers + localStorage persistence for the client game state.
// All game constants come from @/lib/constants — never duplicate them here.
import type { Faction } from "@/lib/units";
import { cellVariant } from "@/lib/units";
import {
  BOARD_SIZE,
  MAX_ENERGY,
  ENERGY_REGEN_MS,
  EARLY_GAME_MERGES,
  EARLY_GAME_REGEN_MULT,
  STARTER_PACK,
  TERRORIST_THRESHOLD,
} from "@/lib/constants";
import { getActiveEvents, getEnergyRegenMultiplier } from "@/lib/events";
import type { Cell, DailyQuest, GameState, Task } from "./types";

export const STORAGE_KEY = "waron-merge-v2";

export function randomFaction(): Faction {
  return Math.random() < 0.5 ? "dog" : "cat";
}

export function isCorrectSide(
  index: number,
  faction: Faction | "hybrid",
): boolean {
  if (faction === "hybrid") return true;
  const col = index % BOARD_SIZE;
  return faction === "dog" ? col < 3 : col >= 3;
}

/**
 * Smart variant picker – keeps any side mergeable until the very last cells.
 * Priority:
 *  1. Existing tier-1 variants on the side → instant merge possible
 *  2. Any existing variant on the side → stay on known lines
 *  3. Pure random only when the side is completely empty
 */
export function pickSmartVariant(
  board: (Cell | null)[],
  faction: Faction,
): number {
  const sideStart = faction === "dog" ? 0 : 3;
  const sideEnd = faction === "dog" ? 3 : BOARD_SIZE;

  const tier1Variants = new Set<number>();
  const anyVariants = new Set<number>();

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = sideStart; col < sideEnd; col++) {
      const idx = row * BOARD_SIZE + col;
      const cell = board[idx];
      if (!cell || cell.faction !== faction) continue;

      const v = cellVariant(cell);
      anyVariants.add(v);
      if (cell.tier === 1) tier1Variants.add(v);
    }
  }

  if (tier1Variants.size > 0) {
    const arr = Array.from(tier1Variants);
    return arr[Math.floor(Math.random() * arr.length)]!;
  }
  if (anyVariants.size > 0) {
    const arr = Array.from(anyVariants);
    return arr[Math.floor(Math.random() * arr.length)]!;
  }
  return Math.floor(Math.random() * 3);
}

/**
 * Production-safe board sanitizer.
 * - Fixed length, unique ids, valid faction/tier/variant
 * - Side fix (NO REARRANGE): if a non-hybrid is on the wrong half we only
 *   correct its faction in-place. Positions are never moved.
 */
export function sanitizeBoard(board: unknown): (Cell | null)[] {
  const size = BOARD_SIZE * BOARD_SIZE;
  const out: (Cell | null)[] = Array(size).fill(null);

  if (!Array.isArray(board)) return out;

  const seen = new Set<number>();
  for (let i = 0; i < size; i++) {
    const raw = board[i];
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Partial<Cell>;

    if (typeof c.id !== "number" || !Number.isFinite(c.id) || c.id <= 0) {
      continue;
    }
    const id = Math.floor(c.id);
    if (seen.has(id)) continue;
    seen.add(id);

    const faction = c.faction;
    if (faction !== "dog" && faction !== "cat" && faction !== "hybrid") {
      continue;
    }

    const tier =
      typeof c.tier === "number" && Number.isFinite(c.tier)
        ? Math.max(1, Math.min(6, Math.floor(c.tier)))
        : 1;

    const cell: Cell = { id, faction, tier };
    if (typeof c.variant === "number" && Number.isFinite(c.variant)) {
      cell.variant = Math.abs(Math.floor(c.variant)) % 3;
    }
    if (typeof c.seed === "string" && c.seed.length > 0) cell.seed = c.seed;
    if (typeof c.imageUrl === "string" && c.imageUrl.length > 0) {
      cell.imageUrl = c.imageUrl;
    }
    if (typeof c.parentDogId === "number") cell.parentDogId = c.parentDogId;
    if (typeof c.parentCatId === "number") cell.parentCatId = c.parentCatId;
    if (c.isHybrid) cell.isHybrid = true;

    out[i] = cell;
  }

  // ── SIDE FIX (position-preserving) ────────────────────────────────
  for (let i = 0; i < size; i++) {
    const cell = out[i];
    if (!cell || cell.faction === "hybrid") continue;
    if (isCorrectSide(i, cell.faction)) continue;

    out[i] = {
      ...cell,
      faction: isCorrectSide(i, "dog") ? "dog" : "cat",
    };
  }

  return out;
}

export function makeInitialBoard(): (Cell | null)[] {
  const board: (Cell | null)[] = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
  let id = 1;

  const leftPositions: number[] = [];
  while (leftPositions.length < 4) {
    const col = Math.floor(Math.random() * 3);
    const row = Math.floor(Math.random() * BOARD_SIZE);
    const idx = row * BOARD_SIZE + col;
    if (!leftPositions.includes(idx)) leftPositions.push(idx);
  }
  for (const p of leftPositions) {
    board[p] = {
      id: id++,
      faction: "dog",
      tier: 1,
      variant: Math.floor(Math.random() * 3),
    };
  }

  const rightPositions: number[] = [];
  while (rightPositions.length < 4) {
    const col = 3 + Math.floor(Math.random() * 3);
    const row = Math.floor(Math.random() * BOARD_SIZE);
    const idx = row * BOARD_SIZE + col;
    if (!rightPositions.includes(idx)) rightPositions.push(idx);
  }
  for (const p of rightPositions) {
    board[p] = {
      id: id++,
      faction: "cat",
      tier: 1,
      variant: Math.floor(Math.random() * 3),
    };
  }

  return board;
}

// ── One-time tasks removed ──────────────────────────────────────────
export function defaultTasks(): Task[] {
  return [];
}

export function normalizeTasks(_tasks: Task[] | undefined | null): Task[] {
  return [];
}

// ── Only 3 Daily Ops ────────────────────────────────────────────────
export const DAILY_QUEST_POOL: Omit<DailyQuest, "progress" | "claimed">[] = [
  {
    id: "dq_merge15",
    title: "Rapid Merge",
    desc: "Perform 15 merges today",
    target: 15,
    reward: 200,
    wardog: 2,
  },
  {
    id: "dq_merge30",
    title: "Combat Ready",
    desc: "Perform 30 merges today",
    target: 30,
    reward: 400,
    warcat: 3,
  },
  {
    id: "dq_spawn10",
    title: "Deploy Weapons",
    desc: "Deploy 10 weapons today",
    target: 10,
    reward: 250,
    energy: 15,
  },
];

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickDailyQuests(_seed: number): DailyQuest[] {
  return DAILY_QUEST_POOL.map((q) => ({
    ...q,
    progress: 0,
    claimed: false,
  }));
}

export function makeReferralCode(): string {
  const alphabet = "ACDEFGHJKMNPQRTUVWXYZ2346789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `WAR-${code}`;
}

export function truncateToDay(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export function clampEnergy(e: unknown): number {
  if (typeof e !== "number" || !Number.isFinite(e)) return 0;
  if (e < 0) return 0;
  if (e > MAX_ENERGY) return MAX_ENERGY;
  return e;
}

export function applyOfflineEnergyRegen(s: GameState): GameState {
  const now = Date.now();
  let energy = clampEnergy(s.energy);
  let last = s.lastRegenAt;

  if (
    typeof last !== "number" ||
    !Number.isFinite(last) ||
    last <= 0 ||
    last > now + 60_000
  ) {
    return { ...s, energy, lastRegenAt: now };
  }

  if (energy >= MAX_ENERGY) {
    return { ...s, energy: MAX_ENERGY, lastRegenAt: now };
  }

  const elapsed = now - last;
  const events = getActiveEvents();
  const mult = getEnergyRegenMultiplier(events);
  const earlyMult =
    s.totalMerges < EARLY_GAME_MERGES ? EARLY_GAME_REGEN_MULT : 1;
  const regenMs = ENERGY_REGEN_MS / (mult * earlyMult);
  const gained = Math.floor(elapsed / regenMs);

  if (gained <= 0) return s;

  energy = clampEnergy(energy + gained);
  return {
    ...s,
    energy,
    lastRegenAt: last + gained * regenMs,
  };
}

export function isDogSideFullOfHybrids(board: (Cell | null)[]): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * BOARD_SIZE + col;
      const cell = board[idx];
      if (!cell || cell.faction !== "hybrid") return false;
    }
  }
  return true;
}

export function isCatSideFullOfHybrids(board: (Cell | null)[]): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 3; col < BOARD_SIZE; col++) {
      const idx = row * BOARD_SIZE + col;
      const cell = board[idx];
      if (!cell || cell.faction !== "hybrid") return false;
    }
  }
  return true;
}

export function updateConquerFlags(s: GameState): GameState {
  const dog = isDogSideFullOfHybrids(s.board);
  const cat = isCatSideFullOfHybrids(s.board);
  if (dog === s.dogSideConquered && cat === s.catSideConquered) return s;
  return {
    ...s,
    dogSideConquered: dog,
    catSideConquered: cat,
  };
}

export function bumpDailyQuest(
  s: GameState,
  type: "merge" | "spawn" | "tierUp",
  amount = 1,
  tier?: number,
): GameState {
  const quests = s.dailyQuests.map((q) => {
    if (q.claimed) return q;
    if (type === "merge" && q.id.startsWith("dq_merge")) {
      return { ...q, progress: Math.min(q.target, q.progress + amount) };
    }
    if (type === "spawn" && q.id === "dq_spawn10") {
      return { ...q, progress: Math.min(q.target, q.progress + amount) };
    }
    if (type === "tierUp" && tier && q.id.startsWith("dq_merge")) {
      return { ...q, progress: Math.min(q.target, q.progress + amount) };
    }
    return q;
  });
  return { ...s, dailyQuests: quests };
}

export function updateTaskProgress(s: GameState): GameState {
  // Tasks system currently disabled / empty
  return s;
}

export function initialState(): GameState {
  const now = Date.now();
  const today = truncateToDay(now);
  return {
    board: makeInitialBoard(),
    nextId: 100,
    glory: STARTER_PACK.glory,
    energy: STARTER_PACK.energy,
    lastRegenAt: now,
    totalMerges: 0,
    highestTier: 1,
    lastDailyClaim: 0,
    dailyStreak: 0,
    tasks: defaultTasks(),
    dailyQuests: pickDailyQuests(today),
    dailyQuestsDate: today,
    wardogTokens: STARTER_PACK.wardog,
    warcatTokens: STARTER_PACK.warcat,
    referralCode: makeReferralCode(),
    referrals: [],
    hasSeenTutorial: false,
    gloryBoostUntil: 0,
    lastSeenAt: now,
    pendingIdleReward: null,
    nukesOwned: 0,
    nukesLaunchedToday: 0,
    lastNukeDay: 0,
    totalNukesLaunched: 0,
    isTerrorist: false,
    lastNukeTargetId: null,
    nukesUsedToday: 0,
    pendingHybrid: null,
    hybrids: [],
    explosion: null,
    lastMergeAt: 0,
    comboCount: 0,
    achievements: [],
    dogSideConquered: false,
    catSideConquered: false,
  };
}

export function load(): GameState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (!parsed.board || parsed.board.length !== BOARD_SIZE * BOARD_SIZE) {
      return initialState();
    }
    const base = initialState();
    const merged = { ...base, ...parsed } as GameState;
    merged.board = sanitizeBoard(merged.board);
    return applyOfflineEnergyRegen(merged);
  } catch {
    return initialState();
  }
}

export function save(s: GameState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
}
