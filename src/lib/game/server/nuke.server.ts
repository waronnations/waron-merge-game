/** Server-authoritative nuke launch (owned-only, unlimited launches). */

import { sql } from "@/lib/db.server";
import { addTokens } from "@/lib/tokens";
import {
  MAX_ENERGY,
  TERRORIST_THRESHOLD,
  NUKE_TRANSFER_VALUE,
  PEACEFUL_DAYS,
  NUKE_REWARDS,
  NUKE_PROTECTION_MS,
} from "@/lib/constants";
import {
  type ServerGameState,
  loadProgress,
  writeProgress,
  normalizeServerState,
  truncateToDay,
} from "./state.server";
import { isNationProtected } from "@/lib/nations/vault.server";
import { announceToGroup } from "@/lib/notify.server";

/**
 * Launch a Strategic Nuke against a nation.
 * UNLIMITED launches — only limited by nukesOwned (bought in shop).
 * Blocked if the target has active 24h economic protection.
 */
export async function serverLaunchNuke(
  userId: number,
  targetNationId: number,
): Promise<
  | {
      ok: true;
      state: ServerGameState;
      glory: number;
      energy: number;
      tokens: number;
      transferred: number;
      wasPeaceful: boolean;
      becameTerrorist: boolean;
      targetName: string;
    }
  | { ok: false; reason: string }
