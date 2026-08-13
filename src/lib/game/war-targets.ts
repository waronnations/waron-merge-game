// src/lib/game/war-targets.ts
import type { GameState, WarTarget, Cell } from "./types";
import {
  TARGET_SPAWN_EVERY_MERGES,
  TARGET_MAX_ON_BOARD,
  TARGET_LIFETIME_MS,
  TARGET_ATTACK_ENERGY_COST,
  TARGET_ATTACK_TOKEN_COST,
  TARGET_NATION_REWARD,
  TARGET_PLAYER_REWARD,
} from "@/lib/constants/war-targets";
import { updateConquerFlags } from "./helpers";

/** Real countries with emoji flags */
export const NATION_POOL = [
  { id: "af", name: "Afghanistan", emoji: "🇦🇫" },
  { id: "al", name: "Albania", emoji: "🇦🇱" },
  { id: "dz", name: "Algeria", emoji: "🇩🇿" },
  { id: "ar", name: "Argentina", emoji: "🇦🇷" },
  { id: "am", name: "Armenia", emoji: "🇦🇲" },
  { id: "au", name: "Australia", emoji: "🇦🇺" },
  { id: "at", name: "Austria", emoji: "🇦🇹" },
  { id: "az", name: "Azerbaijan", emoji: "🇦🇿" },
  { id: "bh", name: "Bahrain", emoji: "🇧🇭" },
  { id: "bd", name: "Bangladesh", emoji: "🇧🇩" },
  { id: "by", name: "Belarus", emoji: "🇧🇾" },
  { id: "be", name: "Belgium", emoji: "🇧🇪" },
  { id: "bo", name: "Bolivia", emoji: "🇧🇴" },
  { id: "ba", name: "Bosnia", emoji: "🇧🇦" },
  { id: "br", name: "Brazil", emoji: "🇧🇷" },
  { id: "bg", name: "Bulgaria", emoji: "🇧🇬" },
  { id: "ca", name: "Canada", emoji: "🇨🇦" },
  { id: "cl", name: "Chile", emoji: "🇨🇱" },
  { id: "cn", name: "China", emoji: "🇨🇳" },
  { id: "co", name: "Colombia", emoji: "🇨🇴" },
  { id: "cr", name: "Costa Rica", emoji: "🇨🇷" },
  { id: "hr", name: "Croatia", emoji: "🇭🇷" },
  { id: "cu", name: "Cuba", emoji: "🇨🇺" },
  { id: "cy", name: "Cyprus", emoji: "🇨🇾" },
  { id: "cz", name: "Czechia", emoji: "🇨🇿" },
  { id: "dk", name: "Denmark", emoji: "🇩🇰" },
  { id: "do", name: "Dominican", emoji: "🇩🇴" },
  { id: "ec", name: "Ecuador", emoji: "🇪🇨" },
  { id: "eg", name: "Egypt", emoji: "🇪🇬" },
  { id: "ee", name: "Estonia", emoji: "🇪🇪" },
  { id: "et", name: "Ethiopia", emoji: "🇪🇹" },
  { id: "fi", name: "Finland", emoji: "🇫🇮" },
  { id: "fr", name: "France", emoji: "🇫🇷" },
  { id: "ge", name: "Georgia", emoji: "🇬🇪" },
  { id: "de", name: "Germany", emoji: "🇩🇪" },
  { id: "gh", name: "Ghana", emoji: "🇬🇭" },
  { id: "gr", name: "Greece", emoji: "🇬🇷" },
  { id: "gt", name: "Guatemala", emoji: "🇬🇹" },
  { id: "hn", name: "Honduras", emoji: "🇭🇳" },
  { id: "hk", name: "Hong Kong", emoji: "🇭🇰" },
  { id: "hu", name: "Hungary", emoji: "🇭🇺" },
  { id: "is", name: "Iceland", emoji: "🇮🇸" },
  { id: "in", name: "India", emoji: "🇮🇳" },
  { id: "id", name: "Indonesia", emoji: "🇮🇩" },
  { id: "ir", name: "Iran", emoji: "🇮🇷" },
  { id: "iq", name: "Iraq", emoji: "🇮🇶" },
  { id: "ie", name: "Ireland", emoji: "🇮🇪" },
  { id: "il", name: "Israel", emoji: "🇮🇱" },
  { id: "it", name: "Italy", emoji: "🇮🇹" },
  { id: "jm", name: "Jamaica", emoji: "🇯🇲" },
  { id: "jp", name: "Japan", emoji: "🇯🇵" },
  { id: "jo", name: "Jordan", emoji: "🇯🇴" },
  { id: "kz", name: "Kazakhstan", emoji: "🇰🇿" },
  { id: "ke", name: "Kenya", emoji: "🇰🇪" },
  { id: "kw", name: "Kuwait", emoji: "🇰🇼" },
  { id: "lv", name: "Latvia", emoji: "🇱🇻" },
  { id: "lb", name: "Lebanon", emoji: "🇱🇧" },
  { id: "ly", name: "Libya", emoji: "🇱🇾" },
  { id: "lt", name: "Lithuania", emoji: "🇱🇹" },
  { id: "lu", name: "Luxembourg", emoji: "🇱🇺" },
  { id: "my", name: "Malaysia", emoji: "🇲🇾" },
  { id: "mx", name: "Mexico", emoji: "🇲🇽" },
  { id: "md", name: "Moldova", emoji: "🇲🇩" },
  { id: "mn", name: "Mongolia", emoji: "🇲🇳" },
  { id: "me", name: "Montenegro", emoji: "🇲🇪" },
  { id: "ma", name: "Morocco", emoji: "🇲🇦" },
  { id: "np", name: "Nepal", emoji: "🇳🇵" },
  { id: "nl", name: "Netherlands", emoji: "🇳🇱" },
  { id: "nz", name: "New Zealand", emoji: "🇳🇿" },
  { id: "ng", name: "Nigeria", emoji: "🇳🇬" },
  { id: "kp", name: "N.Korea", emoji: "🇰🇵" },
  { id: "no", name: "Norway", emoji: "🇳🇴" },
  { id: "om", name: "Oman", emoji: "🇴🇲" },
  { id: "pk", name: "Pakistan", emoji: "🇵🇰" },
  { id: "pa", name: "Panama", emoji: "🇵🇦" },
  { id: "py", name: "Paraguay", emoji: "🇵🇾" },
  { id: "pe", name: "Peru", emoji: "🇵🇪" },
  { id: "ph", name: "Philippines", emoji: "🇵🇭" },
  { id: "pl", name: "Poland", emoji: "🇵🇱" },
  { id: "pt", name: "Portugal", emoji: "🇵🇹" },
  { id: "qa", name: "Qatar", emoji: "🇶🇦" },
  { id: "ro", name: "Romania", emoji: "🇷🇴" },
  { id: "ru", name: "Russia", emoji: "🇷🇺" },
  { id: "sa", name: "Saudi", emoji: "🇸🇦" },
  { id: "rs", name: "Serbia", emoji: "🇷🇸" },
  { id: "sg", name: "Singapore", emoji: "🇸🇬" },
  { id: "sk", name: "Slovakia", emoji: "🇸🇰" },
  { id: "si", name: "Slovenia", emoji: "🇸🇮" },
  { id: "za", name: "S.Africa", emoji: "🇿🇦" },
  { id: "kr", name: "S.Korea", emoji: "🇰🇷" },
  { id: "es", name: "Spain", emoji: "🇪🇸" },
  { id: "lk", name: "Sri Lanka", emoji: "🇱🇰" },
  { id: "se", name: "Sweden", emoji: "🇸🇪" },
  { id: "ch", name: "Switzerland", emoji: "🇨🇭" },
  { id: "sy", name: "Syria", emoji: "🇸🇾" },
  { id: "tw", name: "Taiwan", emoji: "🇹🇼" },
  { id: "th", name: "Thailand", emoji: "🇹🇭" },
  { id: "tr", name: "Turkey", emoji: "🇹🇷" },
  { id: "ua", name: "Ukraine", emoji: "🇺🇦" },
  { id: "ae", name: "UAE", emoji: "🇦🇪" },
  { id: "gb", name: "UK", emoji: "🇬🇧" },
  { id: "us", name: "USA", emoji: "🇺🇸" },
  { id: "uy", name: "Uruguay", emoji: "🇺🇾" },
  { id: "uz", name: "Uzbekistan", emoji: "🇺🇿" },
  { id: "ve", name: "Venezuela", emoji: "🇻🇪" },
  { id: "vn", name: "Vietnam", emoji: "🇻🇳" },
  { id: "ye", name: "Yemen", emoji: "🇾🇪" },
] as const;

