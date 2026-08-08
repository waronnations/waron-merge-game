/** Server-authoritative daily claim, task claim and daily-quest claim logic. */

import { addTokens } from "@/lib/tokens";
import { MAX_ENERGY } from "@/lib/constants";
import {
  type ServerGameState,
  loadProgress,
  writeProgress,
  truncateToDay,
} from "./state.server";

export async function serverClaimDaily(userId: number) {
  const prev = await loadProgress(userId);
  if (!prev) return { ok: false as const, reason: "no_progress" };

  const state = { ...(prev.state as ServerGameState) };
  const now = Date.now();
  const today = truncateToDay(now);

  if (Number(state.lastDailyClaim) === today) {
    return { ok: false as const, reason: "already_claimed_today" };
  }

  const yesterday = today - 86_400_000;
  const streak =
    Number(state.lastDailyClaim) === yesterday
      ? Number(state.dailyStreak) + 1
      : 1;

  const glory = 100 + 25 * streak;
  state.glory = Number(state.glory) + glory;
  state.energy = Math.min(MAX_ENERGY, Number(state.energy) + 30);
  state.lastDailyClaim = today;
  state.dailyStreak = streak;

  await writeProgress(userId, state, {
    touchSyncClock: false,
    gloryDelta: glory,
  });

  return { ok: true as const, state, glory, energy: 30, streak };
}

export async function serverClaimTask(userId: number, taskId: string) {
  const prev = await loadProgress(userId);
  if (!prev) return { ok: false as const, reason: "no_progress" };

  const state = { ...(prev.state as ServerGameState) };

  // Deep-copy the tasks array so we never mutate the loaded reference
  const tasks = Array.isArray(state.tasks)
    ? state.tasks.map((t: any) => ({ ...t }))
    : [];

  const idx = tasks.findIndex((t: any) => t.id === taskId);
  if (idx < 0) {
    return { ok: false as const, reason: "invalid_task" };
  }

  const task = tasks[idx];
  if (!task.done || task.claimed) {
    return { ok: false as const, reason: "invalid_task" };
  }

  // Immutable update
  tasks[idx] = { ...task, claimed: true };
  state.tasks = tasks;

  state.glory = Number(state.glory) + (task.reward || 0);
  if (task.wardog) {
    state.wardogTokens = addTokens(state.wardogTokens, task.wardog);
  }
  if (task.warcat) {
    state.warcatTokens = addTokens(state.warcatTokens, task.warcat);
  }

  await writeProgress(userId, state, {
    touchSyncClock: false,
    gloryDelta: task.reward || 0,
  });

  return { ok: true as const, state };
}

export async function serverClaimDailyQuest(userId: number, questId: string) {
  const prev = await loadProgress(userId);
  if (!prev) return { ok: false as const, reason: "no_progress" };

  const state = { ...(prev.state as ServerGameState) };

  // Deep-copy the dailyQuests array so we never mutate the loaded reference
  const dailyQuests = Array.isArray(state.dailyQuests)
    ? state.dailyQuests.map((q: any) => ({ ...q }))
    : [];

  const idx = dailyQuests.findIndex((q: any) => q.id === questId);
  if (idx < 0) {
    return { ok: false as const, reason: "invalid_quest" };
  }

  const quest = dailyQuests[idx];
  if (quest.progress < quest.target || quest.claimed) {
    return { ok: false as const, reason: "invalid_quest" };
  }

  // Immutable update
  dailyQuests[idx] = { ...quest, claimed: true };
  state.dailyQuests = dailyQuests;

  state.glory = Number(state.glory) + (quest.reward || 0);
  if (quest.wardog) {
    state.wardogTokens = addTokens(state.wardogTokens, quest.wardog);
  }
  if (quest.warcat) {
    state.warcatTokens = addTokens(state.warcatTokens, quest.warcat);
  }
  if (quest.energy) {
    state.energy = Math.min(MAX_ENERGY, Number(state.energy) + quest.energy);
  }

  await writeProgress(userId, state, {
    touchSyncClock: false,
    gloryDelta: quest.reward || 0,
  });

  return { ok: true as const, state };
}