> {
  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  let state = normalizeServerState(prev.state, prev);
  const now = Date.now();
  const today = truncateToDay(now);

  // Track daily stats only (no hard limit)
  if (Number(state.lastNukeDay) !== today) {
    state.nukesLaunchedToday = 0;
    state.lastNukeDay = today;
  }

  const owned = Number(state.nukesOwned ?? 0);
  if (owned < 1) return { ok: false, reason: "no_nukes_owned" };

  // Load target
  const nationRes = await sql`
    SELECT id, name, tag, leader_id, is_default,
           last_nuke_launched_at, last_nuke_received_at,
           is_protected, protection_expires_at
    FROM nations
    WHERE id = ${targetNationId}
    LIMIT 1
  `;
  const nation = nationRes.rows[0];
  if (!nation) return { ok: false, reason: "nation_not_found" };

  // Cannot nuke your own nation
  const myMembership = await sql`
    SELECT nation_id FROM nation_members WHERE user_id = ${userId} LIMIT 1
  `;
  if (
    myMembership.rows[0] &&
    Number(myMembership.rows[0].nation_id) === targetNationId
  ) {
    return { ok: false, reason: "cannot_nuke_own_nation" };
  }

  // ── Phase 1: 24h economic protection ─────────────────────────
  const protectedNow = await isNationProtected(targetNationId);
  if (protectedNow) {
    return { ok: false, reason: "nation_protected" };
  }

  // Short post-strike protection (existing 6 min window)
  if (nation.last_nuke_received_at) {
    const lastReceived = new Date(
      String(nation.last_nuke_received_at),
    ).getTime();
    if (now - lastReceived < NUKE_PROTECTION_MS) {
      return { ok: false, reason: "recently_nuked" };
    }
  }

  // Peaceful check
  const lastLaunched = nation.last_nuke_launched_at
    ? new Date(nation.last_nuke_launched_at as string).getTime()
    : 0;
  const wasPeaceful =
    !lastLaunched ||
    now - lastLaunched > PEACEFUL_DAYS * 24 * 60 * 60 * 1000;

  // Consume the nuke
  state.nukesOwned = owned - 1;
  state.nukesLaunchedToday = Number(state.nukesLaunchedToday ?? 0) + 1;
  state.totalNukesLaunched = Number(state.totalNukesLaunched ?? 0) + 1;
  state.lastNukeTargetId = targetNationId;
  state.nukesUsedToday = state.nukesLaunchedToday; // deprecated field kept in sync

  const becameTerrorist =
    !state.isTerrorist && state.totalNukesLaunched >= TERRORIST_THRESHOLD;
  if (becameTerrorist) {
    state.isTerrorist = true;
    try {
      await sql`UPDATE users SET is_terrorist = TRUE WHERE id = ${userId}`;
    } catch {
      // column may not exist yet — ignore
    }
  }

  // Rewards
  const base = wasPeaceful ? NUKE_REWARDS.peaceful : NUKE_REWARDS.normal;
  const mult = state.isTerrorist ? NUKE_REWARDS.terroristPenaltyMult : 1;

  const glory = Math.floor(base.glory * mult);
  const energy = Math.floor(base.energy * mult);
  const tokens = +(base.tokens * mult).toFixed(3);

  state.glory = Number(state.glory) + glory;
  state.energy = Math.min(MAX_ENERGY, Number(state.energy) + energy);
  state.wardogTokens = addTokens(state.wardogTokens, tokens / 2);
  state.warcatTokens = addTokens(state.warcatTokens, tokens / 2);

  // Transfer full value into the target nation's vault
  const half = NUKE_TRANSFER_VALUE / 2;
  await sql`
    UPDATE nations
    SET vault_wardog          = vault_wardog + ${half},
        vault_warcat          = vault_warcat + ${half},
        last_nuke_received_at = NOW(),
        total_glory           = GREATEST(0, total_glory - 150)
    WHERE id = ${targetNationId}
  `;

  // Mark the attacker's nation as aggressive
  if (myMembership.rows[0]?.nation_id) {
    await sql`
      UPDATE nations
      SET last_nuke_launched_at = NOW()
      WHERE id = ${Number(myMembership.rows[0].nation_id)}
    `;
  }

  await writeProgress(userId, state, {
    touchSyncClock: false,
    gloryDelta: glory,
  });

  // History log
  try {
    await sql`
      INSERT INTO nation_history (nation_id, user_id, event, details)
      VALUES (
        ${targetNationId},
        ${userId},
        ${"nuked"},
        ${JSON.stringify({
          byUserId: userId,
          wasPeaceful,
          transferred: NUKE_TRANSFER_VALUE,
          becameTerrorist,
        })}::jsonb
      )
    `;
  } catch {
    // table/column variance — non-fatal
  }

  // ── Public group announcement ─────────────────────────────────────
  try {
    const attackerRes = await sql`
      SELECT username, first_name FROM users WHERE id = ${userId} LIMIT 1
    `;
    const a = attackerRes.rows[0];
    const attackerLabel = a?.username
      ? `@${a.username}`
      : (a?.first_name as string) || `Commander #${userId}`;

    const targetLabel = String(nation.name);
    const tag = nation.tag ? ` [${nation.tag}]` : "";

    const msg =
      `☢️ <b>STRATEGIC NUKE LAUNCHED</b> ☢️\n\n` +
      `${attackerLabel} just glassed <b>${targetLabel}${tag}</b>\n` +
      `⭐ +${glory.toLocaleString()} Glory · ⚡ +${energy} Energy\n` +
      (wasPeaceful ? `🕊️ Target was peaceful\n` : "") +
      (becameTerrorist ? `☠️ Attacker is now a TERRORIST\n` : "") +
      `\nThe pack is hungry. Your country could be next.\n` +
      `Merge. Build. Conquer. Feed the Pack 🔥`;

    announceToGroup(msg);
  } catch {
    /* non-fatal */
  }

  return {
    ok: true,
    state,
    glory,
    energy,
    tokens,
    transferred: NUKE_TRANSFER_VALUE,
    wasPeaceful,
    becameTerrorist,
    targetName: String(nation.name),
  };
}

/**
 * @deprecated – old free personal nuke.
 * Kept so old clients don't crash. Always returns an error.
 */
export async function serverUseNuke(_userId: number) {
  return { ok: false as const, reason: "deprecated_use_launchNuke" };
}