const FALLBACK_PLAYER_POOL = [
  "Shadow", "Viper", "Ghost", "Raven", "Blaze", "Nova", "Kane",
  "Rex", "Ace", "Wolf", "Storm", "Phoenix", "Drake", "Lynx", "Zero",
  "Reaper", "Spectre", "Titan", "Cobra", "Hawk",
];

function generateTargetId(): string {
  return `tgt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isTargetCell(cell: Cell | null | undefined): boolean {
  if (!cell) return false;
  return (
    cell.isTarget === true ||
    cell.faction === "target" ||
    !!cell.targetId ||
    !!cell.targetType
  );
}

function findSpawnIndex(board: (Cell | null)[]): number | null {
  const empty: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) empty.push(i);
  }
  if (empty.length === 0) return null;

  const preferred = empty.filter((i) => {
    const col = i % 6;
    return col === 2 || col === 3;
  });
  const pool = preferred.length > 0 ? preferred : empty;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function maybeSpawnTarget(
  s: GameState,
  now = Date.now(),
  realPlayers: string[] = [],
): GameState {
  if (!s.warMode?.active) return s;
  if (TARGET_MAX_ON_BOARD <= 0) return s;

  let mergesSince = (s.warMode.mergesSinceLastTarget ?? 0) + 1;
  let targets = [...(s.warMode.targets || [])].filter((t) => t.expiresAt > now);

  if (
    mergesSince >= TARGET_SPAWN_EVERY_MERGES &&
    targets.length < TARGET_MAX_ON_BOARD
  ) {
    const idx = findSpawnIndex(s.board);
    if (idx !== null) {
      const isNation = Math.random() < 0.55;
      const id = generateTargetId();

      let nationId: string | undefined;
      let nationName: string | undefined;
      let nationEmoji: string | undefined;
      let playerName: string | undefined;
      let playerId: number | undefined;
      let label: string;

      if (isNation) {
        const nation = NATION_POOL[Math.floor(Math.random() * NATION_POOL.length)];
        nationId = nation.id;
        nationName = nation.name;
        nationEmoji = nation.emoji;
        label = nation.name;
      } else {
        if (realPlayers.length > 0) {
          playerName = realPlayers[Math.floor(Math.random() * realPlayers.length)];
        } else {
          playerName =
            FALLBACK_PLAYER_POOL[
              Math.floor(Math.random() * FALLBACK_PLAYER_POOL.length)
            ];
        }
        playerId = Math.floor(Math.random() * 900000000) + 100000000;
        label = playerName;
      }

      const target: WarTarget = {
        id,
        type: isNation ? "nation" : "player",
        boardIndex: idx,
        spawnedAt: now,
        expiresAt: now + TARGET_LIFETIME_MS,
        nationId,
        nationName,
        playerId,
        playerName,
      };

      const board = [...s.board];
      board[idx] = {
        id: s.nextId,
        faction: "target",
        tier: 1,
        isTarget: true,
        targetType: target.type,
        targetId: id,
        targetLabel: label,
        ...(isNation ? { nationId, nationEmoji } : {}),
      } as Cell;

      targets.push(target);
      mergesSince = 0;

      return {
        ...s,
        board,
        nextId: s.nextId + 1,
        warMode: {
          ...s.warMode,
          targets,
          mergesSinceLastTarget: mergesSince,
        },
      };
    }
  }

  return {
    ...s,
    warMode: {
      ...s.warMode,
      targets,
      mergesSinceLastTarget: mergesSince,
    },
  };
}

export function attackTarget(
  s: GameState,
  boardIndex: number,
  now = Date.now(),
): {
  nextState: GameState;
  ok: boolean;
  reason?: string;
  rewardText?: string;
} {
  if (!s.warMode?.active) {
    return { nextState: s, ok: false, reason: "War Mode not active" };
  }

  const cell = s.board[boardIndex];
  if (!cell || !cell.isTarget || !cell.targetId) {
    return { nextState: s, ok: false, reason: "Not a target" };
  }

  if (TARGET_ATTACK_ENERGY_COST > 0 && s.energy < TARGET_ATTACK_ENERGY_COST) {
    return { nextState: s, ok: false, reason: "Not enough energy — top up!" };
  }

  const hasTokens =
    TARGET_ATTACK_TOKEN_COST <= 0 ||
    s.wardogTokens >= TARGET_ATTACK_TOKEN_COST ||
    s.warcatTokens >= TARGET_ATTACK_TOKEN_COST;

  if (!hasTokens) {
    return { nextState: s, ok: false, reason: "Need tokens — top up to strike!" };
  }

  const target = s.warMode.targets.find((t) => t.id === cell.targetId);
  if (!target || target.expiresAt < now) {
    return { nextState: s, ok: false, reason: "Target expired" };
  }

  let wardog = s.wardogTokens;
  let warcat = s.warcatTokens;
  if (TARGET_ATTACK_TOKEN_COST > 0) {
    if (wardog >= TARGET_ATTACK_TOKEN_COST) {
      wardog -= TARGET_ATTACK_TOKEN_COST;
    } else {
      warcat -= TARGET_ATTACK_TOKEN_COST;
    }
  }

  const reward =
    target.type === "nation" ? TARGET_NATION_REWARD : TARGET_PLAYER_REWARD;

  const board = [...s.board];
  board[boardIndex] = null;

  const targets = s.warMode.targets.filter((t) => t.id !== target.id);

  let frontLine = s.warMode.frontLine;
  const push = Math.random() > 0.5 ? reward.control : -reward.control;
  frontLine = Math.max(0, Math.min(100, frontLine + push));

  const next: GameState = {
    ...s,
    board,
    energy: Math.max(0, s.energy - TARGET_ATTACK_ENERGY_COST),
    wardogTokens: wardog + reward.wardog,
    warcatTokens: warcat + reward.warcat,
    glory: s.glory + reward.glory,
    warMode: {
      ...s.warMode,
      targets,
      frontLine,
      controlGenerated: (s.warMode.controlGenerated || 0) + reward.control,
    },
  };

  const rewardText =
    target.type === "nation"
      ? `Nuked ${target.nationName}! +${reward.glory} Glory`
      : `Struck ${target.playerName}! +${reward.glory} Glory`;

  return {
    nextState: updateConquerFlags(next),
    ok: true,
    rewardText,
  };
}

/**
 * Remove expired targets AND any sticky target cells when War Mode is off.
 * Local-only — never depends on Neon.
 */
export function cleanExpiredTargets(s: GameState, now = Date.now()): GameState {
  const board = [...s.board];
  let changed = false;

  const activeTargets = s.warMode?.active
    ? (s.warMode.targets || []).filter((t) => t.expiresAt > now)
    : [];

  const aliveIds = new Set(activeTargets.map((t) => t.id));

  for (let i = 0; i < board.length; i++) {
    const cell = board[i];
    if (!isTargetCell(cell)) continue;

    // War Mode off → wipe all target cells
    // War Mode on → wipe if not in the alive list
    if (!s.warMode?.active || !cell!.targetId || !aliveIds.has(cell!.targetId)) {
      board[i] = null;
      changed = true;
    }
  }

  if (!s.warMode) {
    return changed ? { ...s, board } : s;
  }

  const targetsUnchanged =
    activeTargets.length === (s.warMode.targets || []).length;

  if (!changed && targetsUnchanged) return s;

  return {
    ...s,
    board,
    warMode: {
      ...s.warMode,
      targets: activeTargets,
    },
  };
}

/** Strip every Live Target cell from a board (used on load / end War Mode). */
export function stripAllTargetCells(
  board: (Cell | null)[],
): (Cell | null)[] {
  return board.map((cell) => (isTargetCell(cell) ? null : cell));
}
