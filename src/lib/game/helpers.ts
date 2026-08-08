// src/lib/game/helpers.ts
// Pure helpers + localStorage persistence for the client game state.
// All game constants come from @/lib/constants — never duplicate them here.
import type { Faction } from "@/lib/units";
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
  // Always return the fixed 3 daily ops
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

  const events = getActiveEvents(now);
  const eventMult = getEnergyRegenMultiplier(events);
  const earlyMult =
    Number(s.totalMerges ?? 0) < EARLY_GAME_MERGES ? EARLY_GAME_REGEN_MULT : 1;
  const energyMult = eventMult * earlyMult;
  const gained = Math.floor(((now - last) / ENERGY_REGEN_MS) * energyMult);
  if (gained <= 0) return { ...s, energy, lastRegenAt: last };

  energy = Math.min(MAX_ENERGY, energy + gained);
  last = last + Math.floor((gained * ENERGY_REGEN_MS) / energyMult);
  return { ...s, energy, lastRegenAt: last };
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
  };
}

export function load(): GameState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<GameState>;

    const base = initialState();
    const merged: GameState = { ...base, ...parsed } as GameState;

    merged.board = sanitizeBoard(parsed.board);

    delete (merged as Partial<GameState> & { rouletteSpins?: number })
      .rouletteSpins;

    merged.tasks = normalizeTasks(merged.tasks);
    if (!merged.referrals) merged.referrals = [];
    if (!merged.referralCode || merged.referralCode.length < 5) {
      merged.referralCode = makeReferralCode();
    }

    if (typeof merged.nukesOwned !== "number" || !Number.isFinite(merged.nukesOwned)) {
      merged.nukesOwned = 0;
    }
    if (
      typeof merged.nukesLaunchedToday !== "number" ||
      !Number.isFinite(merged.nukesLaunchedToday)
    ) {
      merged.nukesLaunchedToday =
        typeof merged.nukesUsedToday === "number" ? merged.nukesUsedToday : 0;
    }
    if (typeof merged.lastNukeDay !== "number" || !Number.isFinite(merged.lastNukeDay)) {
      merged.lastNukeDay = 0;
    }
    if (
      typeof merged.totalNukesLaunched !== "number" ||
      !Number.isFinite(merged.totalNukesLaunched)
    ) {
      merged.totalNukesLaunched = 0;
    }
    merged.isTerrorist =
      !!merged.isTerrorist || merged.totalNukesLaunched >= TERRORIST_THRESHOLD;
    if (merged.lastNukeTargetId === undefined) {
      merged.lastNukeTargetId = null;
    }

    merged.nukesUsedToday = merged.nukesLaunchedToday;

    if (!merged.pendingHybrid) merged.pendingHybrid = null;
    if (!Array.isArray(merged.hybrids)) merged.hybrids = [];
    if (!(merged as any).explosion) (merged as any).explosion = null;

    const today = truncateToDay(Date.now());
    if (!merged.dailyQuests?.length || merged.dailyQuestsDate !== today) {
      merged.dailyQuests = pickDailyQuests(today);
      merged.dailyQuestsDate = today;
    } else {
      // Keep only the 3 allowed daily ops (migrate old saves)
      const allowedIds = new Set(DAILY_QUEST_POOL.map((q) => q.id));
      const kept = merged.dailyQuests.filter((q) => allowedIds.has(q.id));
      if (kept.length < 3) {
        merged.dailyQuests = pickDailyQuests(today);
      } else {
        merged.dailyQuests = kept.map((q) => {
          const def = DAILY_QUEST_POOL.find((d) => d.id === q.id)!;
          return {
            ...def,
            progress: typeof q.progress === "number" ? q.progress : 0,
            claimed: !!q.claimed,
          };
        });
      }
      merged.dailyQuestsDate = today;
    }

    merged.energy = clampEnergy(merged.energy);
    merged.nextId =
      typeof merged.nextId === "number" &&
      Number.isFinite(merged.nextId) &&
      merged.nextId > 0
        ? Math.floor(merged.nextId)
        : 100;

    return applyOfflineEnergyRegen(merged);
  } catch {
    return initialState();
  }
}

export function save(state: GameState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

export function updateTaskProgress(s: GameState): GameState {
  return { ...s, tasks: [] };
}

export function bumpDailyQuest(
  s: GameState,
  kind: "merge" | "spawn" | "tierUp",
  amount = 1,
  _tier = 0,
): GameState {
  const dailyQuests = s.dailyQuests.map((q) => {
    if (q.claimed) return q;
    if (kind === "merge" && q.id.startsWith("dq_merge")) {
      return {
        ...q,
        progress: Math.min(q.target, q.progress + amount),
      };
    }
    if (kind === "spawn" && q.id === "dq_spawn10") {
      return {
        ...q,
        progress: Math.min(q.target, q.progress + amount),
      };
    }
    return q;
  });
  return { ...s, dailyQuests };
}
